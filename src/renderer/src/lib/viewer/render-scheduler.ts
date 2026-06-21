// Concurrency-limited render scheduler.
// Prevents simultaneous tile renders from flooding the pdfjs worker thread.
const MAX_CONCURRENT = 4;

let active = 0;
const queue: Array<() => void> = [];

function drain(): void {
  while (active < MAX_CONCURRENT && queue.length > 0) {
    const fn = queue.shift()!;
    active++;
    fn();
  }
}

/** Schedule an async render task, waiting if MAX_CONCURRENT tasks are already running. */
export function scheduleRender<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push(() => {
      fn()
        .then(resolve, reject)
        .finally(() => {
          active--;
          drain();
        });
    });
    drain();
  });
}

/** Returns current queue depth (useful for diagnostics). */
export function schedulerQueueDepth(): number {
  return queue.length;
}

/** Returns number of tasks currently running. */
export function schedulerActiveCount(): number {
  return active;
}

/** Reset scheduler state — for use in tests only. */
export function resetScheduler(): void {
  active = 0;
  queue.length = 0;
}
