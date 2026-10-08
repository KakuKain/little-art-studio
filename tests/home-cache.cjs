const assert = require("node:assert/strict"),
  vm = require("node:vm"),
  fs = require("node:fs");
const root = "https://example.com/little-art-studio/",
  handlers = {},
  stores = new Map();
let calls = 0,
  offline = false,
  context;
const normalize = (r) => new URL(typeof r === "string" ? r : r.url, root).href;
class LocalRequest extends Request {
  constructor(url, options) {
    super(new URL(url, root), options);
  }
}
function store(name) {
  if (!stores.has(name)) {
    const entries = new Map();
    stores.set(name, {
      entries,
      match: async (r) => entries.get(normalize(r))?.clone(),
      put: async (r, v) => entries.set(normalize(r), v.clone()),
      keys: async () => [...entries.keys()].map((url) => new LocalRequest(url)),
      addAll: async (files) => {
        for (const file of files) {
          const value = await context.fetch(file);
          entries.set(normalize(file), value);
        }
      },
    });
  }
  return stores.get(name);
}
const environment = {
  self: {
    location: { href: root + "sw.js" },
    addEventListener: (n, f) => (handlers[n] = f),
    skipWaiting: () => {},
    clients: { claim: async () => {} },
  },
  URL,
  Request: LocalRequest,
  Response,
  AbortController,
  setTimeout,
  clearTimeout,
  caches: {
    open: async (name) => store(name),
    keys: async () => [...stores.keys()],
    delete: async (name) => stores.delete(name),
  },
  fetch: async () => {
    calls++;
    if (offline) throw Error("offline");
    return new Response("network", { status: 200 });
  },
  importScripts: () =>
    vm.runInContext(fs.readFileSync("offline-shell.js", "utf8"), context),
};
context = vm.createContext(environment);
vm.runInContext(fs.readFileSync("sw.js", "utf8"), context);
async function request(path, mode = "cors") {
  let result;
  const pending = [];
  handlers.fetch({
    request: { method: "GET", url: new URL(path, root).href, mode },
    respondWith: (r) => (result = r),
    waitUntil: (p) => pending.push(p),
  });
  const value = await result;
  await Promise.all(pending);
  return value;
}
(async () => {
  let job;
  handlers.install({ waitUntil: (p) => (job = p) });
  await job;
  const prepared = "assets/coloring/prepared/kitty.json?rev=stable";
  await request(prepared);
  const before = calls;
  offline = true;
  assert.equal(await (await request(prepared)).text(), "network");
  assert.equal(calls, before);
  await assert.rejects(request("assets/coloring/prepared/rabbit.json?rev=new"));
  assert.equal(
    await (await request("", "navigate")).text(),
    "network",
    "offline shell must be available",
  );
  const legacy = store("little-art-v44");
  await legacy.put(
    root + "assets/coloring/kitty.svg?v=44",
    new Response("legacy-art"),
  );
  store("unrelated-app");
  store("little-art-studio-shell-v1");
  handlers.activate({ waitUntil: (p) => (job = p) });
  await job;
  assert.equal(
    await (
      await store("little-art-studio-art-v1").match(
        root + "assets/coloring/kitty.svg?v=44",
      )
    ).text(),
    "legacy-art",
  );
  assert.ok(stores.has("unrelated-app"), "must not delete other apps caches");
  assert.ok(
    !stores.has("little-art-studio-shell-v1"),
    "retire only our old shells",
  );
  assert.equal(
    await (await request(prepared)).text(),
    "network",
    "art survives shell activation",
  );
  offline = false;
  const navBefore = calls;
  await request("", "navigate");
  assert.equal(calls, navBefore + 1);
  const files = vm.runInContext("SHELL_FILES", context);
  assert.ok(files.some((f) => f.includes("modules/storage.js")));
  assert.ok(
    !files.some((f) => f.includes("/prepared/")),
    "shell install must not download every coloring sheet",
  );
  console.log(
    "PASS lean module shell, cache hits, offline navigation, old artwork preservation and scoped cleanup",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
