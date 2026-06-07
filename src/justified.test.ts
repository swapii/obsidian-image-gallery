import { test, expect } from "bun:test";
import { computeJustifiedLayout } from "./justified";

// Target row height 200, gap 4 — the values the gallery uses.

test("returns nothing for no images", () => {
  expect(computeJustifiedLayout([], 800, 200, 4)).toEqual([]);
});

test("a single short image sits on its own at the target height", () => {
  // A square at 200px tall is 200px wide — far narrower than 800, so it never fills a
  // row and stays at the target height (last-row behaviour), left-aligned.
  const r = computeJustifiedLayout([1], 800, 200, 4);
  expect(r).toHaveLength(1);
  expect(r[0].height).toBeCloseTo(200);
  expect(r[0].width).toBeCloseTo(200);
});

test("a full row is justified so its edges meet the container width", () => {
  // Four squares: 4*200 + 3*4 = 812 >= 800, so they form one full row, scaled down to fit.
  const r = computeJustifiedLayout([1, 1, 1, 1], 800, 200, 4);
  expect(r).toHaveLength(4);
  const rowSpan = r.reduce((s, it) => s + it.width, 0) + 3 * 4; // widths + inner gaps
  expect(rowSpan).toBeCloseTo(800);
  r.forEach((it) => {
    expect(it.height).toBeCloseTo(197); // (800 - 12) / 4
    expect(it.width).toBeCloseTo(197);
  });
});

test("the last partial row keeps the target height, not stretched", () => {
  // Five squares: first four justify to a full row, the fifth is a leftover.
  const r = computeJustifiedLayout([1, 1, 1, 1, 1], 800, 200, 4);
  expect(r).toHaveLength(5);
  expect(r[0].height).toBeCloseTo(197); // justified row, slightly under target
  expect(r[4].height).toBeCloseTo(200); // last row stays at target
  expect(r[4].width).toBeCloseTo(200);
});

test("a panorama wider than the container scales down to fit", () => {
  // aspect 10 at 200px tall would be 2000px wide; it must shrink to the 800px container.
  const r = computeJustifiedLayout([10], 800, 200, 4);
  expect(r).toHaveLength(1);
  expect(r[0].width).toBeCloseTo(800);
  expect(r[0].height).toBeCloseTo(80); // 800 / 10
});

test("rows never exceed the target height", () => {
  const ratios = [1.5, 0.67, 0.67, 1.5, 1.0, 0.62, 1.5, 0.7];
  const r = computeJustifiedLayout(ratios, 900, 200, 4);
  r.forEach((it) => expect(it.height).toBeLessThanOrEqual(200 + 0.001));
});
