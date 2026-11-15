// Golden hour palette (style kit choice B). Every colour in the game comes from here.
export const THEME = {
  sky: ["#6f7fbf", "#e8a98a", "#ffd9a0"],
  haze: "#f3d3a8",
  cloud: "#ffe3c4",
  city: "#b49aa6",
  rough: "#88a552",
  roughDark: "#7b974a",
  fairway: "#bdd477",
  stripe: "#cde086",
  fringe: "#a9c266",
  green: "#d3e98c",
  sand: "#f4d39a",
  sandEdge: "#d8b277",
  tee: "#d3e98c",
  teeMarker: "#3d4f8f",
  // river red gum
  gumDark: "#4c6b44",
  gumLight: "#a8b26a",
  // soft gum
  softDark: "#56744a",
  softLight: "#93a866",
  trunk: "#f0d6ae",
  trunkShade: "#b8926a",
  // clubhouse screen style (style kit choice B)
  ui: {
    card: "#f4ecd6",
    border: "#2f5d34",
    text: "#2f5d34",
    sub: "#3e7a3c",
    meterOn: "#3e7a3c",
    meterWarm: "#f4c542",
    meterHot: "#d8392f",
    meterOff: "#d9d0c0",
    flag: "#d8392f",
    ball: "#ffffff"
  }
};

export const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const lerp3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
