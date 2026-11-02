import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url));
const cut = JSON.parse(read("assets/fonts/playground-round.json"));

// The same files scripts/build-font.py cuts the font for.
test("the rounded font has every character the app shows", () => {
  const files = [
    "index.html",
    "app.js",
    "assets/coloring/catalog.js",
    ...fs
      .readdirSync(new URL("../modules", import.meta.url))
      .filter((f) => f.endsWith(".js"))
      .sort()
      .map((f) => `modules/${f}`),
  ];
  const known = new Set([...cut.characters, ...cut.missing]);
  for (const file of files) {
    const added = [...new Set(read(file).toString())].filter(
      (c) => c.codePointAt(0) >= 0x2000 && !known.has(c),
    );
    assert.deepEqual(
      added,
      [],
      `${file} uses characters the font lacks: run scripts/build-font.py`,
    );
  }
});

test("the font ships in the offline shell under its own name", () => {
  assert.ok(
    read("offline-shell.js").includes(
      '"./assets/fonts/playground-round.woff2"',
    ),
  );
  assert.match(
    read("styles/base.css").toString(),
    /font-family: "Playground Round";\s+src: url\("\.\.\/assets\/fonts\/playground-round\.woff2"\)/,
  );
  // The license reserves the original names for the original font.
  assert.doesNotMatch(read("styles/base.css").toString(), /huninn/i);
});
