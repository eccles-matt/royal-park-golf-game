// Ball flight, bounce and roll over the heightmap.
import { SURF } from "./terrain.js";
import { clamp } from "./util.js";

export const CLUBS = [
  { name: "DRIVER", carry: 225, loft: 12 },
  { name: "3 WOOD", carry: 200, loft: 14 },
  { name: "5 IRON", carry: 165, loft: 19 },
  { name: "7 IRON", carry: 140, loft: 25 },
  { name: "9 IRON", carry: 115, loft: 32 },
  { name: "P WEDGE", carry: 95, loft: 38 },
  { name: "S WEDGE", carry: 70, loft: 46 },
  { name: "PUTTER", putter: true, maxSpeed: 7 }
];

const G = 9.8, K = 0.22, ROLL_G = 0.72;
// rest: bounce, keep: speed kept along the ground on landing, mu: rolling resistance
const SURFACE = [
  { rest: 0.15, keep: 0.3, mu: 0.55 },  // rough
  { rest: 0.3, keep: 0.55, mu: 0.22 },  // fairway
  { rest: 0.25, keep: 0.5, mu: 0.14 },  // fringe
  { rest: 0.2, keep: 0.45, mu: 0.065 }, // green
  { rest: 0, keep: 0.05, mu: 2.5 },     // bunker
  { rest: 0.3, keep: 0.55, mu: 0.22 }   // tee
];
export const LIE_POWER = { [SURF.ROUGH]: 0.8, [SURF.FRINGE]: 0.95, [SURF.BUNKER]: 0.5 };

function flatCarry(v0, loftDeg) {
  const a = loftDeg * Math.PI / 180, dt = 1 / 120;
  let x = 0, h = 0, vx = Math.cos(a) * v0, vh = Math.sin(a) * v0;
  for (let n = 0; n < 6000; n++) { vx -= K * vx * dt; vh -= (G + K * vh) * dt; x += vx * dt; h += vh * dt; if (h < 0 && vh < 0) return x; }
  return x;
}
function speedFor(carry, loft) {
  let lo = 1, hi = 200;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (flatCarry(m, loft) < carry) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

export function treeGrid(trees) {
  const cell = 20, map = new Map();
  for (const t of trees) {
    const k = `${Math.floor(t.x / cell)},${Math.floor(t.y / cell)}`;
    if (!map.has(k)) map.set(k, []); map.get(k).push(t);
  }
  return { near(x, y) { const out = [], cx = Math.floor(x / cell), cy = Math.floor(y / cell); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const a = map.get(`${cx + i},${cy + j}`); if (a) out.push(...a); } return out; } };
}

// side: flick angle in radians, negative = flicked left. The ball starts off in the flick
// direction and keeps curving that way, so a sideways flick gives a clear hook or slice.
export function launch(ball, club, power, side, heading, terrain, rand) {
  const lie = terrain.surfaceAt(ball.x, ball.y);
  ball.prev = { x: ball.x, y: ball.y, h: ball.h };
  ball.hitTree = null;
  side = clamp(side, -0.6, 0.6);
  if (club.putter) {
    const dir = heading + side * 0.2, sp = club.maxSpeed * power;
    Object.assign(ball, { vx: Math.sin(dir) * sp, vy: -Math.cos(dir) * sp, vh: 0, state: "roll", sx: 0, sy: 0 });
    return;
  }
  let mul = LIE_POWER[lie] ?? 1;
  if (lie === SURF.BUNKER && club.name === "S WEDGE") mul = 0.85;
  const [gx, gy] = terrain.gradAt(ball.x, ball.y), rx = Math.cos(heading), ry = Math.sin(heading);
  let dirErr = side * 0.22 + clamp(gx * rx + gy * ry, -0.2, 0.2) * 0.3;
  if (lie === SURF.ROUGH || lie === SURF.BUNKER) dirErr += (rand() - 0.5) * 0.05;
  if (Math.abs(side) > 0.45) mul *= 0.85;
  const dir = heading + dirErr, loft = club.loft * Math.PI / 180, v0 = speedFor(Math.max(5, club.carry * power * mul), club.loft);
  const curve = side * 11;
  Object.assign(ball, {
    vx: Math.sin(dir) * Math.cos(loft) * v0, vy: -Math.cos(dir) * Math.cos(loft) * v0, vh: Math.sin(loft) * v0,
    sx: Math.cos(dir) * curve, sy: Math.sin(dir) * curve, state: "air"
  });
}

// Advance the ball by dt seconds. Returns an event string when something notable happens.
export function step(ball, dt, terrain, wind, trees, pin, rand) {
  if (ball.state === "air") {
    ball.vx += (-K * (ball.vx - wind.x) + ball.sx) * dt;
    ball.vy += (-K * (ball.vy - wind.y) + ball.sy) * dt;
    ball.vh += (-G - K * ball.vh) * dt;
    ball.sx *= 1 - 0.5 * dt; ball.sy *= 1 - 0.5 * dt;
    ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.h += ball.vh * dt;
    for (const t of trees.near(ball.x, ball.y)) {
      const d2 = (t.x - ball.x) ** 2 + (t.y - ball.y) ** 2, cc = t.baseH + t.height * 0.7;
      const inCanopy = d2 < t.canopy * t.canopy && Math.abs(ball.h - cc) < t.height * 0.3;
      const inTrunk = d2 < 0.3 && ball.h < t.baseH + t.height * 0.55;
      if ((inCanopy || inTrunk) && ball.hitTree !== t) {
        ball.hitTree = t;
        const k = inTrunk ? -0.4 : 0.15 + rand() * 0.15, a = (rand() - 0.5) * 1.6, c = Math.cos(a), s = Math.sin(a);
        const vx = ball.vx * k, vy = ball.vy * k;
        ball.vx = vx * c - vy * s; ball.vy = vx * s + vy * c; ball.vh = Math.min(ball.vh, 0) * 0.3; ball.sx = ball.sy = 0;
        return "tree";
      }
    }
    const gh = terrain.heightAt(ball.x, ball.y);
    if (ball.h <= gh) {
      ball.h = gh;
      const S = SURFACE[terrain.surfaceAt(ball.x, ball.y)];
      const [gx, gy] = terrain.gradAt(ball.x, ball.y), nl = Math.hypot(gx, gy, 1), n = [-gx / nl, -gy / nl, 1 / nl];
      const vn = ball.vx * n[0] + ball.vy * n[1] + ball.vh * n[2];
      if (vn < 0) {
        const tx = ball.vx - vn * n[0], ty = ball.vy - vn * n[1], th = ball.vh - vn * n[2];
        ball.vx = tx * S.keep - S.rest * vn * n[0]; ball.vy = ty * S.keep - S.rest * vn * n[1]; ball.vh = th * S.keep - S.rest * vn * n[2];
        ball.sx = ball.sy = 0;
        if (-vn * S.rest < 1.2) { ball.state = "roll"; ball.vh = 0; return "land"; }
        return "bounce";
      }
    }
    return null;
  }
  if (ball.state === "roll") {
    const S = SURFACE[terrain.surfaceAt(ball.x, ball.y)], [gx, gy] = terrain.gradAt(ball.x, ball.y);
    const sp = Math.hypot(ball.vx, ball.vy), slopeA = G * ROLL_G * Math.hypot(gx, gy), fr = S.mu * G;
    if (sp < 0.06 && slopeA < fr * 1.1) { ball.vx = ball.vy = 0; ball.state = "stop"; return "stop"; }
    let ax = -G * ROLL_G * gx, ay = -G * ROLL_G * gy;
    if (sp > 0) { ax -= fr * ball.vx / sp; ay -= fr * ball.vy / sp; }
    const nvx = ball.vx + ax * dt, nvy = ball.vy + ay * dt;
    if (nvx * ball.vx + nvy * ball.vy < 0 && slopeA < fr) { ball.vx = ball.vy = 0; ball.state = "stop"; return "stop"; }
    ball.vx = nvx; ball.vy = nvy;
    ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.h = terrain.heightAt(ball.x, ball.y);
    const dp = Math.hypot(ball.x - pin.x, ball.y - pin.y);
    if (dp < 0.11 && sp < 1.7) { ball.x = pin.x; ball.y = pin.y; ball.state = "holed"; return "holed"; }
    if (sp > 60) ball.state = "stop";
    return null;
  }
  return null;
}
