const MAX_PIXELS = 16_000_000;

function parseColor(value) {
  const match = /^#?([0-9a-f]{6})$/i.exec(String(value ?? ""));
  if (!match) throw new TypeError("Colors must use six-digit RGB hex values");
  return [0, 2, 4].map(index => parseInt(match[1].slice(index, index + 2), 16));
}

function rgbToHsl(red, green, blue, out = [0, 0, 0]) {
  const r0 = red / 255, g0 = green / 255, b0 = blue / 255;
  const maximum = Math.max(r0, g0, b0), minimum = Math.min(r0, g0, b0), delta = maximum - minimum;
  const lightness = (maximum + minimum) / 2;
  let hue = 0, saturation = 0;
  if (delta > 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    if (maximum === r0) hue = ((g0 - b0) / delta) % 6;
    else if (maximum === g0) hue = (b0 - r0) / delta + 2;
    else hue = (r0 - g0) / delta + 4;
    hue = (hue * 60 + 360) % 360;
  }
  out[0] = hue; out[1] = saturation; out[2] = lightness;
  return out;
}

function hslToRgb(hue, saturation, lightness, out = [0, 0, 0]) {
  const h = ((hue % 360) + 360) % 360;
  const s = Math.max(0, Math.min(1, saturation));
  const l = Math.max(0, Math.min(1, lightness));
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const segment = h / 60;
  const x = chroma * (1 - Math.abs((segment % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (segment < 1) { r = chroma; g = x; }
  else if (segment < 2) { r = x; g = chroma; }
  else if (segment < 3) { g = chroma; b = x; }
  else if (segment < 4) { g = x; b = chroma; }
  else if (segment < 5) { r = x; b = chroma; }
  else { r = chroma; b = x; }
  const offset = l - chroma / 2;
  out[0] = Math.round((r + offset) * 255);
  out[1] = Math.round((g + offset) * 255);
  out[2] = Math.round((b + offset) * 255);
  return out;
}

function smooth(t) {
  const value = Math.max(0, Math.min(1, t));
  return value * value * (3 - 2 * value);
}

function pixelLuminance(data, offset) {
  return data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722;
}

function isProtectedLineArt(data, width, height, pixelIndex) {
  const offset = pixelIndex * 4;
  if (data[offset + 3] <= 8) return false;
  const luminance = pixelLuminance(data, offset);
  if (luminance > 48 && luminance < 238) return false;
  const x = pixelIndex % width, y = Math.floor(pixelIndex / width);
  const neighbours = [];
  if (x > 0) neighbours.push(offset - 4);
  if (x + 1 < width) neighbours.push(offset + 4);
  if (y > 0) neighbours.push(offset - width * 4);
  if (y + 1 < height) neighbours.push(offset + width * 4);
  return neighbours.some(next => data[next + 3] > 8 && Math.abs(luminance - pixelLuminance(data, next)) >= 38);
}

/**
 * Recolors raster pixels while preserving alpha. Explicit anime selection masks
 * are authoritative so black hair fills can change color; without a mask,
 * high-contrast black/white line-art edges are protected by default.
 * Both the legacy mask option and selectionMask are supported.
 */
export function replaceColorRange(imageData, {
  sourceColor = "#806050",
  targetColor = "#c76cf2",
  tolerance = 36,
  softness = 24,
  preserveShading = true,
  preserveLineArt = true,
  mutate = false,
  mask = null,
  selectionMask = null,
  animeRecolor = false,
  temperature = 0,
  darkness = 0,
  hueShift = 0
} = {}) {
  const width = Number(imageData?.width);
  const height = Number(imageData?.height);
  const source = imageData?.data;
  const pixelCount = width * height;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 ||
      pixelCount > MAX_PIXELS || !source || source.length !== pixelCount * 4) {
    throw new TypeError("Color replacement requires valid image pixels up to 16 megapixels");
  }

  const activeMask = selectionMask ?? mask;
  if (activeMask != null && (!(activeMask instanceof Uint8Array || activeMask instanceof Uint8ClampedArray) ||
      activeMask.length !== pixelCount)) {
    throw new TypeError("Color selection mask must match image dimensions");
  }

  const from = parseColor(sourceColor);
  const to = parseColor(targetColor);
  const threshold = Math.max(0, Math.min(255, Number(tolerance) || 0));
  const feather = Math.max(0, Math.min(160, Number(softness) || 0));
  const warmth = Math.max(-100, Math.min(100, Number(temperature) || 0));
  const lightnessShift = Math.max(-100, Math.min(100, Number(darkness) || 0)) / 200;
  const hueAdjustment = Math.max(-180, Math.min(180, Number(hueShift) || 0));
  const sourceHsl = rgbToHsl(from[0], from[1], from[2]);
  const targetHsl = rgbToHsl(to[0], to[1], to[2]);
  targetHsl[0] = (targetHsl[0] + hueAdjustment + 360) % 360;
  const output = mutate ? source : new Uint8ClampedArray(source);
  const pixelHsl = [0, 0, 0], replacement = [0, 0, 0];
  const clampChannel = value => Math.round(Math.max(0, Math.min(255, value)));

  for (let offset = 0; offset < source.length; offset += 4) {
    if (source[offset + 3] === 0) continue;
    const pixelIndex = offset >> 2;
    let weight;
    if (activeMask != null) {
      const raw = Number(activeMask[pixelIndex]) || 0;
      weight = Math.max(0, Math.min(1, raw > 1 ? raw / 255 : raw));
      if (weight <= 0) continue;
    } else {
      if (preserveLineArt && isProtectedLineArt(source, width, height, pixelIndex)) continue;
      const red = source[offset], green = source[offset + 1], blue = source[offset + 2];
      const distance = Math.sqrt(((red - from[0]) ** 2 + (green - from[1]) ** 2 + (blue - from[2]) ** 2) / 3);
      if (distance <= threshold) weight = 1;
      else if (feather > 0 && distance < threshold + feather) weight = 1 - smooth((distance - threshold) / feather);
      else continue;
    }

    rgbToHsl(source[offset], source[offset + 1], source[offset + 2], pixelHsl);
    // Map relative to the sampled source tone instead of retaining its absolute
    // lightness. This keeps black/near-black anime hair recolorable while preserving
    // lighter and darker highlights around the new target hue.
    let mappedLightness = preserveShading
      ? targetHsl[2] + (pixelHsl[2] - sourceHsl[2]) * 0.72 - lightnessShift
      : targetHsl[2] - lightnessShift;
    mappedLightness = Math.max(0.02, Math.min(0.98, mappedLightness));
    const rgb = hslToRgb(targetHsl[0], targetHsl[1], mappedLightness, replacement);
    const tempered = [
      clampChannel(rgb[0] + warmth * 0.46),
      clampChannel(rgb[1] + warmth * 0.08),
      clampChannel(rgb[2] - warmth * 0.46)
    ];
    output[offset] = Math.round(source[offset] * (1 - weight) + tempered[0] * weight);
    output[offset + 1] = Math.round(source[offset + 1] * (1 - weight) + tempered[1] * weight);
    output[offset + 2] = Math.round(source[offset + 2] * (1 - weight) + tempered[2] * weight);
  }

  return { width, height, data: output };
}
