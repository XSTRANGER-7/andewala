/**
 * Delivery route planning: in which order should the rider visit the stops so
 * the total distance (and petrol) is smallest?
 *
 * This is the "open" travelling-salesman problem: start at the rider, visit
 * every stop once, no need to come back.
 * - Up to EXACT_LIMIT stops: Held-Karp dynamic programming, which is exact
 *   (the shortest possible order), and still instant at this size.
 * - More stops: nearest-neighbour to start, then 2-opt (reverse a stretch of
 *   the route) and Or-opt (move 1–3 stops elsewhere) until nothing improves.
 *   These usually land within a few percent of the best order.
 *
 * Distances come in as a matrix (index 0 = the rider, 1..n = stops), so road
 * distances from a routing service and straight-line distances both work, even
 * when A→B and B→A differ (one-way streets).
 */
import { distanceMeters, type LatLng } from "./geo";

export type Matrix = number[][];
export type RoutePlan = { order: number[]; total: number; exact: boolean };

export const EXACT_LIMIT = 12;

/** Length of start → order[0] → order[1] → … */
export function pathLength(m: Matrix, order: number[]): number {
  let total = 0;
  let prev = 0;
  for (const s of order) {
    total += m[prev][s];
    prev = s;
  }
  return total;
}

/** Straight-line distances between points (index 0 = start). */
export function straightLineMatrix(points: LatLng[]): Matrix {
  return points.map((a) => points.map((b) => distanceMeters(a, b)));
}

/** Best visiting order of stops 1..n, starting from 0. */
export function planRoute(m: Matrix): RoutePlan {
  const n = m.length - 1;
  if (n <= 0) return { order: [], total: 0, exact: true };
  if (n === 1) return { order: [1], total: m[0][1], exact: true };
  if (n <= EXACT_LIMIT) {
    const order = heldKarp(m);
    return { order, total: pathLength(m, order), exact: true };
  }
  const order = improve(m, nearestNeighbour(m));
  return { order, total: pathLength(m, order), exact: false };
}

/** Exact: dp[set][last] = shortest path from the start covering `set`, ending at `last`. */
export function heldKarp(m: Matrix): number[] {
  const n = m.length - 1;
  const full = (1 << n) - 1;
  const dp = new Float64Array((1 << n) * n).fill(Infinity);
  const parent = new Int8Array((1 << n) * n).fill(-1);
  for (let j = 0; j < n; j++) dp[(1 << j) * n + j] = m[0][j + 1];
  for (let mask = 1; mask <= full; mask++) {
    for (let j = 0; j < n; j++) {
      if (!(mask & (1 << j))) continue;
      const cur = dp[mask * n + j];
      if (cur === Infinity) continue;
      for (let k = 0; k < n; k++) {
        if (mask & (1 << k)) continue;
        const next = mask | (1 << k);
        const cand = cur + m[j + 1][k + 1];
        if (cand < dp[next * n + k]) {
          dp[next * n + k] = cand;
          parent[next * n + k] = j;
        }
      }
    }
  }
  let last = 0;
  for (let j = 1; j < n; j++) if (dp[full * n + j] < dp[full * n + last]) last = j;
  const order: number[] = [];
  let mask = full;
  while (last !== -1) {
    order.push(last + 1);
    const p = parent[mask * n + last];
    mask &= ~(1 << last);
    last = p;
  }
  return order.reverse();
}

/** Greedy: always go to the closest stop not yet visited. */
export function nearestNeighbour(m: Matrix): number[] {
  const n = m.length - 1;
  const left = new Set(Array.from({ length: n }, (_, i) => i + 1));
  const order: number[] = [];
  let cur = 0;
  while (left.size) {
    let best = -1;
    for (const s of left) if (best === -1 || m[cur][s] < m[cur][best]) best = s;
    order.push(best);
    left.delete(best);
    cur = best;
  }
  return order;
}

/** 2-opt and Or-opt passes until the route stops getting shorter. */
export function improve(m: Matrix, start: number[]): number[] {
  let order = start.slice();
  let best = pathLength(m, order);
  const EPS = 1e-9;
  for (let pass = 0; pass < 50; pass++) {
    let changed = false;
    // 2-opt: reverse order[i..k]
    for (let i = 0; i < order.length - 1; i++) {
      for (let k = i + 1; k < order.length; k++) {
        const cand = order.slice(0, i).concat(order.slice(i, k + 1).reverse(), order.slice(k + 1));
        const len = pathLength(m, cand);
        if (len < best - EPS) {
          order = cand;
          best = len;
          changed = true;
        }
      }
    }
    // Or-opt: move a run of 1–3 stops to another position
    for (let size = 1; size <= 3; size++) {
      for (let i = 0; i + size <= order.length; i++) {
        const seg = order.slice(i, i + size);
        const rest = order.slice(0, i).concat(order.slice(i + size));
        for (let j = 0; j <= rest.length; j++) {
          if (j === i) continue;
          const cand = rest.slice(0, j).concat(seg, rest.slice(j));
          const len = pathLength(m, cand);
          if (len < best - EPS) {
            order = cand;
            best = len;
            changed = true;
          }
        }
      }
    }
    if (!changed) break;
  }
  return order;
}
