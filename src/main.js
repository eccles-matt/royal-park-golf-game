import { HOLE3 } from "./course.js";
import { buildTerrain, SURF, SURF_NAME } from "./terrain.js";
import { buildSprites } from "./sprites.js";
import { Renderer, F } from "./render.js";
import { drawHUD, METER_MIN, MAP, CLUB_BOX } from "./hud.js";
import { CLUBS, launch, step, treeGrid, LIE_POWER } from "./physics.js";
import { rng, clamp } from "./util.js";

const hole = HOLE3;
const $ = id => document.getElementById(id);
const canvas = $("game");

const terrain = buildTerrain(hole);
const sprites = buildSprites();
const renderer = new Renderer(canvas, terrain, hole, sprites);
const trees = treeGrid(terrain.trees);

const PUTT_MU_G = 0.065 * 9.8;
let rand = rng(Date.now() & 0xffff);

const S = {
  mode: "title", ball: null, strokes: 0, heading: 0, club: 0, look: false,
  meter: { phase: 0, m: 0, power: 0 }, wind: { x: 0, y: 0 }, windDir: 0, windKmh: 0,
  msg: "", msgT: 0, putt: null, shotCam: null, stopT: 0, dirty: true
};

const putter = () => CLUBS.length - 1;
const ground = () => terrain.heightAt(S.ball.x, S.ball.y);
const lie = () => terrain.surfaceAt(S.ball.x, S.ball.y);
const toPin = () => Math.hypot(hole.pin.x - S.ball.x, hole.pin.y - S.ball.y);
const onGreen = () => lie() === SURF.GREEN;
const club = () => CLUBS[S.club];

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
  S.look = false; S.meter = { phase: 0, m: 0, power: 0 }; S.putt = null;
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
  updateControls();
}

function camera() {
  const b = S.ball, fw = [Math.sin(S.heading), -Math.cos(S.heading)];
  if (S.look) {
    const L = Math.max(25, Math.min(aimDist(), toPin()) - 35), x = b.x + fw[0] * L, y = b.y + fw[1] * L;
    return { x, y, h: terrain.heightAt(x, y) + 20, heading: S.heading };
  }
  const putting = club().putter, back = putting ? 4.5 : 9, eye = putting ? 1.5 : 3.2;
  const x = b.x - fw[0] * back, y = b.y - fw[1] * back;
  return { x, y, h: Math.max(terrain.heightAt(x, y), b.h) + eye, heading: S.heading };
}

function aimDist() {
  const c = club();
  if (c.putter) return toPin();
  let mul = LIE_POWER[lie()] ?? 1; if (lie() === SURF.BUNKER && c.name === "S WEDGE") mul = 0.85;
  return c.carry * mul;
}

function say(msg, t = 1.6) { S.msg = msg; S.msgT = t; }

function hit(power, acc) {
  S.strokes++;
  S.look = false;
  S.shotCam = camera();
  launch(S.ball, club(), power, acc, S.heading, terrain, rand);
  S.mode = "flight"; S.stopT = 0; S.dirty = true;
  updateControls();
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
  S.mode = "done"; updateControls();
  const diff = S.strokes - hole.par;
  $("endTitle").textContent = pickedUp ? "PICKED UP" : S.strokes === 1 ? "HOLE IN ONE!" : "IN THE HOLE!";
  $("endScore").textContent = pickedUp ? `${S.strokes} SHOTS` : `${S.strokes} · ${NAMES[diff] ?? "+" + diff}`;
  setTimeout(() => { $("end").hidden = false; }, 900);
}

// --- swing meter ---
function swingTap() {
  if (S.mode === "title" || S.mode === "done" || S.mode === "flight") return;
  const M = S.meter;
  if (M.phase === 0) { M.phase = 1; M.m = 0; S.look = false; S.dirty = true; }
  else if (M.phase === 1) {
    M.power = M.m;
    if (club().putter) return hit(M.power, 0);
    M.phase = 2;
  } else if (M.phase === 2) hit(M.power, M.m);
  updateControls();
}

function tickMeter(dt) {
  const M = S.meter;
  if (M.phase === 1) { M.m += dt * (club().putter ? 0.6 : 0.85); if (M.m >= 1) { M.m = 1; if (club().putter) return hit(1, 0); M.power = 1; M.phase = 2; updateControls(); } }
  else if (M.phase === 2) { M.m -= dt * 1.3; if (M.m <= METER_MIN) hit(M.power, METER_MIN); }
}

// --- loop ---
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (keys.left || keys.right) { if (S.meter.phase === 0 && (S.mode === "aim" || S.mode === "putt")) { S.heading += (keys.right - keys.left) * dt * (club().putter ? 0.35 : 0.8); S.dirty = true; } }
  if (S.mode === "aim" || S.mode === "putt") tickMeter(dt);
  if (S.mode === "flight") {
    const b = S.ball;
    if (b.state === "air" || b.state === "roll") {
      const n = Math.round(dt * 1.5 * 240);
      for (let i = 0; i < n; i++) {
        const ev = step(b, 1 / 240, terrain, S.wind, trees, hole.pin, rand);
        if (ev === "tree") say("TIMBER!", 1);
        if (b.x < -140 || b.x > 440 || b.y < -140 || b.y > 540) { b.state = "stop"; b.x = clamp(b.x, -140, 440); b.y = clamp(b.y, -140, 540); b.h = ground(); }
        if (b.state === "stop" || b.state === "holed") break;
      }
    } else if ((S.stopT += dt) > 0.9) finishShot();
  }
  if (S.msgT > 0 && (S.msgT -= dt) <= 0) S.msg = "";

  if (S.mode !== "title") {
    const cam = S.mode === "flight" ? S.shotCam : camera();
    if (S.dirty || S.mode !== "flight") { if (S.dirty || camKey(cam) !== lastCam) { renderer.render(cam); lastCam = camKey(cam); } S.dirty = false; }
    renderer.begin();
    if (S.mode === "aim" && !S.look && !club().putter) {
      const d = aimDist(); renderer.drawTarget(S.ball.x + Math.sin(S.heading) * d, S.ball.y - Math.cos(S.heading) * d);
    }
    if (club().putter && S.mode !== "flight" && toPin() < 25) renderer.drawSlopes(S.ball);
    renderer.drawBall(S.ball, ground(), S.mode === "flight");
    renderer.end();
    drawHUD(renderer.ctx, {
      hole, ball: S.ball, heading: S.heading, shot: S.mode === "flight" || S.mode === "done" ? S.strokes : S.strokes + 1,
      toPin: toPin(), onGreen: onGreen(), windDir: S.windDir, windKmh: S.windKmh, minimap: terrain.minimap,
      aimDist: Math.min(aimDist(), 400), club: club(), look: S.look, msg: S.msg,
      meter: meterView()
    });
  }
  requestAnimationFrame(frame);
}
let lastCam = "";
const camKey = c => `${c.x.toFixed(3)},${c.y.toFixed(3)},${c.h.toFixed(3)},${c.heading.toFixed(4)}`;

function meterView() {
  const M = S.meter;
  if (S.putt) return { fill: S.putt.power, marker: null, label: `${Math.round(puttDist(S.putt.power))}M` };
  if (M.phase === 0) return { fill: 0, marker: null, label: "" };
  if (M.phase === 1) return { fill: M.m, marker: M.m, label: "" };
  return { fill: M.power, marker: M.m, label: "" };
}
const puttDist = p => (CLUBS[putter()].maxSpeed * p) ** 2 / (2 * PUTT_MU_G);

// --- controls ---
function updateControls() {
  $("clubName").textContent = club().name;
  const putting = S.mode === "putt";
  $("swing").hidden = putting; $("puttPad").hidden = !putting;
  $("swing").textContent = S.meter.phase === 0 ? "SWING" : S.meter.phase === 1 ? (club().putter ? "TAP: POWER" : "TAP: POWER") : "TAP: STRAIGHT";
  $("look").setAttribute("aria-pressed", S.look);
  const busy = S.mode === "flight" || S.mode === "done" || S.meter.phase > 0;
  for (const id of ["prev", "next", "look"]) $(id).disabled = busy;
}

function changeClub(d) {
  if (S.mode === "flight" || S.meter.phase > 0) return;
  S.club = (S.club + d + CLUBS.length) % CLUBS.length;
  if (S.mode === "putt" && !club().putter) S.mode = "aim";
  else if (S.mode === "aim" && club().putter && onGreen()) S.mode = "putt";
  S.dirty = true; updateControls();
}
function toggleLook() { if (S.mode !== "aim" && S.mode !== "putt") return; if (S.meter.phase) return; S.look = !S.look; S.dirty = true; updateControls(); }

$("prev").onclick = () => changeClub(-1);
$("next").onclick = () => changeClub(1);
$("look").onclick = toggleLook;
$("swing").addEventListener("pointerdown", e => { e.preventDefault(); swingTap(); });

// aim by dragging the view
let drag = null;
canvas.addEventListener("pointerdown", e => { drag = { x: e.clientX, y: e.clientY, moved: 0 }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener("pointermove", e => {
  if (!drag) return;
  const r = canvas.getBoundingClientRect(), dx = (e.clientX - drag.x) * canvas.width / r.width;
  drag.moved += Math.abs(e.clientX - drag.x); drag.x = e.clientX;
  if ((S.mode === "aim" || S.mode === "putt") && S.meter.phase === 0) { S.heading -= dx / F * (club().putter ? 0.5 : 1); S.dirty = true; }
});
canvas.addEventListener("pointerup", e => {
  if (drag && drag.moved < 6) {
    const r = canvas.getBoundingClientRect(), x = (e.clientX - r.left) * canvas.width / r.width, y = (e.clientY - r.top) * canvas.height / r.height;
    if (x >= MAP.x && x <= MAP.x + MAP.w && y >= MAP.y && y <= MAP.y + MAP.h) toggleLook();
    else if (x >= CLUB_BOX.x && x <= CLUB_BOX.x + CLUB_BOX.w && y >= CLUB_BOX.y - 4) changeClub(1);
  }
  drag = null;
});

// putting: drag down on the pad, release to putt
const pad = $("puttPad");
pad.addEventListener("pointerdown", e => { if (S.mode !== "putt") return; pad.setPointerCapture(e.pointerId); S.putt = { y0: e.clientY, power: 0 }; S.look = false; S.dirty = true; });
pad.addEventListener("pointermove", e => { if (!S.putt) return; S.putt.power = clamp((e.clientY - S.putt.y0) / Math.max(120, pad.clientHeight * 0.9), 0, 1); });
pad.addEventListener("pointerup", () => { if (!S.putt) return; const p = S.putt.power; S.putt = null; if (p > 0.02) hit(p, 0); });
pad.addEventListener("pointercancel", () => { S.putt = null; });

const keys = { left: 0, right: 0 };
addEventListener("keydown", e => {
  if (e.code === "Space") { e.preventDefault(); if (!e.repeat) { if (S.mode === "title") start(); else swingTap(); } }
  if (e.code === "ArrowLeft") keys.left = 1;
  if (e.code === "ArrowRight") keys.right = 1;
  if (e.code === "KeyQ") changeClub(-1);
  if (e.code === "KeyE") changeClub(1);
  if (e.code === "KeyM") toggleLook();
});
addEventListener("keyup", e => { if (e.code === "ArrowLeft") keys.left = 0; if (e.code === "ArrowRight") keys.right = 0; });

function start() { $("title").hidden = true; $("end").hidden = true; reset(); }
$("startBtn").onclick = start;
$("againBtn").onclick = start;

// draw a first frame behind the title card
reset(); S.mode = "title";
renderer.render(camera()); renderer.begin(); renderer.end();
requestAnimationFrame(frame);

document.fonts?.load('8px "Press Start 2P"').then(() => { S.dirty = true; });

if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("./sw.js").catch(() => {});

// handle for automated checks
window.__golf = { S, hit, terrain, hole, CLUBS, setupShot };
