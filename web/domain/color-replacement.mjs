const MAX_PIXELS = 16_000_000;
function parseColor(value) {
  const match = /^#?([0-9a-f]{6})$/i.exec(String(value ?? ""));
  if (!match) throw new TypeError("Colors must use six-digit RGB hex values");
  return [0, 2, 4].map(index => parseInt(match[1].slice(index, index + 2), 16));
}
function rgbToHsl(r, g, b, out) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  const lightness = (max + min) / 2;
  let hue = 0, saturation = 0;
  if (delta) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  out[0] = hue; out[1] = saturation; out[2] = lightness;
  return out;
}
function hslToRgb(h, s, l, out) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r, g, b;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  out[0] = Math.max(0, Math.min(255, Math.round((r + m) * 255)));
  out[1] = Math.max(0, Math.min(255, Math.round((g + m) * 255)));
  out[2] = Math.max(0, Math.min(255, Math.round((b + m) * 255)));
  return out;
}
function smooth(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
function luminance(data, offset) {
  return data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722;
}
function isProtectedLineArt(data, width, height, offset) {
  const index = offset / 4, x = index % width, y = Math.floor(index / width);
  const lum = luminance(data, offset);
  if (lum > 48 && lum < 238) return false;
  const neighbors = [];
  if (x > 0) neighbors.push(offset - 4);
  if (x + 1 < width) neighbors.push(offset + 4);
  if (y > 0) neighbors.push(offset - width * 4);
  if (y + 1 < height) neighbors.push(offset + width * 4);
  return neighbors.some(next => data[next + 3] > 8 && Math.abs(lum - luminance(data, next)) >= 38);
}
export function replaceColorRange(imageData, { sourceColor = "#806050", targetColor = "#c76cf2", tolerance = 36, softness = 24, preserveShading = true, preserveLineArt = true, mutate = false, mask = null } = {}) {
  const width = Number(imageData?.width), height = Number(imageData?.height), source = imageData?.data;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > MAX_PIXELS || !source || source.length !== width * height * 4)
    throw new TypeError("Color replacement requires valid image pixels up to 16 megapixels");
  if (mask && mask.length !== width * height) throw new TypeError("Color selection mask must match image dimensions");
  const from = parseColor(sourceColor), to = parseColor(targetColor);
  const threshold = Math.max(0, Math.min(255, Number(tolerance) || 0));
  const feather = Math.max(0, Math.min(160, Number(softness) || 0));
  const targetHsl = rgbToHsl(to[0], to[1], to[2], [0, 0, 0]);
  const sourceHsl = rgbToHsl(from[0], from[1], from[2], [0, 0, 0]);
  const data = mutate ? source : new Uint8ClampedArray(source);
  const pixelHsl = [0, 0, 0], replacement = [0, 0, 0];
  for (let i = 0; i < data.length; i += 4) {
    if (source[i + 3] === 0 || (mask && mask[i / 4] !== 1)) continue;
    const red = source[i], green = source[i + 1], blue = source[i + 2];
    const distance = Math.sqrt(((red - from[0]) ** 2 + (green - from[1]) ** 2 + (blue - from[2]) ** 2) / 3);
    let weight;
    if (distance <= threshold) weight = 1;
    else if (feather > 0 && distance < threshold + feather) weight = 1 - smooth((distance - threshold) / feather);
    else continue;
    if (preserveLineArt && isProtectedLineArt(source, width, height, i)) continue;
    rgbToHsl(red, green, blue, pixelHsl);
    const mappedLightness = Math.max(0, Math.min(1, targetHsl[2] + pixelHsl[2] - sourceHsl[2]));
    const rgb = preserveShading ? hslToRgb(targetHsl[0], targetHsl[1], mappedLightness, replacement) : to;
    data[i] = Math.round(red * (1 - weight) + rgb[0] * weight);
    data[i + 1] = Math.round(green * (1 - weight) + rgb[1] * weight);
    data[i + 2] = Math.round(blue * (1 - weight) + rgb[2] * weight);
  }
  return { width, height, data };
}
