/** Format a date as YYYY.MM.DD for the stamp face. */
export function formatStampDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

/**
 * Render a circular red approval stamp (name + date) to a transparent PNG.
 * Japanese text is drawn with the system font, sidestepping pdf-lib font embedding.
 */
export function generateTextStampDataUrl(
  name: string,
  dateText: string,
  size = 256,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const red = "#c81e1e";
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.46;

  ctx.lineWidth = size * 0.03;
  ctx.strokeStyle = red;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = red;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Name (upper area, larger)
  const label = name.trim() || "承認";
  ctx.font = `bold ${size * 0.26}px system-ui, sans-serif`;
  ctx.fillText(label.slice(0, 4), cx, cy - size * 0.1);

  // Divider line
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.7, cy + size * 0.02);
  ctx.lineTo(cx + r * 0.7, cy + size * 0.02);
  ctx.stroke();

  // Date (lower area, smaller)
  ctx.font = `bold ${size * 0.12}px system-ui, sans-serif`;
  ctx.fillText(dateText, cx, cy + size * 0.18);

  return canvas.toDataURL("image/png");
}

/** Read an imported image File into a data URL. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Resolve the natural width/height ratio of an image data URL. */
export function imageNaturalRatio(dataUrl: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth / img.naturalHeight || 1);
    img.onerror = () => resolve(1);
    img.src = dataUrl;
  });
}
