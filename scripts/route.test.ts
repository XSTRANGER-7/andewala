/* Unit tests for delivery route planning (src/lib/route.ts). Run: npm run test:route */
import { test } from "node:test";
import assert from "node:assert/strict";
import { EXACT_LIMIT, heldKarp, improve, nearestNeighbour, pathLength, planRoute, straightLineMatrix, type Matrix } from "../src/lib/route";

// small deterministic random generator
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
const randomPoints = (n: number, seed: number) => {
  const r = rng(seed);
  return Array.from({ length: n + 1 }, () => ({ lat: 28.6 + r() * 0.1, lng: 77.2 + r() * 0.1 }));
};
function bruteForce(m: Matrix): number {
  const stops = Array.from({ length: m.length - 1 }, (_, i) => i + 1);
  let best = Infinity;
  const perm = (arr: number[], k: number) => {
    if (k === arr.length) return void (best = Math.min(best, pathLength(m, arr)));
    for (let i = k; i < arr.length; i++) {
      [arr[k], arr[i]] = [arr[i], arr[k]];
      perm(arr, k + 1);
      [arr[k], arr[i]] = [arr[i], arr[k]];
    }
  };
  perm(stops, 0);
  return best;
}
const isPermutation = (order: number[], n: number) => order.length === n && new Set(order).size === n && order.every((s) => s >= 1 && s <= n);

test("no stops and one stop", () => {
  assert.deepEqual(planRoute([[0]]).order, []);
  const m = straightLineMatrix(randomPoints(1, 1));
  assert.deepEqual(planRoute(m).order, [1]);
});

test("stops along a line are visited in order outward", () => {
  const pts = [{ lat: 28.6, lng: 77.2 }, ...[3, 1, 4, 2].map((k) => ({ lat: 28.6 + k * 0.01, lng: 77.2 }))];
  const plan = planRoute(straightLineMatrix(pts));
  assert.deepEqual(plan.order.map((i) => pts[i].lat), [28.61, 28.62, 28.63, 28.64].map((x) => +x.toFixed(2)).map((x) => pts.find((p) => +p.lat.toFixed(2) === x)!.lat));
});

test("exact solver matches brute force (2–8 stops, 30 random cases)", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const n = 2 + (seed % 7);
    const m = straightLineMatrix(randomPoints(n, seed));
    const order = heldKarp(m);
    assert.ok(isPermutation(order, n));
    assert.ok(Math.abs(pathLength(m, order) - bruteForce(m)) < 1e-6, `seed ${seed}`);
  }
});

test("exact solver handles one-way (asymmetric) distances", () => {
  const r = rng(99);
  const n = 7;
  const m: Matrix = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === j ? 0 : 100 + Math.floor(r() * 900))));
  assert.ok(Math.abs(pathLength(m, heldKarp(m)) - bruteForce(m)) < 1e-6);
});

test("planRoute is exact up to the limit and never worse than nearest-neighbour above it", () => {
  const small = straightLineMatrix(randomPoints(EXACT_LIMIT, 7));
  assert.equal(planRoute(small).exact, true);
  for (let seed = 1; seed <= 10; seed++) {
    const n = 15 + seed * 2;
    const m = straightLineMatrix(randomPoints(n, seed * 13));
    const plan = planRoute(m);
    assert.equal(plan.exact, false);
    assert.ok(isPermutation(plan.order, n));
    assert.ok(plan.total <= pathLength(m, nearestNeighbour(m)) + 1e-6);
  }
});

test("heuristic stays close to the true best (within 5% on 12-stop cases)", () => {
  let worst = 0;
  for (let seed = 1; seed <= 15; seed++) {
    const m = straightLineMatrix(randomPoints(12, seed * 31));
    const exact = pathLength(m, heldKarp(m));
    const heur = pathLength(m, improve(m, nearestNeighbour(m)));
    worst = Math.max(worst, heur / exact - 1);
  }
  assert.ok(worst <= 0.05, `worst gap ${(worst * 100).toFixed(1)}%`);
});

test("improve fixes a crossed route", () => {
  // square: start at corner, visiting diagonals crosses itself
  const pts = [{ lat: 0, lng: 0 }, { lat: 0, lng: 0.01 }, { lat: 0.01, lng: 0 }, { lat: 0.01, lng: 0.01 }];
  const m = straightLineMatrix(pts);
  const crossed = [1, 2, 3];
  const fixed = improve(m, crossed);
  assert.ok(pathLength(m, fixed) < pathLength(m, crossed));
});
