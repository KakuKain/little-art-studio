// Serializes editor work so two replays never overlap.
// - A user task is dropped while another task runs, so a tap never fires late.
// - Undo/redo taps made during an undo/redo join the running replay.
// - A refit requested while busy runs afterwards, until the size settles.
export function createScheduler({
  blocked = () => false,
  onBusy = () => {},
  onError = () => {},
} = {}) {
  let running = null,
    steps = 0,
    refitWanted = false,
    travelHandler = null,
    refitHandler = null;
  async function exclusive(kind, task) {
    running = kind;
    onBusy(true);
    try {
      await task();
    } catch (error) {
      steps = 0;
      onError(error);
    } finally {
      running = null;
      onBusy(false);
    }
  }
  async function drain() {
    while (!running && !blocked()) {
      if (steps && travelHandler) {
        await exclusive("travel", async () => {
          while (steps) {
            const count = steps;
            steps = 0;
            await travelHandler(count);
          }
        });
      } else if (refitWanted && refitHandler) {
        refitWanted = false;
        await exclusive("refit", refitHandler);
      } else return;
    }
  }
  return {
    get busy() {
      return running !== null;
    },
    async run(task) {
      if (running || blocked()) return false;
      steps = 0;
      await exclusive("task", task);
      // A task may have changed the layout (e.g. leaving the home screen).
      refitWanted = true;
      await drain();
      return true;
    },
    travel(direction) {
      if (blocked() || (running && running !== "travel")) return;
      steps += direction;
      return drain();
    },
    refit() {
      refitWanted = true;
      return drain();
    },
    drain,
    onTravel(handler) {
      travelHandler = handler;
    },
    onRefit(handler) {
      refitHandler = handler;
    },
  };
}
