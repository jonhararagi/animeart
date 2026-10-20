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

export function animeColorFromHsv(hue, saturation, value) {
  const h = ((Number(hue) % 360) + 360) % 360;
  const s = Math.max(0, Math.min(100, Number(saturation))) / 100;
  const v = Math.max(0, Math.min(100, Number(value))) / 100;
  const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
  const parts = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return "#" + parts.map(channel => Math.round((channel + m) * 255).toString(16).padStart(2, "0")).join("");
}

const COLOR_NAMES = Object.freeze({
  "marron claro": "#b9855a", "marrón claro": "#b9855a", "castaño": "#75452f",
  "marron chocolate": "#4a2b22", "marrón chocolate": "#4a2b22", "rubio miel": "#d7a64b",
  "rubio platino": "#e9dfc0", "rubio ceniza": "#b9b19c", "rojo cereza": "#c62845",
  "rojo vino": "#7b1734", "cobre": "#b96842", "rosa pastel": "#f2a2c0",
  "azul pastel": "#9ac8f5", "azul eléctrico": "#2878d7", "violeta": "#8956c9",
  "negro azulado": "#202333", "gris plateado": "#bfc5d0", "blanco": "#ffffff",
  "negro": "#17151a", "verde menta": "#8bd8bb", "naranja": "#f28b38"
});
export function findAnimeColorName(query) {
  const normalized = String(query ?? "").trim().toLocaleLowerCase("es");
  if (/^#?[0-9a-f]{6}$/i.test(normalized)) return normalized.startsWith("#") ? normalized : "#" + normalized;
  return COLOR_NAMES[normalized] || null;
}
