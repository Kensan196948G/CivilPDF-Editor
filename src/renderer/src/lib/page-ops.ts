import { PDFDocument, degrees } from "pdf-lib";
import type { PageIndexMap } from "./document/types";

/** Default page size used when a blank page has no neighbour to copy from (A4). */
const A4_SIZE: [number, number] = [595.28, 841.89];

/** Normalise an arbitrary degree value into the [0, 360) range. */
function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

/**
 * Rotate the given pages by `deltaDegrees`. The delta is added to each target
 * page's current rotation and the result is normalised into [0, 360).
 * Out-of-range indices are ignored.
 */
export async function rotatePages(
  bytes: Uint8Array,
  pageIndices: number[],
  deltaDegrees: number,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes);
  const pages = doc.getPages();
  const targets = new Set(pageIndices);

  for (const index of targets) {
    const page = pages[index];
    if (!page) continue;
    const current = page.getRotation().angle;
    page.setRotation(degrees(normalizeAngle(current + deltaDegrees)));
  }

  return doc.save();
}

/**
 * Delete the given pages and return the new bytes plus an index map. The map
 * returns the new index for a surviving page, or `null` for a deleted page.
 */
export async function deletePages(
  bytes: Uint8Array,
  pageIndices: number[],
): Promise<{ bytes: Uint8Array; map: PageIndexMap }> {
  const doc = await PDFDocument.load(bytes);
  const originalCount = doc.getPageCount();
  const removed = new Set(pageIndices.filter((i) => i >= 0 && i < originalCount));

  // Remove in descending order so earlier indices stay valid.
  for (const index of [...removed].sort((a, b) => b - a)) {
    doc.removePage(index);
  }

  // Build the old → new mapping by counting survivors before each index.
  const newIndexByOld = new Map<number, number>();
  let next = 0;
  for (let old = 0; old < originalCount; old += 1) {
    if (removed.has(old)) continue;
    newIndexByOld.set(old, next);
    next += 1;
  }

  const map: PageIndexMap = (oldIndex) =>
    newIndexByOld.has(oldIndex) ? (newIndexByOld.get(oldIndex) as number) : null;

  return { bytes: await doc.save(), map };
}

/**
 * Reorder pages into `newOrder` (an array of old indices). The result has the
 * same page count; the map returns each old page's new position, or `null` if
 * it was dropped from `newOrder`.
 */
export async function reorderPages(
  bytes: Uint8Array,
  newOrder: number[],
): Promise<{ bytes: Uint8Array; map: PageIndexMap }> {
  const source = await PDFDocument.load(bytes);
  const target = await PDFDocument.create();

  const copied = await target.copyPages(source, newOrder);
  for (const page of copied) target.addPage(page);

  // First occurrence wins if an old index appears more than once.
  const newIndexByOld = new Map<number, number>();
  newOrder.forEach((oldIndex, newIndex) => {
    if (!newIndexByOld.has(oldIndex)) newIndexByOld.set(oldIndex, newIndex);
  });

  const map: PageIndexMap = (oldIndex) =>
    newIndexByOld.has(oldIndex) ? (newIndexByOld.get(oldIndex) as number) : null;

  return { bytes: await target.save(), map };
}

/**
 * Insert a blank page at `atIndex`. The size defaults to the page that will
 * precede the new one (`atIndex - 1`), then to A4 when there is no neighbour.
 */
export async function insertBlankPage(
  bytes: Uint8Array,
  atIndex: number,
  size?: [number, number],
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes);
  const pages = doc.getPages();

  let dimensions: [number, number];
  if (size) {
    dimensions = size;
  } else {
    const neighbour = pages[atIndex - 1] ?? pages[atIndex];
    if (neighbour) {
      const { width, height } = neighbour.getSize();
      dimensions = [width, height];
    } else {
      dimensions = A4_SIZE;
    }
  }

  doc.insertPage(atIndex, dimensions);
  return doc.save();
}

/**
 * Copy pages from `sourceBytes` into `targetBytes` starting at `atIndex`.
 * `sourceIndices` may be `"all"` to copy every source page in order.
 */
export async function insertPagesFrom(
  targetBytes: Uint8Array,
  sourceBytes: Uint8Array,
  sourceIndices: number[] | "all",
  atIndex: number,
): Promise<Uint8Array> {
  const target = await PDFDocument.load(targetBytes);
  const source = await PDFDocument.load(sourceBytes);

  const indices =
    sourceIndices === "all"
      ? source.getPageIndices()
      : sourceIndices.filter((i) => i >= 0 && i < source.getPageCount());

  const copied = await target.copyPages(source, indices);
  copied.forEach((page, offset) => {
    target.insertPage(atIndex + offset, page);
  });

  return target.save();
}

/** Concatenate the given PDFs into a single document, in order. */
export async function mergePdfs(parts: Uint8Array[]): Promise<Uint8Array> {
  const merged = await PDFDocument.create();

  for (const part of parts) {
    const source = await PDFDocument.load(part);
    const copied = await merged.copyPages(source, source.getPageIndices());
    for (const page of copied) merged.addPage(page);
  }

  return merged.save();
}

/**
 * Split a PDF into one document per range. Each range is inclusive and 0-based
 * (`{ start, end }` covers pages `start..end`). Out-of-range bounds are
 * clamped to the available pages.
 */
export async function splitPdf(
  bytes: Uint8Array,
  ranges: Array<{ start: number; end: number }>,
): Promise<Uint8Array[]> {
  const source = await PDFDocument.load(bytes);
  const pageCount = source.getPageCount();
  const results: Uint8Array[] = [];

  for (const { start, end } of ranges) {
    const lo = Math.max(0, start);
    const hi = Math.min(pageCount - 1, end);
    const indices: number[] = [];
    for (let i = lo; i <= hi; i += 1) indices.push(i);

    const out = await PDFDocument.create();
    const copied = await out.copyPages(source, indices);
    for (const page of copied) out.addPage(page);
    results.push(await out.save());
  }

  return results;
}
