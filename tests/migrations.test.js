import test from "node:test";
import assert from "node:assert/strict";
import {
  fillOperations,
  fillVersion,
  FILL_VERSION,
} from "../modules/migrations.js";

test("current states paint their own region IDs", () => {
  const state = {
    assetVersion: FILL_VERSION,
    fills: [
      ["sky", "#fff0bd"],
      ["cell3", "#ff7399"],
    ],
  };
  assert.deepEqual(fillOperations(state, "kitty"), [
    { by: "region", id: "sky", color: "#fff0bd" },
    { by: "region", id: "cell3", color: "#ff7399" },
  ]);
});

test("an unversioned state is the oldest format", () => {
  assert.equal(fillVersion({ fills: [] }), 0);
  assert.deepEqual(fillOperations({ fills: [] }, "belle-simple"), []);
});

test("pre-v32 fills follow renumbered regions and never color an unrelated part", () => {
  const previous = new Set(["body"]);
  const state = {
    assetVersion: 29,
    fills: [
      ["body", "#74b9ed"],
      ["sky", "#ffe16b"],
      ["wing", "#ac8bd8"],
    ],
  };
  assert.deepEqual(
    fillOperations(state, "toothless-sitting-clean", { previous }),
    [
      { by: "previous", id: "body", color: "#74b9ed" },
      { by: "region", id: "sky", color: "#ffe16b" },
    ],
  );
  // Sheets that were never renumbered keep their IDs.
  assert.deepEqual(fillOperations(state, "kitty").length, 3);
  // States from v32 onward already use the new IDs.
  assert.deepEqual(
    fillOperations({ ...state, assetVersion: 32 }, "toothless-sitting-clean", {
      previous,
    }).map((op) => op.by),
    ["region", "region", "region"],
  );
});

test("pre-v43 costume cells move into their merged costume group", () => {
  const state = { assetVersion: 40, fills: [["cell20", "#e95c57"]] };
  assert.deepEqual(fillOperations(state, "anna-simple").at(-1), {
    by: "group",
    id: "cape",
    color: "#e95c57",
  });
  assert.equal(
    fillOperations({ ...state, assetVersion: 43 }, "anna-simple").length,
    1,
  );
  assert.equal(fillOperations(state, "elsa-simple").length, 1);
});

test("pre-v37 Belle roses color the whole enlarged rose", () => {
  const state = { assetVersion: 36, fills: [["simple-rose", "#ff7399"]] };
  assert.deepEqual(fillOperations(state, "belle-simple").at(-1), {
    by: "group",
    id: "rose",
    color: "#ff7399",
  });
  assert.equal(
    fillOperations({ ...state, assetVersion: 37 }, "belle-simple").length,
    1,
  );
});
