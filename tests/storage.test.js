import test from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import { openStudio } from "../modules/storage.js";
import { createWork, record } from "../modules/history.js";
function legacyDB(indexed) {
  return new Promise((resolve, reject) => {
    const request = indexed.open("little-art-studio", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("state");
      request.result.createObjectStore("art", { keyPath: "id" });
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result,
        tx = db.transaction(["state", "art"], "readwrite");
      tx.objectStore("state").put(
        {
          scene: "anna-simple",
          assetVersion: 44,
          fills: [["simple-cape", "pink"]],
          pixels: "data:image/png;base64,YQ==",
        },
        "current",
      );
      tx.objectStore("art").put({ id: 123, image: "legacy-png" });
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
    };
  });
}
test("v1 draft migration is idempotent and preserves legacy album", async () => {
  const indexed = new IDBFactory();
  await legacyDB(indexed);
  let studio = await openStudio(indexed),
    work = await studio.active();
  assert.equal(work.scene, "anna-simple");
  assert.deepEqual(work.base.fills, [["simple-cape", "pink"]]);
  assert.ok(work.base.pixels instanceof Blob);
  const id = work.id;
  studio.close();
  studio = await openStudio(indexed);
  assert.equal((await studio.active()).id, id);
  assert.ok(
    (await studio.list()).some((i) => i.id === 123 && i.image === "legacy-png"),
  );
  studio.close();
});
test("editable documents and undo cursor survive reopening without album duplicates", async () => {
  const indexed = new IDBFactory();
  let studio = await openStudio(indexed);
  const a = createWork("anna-simple"),
    b = createWork("kitty");
  record(a, {
    type: "stroke",
    tool: "pen",
    region: "group:cape",
    width: 6,
    points: [
      [1, 2],
      [3, 4],
    ],
  });
  a.preview = new Blob(["thumbnail"]);
  await studio.save(a);
  await studio.save(a);
  await studio.save(b);
  studio.close();
  studio = await openStudio(indexed);
  assert.equal((await studio.active()).scene, "kitty");
  assert.equal((await studio.forScene("anna-simple")).cursor, 1);
  assert.equal((await studio.list()).length, 2);
  assert.equal((await studio.get(a.id)).actions[0].points.length, 2);
  studio.close();
});
test("blocked upgrades report recovery and close a late connection without losing the draft", async () => {
  const indexed = new IDBFactory();
  await legacyDB(indexed);
  const old = await new Promise((resolve) => {
    const request = indexed.open("little-art-studio", 1);
    request.onsuccess = () => resolve(request.result);
  });
  let pending;
  await assert.rejects(
    openStudio({
      open(...args) {
        pending = indexed.open(...args);
        return pending;
      },
    }),
    (error) =>
      error.code === "storage-blocked" && /重新整理/.test(error.message),
  );
  const closed = new Promise((resolve) =>
    pending.addEventListener("success", resolve),
  );
  old.close();
  await closed;
  assert.throws(() => pending.result.transaction("state"), {
    name: "InvalidStateError",
  });
  const recovered = await openStudio(indexed);
  assert.equal((await recovered.active()).scene, "anna-simple");
  assert.ok((await recovered.list()).some((art) => art.id === 123));
  recovered.close();
});
test("an open request stuck behind another upgrade cannot block startup indefinitely", async () => {
  const request = {
    result: {
      close() {
        this.closed = true;
      },
    },
  };
  await assert.rejects(
    openStudio({ open: () => request }, { timeoutMs: 10 }),
    (error) => error.code === "storage-timeout",
  );
  request.onsuccess();
  assert.equal(request.result.closed, true);
});
