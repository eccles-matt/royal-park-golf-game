// Pixel sprites for trees and the flag, drawn once at start-up.
import { THEME } from "./theme.js";
import { rng } from "./util.js";

function toSprite(cv) {
  const { width: w, height: h } = cv, d = cv.getContext("2d").getImageData(0, 0, w, h).data, px = new Uint32Array(w * h);
  for (let i = 0; i < w * h; i++) px[i] = d[i * 4 + 3] > 140 ? (255 << 24 | d[i * 4 + 2] << 16 | d[i * 4 + 1] << 8 | d[i * 4]) >>> 0 : 0;
  return { w, h, px };
}

function clump(c, x, y, r, R, dark, light) {
  c.fillStyle = dark;
  for (let i = 0; i < 7; i++) { const a = R() * 6.28, d = R() * r * 0.55; c.beginPath(); c.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.75, r * (0.42 + R() * 0.25), r * (0.32 + R() * 0.2), 0, 0, 7); c.fill(); }
  c.fillStyle = light;
  for (let i = 0; i < 4; i++) { const a = R() * 6.28, d = R() * r * 0.35; c.beginPath(); c.ellipse(x - r * 0.22 + Math.cos(a) * d, y - r * 0.25 + Math.sin(a) * d, r * (0.2 + R() * 0.12), r * (0.14 + R() * 0.1), 0, 0, 7); c.fill(); }
}

function riverGum(seed) {
  const W = 56, H = 64, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const c = cv.getContext("2d"), R = rng(seed), T = THEME;
  const fork = H * (0.5 + R() * 0.08), tw = 4;
  c.fillStyle = T.trunk; c.fillRect(W / 2 - tw / 2, fork, tw, H - fork);
  c.fillStyle = T.trunkShade; c.fillRect(W / 2 + 1, fork, 1, H - fork);
  c.fillRect(W / 2 - 1, fork + 6 + R() * 8, 2, 3);
  const n = 3 + (R() < 0.4 ? 1 : 0), tips = [];
  c.strokeStyle = T.trunk; c.lineCap = "round";
  for (let k = 0; k < n; k++) {
    const ang = -Math.PI / 2 + (k - (n - 1) / 2) * 0.62 + (R() - 0.5) * 0.3, len = H * (0.24 + R() * 0.12);
    const ex = W / 2 + Math.cos(ang) * len, ey = fork + Math.sin(ang) * len;
    c.lineWidth = 2.4; c.beginPath(); c.moveTo(W / 2, fork); c.lineTo(ex, ey); c.stroke();
    tips.push([ex, ey]);
  }
  tips.forEach(([ex, ey]) => clump(c, ex, ey - 2, 9 + R() * 4, R, T.gumDark, T.gumLight));
  return toSprite(cv);
}

function softGum(seed) {
  const W = 44, H = 50, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const c = cv.getContext("2d"), R = rng(seed), T = THEME, top = H * 0.48;
  c.fillStyle = T.trunk; c.fillRect(W / 2 - 2, top, 4, H - top);
  c.fillStyle = T.trunkShade; c.fillRect(W / 2 + 1, top, 1, H - top);
  clump(c, W / 2, H * 0.36, 17, R, T.softDark, T.softLight);
  clump(c, W / 2 - 6 + R() * 12, H * 0.24, 10, R, T.softDark, T.softLight);
  return toSprite(cv);
}

function flag() {
  const cv = document.createElement("canvas"); cv.width = 8; cv.height = 24;
  const c = cv.getContext("2d"); c.fillStyle = "#ffffff"; c.fillRect(1, 0, 1, 24);
  c.fillStyle = THEME.ui.flag; c.fillRect(2, 0, 6, 5);
  return toSprite(cv);
}

export function buildSprites() {
  return {
    river: [11, 22, 33].map(riverGum),
    soft: [44, 55, 66].map(softGum),
    flag: flag()
  };
}
