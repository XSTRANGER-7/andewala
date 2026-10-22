/* Unit tests for delivery-area coverage (src/lib/zones.ts). Run: npm run test:zones */
import { test } from "node:test";
import assert from "node:assert/strict";
import { coverageAt, distanceOutsideM, isCovered, NEAR_EDGE_M, pointInPolygon, zonesAt, type Coverage, type Zone } from "../src/lib/zones";

const M_PER_DEG_LAT = (6_371_000 * Math.PI) / 180; // matches distanceMeters' earth radius
const north = (p: { lat: number; lng: number }, m: number) => ({ lat: p.lat + m / M_PER_DEG_LAT, lng: p.lng });
const east = (p: { lat: number; lng: number }, m: number) => ({ lat: p.lat, lng: p.lng + m / (M_PER_DEG_LAT * Math.cos((p.lat * Math.PI) / 180)) });

const HUB1 = { lat: 28.6315, lng: 77.2167 };
const HUB2 = { lat: 28.645, lng: 77.24 };
const circle = (id: string, center: { lat: number; lng: number }, radiusM: number, active = true): Zone => ({ id, name: id, kind: "circle", center, radiusM, points: [], active, color: "#000000" });
// ~1 km square near Saket
const SQ0 = { lat: 28.52, lng: 77.2 };
const square: Zone = {
  id: "square",
  name: "square",
  kind: "polygon",
  center: null,
  radiusM: null,
  points: [SQ0, north(SQ0, 1000), east(north(SQ0, 1000), 1000), east(SQ0, 1000)],
  active: true,
  color: "#000000",
};
const cov = (zones: Zone[], pincodes: string[] = []): Coverage => ({ zones, pincodes });
const two = cov([circle("Hub 1", HUB1, 2000), circle("Hub 2", HUB2, 2000), square]);

test("inside a circle", () => {
  const r = coverageAt(two, north(HUB1, 1999));
  assert.equal(r.status, "inside");
  assert.equal(isCovered(two, north(HUB1, 1999)), true);
});

test("just outside a circle (within 200 m) is 'near' and deliverable", () => {
  const r = coverageAt(two, { ...east(HUB1, -2150) });
  assert.equal(r.status, "near");
  if (r.status === "near") {
    assert.equal(r.zone.name, "Hub 1");
    assert.ok(Math.abs(r.distanceM - 150) <= 2, `distance ${r.distanceM}`);
  }
  assert.equal(isCovered(two, east(HUB1, -2150)), true);
});

test("exactly at the 200 m limit is near; just past it is outside", () => {
  const at = coverageAt(two, east(HUB1, -(2000 + NEAR_EDGE_M - 1)));
  const past = coverageAt(two, east(HUB1, -(2000 + NEAR_EDGE_M + 5)));
  assert.equal(at.status, "near");
  assert.equal(past.status, "outside");
  assert.equal(isCovered(two, east(HUB1, -(2000 + NEAR_EDGE_M + 5))), false);
});

test("far outside reports the nearest area and the distance", () => {
  const far = east(HUB1, -7000); // 5 km past Hub 1's edge
  const r = coverageAt(two, far);
  assert.equal(r.status, "outside");
  if (r.status === "outside") {
    assert.equal(r.zone?.name, "Hub 1");
    assert.ok(r.distanceM !== null && Math.abs(r.distanceM - 5000) < 10, `distance ${r.distanceM}`);
  }
});

test("overlap of two hubs: inside, nearest hub first", () => {
  const p = { lat: 28.641, lng: 77.234 };
  const hits = zonesAt(two.zones, p);
  assert.deepEqual(hits.map((z) => z.name), ["Hub 2", "Hub 1"]);
  const r = coverageAt(two, p);
  assert.equal(r.status === "inside" && r.zone?.name, "Hub 2");
});

test("polygon: inside, near an edge, near a corner, outside", () => {
  const mid = north(east(SQ0, 500), 500);
  assert.equal(coverageAt(two, mid).status, "inside");
  const edge = north(east(SQ0, 500), -120); // 120 m south of the bottom edge
  const e = coverageAt(two, edge);
  assert.equal(e.status, "near");
  if (e.status === "near") assert.ok(Math.abs(e.distanceM - 120) <= 3, `edge distance ${e.distanceM}`);
  const corner = north(east(SQ0, -100), -100); // ~141 m from the corner
  const c = coverageAt(two, corner);
  assert.equal(c.status, "near");
  if (c.status === "near") assert.ok(Math.abs(c.distanceM - 141) <= 3, `corner distance ${c.distanceM}`);
  assert.equal(coverageAt(two, north(east(SQ0, 500), -400)).status, "outside");
});

test("concave (L-shaped) polygon: the notch is outside", () => {
  const o = { lat: 28.6, lng: 77.3 };
  const L: Zone = {
    ...square,
    id: "L",
    name: "L",
    points: [o, north(o, 1000), east(north(o, 1000), 400), east(north(o, 400), 400), east(north(o, 400), 1000), east(o, 1000)],
  };
  assert.equal(pointInPolygon(north(east(o, 200), 800), L.points), true);
  assert.equal(pointInPolygon(north(east(o, 800), 800), L.points), false); // in the notch
  assert.equal(pointInPolygon(north(east(o, 800), 200), L.points), true);
  assert.ok(distanceOutsideM(L, north(east(o, 800), 800)) > 300);
});

test("switched-off areas are ignored", () => {
  const c = cov([circle("Off", HUB1, 2000, false), circle("Hub 2", HUB2, 2000)]);
  assert.equal(coverageAt(c, HUB1).status, "outside");
  assert.equal(coverageAt(c, HUB2).status, "inside");
});

test("no pin while areas are in use: unknown", () => {
  assert.equal(coverageAt(two, { lat: null, lng: null, pincode: "110001" }).status, "unknown");
  assert.equal(isCovered(two, { pincode: "110001" }), null);
});

test("PIN-code fallback when no areas are drawn", () => {
  const pins = cov([], ["110001", "110002"]);
  assert.equal(coverageAt(pins, { pincode: "110001" }).status, "inside");
  assert.equal(coverageAt(pins, { pincode: "110085" }).status, "outside");
  assert.equal(coverageAt(pins, { pincode: "" }).status, "unknown");
  assert.equal(coverageAt(cov([], []), { pincode: "999999" }).status, "inside"); // no list = everywhere
  // only switched-off areas means areas aren't in use: PIN codes decide
  assert.equal(coverageAt(cov([circle("Off", HUB1, 2000, false)], ["110001"]), { lat: 0, lng: 0, pincode: "110001" }).status, "inside");
});
