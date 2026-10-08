import { validateImageFile } from "./image-import.mjs";

export function firstValidImageFile(files) {
  if (!files) return null;
  for (const file of Array.from(files)) {
    try {
      return validateImageFile(file);
    } catch {
      // Skip rejected files and continue to the first valid image.
    }
  }
  return null;
}

export function clipboardImageFile(items) {
  if (!items) return null;
  for (const item of Array.from(items)) {
    if (!item || typeof item.type !== "string" || !item.type.startsWith("image/")) continue;
    if (typeof item.getAsFile !== "function") continue;
    try {
      const file = item.getAsFile();
      if (file) return file;
    } catch {
      // Ignore malformed clipboard items and continue searching for an image.
    }
  }
  return null;
}
