import { HOLE3 } from "./course.js";
import { buildTerrain, SURF, SURF_NAME } from "./terrain.js";
import { buildSprites } from "./sprites.js";
import { Renderer, F, W, H, HZ, setSize } from "./render.js";
import { drawHUD, HIT, inside } from "./hud.js";
import { CLUBS, launch, step, treeGrid, LIE_POWER } from "./physics.js";
import { rng, clamp } from "./util.js";

const hole = HOLE3;
const $ = id => document.getElementById(id);
const canvas = $("game");

const terrain = buildTerrain(hole);
const sprites = buildSprites();

// --- full-screen sizing ---
const safeProbe = $("safe");
let safe = { top: 0, right: 0, bottom: 0, left: 0 };
function fitScreen() {
  const vw = innerWidth, vh = innerHeight;
  let w, h;
  if (vh >= vw) { w = 288; h = clamp(Math.round(288 * vh / vw / 2) * 2, 216, 680); }
  else { h = 216; w = clamp(Math.round(216 * vw / vh / 2) * 2, 288, 560); }
  const cs = getComputedStyle(safeProbe), k = w / vw;
  safe = { top: parseFloat(cs.paddingTop) * k, right: parseFloat(cs.paddingRight) * k, bottom: parseFloat(cs.paddingBottom) * k, left: parseFloat(cs.paddingLeft) * k };
  const changed = w !== W || h !== H;
  setSize(w, h);
  return changed;
}
fitScreen();
const renderer = new Renderer(canvas, terrain, hole, sprites);
addEventListener("resize", () => { if (fitScreen()) { renderer.resize(); S.dirty = true; lastCam = ""; } });
const trees = treeGrid(terrain.trees);

let rand = rng(Date.now() & 0xffff);

const S = {
  mode: "title", ball: null, strokes: 0, heading: 0, club: 0, look: false,
  wind: { x: 0, y: 0 }, windDir: 0, windKmh: 0, gesture: null, targetD: null, path: null,
  msg: "", msgT: 0, shotCam: null, stopT: 0, dirty: true, shotsTaken: 0
};

const putter = () => CLUBS.length - 1;
const ground = () => terrain.heightAt(S.ball.x, S.ball.y);
const lie = () => terrain.surfaceAt(S.ball.x, S.ball.y);
const toPin = () => Math.hypot(hole.pin.x - S.ball.x, hole.pin.y - S.ball.y);
const onGreen = () => lie() === SURF.GREEN;
const club = () => CLUBS[S.club];
const ready = () => S.mode === "aim" || S.mode === "putt";

function reset() {
  rand = rng((Date.now() ^ (Math.random() * 1e9)) & 0x7fffffff);
  const sp = rand() * 4.2, dir = rand() * Math.PI * 2;
  S.wind = { x: Math.sin(dir) * sp, y: -Math.cos(dir) * sp }; S.windDir = dir; S.windKmh = sp * 3.6;
  S.ball = { x: hole.tee.x, y: hole.tee.y - 2, h: 0, state: "stop" };
  S.ball.h = ground();
  S.strokes = 0;
  setupShot(true);
}

function setupShot(first) {
  S.look = false; S.gesture = null; S.targetD = null; S.path = null;
  const d = toPin();
  if (onGreen()) { S.club = putter(); S.mode = "putt"; }
  else {
    S.mode = "aim";
    let pick = 0;
    for (let i = CLUBS.length - 2; i >= 0; i--) if (CLUBS[i].carry * (LIE_POWER[lie()] ?? 1) >= d * 0.95) { pick = i; break; }
    if (lie() === SURF.FRINGE && d < 14) pick = putter();
    S.club = pick;
  }
  const aim = first && hole.teeAim ? hole.teeAim : [hole.pin.x, hole.pin.y];
  S.heading = Math.atan2(aim[0] - S.ball.x, -(aim[1] - S.ball.y));
  S.dirty = true;
}

function camera() {
  const b = S.ball, fw = [Math.sin(S.heading), -Math.cos(S.heading)];
  if (S.look) {
    const L = Math.max(25, targetDist() - 35), x = b.x + fw[0] * L, y = b.y + fw[1] * L;
    return { x, y, h: terrain.heightAt(x, y) + 20, heading: S.heading };
  }
  // camera distance chosen so the ball sits 78% of the way down the screen
  const putting = club().putter, eye = putting ? 1.5 : 3.2, back = eye * F / (H * 0.78 - HZ);
  const x = b.x - fw[0] * back, y = b.y - fw[1] * back;
  return { x, y, h: Math.max(terrain.heightAt(x, y), b.h) + eye, heading: S.heading };
}

function aimDist() {
  const c = club();
  if (c.putter) return toPin();
  let mul = LIE_POWER[lie()] ?? 1; if (lie() === SURF.BUNKER && c.name === "S WEDGE") mul = 0.85;
  return c.carry * mul;
}
// Where this shot is aimed to land: the pin if it's in reach, otherwise full carry. Drag up/down to change it.
function targetDist() {
  if (club().putter) return toPin();
  const reach = aimDist();
  return clamp(S.targetD ?? Math.min(reach, toPin()), Math.min(10, reach), reach);
}

function say(msg, t = 1.6) { S.msg = msg; S.msgT = t; }

// side: flick angle in radians (negative = flicked left, which hooks left)
function hit(power, side) {
  S.strokes++; S.shotsTaken++;
  S.look = false; S.gesture = null;
  S.shotCam = camera();
  launch(S.ball, club(), power, side, S.heading, terrain, rand);
  const a = Math.abs(side);
  if (!club().putter) say(a < 0.07 ? "PURE!" : a > 0.3 ? (side < 0 ? "HOOK" : "SLICE") : (side < 0 ? "DRAW" : "FADE"), 1.1);
  S.mode = "flight"; S.stopT = 0; S.dirty = true;
}

function finishShot() {
  const b = S.ball;
  if (b.state === "holed") return endHole();
  if (!terrain.inPlay(b.x, b.y)) {
    S.strokes++;
    Object.assign(b, b.prev, { state: "stop" });
    say("OUT OF BOUNDS +1", 2);
  } else {
    const s = lie();
    say(s === SURF.GREEN ? "ON THE GREEN" : s === SURF.TEE ? "FAIRWAY" : SURF_NAME[s]);
  }
  if (S.strokes >= 10) return endHole(true);
  setupShot(false);
}

const NAMES = { "-3": "ALBATROSS", "-2": "EAGLE", "-1": "BIRDIE", "0": "PAR", "1": "BOGEY", "2": "DOUBLE BOGEY", "3": "TRIPLE BOGEY" };
function endHole(pickedUp) {
  S.mode = "done";
  const diff = S.strokes - hole.par;
  $("endTitle").textContent = pickedUp ? "PICKED UP" : S.strokes === 1 ? "HOLE IN ONE!" : "IN THE HOLE!";
  $("endScore").textContent = pickedUp ? `${S.strokes} SHOTS` : `${S.strokes} · ${NAMES[diff] ?? "+" + diff}`;
  setTimeout(() => { $("end").hidden = false; }, 900);
}

// --- loop ---
let last = performance.now(), lastCam = "";
const camKey = c => `${c.x.toFixed(3)},${c.y.toFixed(3)},${c.h.toFixed(3)},${c.heading.toFixed(4)},${W}x${H}`;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if ((keys.left || keys.right) && ready() && !S.gesture) { S.heading += (keys.right - keys.left) * dt * (club().putter ? 0.35 : 0.8); S.dirty = true; }
  if (keys.charge && S.gesture?.key) S.gesture.power = Math.min(1, S.gesture.power + dt * 0.8);
  if (S.mode === "flight") {
    const b = S.ball;
    if (b.state === "air" || b.state === "roll") {
      const n = Math.round(dt * 1.5 * 240);
      for (let i = 0; i < n; i++) {
        const ev = step(b, 1 / 240, terrain, S.wind, trees, hole.pin, rand);
        if (ev === "tree") say("TIMBER!", 1);
        if (ev === "lip") say("LIPPED OUT!", 1.4);
        if (b.x < -140 || b.x > 440 || b.y < -140 || b.y > 540) { b.state = "stop"; b.x = clamp(b.x, -140, 440); b.y = clamp(b.y, -140, 540); b.h = ground(); }
        if (b.state === "stop" || b.state === "holed") break;
      }
    } else if ((S.stopT += dt) > 0.9) finishShot();
  }
  if (S.msgT > 0 && (S.msgT -= dt) <= 0) S.msg = "";

  if (S.mode !== "title") {
    const cam = S.mode === "flight" ? S.shotCam : camera();
    if (S.dirty || camKey(cam) !== lastCam) { renderer.render(cam); lastCam = camKey(cam); S.dirty = false; }
    renderer.begin();
    if (S.mode === "aim" && !S.look && !club().putter) {
      const d = targetDist(); renderer.drawTarget(S.ball.x + Math.sin(S.heading) * d, S.ball.y - Math.cos(S.heading) * d);
    }
    if (toPin() < 30 || club().putter) renderer.drawSlopeFlow(now / 1000);
    renderer.drawCup();
    if (S.mode === "putt" && !S.look) renderer.drawPath(S.gesture?.putt && S.gesture.power > 0.01 ? S.path || [] : straightLine(3));
    renderer.drawFlag(S.wind, now / 1000);
    renderer.drawBall(S.ball, ground(), S.mode === "flight");
    renderer.end();
    const bp = ready() && !S.look ? renderer.project(S.ball.x, S.ball.y, S.ball.h) : null;
    lastBall = bp && bp.z > 0 ? { x: bp.sx, y: bp.sy } : null;
    drawHUD(renderer.ctx, {
      hole, ball: S.ball, heading: S.heading, shot: S.mode === "flight" || S.mode === "done" ? S.strokes : S.strokes + 1,
      toPin: toPin(), onGreen: onGreen(), windDir: S.windDir, windKmh: S.windKmh, minimap: terrain.minimap,
      aimDist: Math.min(targetDist(), 400), club: club(), look: S.look, msg: S.msg, safe, time: now / 1000,
      target: ready() && !club().putter ? `${Math.round(targetDist())}M` : "",
      ballScreen: bp && bp.z > 0 ? { x: bp.sx, y: bp.sy } : null, ballR: BALL_R, ready: ready() && !S.look,
      gesture: S.gesture ? { ...S.gesture, notch: S.gesture.putt ? null : targetDist() / aimDist() } : null,
      hint: ready() && !S.look && S.shotsTaken < 4 ? (club().putter ? "PULL BACK + LET GO" : "TOUCH BALL, PULL + FLICK") : ""
    });
  }
  requestAnimationFrame(frame);
}

// Where a putt would roll: run the same physics on a copy of the ball. Stops at the cup or a lip.
function predictPutt(power, side) {
  const b = { ...S.ball }, pts = [], r = () => 0.5;
  launch(b, club(), power, side, S.heading, terrain, r);
  let lx = b.x, ly = b.y;
  for (let i = 0; i < 2400; i++) {
    const ev = step(b, 1 / 120, terrain, { x: 0, y: 0 }, trees, hole.pin, r);
    if (Math.hypot(b.x - lx, b.y - ly) > 0.22) { pts.push([b.x, b.y, terrain.heightAt(b.x, b.y)]); lx = b.x; ly = b.y; }
    if (ev === "stop" || ev === "holed" || ev === "lip" || b.state === "stop") break;
  }
  return pts;
}

function straightLine(len) {
  const pts = []; for (let d = 0.3; d <= len; d += 0.25) { const x = S.ball.x + Math.sin(S.heading) * d, y = S.ball.y - Math.cos(S.heading) * d; pts.push([x, y, terrain.heightAt(x, y)]); }
  return pts;
}

function changeClub(d) {
  if (!ready() || S.gesture) return;
  S.club = (S.club + d + CLUBS.length) % CLUBS.length; S.targetD = null;
  if (S.mode === "putt" && !club().putter) S.mode = "aim";
  else if (S.mode === "aim" && club().putter && onGreen()) S.mode = "putt";
  S.dirty = true;
}
function toggleLook() { if (!ready() || S.gesture) return; S.look = !S.look; S.dirty = true; }

// --- touch ---
// A swing only starts when the touch lands on the ball. Anywhere else: drag to aim
// (left/right) and set the target distance (up/down), or tap the HUD.
//   Full shots: pull back (down) to set power, then flick up fast. The flick angle sets hook or slice.
//   Letting go without a quick flick does nothing.
//   Putts: slingshot. Pull back from the ball and let go; the dotted line shows the roll and break.
// Full power is reached well before the bottom of the screen, wherever the ball sits.
const pullFor = y0 => clamp((H - safe.bottom - y0) * 0.7, H * 0.08, H * 0.18);
const FLICK_MIN = () => H * 0.06, FLICK_SPEED = () => H * 1.2;
const SWEET = 0.05, BALL_R = 22;
let touch = null, lastBall = null;
const toCanvas = e => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; };

// Upward speed (canvas px per second) and direction over the last ~90ms of the gesture
function recentFlick(g) {
  const now = g.trail[g.trail.length - 1];
  let i = g.trail.length - 1; while (i > 0 && now.t - g.trail[i - 1].t < 90) i--;
  const from = g.trail[Math.max(0, i - 1)], dt = Math.max(16, now.t - from.t) / 1000;
  return { vy: (from.y - now.y) / dt, dx: now.x - from.x, dy: from.y - now.y };
}

// Generous finger-sized zone around the ball, stretched a little downwards
const onBall = p => lastBall && Math.hypot(p.x - lastBall.x, (p.y - lastBall.y) * (p.y > lastBall.y ? 0.75 : 1.2)) < BALL_R;

canvas.addEventListener("pointerdown", e => {
  if (touch) return;
  canvas.setPointerCapture(e.pointerId);
  const p = toCanvas(e);
  const onHud = inside(HIT.map, p.x, p.y) || inside(HIT.prev, p.x, p.y) || inside(HIT.next, p.x, p.y) || inside(HIT.club, p.x, p.y);
  const swing = ready() && !S.look && !onHud && onBall(p);
  touch = { id: e.pointerId, x: p.x, y: p.y, x0: p.x, y0: p.y, moved: 0, axis: null, swing };
  if (swing) S.gesture = { x: p.x, y: p.y, x0: p.x, y0: p.y, bx: p.x, by: p.y, power: 0, side: 0, pull: club().putter ? clamp((H - safe.bottom - p.y) * 0.9, H * 0.12, H * 0.3) : pullFor(p.y), putt: !!club().putter, trail: [{ x: p.x, y: p.y, t: performance.now() }] };
});

canvas.addEventListener("pointermove", e => {
  if (!touch || e.pointerId !== touch.id) return;
  const p = toCanvas(e), dx = p.x - touch.x, dy = p.y - touch.y;
  touch.moved += Math.abs(dx) + Math.abs(dy); touch.x = p.x; touch.y = p.y;
  if (touch.swing) {
    const g = S.gesture; if (!g) return;
    g.x = p.x; g.y = p.y; g.trail.push({ x: p.x, y: p.y, t: performance.now() }); if (g.trail.length > 40) g.trail.shift();
    if (!g.putt && p.y >= g.by) { g.bx = p.x; g.by = p.y; g.power = clamp((p.y - g.y0) / g.pull, 0, 1); }  // pulling back
    if (g.putt) {
      // slingshot: the ball goes the opposite way to the pull
      const dx = p.x - g.x0, dy = p.y - g.y0;
      g.power = clamp(Math.max(0, dy) / g.pull, 0, 1) ** 1.5; // gentle at the start for short putts
      g.side = dy > 4 ? Math.atan2(-dx, dy) : 0;
      S.path = g.power > 0.01 ? predictPutt(g.power, g.side) : null;
    }
    return;
  }
  if (!touch.axis && touch.moved > 6) touch.axis = Math.abs(p.x - touch.x0) >= Math.abs(p.y - touch.y0) ? "x" : "y";
  if (!ready()) return;
  if (touch.axis === "x") { S.heading -= dx / F * (club().putter ? 0.5 : 1); S.dirty = true; }
  if (touch.axis === "y" && !club().putter) { S.targetD = clamp(targetDist() - dy * 0.8, 5, aimDist()); if (S.look) S.dirty = true; } // drag up = further
});

function endTouch(e, cancelled) {
  if (!touch || e.pointerId !== touch.id) return;
  const t = touch; touch = null;
  if (t.swing) {
    const g = S.gesture; S.gesture = null;
    if (!g || cancelled) return;
    g.trail.push({ x: t.x, y: t.y, t: performance.now() });
    const f = recentFlick(g), ang = Math.atan2(f.dx, Math.max(1, f.dy)); // 0 = straight up, negative = flicked left
    const err = Math.abs(ang) < SWEET ? 0 : ang;
    if (g.putt) {
      S.path = null;
      if (g.power > 0.03) hit(g.power, Math.abs(g.side) < SWEET ? 0 : g.side);
      return;
    }
    const flicked = g.power > 0.04 && g.by - t.y > FLICK_MIN() && f.vy > FLICK_SPEED();
    if (flicked) hit(g.power, err);
    else if (g.power > 0.04) say("FLICK UP FASTER", 1.2);
    return;
  }
  if (t.moved < 8 && !cancelled) {
    if (inside(HIT.map, t.x, t.y)) toggleLook();
    else if (inside(HIT.prev, t.x, t.y)) changeClub(-1);
    else if (inside(HIT.next, t.x, t.y) || inside(HIT.club, t.x, t.y)) changeClub(1);
  }
}
canvas.addEventListener("pointerup", e => endTouch(e, false));
canvas.addEventListener("pointercancel", e => endTouch(e, true));

// --- keyboard (desktop): hold Space to build power, release to hit straight ---
const keys = { left: 0, right: 0, charge: 0 };
addEventListener("keydown", e => {
  if (e.code === "Space") {
    e.preventDefault(); if (e.repeat) return;
    if (S.mode === "title") return start();
    if (ready() && !S.gesture) { keys.charge = 1; S.gesture = { key: true, x: 0, y: 0, bx: 0, by: 0, power: 0 }; S.look = false; }
  }
  if (e.code === "ArrowLeft") keys.left = 1;
  if (e.code === "ArrowRight") keys.right = 1;
  if (e.code === "KeyQ") changeClub(-1);
  if (e.code === "KeyE") changeClub(1);
  if (e.code === "KeyM") toggleLook();
  if (e.code === "ArrowUp" && !club().putter) S.targetD = clamp(targetDist() + 5, 5, aimDist());
  if (e.code === "ArrowDown" && !club().putter) S.targetD = clamp(targetDist() - 5, 5, aimDist());
});
addEventListener("keyup", e => {
  if (e.code === "ArrowLeft") keys.left = 0;
  if (e.code === "ArrowRight") keys.right = 0;
  if (e.code === "Space" && keys.charge) { keys.charge = 0; const g = S.gesture; S.gesture = null; if (g?.key && g.power > 0.02 && ready()) hit(g.power, 0); }
});

function start() { if (pendingReload) return location.reload(); $("title").hidden = true; $("end").hidden = true; reset(); }
$("startBtn").onclick = start;
$("againBtn").onclick = start;

// draw a first frame behind the title card
reset(); S.mode = "title";
renderer.render(camera()); renderer.begin(); renderer.end();
requestAnimationFrame(frame);

document.fonts?.load('8px "Press Start 2P"').then(() => { S.dirty = true; });

let pendingReload = false;
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  // updateViaCache: "none" makes the browser always fetch a fresh sw.js, so new versions are noticed
  navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).then(reg => {
    reg.update();
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update(); });
  }).catch(() => {});
  // When a new version takes over, reload once, but only if no hole is in progress
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController) return;
    if (S.mode === "title" || S.mode === "done") location.reload(); else pendingReload = true;
  });
}

// handle for automated checks
window.__golf = { S, hit, terrain, hole, CLUBS, setupShot, ballCss: () => { const r = canvas.getBoundingClientRect(); return lastBall && { x: r.left + lastBall.x * r.width / W, y: r.top + lastBall.y * r.height / H }; } };
