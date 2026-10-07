export const UNDO_LIMIT = 20;
export function createWork(scene, base = { scene, fills: [], pixels: null }) {
  return {
    schemaVersion: 2,
    id: crypto.randomUUID(),
    scene,
    base,
    actions: [],
    cursor: 0,
    revision: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
export function record(work, action) {
  work.actions.splice(work.cursor);
  work.checkpoints = (work.checkpoints || []).filter(
    (c) => c.cursor <= work.cursor,
  );
  work.actions.push(action);
  work.cursor++;
  work.revision++;
  work.updatedAt = Date.now();
}
export function canUndo(work) {
  return !!work && work.cursor > Math.max(0, work.actions.length - UNDO_LIMIT);
}
export function canRedo(work) {
  return !!work && work.cursor < work.actions.length;
}
export function moveCursor(work, direction) {
  if (direction < 0 ? !canUndo(work) : !canRedo(work)) return false;
  work.cursor += direction;
  work.revision++;
  work.updatedAt = Date.now();
  return true;
}
export function validWork(work) {
  return (
    work?.schemaVersion === 2 &&
    typeof work.id === "string" &&
    typeof work.scene === "string" &&
    Array.isArray(work.base?.fills) &&
    Array.isArray(work.actions) &&
    Number.isInteger(work.cursor) &&
    work.cursor >= 0 &&
    work.cursor <= work.actions.length
  );
}
export function replayStart(work) {
  const checkpoint = (work.checkpoints || [])
    .filter((c) => c.cursor <= work.cursor)
    .sort((a, b) => b.cursor - a.cursor)[0];
  return checkpoint || { cursor: 0, state: work.base };
}
export function addCheckpoint(work, state) {
  work.checkpoints = [
    ...(work.checkpoints || []).filter((c) => c.cursor < work.cursor),
    { cursor: work.cursor, state },
  ].slice(-2);
  // Once earlier actions cannot be undone, compact them into a single Blob base.
  // Keep the complete 20-step undo window and every current redo action.
  if (work.cursor === work.actions.length && work.cursor >= 40) {
    const anchor = work.checkpoints.find(
      (c) => c.cursor <= work.cursor - UNDO_LIMIT,
    );
    if (anchor) {
      work.base = anchor.state;
      work.actions.splice(0, anchor.cursor);
      work.cursor -= anchor.cursor;
      work.checkpoints = work.checkpoints
        .filter((c) => c.cursor > anchor.cursor)
        .map((c) => ({ cursor: c.cursor - anchor.cursor, state: c.state }));
    }
  }
}
