// Builds the height grid, surface grid and colour grid for the whole course (all nine holes share one world).
import { THEME, hex } from "./theme.js";
import { makeHeightFn, makeTrees, inCutting, smoothPath, distToLine } from "./course.js";
import { pack, clamp } from "./util.js";

export const SURF = { ROUGH: 0, FAIRWAY: 1, FRINGE: 2, GREEN: 3, BUNKER: 4, TEE: 5, ROAD: 6 };
export const SURF_NAME = ["ROUGH", "FAIRWAY", "FRINGE", "GREEN", "BUNKER", "TEE", "TRACKS"];

// mask is the traced course map (see tools/trace_map.py): one class per pixel, stored as class * 30
const CLASS_SURF = [SURF.ROUGH, SURF.ROUGH, SURF.FAIRWAY, SURF.FRINGE, SURF.GREEN, SURF.BUNKER, SURF.ROAD, SURF.TEE];
const PARK = 0, LIGHT_ROUGH = 1, COLLAR = 3, GREEN = 4, TEE = 7;

// A polyline with running lengths, for finding the nearest point, how far along it is, and which side
function withLengths(pts) {
  const len = [0]; for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, len, yAt(x) { for (let i = 0; i < pts.length - 1; i++) if (x >= pts[i][0] && x <= pts[i + 1][0]) return pts[i][1] + (pts[i + 1][1] - pts[i][1]) * (x - pts[i][0]) / (pts[i + 1][0] - pts[i][0]); return pts[x < pts[0][0] ? 0 : pts.length - 1][1]; } };
}
function nearest(L, x, y) {
  let best = 1e18, out = null;
  for (let i = 0; i < L.pts.length - 1; i++) {
    const [ax, ay] = L.pts[i], [bx, by] = L.pts[i + 1], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)), ex = ax + dx * t - x, ey = ay + dy * t - y, d2 = ex * ex + ey * ey;
    if (d2 < best) { best = d2; const l = Math.sqrt(l2); out = { along: L.len[i] + t * l, off: ((x - ax) * -dy + (y - ay) * dx) / l }; }
  }
  out.d = Math.sqrt(best); return out;
}

export function buildTerrain(course, mask) {
  const w = course.world, M = 70, RES = 2, X0 = w.x0 - M, Y0 = w.y0 - M;
  const GW = Math.ceil((w.x1 - w.x0 + 2 * M) * RES), GH = Math.ceil((w.y1 - w.y0 + 2 * M) * RES);
  const hf = makeHeightFn(course);
  const height = new Float32Array(GW * GH);
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) height[gy * GW + gx] = hf(X0 + gx / RES, Y0 + gy / RES);

  // surfaces: the traced map scaled up to the grid, then hole 6 and the tee boxes painted on top
  const cv = document.createElement("canvas"); cv.width = GW; cv.height = GH;
  const c = cv.getContext("2d", { willReadFrequently: true });
  c.imageSmoothingEnabled = false;
  c.setTransform(RES, 0, 0, RES, -X0 * RES, -Y0 * RES);
  const code = k => `rgb(${k * 30},${k * 30},${k * 30})`;
  c.fillStyle = code(PARK); c.fillRect(X0, Y0, GW / RES, GH / RES);
  c.drawImage(mask, 0, 0, course.maskSize[0] * course.px, course.maskSize[1] * course.px);
  const sd = c.getImageData(0, 0, GW, GH).data, surf = new Uint8Array(GW * GH), park = new Uint8Array(GW * GH);
  const cls = new Uint8Array(GW * GH);
  for (let i = 0; i < cls.length; i++) cls[i] = Math.min(7, Math.round(sd[i * 4] / 30));
  // painted cell by cell (not with canvas paths) so edges stay crisp and never blend into other classes
  const paint = (x0, y0, x1, y1, f) => {
    for (let gy = Math.max(0, ((y0 - Y0) * RES) | 0); gy <= Math.min(GH - 1, ((y1 - Y0) * RES) | 0); gy++)
      for (let gx = Math.max(0, ((x0 - X0) * RES) | 0); gx <= Math.min(GW - 1, ((x1 - X0) * RES) | 0); gx++) {
        const i = gy * GW + gx, k = f(X0 + gx / RES, Y0 + gy / RES, cls[i]); if (k !== undefined) cls[i] = k;
      }
  };
  // hole 6: light rough from tee to green, then the green and its collar
  const h6 = course.holes[5], line6 = smoothPath(course.hole6.path), half6 = course.hole6.width / 2, g6 = h6.green;
  const inEll = (e, grow, x, y) => { const dx = x - e.x, dy = y - e.y, c = Math.cos(-e.rot), s = Math.sin(-e.rot), u = (dx * c - dy * s) / (e.rx + grow), v = (dx * s + dy * c) / (e.ry + grow); return u * u + v * v <= 1; };
  paint(Math.min(...line6.map(q => q[0])) - half6, Math.min(...line6.map(q => q[1])) - half6, Math.max(...line6.map(q => q[0])) + half6, Math.max(...line6.map(q => q[1])) + half6,
    (x, y, k) => k === PARK && distToLine(line6, x, y) < half6 ? LIGHT_ROUGH : undefined);
  paint(g6.x - 20, g6.y - 20, g6.x + 20, g6.y + 20, (x, y) => inEll(g6, 0, x, y) ? GREEN : inEll(g6, 3, x, y) ? COLLAR : undefined);
  // tee boxes, lined up with the shot
  for (const h of course.holes) {
    const t = h.tee, c = Math.cos(t.rot), s = Math.sin(t.rot);
    paint(t.x - 8, t.y - 8, t.x + 8, t.y + 8, (x, y) => { const dx = x - t.x, dy = y - t.y, u = dx * c + dy * s, v = -dx * s + dy * c; return Math.abs(u) <= t.w / 2 && Math.abs(v) <= t.h / 2 ? TEE : undefined; });
  }
  for (let i = 0; i < surf.length; i++) { const k = cls[i]; surf[i] = CLASS_SURF[k]; park[i] = k === PARK ? 1 : k === LIGHT_ROUGH ? 0 : 2; }
  const idx = (x, y) => {
    const gx = Math.round((x - X0) * RES), gy = Math.round((y - Y0) * RES);
    return gx < 0 || gy < 0 || gx >= GW || gy >= GH ? -1 : gy * GW + gx;
  };
  const trees = makeTrees(course, (x, y) => { const i = idx(x, y); return i < 0 || park[i] === 1; });

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
  // railway and tram tracks: ballast, sleepers and two steel rails per track
  const trainLine = withLengths(smoothPath(course.train)), tramLine = withLengths(smoothPath(course.tram)), cut = course.cut;
  const sleeper = C.sleeper, rail = C.rail, ballast = C.ballast;
  const trackCol = (off, along, gauge) => {
    const a = Math.abs(off);
    if (Math.abs(a - gauge / 2) < 0.2) return rail;
    if (a < gauge / 2 + 0.6 && along % 0.7 < 0.3) return sleeper;
    return null;
  };
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
    const i = gy * GW + gx, x = X0 + gx / RES, y = Y0 + gy / RES, s = surf[i];
    let base;
    // in the railway cutting: two tracks on ballast, clay walls with scrubby grass
    if (x > course.cutFrom - 4 && Math.abs(y - trainLine.yAt(x)) < cut.top + 12) {
      const n = nearest(trainLine, x, y);
      if (n.d < cut.top) {
        if (n.d < cut.floor) {
          base = trackCol(n.off - 1.9, n.along, 1.435) || trackCol(n.off + 1.9, n.along, 1.435) || ballast;
        } else base = ((x * 3.1 + y * 1.7) | 0) % 5 === 0 ? C.parkDark : C.clay;
        surf[i] = SURF.ROAD;
      }
    }
    if (surf[i] === SURF.ROAD && base === undefined) {
      const n = nearest(tramLine, x, y);
      base = n.d < 2.2 ? (trackCol(n.off, n.along, 1.435) || ballast) : C.roughDark;
    }
    if (base !== undefined) {} else
    if (s === SURF.FAIRWAY || s === SURF.TEE) base = Math.floor(y / 7) % 2 ? C.stripe : C.fairway;
    else if (s === SURF.FRINGE) base = C.fringe;
    else if (s === SURF.GREEN) base = Math.floor((y - x * 0.35) / 2.5) % 2 ? C.greenStripe : C.green;
    else if (s === SURF.BUNKER) {
      const edge = surf[i - 1] !== s || surf[i + 1] !== s || surf[i - GW] !== s || surf[i + GW] !== s;
      base = edge ? C.sandEdge : C.sand;
    } else {
      // light rough down the holes, patchier parkland grass under the trees
      const n = Math.sin(x * 0.21 + Math.sin(y * 0.13)) + Math.sin(y * 0.17 + Math.cos(x * 0.11)) + Math.sin((x + y) * 0.53) * 0.4;
      base = park[i] !== 1 ? (n > 1.2 ? C.roughDark : C.rough) : n > 0.2 ? C.parkDark : C.roughDark;
    }
    // shading from the slope
    const hx = (height[i + (gx < GW - 1 ? 1 : 0)] - height[i - (gx > 0 ? 1 : 0)]) * RES / 2;
    const hy = (height[i + (gy < GH - 1 ? GW : 0)] - height[i - (gy > 0 ? GW : 0)]) * RES / 2;
    const nl = Math.hypot(hx, hy, 1);
    let shade = ((-hx * L[0] - hy * L[1] + L[2]) / nl) / L[2];
    if (s === SURF.GREEN) shade = 1 + (shade - 1) * 0.35; // keep the putting surface smooth, not banded
    shade = Math.round(clamp(shade, 0.62, 1.3) * (s === SURF.GREEN ? 24 : 12)) / (s === SURF.GREEN ? 24 : 12) * shadow[i];
    col[i] = pack(Math.min(255, base[0] * shade * 1.02), Math.min(255, base[1] * shade), Math.min(255, base[2] * shade * 0.94));
  }

  // a minimap image for each hole
  const minimaps = course.holes.map(h => {
    const b = h.bounds, mm = document.createElement("canvas"); mm.width = 60; mm.height = 80;
    const md = mm.getContext("2d").createImageData(60, 80), m32 = new Uint32Array(md.data.buffer);
    for (let my = 0; my < 80; my++) for (let mx = 0; mx < 60; mx++) {
      const gx = clamp(((b.x0 + (mx + 0.5) * (b.x1 - b.x0) / 60 - X0) * RES) | 0, 0, GW - 1), gy = clamp(((b.y0 + (my + 0.5) * (b.y1 - b.y0) / 80 - Y0) * RES) | 0, 0, GH - 1);
      m32[my * 60 + mx] = col[gy * GW + gx];
    }
    mm.getContext("2d").putImageData(md, 0, 0);
    return mm;
  });

  return {
    RES, X0, Y0, GW, GH, height, surf, col, trees, minimaps, heightFn: hf,
    heightAt: hf,
    surfaceAt(x, y) { const i = idx(x, y); return i < 0 ? SURF.ROUGH : surf[i]; },
    gradAt(x, y) { const e = 0.25; return [(hf(x + e, y) - hf(x - e, y)) / (2 * e), (hf(x, y + e) - hf(x, y - e)) / (2 * e)]; },
    // out of bounds: off the edge of the park, on the tram tracks, or over the fence into the railway cutting
    inPlay(x, y) {
      if (x < w.x0 || x > w.x1 || y < w.y0 || y > w.y1) return false;
      const i = idx(x, y); if (i >= 0 && surf[i] === SURF.ROAD) return false;
      const f8 = course.fence8; if (x < f8[0][0] && y > f8[0][1] && y < f8[f8.length - 1][1]) return false; // over the 8th's fence
      return !inCutting(course, x, y);
    }
  };
}
