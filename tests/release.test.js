import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) =>
  fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const { version } = JSON.parse(read("release.json"));

test("the release version is semantic, with an optional alpha/beta/rc number", () => {
  assert.match(
    version,
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-(alpha|beta|rc)\.[1-9]\d*)?$/,
  );
});

test("npm run build stamped the same version everywhere", () => {
  const lock = JSON.parse(read("package-lock.json"));
  assert.equal(JSON.parse(read("package.json")).version, version);
  assert.equal(lock.version, version);
  assert.equal(lock.packages[""].version, version);
  const html = read("index.html");
  assert.ok(
    html.includes(`<span data-release>v${version}</span>`),
    "about dialog shows the version",
  );
  for (const [, stamped] of html.matchAll(/\?v=([0-9A-Za-z.-]+)/g))
    assert.equal(stamped, version);
  for (const file of [
    "app.js",
    ...fs
      .readdirSync(new URL("../modules", import.meta.url))
      .map((f) => `modules/${f}`),
  ])
    for (const [, stamped] of read(file).matchAll(
      /from "\.{1,2}\/[^"?]+\.js\?v=([^"]+)"/g,
    ))
      assert.equal(stamped, version, `${file} imports ?v=${stamped}`);
  assert.ok(
    read("offline-shell.js").includes(
      `const SHELL_VERSION=${JSON.stringify(version)};`,
    ),
  );
});
