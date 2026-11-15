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
// The railway runs west to east through the park in a cutting, fenced at the top. Its north wall is the
// "cliff" behind the 2nd green, with a CLIFF EDGE sign on the fence. Traced centreline, west to east.
const TRAIN_PX = [[0, 846], [50, 834], [130, 819], [210, 805], [290, 790], [330, 781], [410, 763], [490, 745], [570, 725],
  [650, 703], [730, 681], [810, 656], [890, 626], [952, 597]];
const CUT_FROM_PX = 330; // the cutting starts east of where the tram line comes alongside
const CLIFF_SIGN_PX = [790, 636];
// The tram line runs north to south between the 7th/8th and the rest, then curves west to meet the railway
const TRAM_PX = [[100, 10], [118, 40], [160, 100], [193, 160], [226, 220], [255, 280], [276, 340], [288, 400], [295, 460], [297, 520],
  [296, 580], [293, 610], [289, 640], [281, 670], [268, 700], [245, 730], [206, 760], [150, 790], [90, 812], [0, 836]];
// Chain-mesh fence on the right of the 7th tee, between the tee and the road
const FENCE7_PX = [[278, 535], [277, 510], [275, 485], [272, 460], [268, 435]];
// 8th: a very tall fence down the right of the narrow opening, with the brown housing commission flats behind it
const FENCE8_PX = [[30, 20], [31, 80], [31, 140], [32, 200], [33, 255]];
// Buildings, in map pixels: centre, size in metres (w across x, d across y), height, rotation
const BUILDINGS_PX = [
  { kind: "shed", at: [829, 806], w: 10, d: 6, h: 3.2, rot: 0.05 },   // the clubhouse, more of a shed, right of the 1st tee
  { kind: "flats", at: [-2, 40], w: 14, d: 34, h: 16, rot: 0.02 },   // housing commission flats right of the 8th tee
  { kind: "flats", at: [-6, 105], w: 14, d: 34, h: 19, rot: 0.02 },
  { kind: "flats", at: [-4, 170], w: 14, d: 34, h: 16, rot: 0.02 }
];
// Practice nets behind the trees on the right, midway up the 1st: an open-fronted mesh cage
const NETS_PX = { at: [722, 772], w: 20, d: 8 };
// Thick stands of gums: the corner of the 3rd (hides the green from the tee) and the tree line left of the 8th's opening
const STANDS_PX = [
  { at: [588, 445], r: 42, n: 90 }, { at: [560, 400], r: 20, n: 16 }, { at: [615, 490], r: 18, n: 12 },
  { at: [90, 150], r: 14, n: 10 }, { at: [93, 195], r: 15, n: 11 }, { at: [97, 240], r: 15, n: 11 },
  { at: [690, 796], r: 11, n: 4 }, { at: [722, 794], r: 11, n: 4 }, { at: [755, 797], r: 11, n: 4 }
];

function netsFence() {
  const [cx, cy] = NETS_PX.at, w = NETS_PX.w / 2, d = NETS_PX.d / 2, x = cx * PX, y = cy * PX;
  return { pts: [[x - w, y + d], [x - w, y - d], [x + w, y - d], [x + w, y + d]], kind: "mesh", height: 4.2 }; // open to the south
}

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
  train: TRAIN_PX.map(P), tram: TRAM_PX.map(P), cutFrom: CUT_FROM_PX * PX,
  cut: { floor: 5, top: 17, depth: 7 }, // half-width of the track bed, distance to the fence at the top, depth (m)
  sign: P(CLIFF_SIGN_PX),
  fences: [{ pts: FENCE7_PX.map(P), kind: "mesh", height: 2.0 }, { pts: FENCE8_PX.map(P), kind: "mesh", height: 6.5 }, netsFence()],
  fence8: FENCE8_PX.map(P),
  buildings: BUILDINGS_PX.map(b => ({ ...b, x: b.at[0] * PX, y: b.at[1] * PX })),
  stands: STANDS_PX.map(s => ({ x: s.at[0] * PX, y: s.at[1] * PX, r: s.r * PX, n: s.n })),
  hills: [
    // gentle rises under the greens and tees, and a few knolls and hollows around the park
    ...HOLES.map(h => ({ x: h.green.x, y: h.green.y, r: 22, h: 1.6 })),
    ...HOLES.map(h => ({ x: h.tee.x, y: h.tee.y, r: 14, h: 1.2 })),
    { x: 380, y: 330, r: 40, h: 2.5 }, { x: 360, y: 210, r: 35, h: 2.2 }, { x: 120, y: 260, r: 45, h: 3 },
    { x: 60, y: 120, r: 30, h: 2 }, { x: 250, y: 400, r: 35, h: -2.4 }, { x: 470, y: 320, r: 30, h: 1.8 },
    { x: 520, y: 640, r: 40, h: 2.6 }, { x: 160, y: 600, r: 60, h: 3.5 }, { x: 300, y: 650, r: 50, h: -2 },
    { x: 450, y: 560, r: 30, h: -1.8 }, { x: 330, y: 380, r: 30, h: 1.5 },
    // the 3rd: a raised tee, and the whole hole runs downhill round the dogleg to the green
    { x: 449, y: 342, r: 30, h: 4 }, { x: 420, y: 300, r: 55, h: 2.5 }, { x: 318, y: 205, r: 50, h: -3.2 }
  ],
  seed: 7
};

COURSE.fences.push(...cuttingFences(COURSE));
for (const h of HOLES) h.section = sectionOf(COURSE, h.tee.x, h.tee.y);

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

// A track to move along: position and heading at a distance s from its start
export function track(pts) {
  const p = smoothPath(pts), len = [0];
  for (let i = 1; i < p.length; i++) len.push(len[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
  const seg = s => { let i = 0; while (i < p.length - 2 && len[i + 1] < s) i++; return i; };
  const T = {
    length: len[len.length - 1],
    at(s) { const i = seg(s), l = len[i + 1] - len[i], t = (s - len[i]) / l; return [p[i][0] + (p[i + 1][0] - p[i][0]) * t, p[i][1] + (p[i + 1][1] - p[i][1]) * t]; },
    dir(s) { const i = seg(s), dx = p[i + 1][0] - p[i][0], dy = p[i + 1][1] - p[i][1], l = Math.hypot(dx, dy); return [dx / l, dy / l]; }
  };
  return T;
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

// y of a west-to-east polyline at x / x of a north-to-south polyline at y
function lineY(pts, x) {
  for (let i = 0; i < pts.length - 1; i++) if (x >= pts[i][0] && x <= pts[i + 1][0]) { const t = (x - pts[i][0]) / (pts[i + 1][0] - pts[i][0]); return pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t; }
  return x < pts[0][0] ? pts[0][1] : pts[pts.length - 1][1];
}

function lineX(pts, y) {
  for (let i = 0; i < pts.length - 1; i++) if (y >= pts[i][1] && y <= pts[i + 1][1]) { const t = (y - pts[i][1]) / (pts[i + 1][1] - pts[i][1]); return pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t; }
  return y < pts[0][1] ? pts[0][0] : pts[pts.length - 1][0];
}

const smooth = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);

// The railway and the tram line split the park into three parts: south of the railway (1, 9),
// west of the tram line (7, 8) and the rest (2 to 6). From a hole you only see your own part.
export function sectionOf(course, x, y) {
  if (y > lineY(course.train, x)) return 0;
  return x < lineX(course.tram, y) ? 1 : 2;
}
export const trainDist = (course, x, y) => distToLine(course.train, x, y);
// inside the railway fences (in the cutting)
export const inCutting = (course, x, y) => x > course.cutFrom && trainDist(course, x, y) < course.cut.top;

// Fences along the top of both sides of the cutting
export function cuttingFences(course) {
  const pts = smoothPath(course.train).filter(p => p[0] > course.cutFrom + 2), sides = [[], []];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l, ny = dx / l;
    sides[0].push([pts[i][0] + nx * course.cut.top, pts[i][1] + ny * course.cut.top]);
    sides[1].push([pts[i][0] - nx * course.cut.top, pts[i][1] - ny * course.cut.top]);
  }
  return sides.map(p => ({ pts: p, kind: "rail", height: 1.0 }));
}

export function makeHeightFn(course) {
  const holes = course.holes, hills = course.hills, cut = course.cut;
  const raw = (x, y) => {
    let h = 1.6 * Math.sin(x / 41 + 0.7) * Math.cos(y / 57) + 1.1 * Math.sin((x * 0.6 + y) / 33) + 0.6 * Math.cos((x - y * 0.4) / 23);
    for (const f of hills) {
      const dx = x - f.x, dy = y - f.y; if (dx > f.r * 3 || dx < -f.r * 3 || dy > f.r * 3 || dy < -f.r * 3) continue;
      h += f.h * Math.exp(-(dx * dx + dy * dy) / (f.r * f.r));
    }
    // the railway cutting: steep walls down from the fences to a flat track bed
    if (x > course.cutFrom - 40) {
      const ly = lineY(course.train, x);
      if (Math.abs(y - ly) < cut.top + 30) {
        const d = trainDist(course, x, y);
        if (d < cut.top + 1) {
          const k = (1 - smooth((d - cut.floor) / (cut.top - cut.floor))) * smooth((x - course.cutFrom + 40) / 40);
          h += (-cut.depth - h) * k;
        }
      }
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
  const keep = course.holes.flatMap(h => [[h.green.x, h.green.y, 24], [h.tee.x, h.tee.y, 12]])
    .concat(course.buildings.map(b => [b.x, b.y, Math.hypot(b.w, b.d) / 2 + 4]));
  const f8x = course.fence8[0][0] + 1, f8y0 = course.fence8[0][1], f8y1 = course.fence8[course.fence8.length - 1][1];
  const ok = (x, y) => {
    for (const [kx, ky, r] of keep) if ((x - kx) ** 2 + (y - ky) ** 2 < r * r) return false;
    if (!isPark(x, y) || !isPark(x + 4, y) || !isPark(x - 4, y) || !isPark(x, y + 4) || !isPark(x, y - 4)) return false;
    for (const c of clear) if (distToLine(c.pts, x, y) < c.half) return false;
    if (trainDist(course, x, y) < course.cut.top + 3) return false;
    if (x < f8x + 3 && y > f8y0 - 10 && y < f8y1 + 10) return false; // the flats' yard behind the 8th fence
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
  // thick belts of trees along the railway and the tram line, so each part of the course feels closed off.
  // The tram belt has gaps, so a passing tram can be seen.
  const belt = (line, from, to, step, gapEvery, gapLen) => {
    const pts = smoothPath(line);
    let along = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1], l = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / l, ny = (bx - ax) / l;
      for (let d = 0; d < l; d += step, along += step) {
        if (gapEvery && along % gapEvery < gapLen) continue;
        for (const side of [-1, 1]) {
          const off = from + R() * (to - from), x = ax + (bx - ax) * d / l + nx * off * side, y = ay + (by - ay) * d / l + ny * off * side;
          if (near(x, y, 6.5) || !ok(x, y)) continue;
          const river = R() < 0.5;
          const t = { x, y, type: river ? "river" : "soft", variant: (R() * 3) | 0, height: river ? 18 + R() * 9 : 12 + R() * 7, canopy: river ? 6 + R() * 3 : 5 + R() * 2 };
          trees.push(t);
          const k = Math.floor(x / cell) * 4096 + Math.floor(y / cell); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(t);
        }
      }
    }
  };
  for (const st of course.stands) {
    let n = st.n, tries = 0;
    while (n > 0 && tries++ < st.n * 40) {
      const a = R() * Math.PI * 2, r = Math.sqrt(R()) * st.r, x = st.x + Math.cos(a) * r, y = st.y + Math.sin(a) * r;
      if (near(x, y, 4.5) || !ok(x, y)) continue;
      // a mix of tall gums over a dense understory of scrub, so you can't see through
      const kind = R(), type = kind < 0.35 ? "river" : kind < 0.6 ? "soft" : "scrub";
      const t = type === "river" ? { height: 19 + R() * 8, canopy: 6.5 + R() * 2.5 } : type === "soft" ? { height: 11 + R() * 5, canopy: 5 + R() * 2 } : { height: 3.5 + R() * 2.5, canopy: 3 + R() };
      Object.assign(t, { x, y, type, variant: (R() * 3) | 0 });
      trees.push(t);
      const k = Math.floor(x / cell) * 4096 + Math.floor(y / cell); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(t);
      n--;
    }
  }
  for (let pass = 0; pass < 3; pass++) belt(course.train, course.cut.top + 3, course.cut.top + 30, 4, 0, 0);
  for (let pass = 0; pass < 2; pass++) belt(course.tram, 9, 28, 4, 75, 22);
  place(1100, w.x0, w.y0, w.x1, w.y1, 10);         // through the park
  place(900, w.x0 - M, w.y0 - M, w.x1 + M, w.y1 + M, 10); // bush around the outside
  return trees;
}
