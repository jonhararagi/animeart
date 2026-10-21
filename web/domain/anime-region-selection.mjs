const MAX_PIXELS = 16_000_000;

function colorDistance(data, offset, color) {
  const dr = data[offset] - color[0];
  const dg = data[offset + 1] - color[1];
  const db = data[offset + 2] - color[2];
  return Math.sqrt((dr * dr + dg * dg + db * db) / 3);
}

/**
 * Selects a connected, color-similar region for flat anime/cel-shaded art.
 * It deliberately does not claim semantic hair recognition: line art and
 * enclosed flat-color shapes make this heuristic work best.
 */
export function selectAnimeRegion(imageData, x, y, { tolerance = 28, alphaThreshold = 8, maxPixels = MAX_PIXELS } = {}) {
  const width = Number(imageData?.width);
  const height = Number(imageData?.height);
  const data = imageData?.data;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 ||
      width * height > Math.min(MAX_PIXELS, maxPixels) || !data || data.length !== width * height * 4) {
    throw new TypeError("Anime region selection requires valid image pixels up to 16 megapixels");
  }
  const sx = Math.floor(Number(x));
  const sy = Math.floor(Number(y));
  if (!Number.isFinite(sx) || !Number.isFinite(sy) || sx < 0 || sy < 0 || sx >= width || sy >= height) {
    throw new RangeError("Selection point is outside the image");
  }
  const start = (sy * width + sx) * 4;
  if (data[start + 3] < alphaThreshold) return { width, height, mask: new Uint8Array(width * height), selectedPixels: 0, sourceColor: null };
  const sourceColor = [data[start], data[start + 1], data[start + 2]];
  const limit = Math.max(0, Math.min(255, Number(tolerance) || 0));
  const mask = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0, tail = 0;
  const seed = sy * width + sx;
  queue[tail++] = seed;
  mask[seed] = 1;
  while (head < tail) {
    const index = queue[head++];
    const px = index % width;
    const py = Math.floor(index / width);
    const neighbours = [px > 0 ? index - 1 : -1, px + 1 < width ? index + 1 : -1,
      py > 0 ? index - width : -1, py + 1 < height ? index + width : -1];
    for (const next of neighbours) {
      if (next < 0 || mask[next]) continue;
      const offset = next * 4;
      if (data[offset + 3] < alphaThreshold || colorDistance(data, offset, sourceColor) > limit) continue;
      mask[next] = 1;
      queue[tail++] = next;
    }
  }
  return { width, height, mask, selectedPixels: tail, sourceColor: "#" + sourceColor.map(value => value.toString(16).padStart(2, "0")).join("") };
}

export function combineAnimeRegionSelections(current, next, mode = "add") {
  const validRegion = region => region && Number.isInteger(region.width) && Number.isInteger(region.height) &&
    region.width > 0 && region.height > 0 && (region.mask instanceof Uint8Array || region.mask instanceof Uint8ClampedArray) &&
    region.mask.length === region.width * region.height;
  if (!validRegion(next)) throw new TypeError("Region selection requires a valid pixel mask");
  if (!["replace", "add", "subtract"].includes(mode)) throw new TypeError("Selection mode must be replace, add or subtract");
  if (current && !validRegion(current)) throw new TypeError("Current selection requires a valid pixel mask");
  if (current && (current.width !== next.width || current.height !== next.height)) {
    throw new RangeError("Region selections must use the same image dimensions");
  }
  const mask = new Uint8Array(next.width * next.height);
  let selectedPixels = 0;
  for (let i = 0; i < mask.length; i++) {
    const before = mode !== "replace" && Boolean(current?.mask[i]);
    const added = Boolean(next.mask[i]);
    mask[i] = mode === "replace" ? (added ? 1 : 0) :
      mode === "add" ? (before || added ? 1 : 0) : (before && !added ? 1 : 0);
    selectedPixels += mask[i];
  }
  return {
    width: next.width,
    height: next.height,
    mask,
    selectedPixels,
    sourceColor: mode !== "replace" && current?.sourceColor ? current.sourceColor : (next.sourceColor || null)
  };
}

export function animeColorFromHsv(hue, saturation, value) {
  const rawHue = Number(hue), rawSaturation = Number(saturation), rawValue = Number(value);
  const h = ((Number.isFinite(rawHue) ? rawHue : 0) % 360 + 360) % 360;
  const s = (Number.isFinite(rawSaturation) ? Math.max(0, Math.min(100, rawSaturation)) : 0) / 100;
  const v = (Number.isFinite(rawValue) ? Math.max(0, Math.min(100, rawValue)) : 0) / 100;
  const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
  const parts = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return "#" + parts.map(channel => Math.round((channel + m) * 255).toString(16).padStart(2, "0")).join("");
}

const COLOR_NAMES = Object.freeze({
  "marron claro": "#b9855a", "castano": "#75452f", "marron chocolate": "#4a2b22",
  "rubio miel": "#d7a64b", "rubio platino": "#e9dfc0", "rubio ceniza": "#b9b19c",
  "rubio dorado": "#e8bd58", "rubio arena": "#d8c08a",
  "rojo cereza": "#c62845", "rojo vino": "#7b1734", "rojo escarlata": "#e32636",
  "rojo coral": "#f05b64", "rojo carmesi": "#b91f3b", "cobre": "#b96842",
  "caramelo": "#c68642", "avellana": "#a87950", "caoba": "#7c2d26", "miel": "#d8a24a",
  "rosa pastel": "#f2a2c0", "rosa chicle": "#f44891", "rosa viejo": "#c08081",
  "fucsia": "#e0008a", "magenta": "#ff00ff", "coral": "#ff7f70", "salmon": "#fa8072",
  "durazno": "#ffcba4", "beige": "#d8c3a5", "arena": "#cbb994", "crema": "#fff1d0",
  "marfil": "#fffff0", "lavanda": "#c4b5fd", "lila": "#b48ead", "violeta": "#8956c9",
  "violeta pastel": "#c9a0dc", "morado": "#7b2cbf", "purpura": "#6f2da8", "ciruela": "#673147",
  "azul pastel": "#9ac8f5", "azul electrico": "#2878d7", "azul marino": "#14213d",
  "azul noche": "#191970", "azul cielo": "#87ceeb", "celeste": "#87cefa", "cian": "#00ffff",
  "turquesa": "#40e0d0", "azul petroleo": "#0f5b66",
  "verde menta": "#8bd8bb", "verde pastel": "#a8d5a2", "verde lima": "#a4de02",
  "verde oliva": "#808000", "verde bosque": "#228b22", "verde esmeralda": "#50c878",
  "verde agua": "#7fffd4", "verde oscuro": "#006400",
  "amarillo pastel": "#fdfd96", "amarillo limon": "#fff44f", "oro": "#ffd700",
  "dorado": "#d4af37", "naranja": "#f28b38", "naranja pastel": "#ffb347",
  "blanco": "#ffffff", "blanco puro": "#ffffff", "negro": "#17151a",
  "negro puro": "#000000", "negro azulado": "#202333", "carbon": "#343434",
  "gris claro": "#d3d3d3", "gris plateado": "#bfc5d0", "gris oscuro": "#555555",
  "pizarra": "#708090", "piel clara": "#f3c8a7", "piel media": "#d99a72",
  "piel tostada": "#b8764c", "piel oscura": "#71452d"
});

function normalizeColorName(value) {
  return String(value ?? "").trim().toLocaleLowerCase("es")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
}

export function findAnimeColorName(query) {
  const normalized = normalizeColorName(query);
  if (/^#?[0-9a-f]{6}$/i.test(normalized)) return normalized.startsWith("#") ? normalized : "#" + normalized;
  return COLOR_NAMES[normalized] || null;
}
