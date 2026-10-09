export interface PreparedImage {
  /** Base64 without data-URL prefix. */
  base64: string;
  mediaType: "image/jpeg";
  /** Object URL for previews; revoke when no longer needed. */
  previewUrl: string;
  canvas: HTMLCanvasElement;
}

/** Long edge in pixels; enough for small receipt print while keeping uploads small. */
const MAX_EDGE = 2000;

/**
 * Downscales and re-encodes a camera photo to JPEG. This keeps the upload small and
 * normalizes formats like HEIC that some phones produce, and applies EXIF rotation.
 */
export async function prepareImage(file: Blob): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas wird nicht unterstützt.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Bild konnte nicht kodiert werden."))), "image/jpeg", 0.85),
  );
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  return { base64, mediaType: "image/jpeg", previewUrl: URL.createObjectURL(blob), canvas };
}
