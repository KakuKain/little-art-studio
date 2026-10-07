import { createWork, validWork } from "./history.js?v=45";

function transaction(db, store, mode, action) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode),
      req = action(tx.objectStore(store));
    let result;
    req.onsuccess = () => (result = req.result);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
export async function openStudio(indexed = indexedDB) {
  const db = await new Promise((resolve, reject) => {
    const req = indexed.open("little-art-studio", 2);
    req.onupgradeneeded = () => {
      for (const name of ["state", "art", "works"])
        if (!req.result.objectStoreNames.contains(name)) {
          req.result.createObjectStore(
            name,
            name === "state" ? undefined : { keyPath: "id" },
          );
        }
      const works = req.transaction.objectStore("works");
      if (!works.indexNames.contains("scene"))
        works.createIndex("scene", "scene");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () =>
      reject(new Error("請關閉其他舊版畫室分頁，再重新整理"));
  });
  db.onversionchange = () => db.close();
  const get = (store, key) =>
    transaction(db, store, "readonly", (s) => s.get(key));
  const studio = {
    async active() {
      const id = await get("state", "activeId");
      const current = id && (await get("works", id));
      if (validWork(current)) return current;
      const legacy = await get("state", "current");
      if (
        legacy &&
        typeof legacy.scene === "string" &&
        Array.isArray(legacy.fills)
      ) {
        const migrated = createWork(legacy.scene, legacy);
        if (
          typeof legacy.pixels === "string" &&
          legacy.pixels.startsWith("data:image/png;base64,")
        ) {
          const binary = atob(legacy.pixels.split(",")[1]);
          migrated.base = {
            ...legacy,
            pixels: new Blob(
              [Uint8Array.from(binary, (c) => c.charCodeAt(0))],
              { type: "image/png" },
            ),
          };
        }
        await studio.save(migrated);
        // Keep the original current record and all legacy PNGs as migration backups.
        return migrated;
      }
      return null;
    },
    async save(work) {
      if (!validWork(work)) throw new Error("Invalid editable work");
      return new Promise((resolve, reject) => {
        const tx = db.transaction(["state", "works"], "readwrite");
        tx.objectStore("works").put(work);
        tx.objectStore("state").put(work.id, "activeId");
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    },
    async forScene(scene) {
      const all = await transaction(db, "works", "readonly", (s) =>
        s.index("scene").getAll(scene),
      );
      return (
        all.filter(validWork).sort((a, b) => b.updatedAt - a.updatedAt)[0] ||
        null
      );
    },
    get: (id) => get("works", id),
    async list() {
      const works = await transaction(db, "works", "readonly", (s) =>
        s.getAll(),
      );
      const legacy = await transaction(db, "art", "readonly", (s) =>
        s.getAll(),
      );
      return [
        ...works.filter(validWork).map((work) => ({ ...work, editable: true })),
        ...legacy.map((art) => ({
          ...art,
          updatedAt: art.id,
          editable: false,
        })),
      ].sort((a, b) => b.updatedAt - a.updatedAt);
    },
    close: () => db.close(),
  };
  return studio;
}
