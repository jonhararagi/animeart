export const MAX_MULTIPAGE_PDF_PAGES = 10;
export const MAX_MULTIPAGE_PDF_BYTES = 45 * 1024 * 1024;
export const PDF_POINTS_PER_PIXEL = 0.75;
const MAX_PAGE_DIMENSION = 8192;
const MAX_PAGE_PIXELS = 40_000_000;
const MAX_EMBEDDED_IMAGE_PIXELS = 16_000_000;
const encoder = new TextEncoder();

function ascii(value) {
  return encoder.encode(String(value));
}

function finitePositiveInteger(value, name, max) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max) {
    throw new RangeError(name + " must be a whole number between 1 and " + max);
  }
  return number;
}

function normalizeJpegBytes(value) {
  if (!(value instanceof Uint8Array)) throw new TypeError("Each PDF page must contain JPEG bytes");
  if (value.byteLength < 4 || value[0] !== 0xff || value[1] !== 0xd8 ||
      value[value.byteLength - 2] !== 0xff || value[value.byteLength - 1] !== 0xd9) {
    throw new TypeError("Each PDF page must contain a complete JPEG image");
  }
  return value;
}

function compactNumber(value) {
  return Number(value.toFixed(3)).toString();
}

function concatByteArrays(chunks, totalLength) {
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

/**
 * Builds a dependency-free PDF where each editable KapiArt page is represented
 * by its own rendered JPEG. Layer/document data is untouched by this export.
 *
 * Page shape:
 * { width, height, imageWidth?, imageHeight?, jpegBytes: Uint8Array }
 * width/height are the original canvas dimensions; imageWidth/imageHeight
 * describe the potentially downscaled raster embedded in the PDF.
 */
export function buildMultiPagePdf(pages) {
  if (!Array.isArray(pages) || pages.length < 1 || pages.length > MAX_MULTIPAGE_PDF_PAGES) {
    throw new RangeError("PDF export supports between 1 and " + MAX_MULTIPAGE_PDF_PAGES + " pages");
  }
  const normalized = pages.map((page, index) => {
    if (!page || typeof page !== "object") throw new TypeError("PDF page " + (index + 1) + " is invalid");
    const width = finitePositiveInteger(page.width, "Page width", MAX_PAGE_DIMENSION);
    const height = finitePositiveInteger(page.height, "Page height", MAX_PAGE_DIMENSION);
    if (width * height > MAX_PAGE_PIXELS) throw new RangeError("Page " + (index + 1) + " exceeds 40 megapixels");
    const imageWidth = finitePositiveInteger(page.imageWidth ?? width, "Embedded image width", MAX_PAGE_DIMENSION);
    const imageHeight = finitePositiveInteger(page.imageHeight ?? height, "Embedded image height", MAX_PAGE_DIMENSION);
    if (imageWidth * imageHeight > MAX_EMBEDDED_IMAGE_PIXELS) {
      throw new RangeError("Embedded page image exceeds 16 megapixels");
    }
    const jpegBytes = normalizeJpegBytes(page.jpegBytes);
    return { width, height, imageWidth, imageHeight, jpegBytes };
  });
  const totalJpegBytes = normalized.reduce((sum, page) => sum + page.jpegBytes.byteLength, 0);
  if (totalJpegBytes > MAX_MULTIPAGE_PDF_BYTES) {
    throw new RangeError("The PDF would exceed the 45 MB export limit");
  }

  const objectCount = 2 + normalized.length * 3;
  const chunks = [];
  const objectOffsets = new Array(objectCount + 1).fill(0);
  let totalLength = 0;
  const append = chunk => {
    const bytes = chunk instanceof Uint8Array ? chunk : ascii(chunk);
    chunks.push(bytes);
    totalLength += bytes.byteLength;
  };
  const beginObject = (id, bodyPrefix) => {
    objectOffsets[id] = totalLength;
    append(id + " 0 obj\n" + bodyPrefix);
  };

  append("%PDF-1.4\n%KapiArt local export\n");
  beginObject(1, "<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  const pageIds = normalized.map((_, index) => 3 + index * 3);
  beginObject(2, "<< /Type /Pages /Count " + normalized.length + " /Kids [" +
    pageIds.map(id => id + " 0 R").join(" ") + "] >>\nendobj\n");

  normalized.forEach((page, index) => {
    const pageObjectId = 3 + index * 3;
    const imageObjectId = pageObjectId + 1;
    const contentObjectId = pageObjectId + 2;
    const pageWidthPt = compactNumber(page.width * PDF_POINTS_PER_PIXEL);
    const pageHeightPt = compactNumber(page.height * PDF_POINTS_PER_PIXEL);
    const content = "q\n" + pageWidthPt + " 0 0 " + pageHeightPt + " 0 0 cm\n/Im0 Do\nQ\n";
    const contentBytes = ascii(content);

    beginObject(pageObjectId,
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + pageWidthPt + " " + pageHeightPt +
      "] /Resources << /XObject << /Im0 " + imageObjectId + " 0 R >> >> /Contents " +
      contentObjectId + " 0 R >>\nendobj\n");

    objectOffsets[imageObjectId] = totalLength;
    append(imageObjectId + " 0 obj\n<< /Type /XObject /Subtype /Image /Width " +
      page.imageWidth + " /Height " + page.imageHeight +
      " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " +
      page.jpegBytes.byteLength + " >>\nstream\n");
    append(page.jpegBytes);
    append("\nendstream\nendobj\n");

    beginObject(contentObjectId, "<< /Length " + contentBytes.byteLength + " >>\nstream\n");
    append(contentBytes);
    append("endstream\nendobj\n");
  });

  const xrefOffset = totalLength;
  append("xref\n0 " + (objectCount + 1) + "\n");
  append("0000000000 65535 f \n");
  for (let id = 1; id <= objectCount; id++) {
    const offset = objectOffsets[id];
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 9_999_999_999) {
      throw new RangeError("PDF object offsets exceed the classic PDF xref limit");
    }
    append(String(offset).padStart(10, "0") + " 00000 n \n");
  }
  append("trailer\n<< /Size " + (objectCount + 1) + " /Root 1 0 R /Info << /Producer (KapiArt) >> >>\n");
  append("startxref\n" + xrefOffset + "\n%%EOF\n");

  if (totalLength > MAX_MULTIPAGE_PDF_BYTES) {
    throw new RangeError("The PDF would exceed the 45 MB export limit");
  }
  return concatByteArrays(chunks, totalLength);
}
