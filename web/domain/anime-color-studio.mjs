const MAX_PIXELS = 16_000_000;

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export const ANIME_COLOR_PRESETS = Object.freeze([
  { name: "Negro azulado", hex: "#202334", tags: ["cabello", "tinta", "azul negro", "blue black"] },
  { name: "Negro suave", hex: "#211F24", tags: ["cabello", "negro natural"] },
  { name: "Castaño oscuro", hex: "#4A2F27", tags: ["cabello", "marron oscuro", "brunette"] },
  { name: "Castaño", hex: "#75472F", tags: ["cabello", "marron medio", "castano medio"] },
  { name: "Marrón claro", hex: "#B9855A", tags: ["cabello", "castano claro", "brown", "light brown"] },
  { name: "Marrón caramelo", hex: "#B77A45", tags: ["cabello", "caramelo", "camel"] },
  { name: "Chocolate", hex: "#4A2925", tags: ["cabello", "marron chocolate"] },
  { name: "Marrón ceniza", hex: "#8A776A", tags: ["cabello", "taupe", "ash brown"] },
  { name: "Cobre", hex: "#B76542", tags: ["cabello", "naranja rojizo", "copper"] },
  { name: "Castaño rojizo", hex: "#8B3D32", tags: ["cabello", "auburn", "caoba"] },
  { name: "Rojo cereza", hex: "#C62845", tags: ["cabello", "rojo", "red", "cereza"] },
  { name: "Rojo fuego", hex: "#E34234", tags: ["cabello", "escarlata", "rojo brillante"] },
  { name: "Borgoña", hex: "#70263D", tags: ["cabello", "vino tinto", "burgundy"] },
  { name: "Rubio platino", hex: "#E8DDC5", tags: ["cabello", "blanco calido", "platinum blonde"] },
  { name: "Rubio ceniza", hex: "#C7BCA7", tags: ["cabello", "gris rubio", "ash blonde"] },
  { name: "Rubio miel", hex: "#D8A747", tags: ["cabello", "dorado", "honey blonde"] },
  { name: "Rubio dorado", hex: "#E4BA62", tags: ["cabello", "oro", "golden blonde"] },
  { name: "Rubio arena", hex: "#D8C391", tags: ["cabello", "beige", "sand blonde"] },
  { name: "Rosa pastel", hex: "#F4A9C8", tags: ["cabello", "rosa claro", "pastel pink"] },
  { name: "Rosa chicle", hex: "#EF5D9B", tags: ["cabello", "pink", "fucsia suave"] },
  { name: "Rosa humo", hex: "#D5A5B8", tags: ["cabello", "rosa grisaceo", "dusty pink"] },
  { name: "Azul noche", hex: "#202A5A", tags: ["cabello", "azul oscuro", "navy"] },
  { name: "Azul eléctrico", hex: "#2878D7", tags: ["cabello", "azul intenso", "electric blue"] },
  { name: "Azul cielo", hex: "#73B9EF", tags: ["cabello", "celeste", "sky blue"] },
  { name: "Azul hielo", hex: "#BCE8F5", tags: ["cabello", "celeste palido", "ice blue"] },
  { name: "Cian", hex: "#35D8DE", tags: ["cabello", "turquesa", "cyan"] },
  { name: "Violeta", hex: "#8B5CC7", tags: ["cabello", "morado", "purple"] },
  { name: "Lavanda", hex: "#C5A7EA", tags: ["cabello", "lila", "lavender"] },
  { name: "Púrpura oscuro", hex: "#562C78", tags: ["cabello", "morado oscuro", "deep purple"] },
  { name: "Verde menta", hex: "#8AE0BD", tags: ["cabello", "menta", "mint"] },
  { name: "Verde jade", hex: "#168B72", tags: ["cabello", "verde intenso", "jade"] },
  { name: "Verde oliva", hex: "#8A9852", tags: ["cabello", "oliva", "olive"] },
  { name: "Amarillo crema", hex: "#F8E8A0", tags: ["rubio", "amarillo claro", "cream yellow"] },
  { name: "Naranja melocotón", hex: "#F7A36B", tags: ["naranja pastel", "peach"] },
  { name: "Coral", hex: "#F17C78", tags: ["rojo rosado", "coral"] },
  { name: "Vino", hex: "#7A254A", tags: ["burdeos", "wine"] },
  { name: "Piel clara", hex: "#F5D2B8", tags: ["piel", "beige rosado", "fair skin"] },
  { name: "Piel cálida", hex: "#D9A07D", tags: ["piel", "durazno", "warm skin"] },
  { name: "Piel tostada", hex: "#AC7054", tags: ["piel", "bronceada", "tan skin"] },
  { name: "Marrón grisáceo", hex: "#927F75", tags: ["marron frio", "greige", "taupe"] },
  { name: "Gris plata", hex: "#BCC4D0", tags: ["cabello", "plateado", "silver"] },
  { name: "Blanco nieve", hex: "#FFF8F3", tags: ["blanco", "reflejos", "snow white"] },
  { name: "Crema cálida", hex: "#F1DFC1", tags: ["marfil", "ivory", "warm cream"] },
  { name: "Gris grafito", hex: "#45434C", tags: ["gris oscuro", "grafito", "charcoal"] },
  { name: "Sombra violeta", hex: "#51415F", tags: ["sombreado anime", "sombra fria"] },
  { name: "Sombra cálida", hex: "#795044", tags: ["sombreado anime", "sombra calida"] }
].map(color => Object.freeze({ ...color, tags: Object.freeze(color.tags) })));

function rgbHex(r, g, b) {
  return "#" + [r, g, b].map(value => Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, "0")).join("").toUpperCase();
}

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [rgbHex((r + m) * 255, (g + m) * 255, (b + m) * 255)];
}

/**
 * Generates an offline anime-oriented swatch catalogue instead of shipping a
 * giant bitmap. The default profile yields 2,880 shades from HSL coordinates.
 */
export function generateAnimePalette({
  hueSteps = 72,
  saturations = [0.32, 0.46, 0.60, 0.74, 0.88],
  lightnesses = [0.16, 0.24, 0.32, 0.40, 0.48, 0.56, 0.64, 0.72]
} = {}) {
  const steps = Math.max(12, Math.min(180, Math.round(Number(hueSteps) || 72)));
  if (!Array.isArray(saturations) || !Array.isArray(lightnesses) || !saturations.length || !lightnesses.length) {
    throw new TypeError("Anime palette requires saturation and lightness levels");
  }
  const palette = [];
  for (let index = 0; index < steps; index += 1) {
    const hue = Math.round(index * 360 / steps);
    for (const saturationValue of saturations) {
      const saturation = Math.max(0.05, Math.min(1, Number(saturationValue)));
      for (const lightnessValue of lightnesses) {
        const lightness = Math.max(0.05, Math.min(0.95, Number(lightnessValue)));
        const [hex] = hslToRgb(hue, saturation, lightness);
        palette.push({
          name: "Tono " + hue + "° · " + Math.round(saturation * 100) + "% · " + Math.round(lightness * 100) + "%",
          hex,
          hue,
          saturation,
          lightness,
          generated: true
        });
      }
    }
  }
  return palette;
}

export function searchAnimeColors(query, limit = 36) {
  const normalized = normalizeText(query);
  if (!normalized) return ANIME_COLOR_PRESETS.slice(0, Math.max(1, Math.min(100, Number(limit) || 36)));
  const terms = normalized.split(/\s+/).filter(Boolean);
  return ANIME_COLOR_PRESETS
    .map(color => {
      const name = normalizeText(color.name);
      const tags = color.tags.map(normalizeText);
      const text = name + " " + tags.join(" ") + " " + color.hex.toLowerCase();
      const matches = terms.every(term => text.includes(term));
      const score = name === normalized ? 0 : name.startsWith(normalized) ? 1 : name.includes(normalized) ? 2 : 3;
      return matches ? { color, score } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score || a.color.name.localeCompare(b.color.name, "es"))
    .slice(0, Math.max(1, Math.min(100, Number(limit) || 36)))
    .map(entry => entry.color);
}

function colorDistance(data, offset, seed) {
  const red = data[offset] - seed[0];
  const green = data[offset + 1] - seed[1];
  const blue = data[offset + 2] - seed[2];
  return Math.sqrt((red * red + green * green + blue * blue) / 3);
}

function isAnimeBoundaryPixel(data, offset, { protectLineArt, seedLuminance, lineArtThreshold }) {
  if (!protectLineArt || seedLuminance < lineArtThreshold) return false;
  const luminance = data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722;
  return luminance < lineArtThreshold;
}

/**
 * Selects a contiguous flat-color region, tuned for clean anime/cel-shaded art.
 * Dark line-art is treated as a boundary when the sampled fill is lighter than it.
 */
export function selectAnimeRegion(imageData, {
  x,
  y,
  tolerance = 28,
  protectLineArt = true,
  lineArtThreshold = 54,
  maxPixels = MAX_PIXELS
} = {}) {
  const width = Number(imageData?.width);
  const height = Number(imageData?.height);
  const data = imageData?.data;
  const pixelCount = width * height;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1
      || pixelCount > Math.min(MAX_PIXELS, Number(maxPixels) || MAX_PIXELS)
      || !data || data.length !== pixelCount * 4) {
    throw new TypeError("Anime selection requires valid image pixels up to 16 megapixels");
  }
  const seedX = Math.floor(Number(x));
  const seedY = Math.floor(Number(y));
  if (!Number.isFinite(seedX) || !Number.isFinite(seedY) || seedX < 0 || seedY < 0 || seedX >= width || seedY >= height) {
    throw new RangeError("Tap inside the image preview to select an anime region");
  }
  const seedOffset = (seedY * width + seedX) * 4;
  if (data[seedOffset + 3] === 0) {
    return { mask: new Uint8Array(pixelCount), pixelCount: 0, bounds: null, seedColor: null };
  }
  const seed = [data[seedOffset], data[seedOffset + 1], data[seedOffset + 2]];
  const seedLuminance = seed[0] * 0.2126 + seed[1] * 0.7152 + seed[2] * 0.0722;
  const range = Math.max(0, Math.min(255, Number(tolerance) || 0));
  const lineOptions = { protectLineArt: protectLineArt === true, seedLuminance, lineArtThreshold: Math.max(0, Math.min(180, Number(lineArtThreshold) || 54)) };
  const mask = new Uint8Array(pixelCount);
  let queue = new Uint32Array(Math.min(4096, pixelCount));
  let head = 0, tail = 0;
  const inBounds = (px, py) => px >= 0 && py >= 0 && px < width && py < height;
  const enqueue = index => {
    if (tail === queue.length) {
      const grown = new Uint32Array(Math.min(pixelCount, Math.max(queue.length + 1, queue.length * 2)));
      grown.set(queue);
      queue = grown;
    }
    queue[tail++] = index;
  };
  const canSelect = index => {
    const offset = index * 4;
    if (data[offset + 3] === 0) return false;
    if (isAnimeBoundaryPixel(data, offset, lineOptions)) return false;
    return colorDistance(data, offset, seed) <= range;
  };
  mask[seedY * width + seedX] = 255;
  enqueue(seedY * width + seedX);
  let minX = seedX, minY = seedY, maxX = seedX, maxY = seedY;
  while (head < tail) {
    const index = queue[head++];
    const px = index % width;
    const py = Math.floor(index / width);
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
    const neighbours = [index - 1, index + 1, index - width, index + width];
    for (let n = 0; n < neighbours.length; n += 1) {
      const next = neighbours[n];
      const nx = n === 0 ? px - 1 : n === 1 ? px + 1 : px;
      const ny = n === 2 ? py - 1 : n === 3 ? py + 1 : py;
      if (!inBounds(nx, ny) || mask[next] !== 0 || !canSelect(next)) continue;
      mask[next] = 255;
      enqueue(next);
    }
  }
  return {
    mask,
    pixelCount: tail,
    bounds: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
    seedColor: "#" + seed.map(value => value.toString(16).padStart(2, "0")).join("").toUpperCase()
  };
}

export function combineAnimeSelections(currentMask, nextMask, mode = "add") {
  if (!(nextMask instanceof Uint8Array)) throw new TypeError("The next anime selection must be a Uint8Array mask");
  if (!currentMask) return new Uint8Array(nextMask);
  if (!(currentMask instanceof Uint8Array) || currentMask.length !== nextMask.length) {
    throw new TypeError("Anime selection masks must have matching dimensions");
  }
  const result = new Uint8Array(nextMask.length);
  for (let index = 0; index < result.length; index += 1) {
    result[index] = mode === "subtract"
      ? (currentMask[index] && !nextMask[index] ? 255 : 0)
      : (currentMask[index] || nextMask[index] ? 255 : 0);
  }
  return result;
}

export function countAnimeSelection(mask) {
  if (!(mask instanceof Uint8Array)) return 0;
  let count = 0;
  for (const value of mask) if (value > 0) count += 1;
  return count;
}
