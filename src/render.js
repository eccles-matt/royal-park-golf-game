// Software renderer: heightmap "voxel" terrain marched per screen column, depth-tested tree sprites,
// then a ball and markers on top. Everything is drawn at 288x216 and scaled up with nearest-neighbour.
import { THEME, hex, lerp3 } from "./theme.js";
import { pack, clamp, BAYER, rng } from "./util.js";
import { SURF } from "./terrain.js";

export const W = 288, H = 216, HZ = 78, F = W * 0.95, CX = W / 2;
const ZF = 620;

export class Renderer {
  constructor(canvas, terrain, hole, sprites) {
    this.canvas = canvas; canvas.width = W; canvas.height = H;
    this.ctx = canvas.getContext("2d");
    this.t = terrain; this.hole = hole; this.sprites = sprites;
    this.img = this.ctx.createImageData(W, H);
    this.buf = new Uint32Array(this.img.data.buffer);
    this.depth = new Float32Array(W * H);
    this.baseBuf = new Uint32Array(W * H);
    this.baseDepth = new Float32Array(W * H);
    this.haze = hex(THEME.haze);
    const far = lerp3(hex(THEME.rough), this.haze, 0.82);
    this.farCol = pack(far[0], far[1], far[2]);
    for (const tr of terrain.trees) tr.baseH = terrain.heightAt(tr.x, tr.y);
    this.pinH = terrain.heightAt(hole.pin.x, hole.pin.y);
    this.buildSky();
  }

  buildSky() {
    const fov = 2 * Math.atan(CX / F);
    const PW = this.PW = Math.round(W * 2 * Math.PI / fov), cv = document.createElement("canvas");
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
    // trees, then flag
    for (const tr of t.trees) this.blit(cam, this.sprites[tr.type][tr.variant], tr.x, tr.y, tr.baseH, tr.height);
    this.blit(cam, this.sprites.flag, this.hole.pin.x, this.hole.pin.y, this.pinH, 2.4);
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
    const r = clamp(0.3 * p.s, 0.6, 5);
    for (let y = Math.floor(p.sy - r); y <= Math.ceil(p.sy + r); y++) for (let x = Math.floor(p.sx - r); x <= Math.ceil(p.sx + r); x++)
      if ((x - p.sx) ** 2 + (y - p.sy) ** 2 <= r * r + 0.3) this.plot(x, y, white, p.z - 1.5);
    if (showMarker && r < 2) {
      const m = pack(...hex(THEME.ui.border)), x = Math.round(p.sx), y = Math.round(p.sy) - 6;
      this.line(x - 2, y - 2, x + 2, y - 2, m); this.line(x - 1, y - 1, x + 1, y - 1, m); this.plot(x, y, m);
    }
  }

  drawTarget(x, y) {
    const h = this.t.heightAt(x, y), p = this.project(x, y, h);
    if (p.z < 2) return;
    const c = pack(255, 255, 255), rx = Math.max(2, 3 * p.s), ry = Math.max(1, rx * 0.35);
    for (let a = 0; a < 6.28; a += 0.25) this.plot(p.sx + Math.cos(a) * rx, p.sy + Math.sin(a) * ry, c, p.z - 2);
  }

  // Slope arrows on and around the green, pointing downhill
  drawSlopes(ball) {
    const t = this.t, c = pack(...hex(THEME.ui.border)), tip = pack(255, 255, 255), pin = this.hole.pin;
    for (let gy = -16; gy <= 16; gy += 2) for (let gx = -16; gx <= 16; gx += 2) {
      const x = pin.x + gx, y = pin.y + gy, s = t.surfaceAt(x, y);
      if (s !== SURF.GREEN && s !== SURF.FRINGE) continue;
      const [ax, ay] = t.gradAt(x, y), m = Math.hypot(ax, ay); if (m < 0.004) continue;
      const len = Math.min(1.2, m * 30), ex = x - ax / m * len, ey = y - ay / m * len;
      const a = this.project(x, y, t.heightAt(x, y) + 0.02), b = this.project(ex, ey, t.heightAt(ex, ey) + 0.02);
      if (a.z < 1 || b.z < 1) continue;
      this.line(a.sx, a.sy, b.sx, b.sy, c, a.z - 0.6); this.plot(b.sx, b.sy, tip, b.z - 0.6);
    }
  }
}
