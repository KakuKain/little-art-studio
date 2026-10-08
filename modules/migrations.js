// Saved fill states name regions by the artwork generation that wrote them.
// `assetVersion` first appeared in v12, so a state without it is the oldest
// format. Checkpoints written by this release use FILL_VERSION.
export const FILL_VERSION = 44;
export function fillVersion(state) {
  return state?.assetVersion ?? 0;
}

// v43 merged these simplified costumes into one fill group.
const MERGED_COSTUMES = {
  "anna-simple": ["cell20", "cape"],
  "elsa-simple": ["cell36", "dress"],
  "moana-simple": ["cell30", "skirt"],
};

// Translates a saved fill state into paint operations for the current sheet.
// `previous` holds the sheet's data-previous-region values (IDs before v32).
// Each operation targets one of:
//   { by: "region", id }   → the first [data-region="id"]
//   { by: "previous", id } → every [data-previous-region="id"]
//   { by: "group", id }    → every [data-fill-group="id"]
export function fillOperations(state, scene, { previous = new Set() } = {}) {
  const version = fillVersion(state),
    operations = [];
  for (const [id, color] of state.fills) {
    if (version < 32 && previous.has(id))
      operations.push({ by: "previous", id, color });
    // A renumbered sheet must not color whichever part now owns an old ID.
    else if (version >= 32 || !previous.size || id === "sky")
      operations.push({ by: "region", id, color });
  }
  const merged = version < 43 && MERGED_COSTUMES[scene];
  const costume = merged && state.fills.find(([id]) => id === merged[0]);
  if (costume)
    operations.push({ by: "group", id: merged[1], color: costume[1] });
  if (scene === "belle-simple" && version < 37) {
    const rose = state.fills.find(([id]) => id === "simple-rose");
    if (rose) operations.push({ by: "group", id: "rose", color: rose[1] });
  }
  return operations;
}
