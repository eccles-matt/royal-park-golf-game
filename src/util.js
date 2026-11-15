export function rng(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

// 4x4 ordered-dither thresholds in 0..1
export const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);

// Pack an [r,g,b] into the little-endian ABGR word ImageData expects
export const pack = (r, g, b) => (255 << 24 | (b & 255) << 16 | (g & 255) << 8 | (r & 255)) >>> 0;
