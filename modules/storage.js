import { createWork, validWork } from "./history.js?v=48";

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
// The album reads a small summary stored beside each work, so opening it does
// not load every stroke and checkpoint into memory.
const SUMMARY = "summary:";
function summarize(work) {
  return {
    id: work.id,
    scene: work.scene,
    updatedAt: work.updatedAt,
    preview: work.preview || null,
    hasContent: !!(
      work.preview ||
      work.actions.length ||
      work.base.pixels ||
      work.base.fills.some(([, color]) => color !== "white")
    ),
  };
}
function closedError() {
  const error = new Error("畫室已在其他分頁更新，回到首頁會重新整理");
  error.code = "storage-closed";
  return error;
}
export async function openStudio(
  indexed = indexedDB,
  { timeoutMs = 3000, onClose = () => {} } = {},
) {
  const db = await new Promise((resolve, reject) => {
    let settled = false;
    function fail(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    }
    function unavailable(code) {
      const error = new Error("儲存尚未就緒，請關閉其他畫室分頁後重新整理");
      error.code = code;
      return error;
    }
    // A queued upgrade may never emit onblocked if another open request already
    // waits for an old tab. Keep the interface usable, and close late connections.
    const timer = setTimeout(
      () => fail(unavailable("storage-timeout")),
      timeoutMs,
    );
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
    req.onsuccess = () => {
      if (settled) {
        req.result.close();
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(req.result);
    };
    req.onerror = () => fail(req.error);
    req.onblocked = () => fail(unavailable("storage-blocked"));
  });
  let closed = false;
  // Another tab is upgrading the database. Release it, and fail later requests
  // with a code the interface can explain instead of reporting a full disk.
  db.onversionchange = () => {
    closed = true;
    db.close();
    onClose();
  };
  const run = (store, mode, action) =>
    closed
      ? Promise.reject(closedError())
      : transaction(db, store, mode, action);
  const get = (store, key) => run(store, "readonly", (s) => s.get(key));
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
      if (closed) throw closedError();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(["state", "works"], "readwrite");
        tx.objectStore("works").put(work);
        tx.objectStore("state").put(work.id, "activeId");
        tx.objectStore("state").put(summarize(work), SUMMARY + work.id);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    },
    async forScene(scene) {
      const all = await run("works", "readonly", (s) =>
        s.index("scene").getAll(scene),
      );
      return (
        all.filter(validWork).sort((a, b) => b.updatedAt - a.updatedAt)[0] ||
        null
      );
    },
    get: (id) => get("works", id),
    async list() {
      const ids = new Set(
        await run("works", "readonly", (s) => s.getAllKeys()),
      );
      const summaries = (
        await run("state", "readonly", (s) =>
          s.getAll(IDBKeyRange.bound(SUMMARY, SUMMARY + "\uffff")),
        )
      ).filter((summary) => ids.has(summary.id));
      const known = new Set(summaries.map((summary) => summary.id));
      // Works saved before summaries existed are summarized once.
      for (const id of ids) {
        if (known.has(id)) continue;
        const work = await get("works", id);
        if (!validWork(work)) continue;
        const summary = summarize(work);
        await run("state", "readwrite", (s) => s.put(summary, SUMMARY + id));
        summaries.push(summary);
      }
      const legacy = await run("art", "readonly", (s) => s.getAll());
      return [
        ...summaries.map((summary) => ({ ...summary, editable: true })),
        ...legacy.map((art) => ({
          ...art,
          updatedAt: art.id,
          editable: false,
        })),
      ].sort((a, b) => b.updatedAt - a.updatedAt);
    },
    get closed() {
      return closed;
    },
    close: () => db.close(),
  };
  return studio;
}
