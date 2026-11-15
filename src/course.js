// Course data. World units are metres. x runs east, y runs south, heights are metres above a datum.
// Hole 3 below is a TEST LAYOUT (a made-up dogleg left), not yet traced from the real course.

import { rng } from "./util.js";

export const HOLE3 = {
  number: 3,
  par: 4,
  label: "TEST LAYOUT",
  bounds: { x0: 0, y0: 0, x1: 300, y1: 400 }, // in play; outside is out of bounds (bush)
  tee: { x: 215, y: 362, w: 14, h: 12 },
  teeAim: [207, 200], // default aim off the tee: down the fairway to the corner
  fairway: { width: 42, path: [[215, 350], [213, 262], [200, 182], [155, 122], [100, 90]] },
  green: { x: 86, y: 80, rx: 16, ry: 13, rot: 0.3, slope: [0.018, 0.03] },
  pin: { x: 84, y: 83 },
  bunkers: [
    { x: 236, y: 190, rx: 11, ry: 6, rot: 0.35 },
    { x: 103, y: 64, rx: 7, ry: 4, rot: -0.45 },
    { x: 66, y: 92, rx: 4, ry: 7, rot: 0.1 }
  ],
  // Hills: gaussian bumps (h > 0) and dips (h < 0) on top of gentle rolling ground
  hills: [
    { x: 215, y: 366, r: 22, h: 3.2 },  // raised tee
    { x: 208, y: 262, r: 38, h: -3.6 }, // valley in the drive zone
    { x: 168, y: 158, r: 34, h: 2.6 },  // ridge at the corner of the dogleg
    { x: 86, y: 78, r: 30, h: 4.2 },    // green sits up on a rise
    { x: 140, y: 232, r: 45, h: 3.0 },  // knoll inside the dogleg
    { x: 268, y: 120, r: 40, h: 2.0 }
  ],
  seed: 3
};

// Sample the fairway centreline the same way the canvas draws it (quadratic smoothing through midpoints)
export function centreline(hole) {
  const p = hole.fairway.path, out = [p[0]];
  let prev = p[0];
  for (let i = 1; i < p.length - 1; i++) {
    const end = [(p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2];
    for (let t = 0.05; t <= 1.0001; t += 0.05) {
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

const smooth = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);

export function makeHeightFn(hole) {
  const raw = (x, y) => {
    let h = 1.6 * Math.sin(x / 41 + 0.7) * Math.cos(y / 57) + 1.1 * Math.sin((x * 0.6 + y) / 33) + 0.6 * Math.cos((x - y * 0.4) / 23);
    for (const f of hole.hills) { const dx = x - f.x, dy = y - f.y; h += f.h * Math.exp(-(dx * dx + dy * dy) / (f.r * f.r)); }
    return h;
  };
  const t = hole.tee, teeH = raw(t.x, t.y);
  const g = hole.green, gH = raw(g.x, g.y), c = Math.cos(-g.rot), s = Math.sin(-g.rot);
  return (x, y) => {
    let h = raw(x, y);
    // flat tee box
    const tx = Math.max(Math.abs(x - t.x) - t.w / 2, 0), ty = Math.max(Math.abs(y - t.y) - t.h / 2, 0);
    h += (teeH - h) * (1 - smooth(Math.hypot(tx, ty) / 6));
    // green: a tilted plane blended into the surrounds
    const dx = x - g.x, dy = y - g.y, u = (dx * c - dy * s) / g.rx, v = (dx * s + dy * c) / g.ry, e = Math.sqrt(u * u + v * v);
    const plane = gH + g.slope[0] * dx + g.slope[1] * dy;
    h += (plane - h) * (1 - smooth((e - 1) * 2.2));
    return h;
  };
}

// Bushland: eucalypts everywhere except the playing corridor. Mix of river red gums and soft gums.
export function makeTrees(hole) {
  const R = rng(hole.seed * 977 + 13), line = centreline(hole), trees = [];
  const ok = (x, y) => {
    const dl = distToLine(line, x, y), dg = Math.hypot(x - hole.green.x, y - hole.green.y), dt = Math.hypot(x - hole.tee.x, y - hole.tee.y);
    return dl > hole.fairway.width / 2 + 9 && dg > 30 && dt > 16;
  };
  const place = (n, x0, y0, x1, y1, minGap) => {
    let tries = 0;
    while (n > 0 && tries++ < n * 40) {
      const x = x0 + R() * (x1 - x0), y = y0 + R() * (y1 - y0);
      if (!ok(x, y)) continue;
      if (trees.some(t => (t.x - x) ** 2 + (t.y - y) ** 2 < minGap * minGap)) continue;
      const river = R() < 0.55;
      trees.push({ x, y, type: river ? "river" : "soft", variant: (R() * 3) | 0, height: river ? 17 + R() * 9 : 11 + R() * 7, canopy: river ? 6 + R() * 3 : 4.5 + R() * 2 });
      n--;
    }
  };
  const b = hole.bounds;
  place(150, b.x0, b.y0, b.x1, b.y1, 9);                // scattered through the park
  place(420, b.x0 - 140, b.y0 - 140, b.x1 + 140, b.y1 + 140, 8); // thicker bush around the edges
  return trees;
}
