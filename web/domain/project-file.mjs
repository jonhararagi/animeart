import { DOCUMENT_VERSION, isValidDocument, restoreDocument } from "./model.mjs";

export const PROJECT_FILE_FORMAT = "animeart-project";
export const PROJECT_FILE_VERSION = 1;
export const MAX_PROJECT_FILE_CHARS = 2_500_000;
export const MAX_PROJECT_DIMENSION = 8192;
export const MAX_PROJECT_PIXELS = 40_000_000;
export const MAX_PROJECT_LAYERS = 200;

function validateProjectDocument(input) {
  if (!isValidDocument(input)) throw new TypeError("Project file contains an invalid document");
  if (input.version !== DOCUMENT_VERSION) throw new TypeError("Unsupported AnimeArt document version");
  if (!Number.isInteger(input.width) || !Number.isInteger(input.height) ||
      input.width < 0 || input.height < 0 ||
      input.width > MAX_PROJECT_DIMENSION || input.height > MAX_PROJECT_DIMENSION) {
    throw new RangeError("Project dimensions must be whole numbers between 0 and 8192 pixels");
  }
  if ((input.width === 0) !== (input.height === 0)) {
    throw new RangeError("Project width and height must both be zero or both be positive");
  }
  if (input.width * input.height > MAX_PROJECT_PIXELS) {
    throw new RangeError("Project exceeds the 40-megapixel safety limit");
  }
  if (!Array.isArray(input.layers) || input.layers.length > MAX_PROJECT_LAYERS) {
    throw new RangeError("Project may contain at most 200 layers");
  }
  return restoreDocument(input);
}

export function serializeProjectFile(documentModel) {
  const document = validateProjectDocument(documentModel);
  const serialized = JSON.stringify({
    format: PROJECT_FILE_FORMAT,
    formatVersion: PROJECT_FILE_VERSION,
    document
  });
  if (serialized.length > MAX_PROJECT_FILE_CHARS) {
    throw new RangeError("Project file exceeds the 2.5 MB portability limit");
  }
  return serialized;
}

export function parseProjectFile(source) {
  if (typeof source !== "string" || source.length === 0) {
    throw new TypeError("Project file is empty");
  }
  if (source.length > MAX_PROJECT_FILE_CHARS) {
    throw new RangeError("Project file exceeds the 2.5 MB portability limit");
  }
  let packageData;
  try {
    packageData = JSON.parse(source);
  } catch {
    throw new TypeError("Project file is not valid JSON");
  }
  if (!packageData || packageData.format !== PROJECT_FILE_FORMAT ||
      packageData.formatVersion !== PROJECT_FILE_VERSION || !packageData.document) {
    throw new TypeError("Unsupported project file format");
  }
  return validateProjectDocument(packageData.document);
}
