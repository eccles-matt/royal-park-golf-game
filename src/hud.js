// Clubhouse-style overlay drawn straight onto the game canvas: cream cards with a green border, pixel font.
// Everything is positioned inside the phone's safe area (s.safe, in canvas pixels).
import { THEME } from "./theme.js";
import { W, H, HZ } from "./render.js";

const U = THEME.ui, FS = 8;

function panel(c, x, y, w, h) {
  c.fillStyle = U.border; c.fillRect(x - 2, y - 2, w + 4, h + 4);
  c.fillStyle = U.card; c.fillRect(x, y, w, h);
}
function text(c, s, x, y, col = U.text) { c.fillStyle = col; c.fillText(s, Math.round(x), Math.round(y)); }

// Tap targets, worked out each frame from the current size and safe area
export const HIT = { map: null, prev: null, next: null, club: null };

export function drawHUD(c, s) {
  c.font = `${FS}px "Press Start 2P", monospace`; c.textBaseline = "top"; c.imageSmoothingEnabled = false;
  const hole = s.hole, L = s.safe.left + 6, R = W - s.safe.right - 6, T = s.safe.top + 6, B = H - s.safe.bottom - 6;

  // hole card
  panel(c, L, T, 104, 22);
  text(c, `HOLE ${hole.number} PAR ${hole.par}`, L + 3, T + 3);
  text(c, s.onGreen ? `${s.toPin.toFixed(1)}M` : `${Math.round(s.toPin)}M`, L + 3, T + 13, U.sub);
  text(c, `SHOT ${s.shot}`, L + 56, T + 13, U.sub);

  // wind
  panel(c, L, T + 27, 66, 11);
  text(c, "WIND", L + 2, T + 29);
  const rel = s.windDir - s.heading, ax = L + 41, ay = T + 32.5, dx = Math.sin(rel) * 4, dy = -Math.cos(rel) * 4;
  c.strokeStyle = U.text; c.lineWidth = 1; c.beginPath(); c.moveTo(ax - dx, ay - dy); c.lineTo(ax + dx, ay + dy); c.stroke();
  c.fillStyle = U.text; c.fillRect(Math.round(ax + dx) - 1, Math.round(ay + dy) - 1, 2, 2);
  text(c, `${Math.round(s.windKmh)}`, L + 47, T + 29);

  // hole map (tap to look ahead)
  const m = HIT.map = { x: R - 45, y: T, w: 45, h: 60 }, b = hole.bounds;
  panel(c, m.x, m.y, m.w, m.h);
  c.drawImage(s.minimap, m.x, m.y, m.w, m.h);
  const mx = x => m.x + (x - b.x0) / (b.x1 - b.x0) * m.w, my = y => m.y + (y - b.y0) / (b.y1 - b.y0) * m.h;
  const bx = mx(s.ball.x), by = my(s.ball.y), reach = s.aimDist / (b.x1 - b.x0) * m.w;
  c.strokeStyle = "#ffffff"; c.setLineDash([2, 2]); c.beginPath(); c.moveTo(bx, by);
  c.lineTo(bx + Math.sin(s.heading) * reach, by - Math.cos(s.heading) * reach); c.stroke(); c.setLineDash([]);
  c.fillStyle = U.flag; c.fillRect(Math.round(mx(hole.pin.x)) - 1, Math.round(my(hole.pin.y)) - 3, 2, 3);
  c.fillStyle = "#ffffff"; c.fillRect(Math.round(bx) - 1, Math.round(by) - 1, 3, 3);
  c.fillStyle = U.border; c.fillRect(Math.round(bx), Math.round(by), 1, 1);
  panel(c, m.x, m.y + m.h + 5, m.w, 9);
  text(c, s.look ? "BACK" : "LOOK", m.x + 6, m.y + m.h + 6);
  HIT.map.h += 16;

  // club picker: tap the arrows (or the name) to change club
  const cw = 100, cy = B - 13;
  panel(c, L, cy, cw, 13);
  c.fillStyle = U.text;
  for (let i = 0; i < 4; i++) { c.fillRect(L + 3 + i, cy + 6 - i, 1, 1 + 2 * i); c.fillRect(L + cw - 4 - i, cy + 6 - i, 1, 1 + 2 * i); }
  text(c, s.club.name, L + Math.round((cw - s.club.name.length * FS) / 2), cy + 3);
  HIT.prev = { x: L - 4, y: cy - 8, w: 30, h: 26 };
  HIT.next = { x: L + cw - 26, y: cy - 8, w: 30, h: 26 };
  HIT.club = { x: L + 26, y: cy - 8, w: cw - 52, h: 26 };

  // target distance for full shots
  if (s.target) {
    const lw = s.target.length * FS + 6;
    panel(c, R - lw, cy, lw, 13); text(c, s.target, R - lw + 3, cy + 3);
  }

  // swing gesture
  const g = s.gesture, ball = s.ballScreen;
  if (!g && ball && s.ready) {
    // pulsing dotted ring: touch here to swing
    const r = s.ballR * (0.55 + 0.08 * Math.sin(s.time * 4)), n = 16;
    c.fillStyle = "rgba(255,255,255,0.85)";
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + s.time * 0.8; c.fillRect(Math.round(ball.x + Math.cos(a) * r), Math.round(ball.y + Math.sin(a) * r * 0.8), 1, 1); }
  }
  if (g && ball) {
    // dotted pull-back line from ball to finger
    c.fillStyle = "#ffffff";
    const ex = g.x, ey = g.y, n = Math.max(1, Math.round(Math.hypot(ex - ball.x, ey - ball.y) / 4));
    for (let i = 1; i <= n; i++) { const t = i / n; c.fillRect(Math.round(ball.x + (ex - ball.x) * t), Math.round(ball.y + (ey - ball.y) * t), 2, 2); }
    // power gauge beside the ball
    const gh = Math.min(70, Math.round(H * 0.22)), gx = Math.round(Math.min(ball.x + 16, R - 10)), gy = Math.round(ball.y - gh / 2);
    panel(c, gx, gy, 6, gh);
    const fillH = Math.round(gh * g.power);
    c.fillStyle = g.power > 0.9 ? U.meterHot : g.power > 0.7 ? U.meterWarm : U.meterOn;
    c.fillRect(gx, gy + gh - fillH, 6, fillH);
    if (g.notch != null) { const ny = Math.round(gy + gh - gh * g.notch); c.fillStyle = U.flag; c.fillRect(gx - 4, ny, 14, 1); c.fillRect(gx - 4, ny - 1, 2, 3); }
    const pct = `${Math.round(g.power * 100)}%`;
    panel(c, gx - 6 - pct.length * FS, gy - 13, pct.length * FS + 2, 9); text(c, pct, gx - 5 - pct.length * FS, gy - 12);
  } else if (s.hint) {
    const w = s.hint.length * FS + 8, x = Math.round((W - w) / 2), y = cy - 20;
    if (Math.floor(s.time * 1.2) % 4 !== 3) { panel(c, x, y, w, 11); text(c, s.hint, x + 4, y + 2); }
  }

  if (s.msg) {
    const w = s.msg.length * FS + 8, x = Math.round((W - w) / 2);
    panel(c, x, HZ + 14, w, 13); text(c, s.msg, x + 4, HZ + 17);
  }
}

export const inside = (r, x, y) => r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
