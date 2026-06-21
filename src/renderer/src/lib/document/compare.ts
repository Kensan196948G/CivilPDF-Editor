import type { PDFDocumentProxy } from "pdfjs-dist";

export type DiffKind = "equal" | "added" | "removed";

export interface DiffLine {
  kind: DiffKind;
  text: string;
}

async function extractLines(pdfDoc: PDFDocumentProxy): Promise<string[]> {
  const lines: string[] = [];
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .filter((item) => "str" in item)
      .map((item) => (item as { str: string }).str)
      .join("")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    lines.push(...pageText);
  }
  return lines;
}

/** LCS-based line diff — O(m×n) DP, sufficient for typical PDF page counts */
function lcs(a: string[], b: string[]): number[][] {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp;
}

function backtrack(dp: number[][], a: string[], b: string[], i: number, j: number, out: DiffLine[]): void {
  if (i === 0 && j === 0) return;
  if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
    backtrack(dp, a, b, i - 1, j - 1, out);
    out.push({ kind: "equal", text: a[i - 1] });
  } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
    backtrack(dp, a, b, i, j - 1, out);
    out.push({ kind: "added", text: b[j - 1] });
  } else {
    backtrack(dp, a, b, i - 1, j, out);
    out.push({ kind: "removed", text: a[i - 1] });
  }
}

export interface CompareResult {
  diff: DiffLine[];
  added: number;
  removed: number;
  equal: number;
}

export async function comparePdfs(
  docA: PDFDocumentProxy,
  docB: PDFDocumentProxy,
): Promise<CompareResult> {
  const [linesA, linesB] = await Promise.all([extractLines(docA), extractLines(docB)]);
  const dp = lcs(linesA, linesB);
  const diff: DiffLine[] = [];
  backtrack(dp, linesA, linesB, linesA.length, linesB.length, diff);

  return {
    diff,
    added: diff.filter((d) => d.kind === "added").length,
    removed: diff.filter((d) => d.kind === "removed").length,
    equal: diff.filter((d) => d.kind === "equal").length,
  };
}
