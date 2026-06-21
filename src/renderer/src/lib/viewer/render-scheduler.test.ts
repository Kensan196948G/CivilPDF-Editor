import { describe, it, expect, beforeEach } from "vitest";
import {
  scheduleRender,
  schedulerActiveCount,
  resetScheduler,
} from "./render-scheduler";

beforeEach(() => {
  resetScheduler();
});

describe("scheduleRender", () => {
  it("resolves the return value of the supplied function", async () => {
    const result = await scheduleRender(() => Promise.resolve(42));
    expect(result).toBe(42);
  });

  it("rejects when the supplied function throws", async () => {
    await expect(
      scheduleRender(() => Promise.reject(new Error("boom"))),
    ).rejects.toThrow("boom");
  });

  it("runs at most 4 tasks simultaneously", async () => {
    let peakActive = 0;
    const tasks = Array.from({ length: 8 }, (_, i) =>
      scheduleRender(async () => {
        peakActive = Math.max(peakActive, schedulerActiveCount());
        await Promise.resolve();
        return i;
      }),
    );
    const results = await Promise.all(tasks);
    expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(peakActive).toBeLessThanOrEqual(4);
  });

  it("active count returns to 0 after all tasks complete", async () => {
    await Promise.all([
      scheduleRender(() => Promise.resolve(1)),
      scheduleRender(() => Promise.resolve(2)),
    ]);
    expect(schedulerActiveCount()).toBe(0);
  });
});
