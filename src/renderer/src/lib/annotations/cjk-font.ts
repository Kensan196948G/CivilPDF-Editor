import fontUrl from "../../assets/fonts/NotoSansJP-Regular.otf?url";

/**
 * Bundled CJK (Japanese) font used by the PDF burn-in pipeline.
 *
 * The standard PDF fonts (Helvetica etc.) only cover ASCII, so any Japanese
 * text edit / note body would otherwise be stripped to an empty string. We ship
 * NotoSansJP (SIL OFL 1.1, see assets/fonts/OFL.txt) and embed it as a subset so
 * only the glyphs actually used end up in the output PDF (a few KB, not 4.5 MB).
 *
 * The fetch is isolated in this tiny module so tests can mock it (jsdom cannot
 * resolve Vite asset URLs at runtime).
 */
let cache: Uint8Array | null = null;

/** Lazily fetch the bundled NotoSansJP bytes (cached for the session). */
export async function loadCjkFontBytes(): Promise<Uint8Array> {
  if (cache) return cache;
  const res = await fetch(fontUrl);
  if (!res.ok) {
    throw new Error(`Failed to load bundled CJK font (${res.status})`);
  }
  cache = new Uint8Array(await res.arrayBuffer());
  return cache;
}
