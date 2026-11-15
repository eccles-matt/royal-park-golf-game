// Builds the height grid, surface grid and colour grid for a hole.
import { THEME, hex } from "./theme.js";
import { makeHeightFn, makeTrees } from "./course.js";
import { pack, clamp } from "./util.js";

export const SURF = { ROUGH: 0, FAIRWAY: 1, FRINGE: 2, GREEN: 3, BUNKER: 4, TEE: 5 };
export const SURF_NAME = ["ROUGH", "FAIRWAY", "FRINGE", "GREEN", "BUNKER", "TEE"];

export function buildTerrain(hole) {
  const RES = 2, X0 = -150, Y0 = -150, GW = 1200, GH = 1400;
  const hf = makeHeightFn(hole), trees = makeTrees(hole);
  const height = new Float32Array(GW * GH);
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) height[gy * GW + gx] = hf(X0 + gx / RES, Y0 + gy / RES);

  // surfaces, painted with canvas paths then read back
  const cv = document.createElement("canvas"); cv.width = GW; cv.height = GH;
  const c = cv.getContext("2d");
  c.setTransform(RES, 0, 0, RES, -X0 * RES, -Y0 * RES);
  const code = k => `rgb(${k * 40},0,0)`;
  c.fillStyle = code(0); c.fillRect(X0, Y0, GW / RES, GH / RES);
  const fairway = (w, k) => {
    const p = hole.fairway.path; c.beginPath(); c.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length - 1; i++) c.quadraticCurveTo(p[i][0], p[i][1], (p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2);
    c.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
    c.lineWidth = w; c.lineCap = "round"; c.lineJoin = "round"; c.strokeStyle = code(k); c.stroke();
  };
  const ell = (e, grow, k) => { c.beginPath(); c.ellipse(e.x, e.y, e.rx + grow, e.ry + grow, e.rot || 0, 0, Math.PI * 2); c.fillStyle = code(k); c.fill(); };
  fairway(hole.fairway.width + 6, SURF.FRINGE);
  fairway(hole.fairway.width, SURF.FAIRWAY);
  ell(hole.green, 2.5, SURF.FRINGE);
  ell(hole.green, 0, SURF.GREEN);
  for (const b of hole.bunkers) ell(b, 0, SURF.BUNKER);
  const t = hole.tee; c.fillStyle = code(SURF.TEE); c.fillRect(t.x - t.w / 2, t.y - t.h / 2, t.w, t.h);
  const sd = c.getImageData(0, 0, GW, GH).data, surf = new Uint8Array(GW * GH);
  for (let i = 0; i < surf.length; i++) surf[i] = Math.round(sd[i * 4] / 40);

  // colours with hill shading (sun low in the west for golden hour)
  const T = THEME, col = new Uint32Array(GW * GH);
  const C = Object.fromEntries(Object.entries(T).filter(([, v]) => typeof v === "string").map(([k, v]) => [k, hex(v)]));
  const L = (() => { const v = [-0.62, 0.2, 0.76], n = Math.hypot(...v); return v.map(a => a / n); })();
  const shadow = new Float32Array(GW * GH).fill(1);
  for (const tr of trees) {
    const cx = tr.x + tr.canopy * 1.7, cy = tr.y + 0.6, rx = tr.canopy * 1.8, ry = tr.canopy * 0.85;
    const gx0 = Math.max(0, ((cx - rx - X0) * RES) | 0), gx1 = Math.min(GW - 1, ((cx + rx - X0) * RES) | 0);
    const gy0 = Math.max(0, ((cy - ry - Y0) * RES) | 0), gy1 = Math.min(GH - 1, ((cy + ry - Y0) * RES) | 0);
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
      const u = (X0 + gx / RES - cx) / rx, v = (Y0 + gy / RES - cy) / ry;
      if (u * u + v * v < 1) shadow[gy * GW + gx] = 0.8;
    }
  }
  const b = hole.bounds, pin = hole.pin;
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
    const i = gy * GW + gx, x = X0 + gx / RES, y = Y0 + gy / RES, s = surf[i];
    let base;
    if (s === SURF.FAIRWAY || s === SURF.TEE) base = Math.floor(y / 7) % 2 ? C.stripe : C.fairway;
    else if (s === SURF.FRINGE) base = C.fringe;
    else if (s === SURF.GREEN) base = C.green;
    else if (s === SURF.BUNKER) {
      const edge = surf[i - 1] !== s || surf[i + 1] !== s || surf[i - GW] !== s || surf[i + GW] !== s;
      base = edge ? C.sandEdge : C.sand;
    } else {
      const inPlay = x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
      const n = Math.sin(x * 0.21 + Math.sin(y * 0.13)) + Math.sin(y * 0.17 + Math.cos(x * 0.11)) + Math.sin((x + y) * 0.53) * 0.4;
      base = n > (inPlay ? 0.9 : 0.2) ? C.roughDark : C.rough;
    }
    // shading from the slope
    const hx = (height[i + (gx < GW - 1 ? 1 : 0)] - height[i - (gx > 0 ? 1 : 0)]) * RES / 2;
    const hy = (height[i + (gy < GH - 1 ? GW : 0)] - height[i - (gy > 0 ? GW : 0)]) * RES / 2;
    const nl = Math.hypot(hx, hy, 1);
    let shade = ((-hx * L[0] - hy * L[1] + L[2]) / nl) / L[2];
    shade = Math.round(clamp(shade, 0.62, 1.3) * 12) / 12 * shadow[i];
    col[i] = pack(Math.min(255, base[0] * shade * 1.02), Math.min(255, base[1] * shade), Math.min(255, base[2] * shade * 0.94));
  }

  // minimap image of the in-play area
  const mm = document.createElement("canvas"); mm.width = 60; mm.height = 80;
  const md = mm.getContext("2d").createImageData(60, 80), m32 = new Uint32Array(md.data.buffer);
  for (let my = 0; my < 80; my++) for (let mx = 0; mx < 60; mx++) {
    const gx = ((b.x0 + (mx + 0.5) * (b.x1 - b.x0) / 60 - X0) * RES) | 0, gy = ((b.y0 + (my + 0.5) * (b.y1 - b.y0) / 80 - Y0) * RES) | 0;
    m32[my * 60 + mx] = col[gy * GW + gx];
  }
  mm.getContext("2d").putImageData(md, 0, 0);

  const idx = (x, y) => {
    const gx = Math.round((x - X0) * RES), gy = Math.round((y - Y0) * RES);
    return gx < 0 || gy < 0 || gx >= GW || gy >= GH ? -1 : gy * GW + gx;
  };
  return {
    RES, X0, Y0, GW, GH, height, surf, col, trees, minimap: mm, heightFn: hf,
    heightAt: hf,
    surfaceAt(x, y) { const i = idx(x, y); return i < 0 ? SURF.ROUGH : surf[i]; },
    gradAt(x, y) { const e = 0.25; return [(hf(x + e, y) - hf(x - e, y)) / (2 * e), (hf(x, y + e) - hf(x, y - e)) / (2 * e)]; },
    inPlay(x, y) { return x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1; }
  };
}
