import { createCanvas, loadImage } from '@napi-rs/canvas';

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 12_000_000;
const MAX_IMAGE_DIMENSION = 4096;
const MAX_PNG_BYTES = 8 * 1024 * 1024;
const MAX_OUTPUT_WIDTH = 1600;
const MAX_OUTPUT_HEIGHT = 900;

export class UploadedImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadedImageError';
  }
}

/** Validate and normalize an uploaded image once for persisted dashboard artwork. */
export async function normalizeUploadedImage(raw: unknown): Promise<{ data: Buffer; width: number; height: number }> {
  if (!Buffer.isBuffer(raw) || raw.length === 0 || raw.length > MAX_UPLOAD_BYTES) {
    throw new UploadedImageError('Choose an image under 4 MiB.');
  }

  let image;
  try {
    image = await loadImage(raw);
  } catch {
    throw new UploadedImageError('That file is not a supported image.');
  }

  if (!image.width || !image.height || image.width > MAX_IMAGE_DIMENSION || image.height > MAX_IMAGE_DIMENSION || image.width * image.height > MAX_IMAGE_PIXELS) {
    throw new UploadedImageError('Image dimensions must be at most 4096×4096 and 12 megapixels.');
  }

  const scale = Math.min(1, MAX_OUTPUT_WIDTH / image.width, MAX_OUTPUT_HEIGHT / image.height);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = createCanvas(width, height);
  canvas.getContext('2d').drawImage(image, 0, 0, width, height);
  const data = canvas.toBuffer('image/png');
  if (data.length > MAX_PNG_BYTES) throw new UploadedImageError('The optimized image is too large. Try a smaller or simpler image.');
  return { data, width, height };
}
