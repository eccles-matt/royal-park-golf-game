// Clubhouse-style overlay: cream cards with a green border, pixel font.
import { THEME } from "./theme.js";
import { W, H } from "./render.js";

const U = THEME.ui, FS = 8;
export const METER_MIN = -0.12;

function panel(c, x, y, w, h) {
  c.fillStyle = U.border; c.fillRect(x - 2, y - 2, w + 4, h + 4);
  c.fillStyle = U.card; c.fillRect(x, y, w, h);
}
function text(c, s, x, y, col = U.text) { c.fillStyle = col; c.fillText(s, Math.round(x), Math.round(y)); }

export const MAP = { x: W - 52, y: 6, w: 45, h: 60 };
export const CLUB_BOX = { x: 6, y: H - 17, w: 70, h: 11 };

export function drawHUD(c, s) {
  c.font = `${FS}px "Press Start 2P", monospace`; c.textBaseline = "top"; c.imageSmoothingEnabled = false;
  const hole = s.hole;

  panel(c, 6, 6, 104, 22);
  text(c, `HOLE ${hole.number} PAR ${hole.par}`, 9, 9);
  text(c, s.onGreen ? `${s.toPin.toFixed(1)}M` : `${Math.round(s.toPin)}M`, 9, 19, U.sub);
  text(c, `SHOT ${s.shot}`, 62, 19, U.sub);

  // wind
  panel(c, 6, 33, 56, 11);
  text(c, "WIND", 8, 35);
  const rel = s.windDir - s.heading, ax = 47, ay = 38.5;
  c.strokeStyle = U.text; c.lineWidth = 1; c.beginPath();
  const dx = Math.sin(rel) * 4, dy = -Math.cos(rel) * 4;
  c.moveTo(ax - dx, ay - dy); c.lineTo(ax + dx, ay + dy); c.stroke();
  c.fillStyle = U.text; c.fillRect(Math.round(ax + dx) - 1, Math.round(ay + dy) - 1, 2, 2);
  c.font = `${FS}px "Press Start 2P", monospace`;
  text(c, `${Math.round(s.windKmh)}`, 53, 35);

  // hole map
  const m = MAP, b = hole.bounds;
  panel(c, m.x, m.y, m.w, m.h);
  c.drawImage(s.minimap, m.x, m.y, m.w, m.h);
  const mx = x => m.x + (x - b.x0) / (b.x1 - b.x0) * m.w, my = y => m.y + (y - b.y0) / (b.y1 - b.y0) * m.h;
  const bx = mx(s.ball.x), by = my(s.ball.y);
  c.strokeStyle = "#ffffff"; c.setLineDash([2, 2]); c.beginPath(); c.moveTo(bx, by);
  const reach = s.aimDist / (b.x1 - b.x0) * m.w;
  c.lineTo(bx + Math.sin(s.heading) * reach, by - Math.cos(s.heading) * reach); c.stroke(); c.setLineDash([]);
  c.fillStyle = U.flag; c.fillRect(Math.round(mx(hole.pin.x)) - 1, Math.round(my(hole.pin.y)) - 3, 2, 3);
  c.fillStyle = "#ffffff"; c.fillRect(Math.round(bx) - 1, Math.round(by) - 1, 3, 3);
  c.fillStyle = U.border; c.fillRect(Math.round(bx), Math.round(by), 1, 1);
  if (s.look) { panel(c, m.x - 4, m.y + m.h + 5, m.w + 8, 9); text(c, "AHEAD", m.x + 3, m.y + m.h + 6); }

  // club
  const cb = CLUB_BOX;
  panel(c, cb.x, cb.y, cb.w, cb.h);
  text(c, s.club.name, cb.x + 2, cb.y + 2);

  // meter
  const mx0 = 86, mw = W - mx0 - 7, my0 = H - 17, mh = 11;
  panel(c, mx0, my0, mw, mh);
  const toX = v => mx0 + (v - METER_MIN) / (1 - METER_MIN) * mw;
  const segs = 18;
  for (let i = 0; i < segs; i++) {
    const v0 = METER_MIN + i / segs * (1 - METER_MIN), on = s.meter.fill > v0 && v0 >= 0;
    c.fillStyle = on ? (v0 > 0.85 ? U.meterHot : v0 > 0.62 ? U.meterWarm : U.meterOn) : U.meterOff;
    c.fillRect(Math.round(mx0 + i * mw / segs) + 1, my0 + 1, Math.round(mw / segs) - 2, mh - 2);
  }
  c.fillStyle = U.border; c.fillRect(Math.round(toX(0)), my0 - 3, 1, mh + 6);           // accuracy sweet spot
  if (s.meter.marker !== null) { c.fillStyle = "#ffffff"; c.fillRect(Math.round(toX(s.meter.marker)) - 1, my0 - 2, 2, mh + 4); }
  if (s.meter.label) { panel(c, mx0 + mw - 34, my0 - 15, 34, 9); text(c, s.meter.label, mx0 + mw - 33, my0 - 14); }

  if (s.msg) {
    const w = s.msg.length * FS + 8, x = Math.round((W - w) / 2);
    panel(c, x, 92, w, 13); text(c, s.msg, x + 4, 95);
  }
}
