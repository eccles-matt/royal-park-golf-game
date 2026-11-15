// Software renderer: heightmap "voxel" terrain marched per screen column, depth-tested tree sprites,
// then a ball and markers on top. Drawn at low resolution and scaled up with nearest-neighbour.
import { THEME, hex, lerp3 } from "./theme.js";
import { pack, clamp, BAYER, rng } from "./util.js";
import { SURF } from "./terrain.js";

// The view fills the screen. The short side is 288 (portrait) or 216 (landscape) pixels and the long side
// follows the screen's shape. Focal length is fixed, so a wider screen simply sees more.
export const F = 288 * 0.95;
export let W = 288, H = 216, HZ = 78, CX = 144;
export function setSize(w, h) { W = w; H = h; CX = w / 2; HZ = Math.round(h * 0.36); }
const ZF = 620;

export class Renderer {
  constructor(canvas, terrain, hole, sprites) {
    this.canvas = canvas; this.ctx = canvas.getContext("2d");
    this.t = terrain; this.hole = hole; this.sprites = sprites;
    this.haze = hex(THEME.haze);
    const far = lerp3(hex(THEME.rough), this.haze, 0.82);
    this.farCol = pack(far[0], far[1], far[2]);
    for (const tr of terrain.trees) tr.baseH = terrain.heightAt(tr.x, tr.y);
    this.pinH = terrain.heightAt(hole.pin.x, hole.pin.y);
    this.resize();
  }

  resize() {
    const c = this.canvas; c.width = W; c.height = H;
    this.img = this.ctx.createImageData(W, H);
    this.buf = new Uint32Array(this.img.data.buffer);
    this.depth = new Float32Array(W * H);
    this.baseBuf = new Uint32Array(W * H);
    this.baseDepth = new Float32Array(W * H);
    this.buildSky();
  }

  buildSky() {
    const PW = this.PW = Math.round(2 * Math.PI * F), cv = document.createElement("canvas");
    cv.width = PW; cv.height = HZ;
    const c = cv.getContext("2d"), id = c.createImageData(PW, HZ), d32 = new Uint32Array(id.data.buffer);
    const s = THEME.sky.map(hex), LEVELS = 12;
    for (let y = 0; y < HZ; y++) for (let x = 0; x < PW; x++) {
      let t = (y / (HZ - 1)) * LEVELS; t = (Math.floor(t) + (BAYER[(y & 3) * 4 + (x & 3)] < t % 1 ? 1 : 0)) / LEVELS;
      const col = t < 0.6 ? lerp3(s[0], s[1], t / 0.6) : lerp3(s[1], s[2], (t - 0.6) / 0.4);
      d32[y * PW + x] = pack(col[0], col[1], col[2]);
    }
    c.putImageData(id, 0, 0);
    const R = rng(5);
    c.fillStyle = THEME.cloud;
    for (let k = 0; k < 14; k++) {
      const x = R() * PW, y = 8 + R() * 30, sz = 7 + R() * 10;
      for (const off of [-PW, 0, PW]) for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse(x + off + (i - 2) * sz * 0.8, y + Math.abs(i - 2) * sz * 0.15, sz, sz * 0.42, 0, 0, 7); c.fill(); }
    }
    // Melbourne CBD skyline to the south (bearing ~ 190 degrees)
    const cbd = (190 / 360) * PW;
    c.fillStyle = THEME.city;
    for (let x = cbd - 70; x < cbd + 70;) {
      const w = 3 + R() * 7, mid = 1 - Math.abs(x - cbd) / 70, h = 4 + R() * 10 + mid * mid * 26;
      c.fillRect(Math.round(x), HZ - h, Math.round(w), h); x += w + R() * 2;
    }
    const pd = c.getImageData(0, 0, PW, HZ).data;
    this.pano = new Uint32Array(pd.buffer.slice(0));
  }

  fog(z) { let f = clamp((z - 35) / 480, 0, 1); return f * f * (3 - 2 * f) * 0.82; }

  // Draw terrain, sky, trees and flag for a camera. Result is cached so the ball can be drawn on top each frame.
  render(cam) {
    const { buf, depth, t } = this, { height, col, GW, GH, RES, X0, Y0 } = t;
    const fw0 = Math.sin(cam.heading), fw1 = -Math.cos(cam.heading), rt0 = Math.cos(cam.heading), rt1 = Math.sin(cam.heading);
    const hz = this.haze, PW = this.PW, pano = this.pano, headPx = (cam.heading / (2 * Math.PI)) * PW;
    for (let sx = 0; sx < W; sx++) {
      const ox = (sx - CX) / F, dx = fw0 + rt0 * ox, dy = fw1 + rt1 * ox;
      let ybuf = H, z = 0.3, dz = 0.04;
      while (z < ZF) {
        const gx = ((cam.x + dx * z - X0) * RES) | 0, gy = ((cam.y + dy * z - Y0) * RES) | 0;
        if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) break;
        const i = gy * GW + gx, sy = (HZ + (cam.h - height[i]) * F / z) | 0;
        if (sy < ybuf) {
          const c = col[i], r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255;
          const f = this.fog(z) * 7, lo = Math.floor(f), frac = f - lo, k0 = lo / 7, k1 = (lo + 1) / 7;
          const ca = pack(r + (hz[0] - r) * k0, g + (hz[1] - g) * k0, b + (hz[2] - b) * k0);
          const cb = pack(r + (hz[0] - r) * k1, g + (hz[1] - g) * k1, b + (hz[2] - b) * k1);
          const top = sy < 0 ? 0 : sy;
          for (let y = top; y < ybuf; y++) { const p = y * W + sx; buf[p] = BAYER[(y & 3) * 4 + (sx & 3)] < frac ? cb : ca; depth[p] = z; }
          ybuf = top;
          if (ybuf <= 0) break;
        }
        z += dz; dz *= 1.016;
      }
      for (let y = HZ; y < ybuf; y++) { buf[y * W + sx] = this.farCol; depth[y * W + sx] = ZF; }
      const sky = Math.min(ybuf, HZ);
      let px = Math.round(headPx + Math.atan(ox) * F) % PW; if (px < 0) px += PW;
      for (let y = 0; y < sky; y++) { buf[y * W + sx] = pano[y * PW + px]; depth[y * W + sx] = 1e9; }
    }
    // trees (the flag is drawn each frame by drawFlag so it can wave)
    for (const tr of t.trees) this.blit(cam, this.sprites[tr.type][tr.variant], tr.x, tr.y, tr.baseH, tr.height);
    this.baseBuf.set(buf); this.baseDepth.set(depth);
    this.cam = cam;
  }

  project(x, y, h, cam = this.cam) {
    const dx = x - cam.x, dy = y - cam.y, fw0 = Math.sin(cam.heading), fw1 = -Math.cos(cam.heading);
    const z = dx * fw0 + dy * fw1, lx = dx * -fw1 + dy * fw0;
    return { z, sx: CX + lx * F / z, sy: HZ + (cam.h - h) * F / z, s: F / z };
  }

  blit(cam, spr, x, y, baseH, worldH) {
    const p = this.project(x, y, baseH, cam);
    if (p.z < (worldH > 5 ? 5 : 1.2) || p.z > ZF) return; // walk "through" trees right next to the camera
    const ph = worldH * p.s, pw = ph * spr.w / spr.h, left = p.sx - pw / 2, top = p.sy - ph;
    if (left > W || left + pw < 0 || top > H || p.sy < 0) return;
    const x0 = Math.max(0, Math.floor(left)), x1 = Math.min(W, Math.ceil(left + pw)), y0 = Math.max(0, Math.floor(top)), y1 = Math.min(H, Math.ceil(p.sy));
    const f = this.fog(p.z), hz = this.haze, { buf, depth } = this, z = p.z;
    for (let sy = y0; sy < y1; sy++) {
      const v = ((sy - top) / ph * spr.h) | 0; if (v < 0 || v >= spr.h) continue;
      for (let sx = x0; sx < x1; sx++) {
        const u = ((sx - left) / pw * spr.w) | 0; if (u < 0 || u >= spr.w) continue;
        const c = spr.px[v * spr.w + u]; if (!c) continue;
        const i = sy * W + sx; if (z >= depth[i]) continue;
        const r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255;
        buf[i] = pack(r + (hz[0] - r) * f, g + (hz[1] - g) * f, b + (hz[2] - b) * f); depth[i] = z;
      }
    }
  }

  // --- per-frame overlay on the cached frame ---
  begin() { this.buf.set(this.baseBuf); this.depth.set(this.baseDepth); }
  end() { this.ctx.putImageData(this.img, 0, 0); }

  plot(x, y, c, z) {
    x |= 0; y |= 0; if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x; if (z !== undefined && z > this.depth[i]) return;
    this.buf[i] = c;
  }
  line(x0, y0, x1, y1, c, z) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let n = 0; n < 400; n++) {
      this.plot(x0, y0, c, z);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  drawBall(ball, ground, showMarker) {
    const white = pack(255, 255, 255), dark = pack(40, 40, 30);
    if (ball.h - ground > 0.15) {
      const s = this.project(ball.x, ball.y, ground);
      if (s.z > 1) { this.plot(s.sx, s.sy, dark, s.z - 1); this.plot(s.sx + 1, s.sy, dark, s.z - 1); }
    }
    const p = this.project(ball.x, ball.y, ball.h + 0.05);
    if (p.z < 0.5) return;
    const r = clamp(0.07 * p.s, 0.8, 5); // a little larger than life (0.021m) so it reads, but in proportion to the cup
    for (let y = Math.floor(p.sy - r); y <= Math.ceil(p.sy + r); y++) for (let x = Math.floor(p.sx - r); x <= Math.ceil(p.sx + r); x++)
      if ((x - p.sx) ** 2 + (y - p.sy) ** 2 <= r * r + 0.3) this.plot(x, y, white, p.z - 1.5);
    if (showMarker && r < 2) {
      const m = pack(...hex(THEME.ui.border)), x = Math.round(p.sx), y = Math.round(p.sy) - 6;
      this.line(x - 2, y - 2, x + 2, y - 2, m); this.line(x - 1, y - 1, x + 1, y - 1, m); this.plot(x, y, m);
    }
  }

  // Landing marker: a ring on the ground with a small red-and-white pole
  drawTarget(x, y) {
    const h = this.t.heightAt(x, y), p = this.project(x, y, h);
    if (p.z < 2) return;
    const white = pack(255, 255, 255), red = pack(...hex(THEME.ui.flag)), dark = pack(...hex(THEME.ui.border));
    const rx = Math.max(3, 4 * p.s), ry = Math.max(1.5, rx * Math.min(0.5, (this.cam.h - h) / p.z));
    for (let a = 0; a < 6.28; a += 0.12) {
      this.plot(p.sx + Math.cos(a) * rx, p.sy + Math.sin(a) * ry + 1, dark, p.z - 3);
      this.plot(p.sx + Math.cos(a) * rx, p.sy + Math.sin(a) * ry, white, p.z - 3);
    }
    const ph = Math.max(7, 3 * p.s);
    for (let i = 0; i < ph; i++) this.plot(p.sx, p.sy - i, (Math.floor(i / 2) % 2) ? white : red);
  }

  // The cup: dark hole, the lit far wall of the white liner, and a trimmed collar of grass around it
  drawCup() {
    const pin = this.hole.pin, p = this.project(pin.x, pin.y, this.pinH);
    if (p.z < 0.5) return;
    const R = 0.16, rx = Math.max(0.8, R * p.s), ry = Math.max(0.6, rx * clamp((this.cam.h - this.pinH) / p.z, 0.12, 0.6));
    const hole = pack(22, 26, 18), wall = pack(70, 78, 56), liner = pack(236, 236, 224), collar = pack(150, 190, 96), z = p.z - 0.5;
    if (rx > 2.5) // collar of slightly darker, shorter grass
      for (let y = Math.floor(p.sy - ry * 1.5); y <= Math.ceil(p.sy + ry * 1.5); y++) for (let x = Math.floor(p.sx - rx * 1.5); x <= Math.ceil(p.sx + rx * 1.5); x++) {
        const d = ((x - p.sx) / rx) ** 2 + ((y - p.sy) / ry) ** 2;
        if (d > 1.1 && d <= 1.45 && ((x + y) & 1)) this.plot(x, y, collar, z);
      }
    for (let y = Math.floor(p.sy - ry); y <= Math.ceil(p.sy + ry); y++) for (let x = Math.floor(p.sx - rx); x <= Math.ceil(p.sx + rx); x++) {
      const u = (x - p.sx) / rx, v = (y - p.sy) / ry, d = u * u + v * v;
      if (d > 1.1) continue;
      let c = hole;
      if (rx > 2.5) {
        // the far inside wall is visible and catches the light; the liner's top edge is a bright rim
        const rim = v < 0 && d > 0.72, far = v < -0.15 && v < -Math.sqrt(Math.max(0, 1 - u * u)) * 0.35;
        c = rim ? liner : far ? wall : hole;
      }
      this.plot(x, y, c, z);
    }
  }

  // The pin: a thin white pole with a red flag that waves with the wind. Scaled up a little when far
  // away so it can always be seen from the tee.
  drawFlag(wind, time) {
    const pin = this.hole.pin, base = this.project(pin.x, pin.y, this.pinH);
    if (base.z < 0.6) return;
    const POLE = 2.3, k = Math.max(1, 12 / (POLE * base.s)), ph = POLE * k;
    const white = pack(248, 246, 236), shade = pack(196, 196, 186), z = base.z - 0.3;
    const top = this.project(pin.x, pin.y, this.pinH + ph);
    const pw = Math.max(1, Math.min(4, 0.03 * base.s));
    for (let y = Math.floor(top.sy); y <= Math.ceil(base.sy); y++)
      for (let i = 0; i < pw; i++) this.plot(base.sx + i - Math.floor(pw / 2), y, i === pw - 1 && pw > 1 ? shade : white, z);
    // the flag streams downwind
    // (bent towards side-on to the camera, so it never shows up as a thin edge-on sliver)
    const ws = Math.hypot(wind.x, wind.y), rx = Math.cos(this.cam.heading), ry = Math.sin(this.cam.heading);
    let wx = ws > 0.2 ? wind.x / ws : rx, wy = ws > 0.2 ? wind.y / ws : ry;
    const sd = wx * rx + wy * ry >= 0 ? 1 : -1; wx = wx * 0.35 + rx * sd; wy = wy * 0.35 + ry * sd;
    const wl = Math.hypot(wx, wy); wx /= wl; wy /= wl;
    const FW = 0.55 * k, FH = 0.36 * k, flap = 0.6 + Math.min(1, ws / 4) * 1.4;
    const red = hex(THEME.ui.flag), steps = clamp(Math.ceil(FW * base.s * 1.6), 6, 260), vsteps = clamp(Math.ceil(FH * base.s * 1.6), 4, 200);
    for (let i = 0; i <= steps; i++) {
      const u = i / steps, wave = Math.sin(time * 5 * flap - u * 5) * u, droop = (1 - Math.min(1, ws / 3)) * 0.5 * u;
      const px = pin.x + wx * u * FW - wy * wave * 0.08 * k, py = pin.y + wy * u * FW + wx * wave * 0.08 * k;
      const lit = 0.82 + 0.18 * Math.cos(time * 5 * flap - u * 5); // folds catch the light
      const c = pack(red[0] * lit, red[1] * lit, red[2] * lit);
      for (let j = 0; j <= vsteps; j++) {
        const v = j / vsteps, h = this.pinH + ph - FH * (v + droop * v * 0.6) - droop * FH * 0.4;
        const q = this.project(px, py, h); if (q.z < 0.5) continue;
        this.plot(q.sx, q.sy, c, q.z - 0.3);
        if (q.s > 30) this.plot(q.sx + 1, q.sy, c, q.z - 0.3);
      }
    }
  }

  // Predicted putt: white dots with a dark edge so they read on the green
  drawPath(pts) {
    const white = pack(255, 255, 255), dark = pack(...hex(THEME.ui.border));
    pts.forEach(([x, y, h], i) => {
      const p = this.project(x, y, h + 0.01); if (p.z < 0.8) return;
      const s = p.s > 40 ? 2 : 1;
      for (let a = 0; a < s; a++) { this.plot(p.sx + a, p.sy + s, dark, p.z - 0.5); for (let b = 0; b < s; b++) this.plot(p.sx + a, p.sy + b, white, p.z - 0.5); }
    });
  }

  // Slopes: little specks of light that drift downhill across the green, faster where it's steeper
  drawSlopeFlow(time) {
    const t = this.t, pin = this.hole.pin, c = pack(250, 244, 222), c2 = pack(222, 236, 176); // light streaks: stand out on the green without looking like dirt
    for (let gy = -15; gy <= 15; gy += 1.5) for (let gx = -15; gx <= 15; gx += 1.5) {
      const x0 = pin.x + gx, y0 = pin.y + gy;
      if (t.surfaceAt(x0, y0) !== SURF.GREEN) continue;
      const [ax, ay] = t.gradAt(x0, y0), m = Math.hypot(ax, ay); if (m < 0.004) continue;
      const seed = Math.abs(Math.sin(gx * 12.9898 + gy * 78.233)) % 1, k = (time * (0.25 + m * 12) + seed) % 1;
      const x = x0 - ax / m * k * 1.4, y = y0 - ay / m * k * 1.4;
      if (t.surfaceAt(x, y) !== SURF.GREEN) continue;
      const p = this.project(x, y, t.heightAt(x, y) + 0.01); if (p.z < 0.8) continue;
      // a short dark streak with a softer tail, pointing downhill
      const q = this.project(x + ax / m * 0.25, y + ay / m * 0.25, t.heightAt(x, y) + 0.01);
      this.plot(p.sx, p.sy, c, p.z - 0.5);
      if (q.z > 0.8) this.plot(q.sx, q.sy, c2, q.z - 0.5);
    }
  }
}
