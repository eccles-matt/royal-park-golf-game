// Royal Park Public Golf Course, Melbourne: 9 holes, par 35, 2316 yards from the whites.
// Traced from the course's bird's-eye map. Positions below are in map pixels and converted to metres
// (x east, y south, north up). One pixel of that map is about 0.62 m, which makes the holes come out
// close to their scorecard lengths. Hole 6 is stretched, since the map draws it short.

import { rng } from "./util.js";

const PX = 0.62;

// The fairways, rough, greens, bunkers and roads come straight from the map, traced into
// assets/course-mask.png by tools/trace_map.py. This file adds what the map can't say: tees, pins,
// green slopes, hills, fences, and hole 6, which is drawn here because the map draws it short.
// green: the putting surface fitted to the map (centre, radii, rotation), used to shape a smooth tilted green
const HOLES_PX = [
  { number: 1, par: 3, yards: 167, tee: [822, 833],
    green: { x: 580, y: 806, rx: 21, ry: 16.5, rot: -0.47, slope: [0.012, -0.02] }, pin: [576, 804] },
  { number: 2, par: 4, yards: 296, tee: [353, 611],
    green: { x: 791, y: 596, rx: 18, ry: 15, rot: 0.78, slope: [-0.015, 0.022] }, pin: [793, 599] },
  { number: 3, par: 4, yards: 226, tee: [722, 550], teeAim: [612, 372], // dogleg left round a stand of gums
    green: { x: 499, y: 317, rx: 17, ry: 15, rot: 0.01, slope: [0.02, 0.018] }, pin: [496, 314] },
  { number: 4, par: 3, yards: 158, tee: [432, 281],
    green: { x: 291, y: 106, rx: 18.4, ry: 15.6, rot: -0.9, slope: [0.018, 0.02] }, pin: [293, 103] },
  { number: 5, par: 5, yards: 387, tee: [236, 151], teeAim: [380, 292],
    green: { x: 626, y: 550, rx: 16, ry: 13.6, rot: 0.89, slope: [-0.02, -0.015] }, pin: [628, 552] },
  { number: 6, par: 3, yards: 145, tee: [497, 553],
    green: { x: 352, y: 410, rx: 16, ry: 11.5, rot: 0.78, slope: [0.015, 0.024] }, pin: [350, 409] },
  { number: 7, par: 4, yards: 294, tee: [261, 490], teeAim: [190, 300],
    green: { x: 107, y: 101, rx: 21.5, ry: 12.7, rot: 1.4, slope: [0.016, -0.022] }, pin: [106, 104] },
  { number: 8, par: 5, yards: 375, tee: [49, 84], teeAim: [96, 372],
    green: { x: 247, y: 559, rx: 16.7, ry: 14.5, rot: 0.93, slope: [-0.018, -0.016] }, pin: [244, 556] },
  { number: 9, par: 4, yards: 268, tee: [591, 873], teeAim: [800, 1012],
    green: { x: 906, y: 1133, rx: 21.7, ry: 14.7, rot: 1.16, slope: [-0.02, -0.02] }, pin: [903, 1135] }
];
// Hole 6, drawn over the map: light rough from tee to green
const HOLE6_CORRIDOR_PX = [[[505, 562], [420, 476], [348, 406]], 56];
// Open ground with no trees, where the map's line crosses parkland (the 9th's tee shot)
const CLEAR_PX = [[[[591, 873], [672, 926], [752, 980]], 34]];
// Cliff south of the 2nd green: a post-and-rail fence, a CLIFF EDGE sign, then a drop towards the road
const CLIFF_PX = { fence: [[738, 633], [765, 632], [795, 632], [825, 630], [850, 626]], sign: [790, 633], x0: 728, x1: 860, drop: 6 };
// Chain-mesh fence on the right of the 7th tee, between the tee and the road
const FENCE7_PX = [[278, 535], [277, 510], [275, 485], [272, 460], [268, 435]];

// --- convert to metres ---
const P = ([x, y]) => [x * PX, y * PX];
const ell = e => ({ ...e, x: e.x * PX, y: e.y * PX, rx: e.rx * PX, ry: e.ry * PX });

export const HOLES = HOLES_PX.map(h => {
  const [tx, ty] = P(h.tee), [px, py] = P(h.pin), aim = h.teeAim ? P(h.teeAim) : [px, py];
  const hole = {
    number: h.number, par: h.par, yards: h.yards,
    // tee box: 6 m wide, 10 m long, lined up with the shot
    tee: { x: tx, y: ty, w: 6, h: 10, rot: Math.atan2(aim[0] - tx, -(aim[1] - ty)) },
    teeAim: h.teeAim ? aim : null,
    green: ell(h.green), pin: { x: px, y: py }
  };
  // minimap window: tee, aim point and green plus a margin, in a 3:4 frame
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of [[tx, ty], [px, py], aim]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  x0 -= 35; y0 -= 35; x1 += 35; y1 += 35;
  const w = x1 - x0, hgt = y1 - y0;
  if (w / hgt > 0.75) { const d = w / 0.75 - hgt; y0 -= d / 2; y1 += d / 2; } else { const d = hgt * 0.75 - w; x0 -= d / 2; x1 += d / 2; }
  hole.bounds = { x0, y0, x1, y1 };
  return hole;
});

export const COURSE = {
  name: "ROYAL PARK", par: HOLES.reduce((a, h) => a + h.par, 0), yards: HOLES.reduce((a, h) => a + h.yards, 0),
  holes: HOLES, px: PX, mask: "assets/course-mask.png", maskSize: [952, 1198],
  world: { x0: 0, y0: 0, x1: 952 * PX, y1: 1198 * PX },
  hole6: { path: HOLE6_CORRIDOR_PX[0].map(P), width: HOLE6_CORRIDOR_PX[1] * PX },
  clear: CLEAR_PX.map(([path, w]) => ({ path: path.map(P), width: w * PX })),
  cliff: { fence: CLIFF_PX.fence.map(P), sign: P(CLIFF_PX.sign), x0: CLIFF_PX.x0 * PX, x1: CLIFF_PX.x1 * PX, drop: CLIFF_PX.drop },
  fences: [
    { pts: CLIFF_PX.fence.map(P), kind: "rail", height: 1.0 },
    { pts: FENCE7_PX.map(P), kind: "mesh", height: 2.0 }
  ],
  hills: [
    // gentle rises under the greens and tees, and a few knolls and hollows around the park
    ...HOLES.map(h => ({ x: h.green.x, y: h.green.y, r: 22, h: 1.6 })),
    ...HOLES.map(h => ({ x: h.tee.x, y: h.tee.y, r: 14, h: 1.2 })),
    { x: 380, y: 330, r: 40, h: 2.5 }, { x: 360, y: 210, r: 35, h: 2.2 }, { x: 120, y: 260, r: 45, h: 3 },
    { x: 60, y: 120, r: 30, h: 2 }, { x: 250, y: 400, r: 35, h: -2.4 }, { x: 470, y: 320, r: 30, h: 1.8 },
    { x: 520, y: 640, r: 40, h: 2.6 }, { x: 160, y: 600, r: 60, h: 3.5 }, { x: 300, y: 650, r: 50, h: -2 },
    { x: 450, y: 560, r: 30, h: -1.8 }, { x: 330, y: 380, r: 30, h: 1.5 }
  ],
  seed: 7
};

// --- geometry helpers ---

// Sample a path the same way the canvas draws it (quadratic smoothing through midpoints)
export function smoothPath(p) {
  const out = [p[0]];
  let prev = p[0];
  for (let i = 1; i < p.length - 1; i++) {
    const end = [(p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2];
    for (let t = 0.1; t <= 1.0001; t += 0.1) {
      const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
      out.push([a * prev[0] + b * p[i][0] + c * end[0], a * prev[1] + b * p[i][1] + c * end[1]]);
    }
    prev = end;
  }
  out.push(p[p.length - 1]);
  return out;
}

export function distToLine(pts, x, y) {
  let best = 1e9;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    const ex = ax + dx * t - x, ey = ay + dy * t - y, d = ex * ex + ey * ey;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

// y of a west-to-east polyline at x (for the cliff fence)
function lineY(pts, x) {
  for (let i = 0; i < pts.length - 1; i++) if (x >= pts[i][0] && x <= pts[i + 1][0]) { const t = (x - pts[i][0]) / (pts[i + 1][0] - pts[i][0]); return pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t; }
  return x < pts[0][0] ? pts[0][1] : pts[pts.length - 1][1];
}

const smooth = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);

// South of the cliff fence on the 2nd: is this point past the edge?
export function pastCliff(course, x, y) {
  const c = course.cliff;
  return x > c.x0 && x < c.x1 && y > lineY(c.fence, x) + 0.5;
}

export function makeHeightFn(course) {
  const holes = course.holes, hills = course.hills, cl = course.cliff;
    const raw = (x, y) => {
    let h = 1.6 * Math.sin(x / 41 + 0.7) * Math.cos(y / 57) + 1.1 * Math.sin((x * 0.6 + y) / 33) + 0.6 * Math.cos((x - y * 0.4) / 23);
    for (const f of hills) {
      const dx = x - f.x, dy = y - f.y; if (dx > f.r * 3 || dx < -f.r * 3 || dy > f.r * 3 || dy < -f.r * 3) continue;
      h += f.h * Math.exp(-(dx * dx + dy * dy) / (f.r * f.r));
    }
    // the 2nd green sits above a cutting: the ground drops away past the fence and stays low across the road
    if (x > cl.x0 - 20 && x < cl.x1 + 20 && y > cl.fence[0][1] - 20) {
      const fy = lineY(cl.fence, x), along = smooth((x - cl.x0 + 20) / 30) * smooth((cl.x1 + 20 - x) / 30);
      const down = smooth((y - fy - 0.5) / 5), up = smooth((y - fy - 24) / 30);
      h -= cl.drop * along * down * (1 - up);
    }
    return h;
  };
  const tees = holes.map(h => ({ t: h.tee, h: raw(h.tee.x, h.tee.y) }));
  const greens = holes.map(h => { const g = h.green; return { g, h: raw(g.x, g.y), c: Math.cos(-g.rot), s: Math.sin(-g.rot), r: Math.max(g.rx, g.ry) + 4 }; });
  return (x, y) => {
    let h = raw(x, y);
    for (const { t, h: th } of tees) {
      const dx = x - t.x, dy = y - t.y; if (dx > 14 || dx < -14 || dy > 14 || dy < -14) continue;
      const c = Math.cos(t.rot), s = Math.sin(t.rot), u = dx * c + dy * s, v = -dx * s + dy * c; // across, along
      const tx = Math.max(Math.abs(u) - t.w / 2, 0), ty = Math.max(Math.abs(v) - t.h / 2, 0);
      if (tx > 6 || ty > 6) continue;
      h += (th - h) * (1 - smooth(Math.hypot(tx, ty) / 6));
    }
    for (const { g, h: gH, c, s, r } of greens) {
      const dx = x - g.x, dy = y - g.y; if (dx > r || dx < -r || dy > r || dy < -r) continue;
      const u = (dx * c - dy * s) / g.rx, v = (dx * s + dy * c) / g.ry, e = Math.sqrt(u * u + v * v);
      const plane = gH + g.slope[0] * dx + g.slope[1] * dy;
      h += (plane - h) * (1 - smooth((e - 1.15) * 2.2));
    }
    return h;
  };
}

// Parkland eucalypts: river red gums and soft gums, thick in the stands between holes and scattered elsewhere,
// kept out of the playing corridors, tees, greens and roads.
export function makeTrees(course, isPark) {
  const R = rng(course.seed * 977 + 13), trees = [];
  const clear = course.clear.map(c => ({ pts: smoothPath(c.path), half: c.width / 2 }));
  const keep = course.holes.flatMap(h => [[h.green.x, h.green.y, 24], [h.tee.x, h.tee.y, 12]]);
  const ok = (x, y) => {
    for (const [kx, ky, r] of keep) if ((x - kx) ** 2 + (y - ky) ** 2 < r * r) return false;
    if (!isPark(x, y) || !isPark(x + 4, y) || !isPark(x - 4, y) || !isPark(x, y + 4) || !isPark(x, y - 4)) return false;
    for (const c of clear) if (distToLine(c.pts, x, y) < c.half) return false;
    if (pastCliff(course, x, y) && y < lineY(course.cliff.fence, x) + 6) return false;
    return true;
  };
  const w = course.world, M = 140, cell = 10, grid = new Map();
  const near = (x, y, gap) => {
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const t of grid.get((cx + i) * 4096 + cy + j) || []) if ((t.x - x) ** 2 + (t.y - y) ** 2 < gap * gap) return true;
    return false;
  };
  const place = (n, x0, y0, x1, y1, minGap) => {
    let tries = 0;
    while (n > 0 && tries++ < n * 30) {
      const x = x0 + R() * (x1 - x0), y = y0 + R() * (y1 - y0);
      if (near(x, y, minGap) || !ok(x, y)) continue;
      const river = R() < 0.55;
      const t = { x, y, type: river ? "river" : "soft", variant: (R() * 3) | 0, height: river ? 17 + R() * 9 : 11 + R() * 7, canopy: river ? 6 + R() * 3 : 4.5 + R() * 2 };
      trees.push(t);
      const k = Math.floor(x / cell) * 4096 + Math.floor(y / cell); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(t);
      n--;
    }
  };
  place(1100, w.x0, w.y0, w.x1, w.y1, 10);         // through the park
  place(900, w.x0 - M, w.y0 - M, w.x1 + M, w.y1 + M, 10); // bush around the outside
  return trees;
}
