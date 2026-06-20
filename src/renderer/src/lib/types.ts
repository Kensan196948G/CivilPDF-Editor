/** A placed stamp. Position/size are page-relative fractions for resolution independence. */
export interface Stamp {
  id: string;
  page: number; // 0-based page index
  x: number; // left edge as fraction of page width (0..1)
  y: number; // top edge as fraction of page height (0..1)
  w: number; // width as fraction of page width (0..1)
  ratio: number; // image natural aspect ratio (width / height)
  src: string; // PNG data URL
}
