import type { PDFDocumentProxy } from "pdfjs-dist";

export type FormFieldType = "text" | "checkbox" | "radio" | "choice" | "button" | "unknown";

export interface FormField {
  page: number;
  fieldName: string;
  fieldType: FormFieldType;
  value: string;
}

function classifyFieldType(subtype: string): FormFieldType {
  switch (subtype) {
    case "Tx": return "text";
    case "Btn": return "button";
    case "Ch": return "choice";
    default: return "unknown";
  }
}

function stringifyValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "boolean") return v ? "✓" : "☐";
  return String(v);
}

export async function readFormFields(pdfDoc: PDFDocumentProxy): Promise<FormField[]> {
  const fields: FormField[] = [];

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const annotations = await page.getAnnotations();

    for (const annot of annotations) {
      if (annot.subtype !== "Widget") continue;
      fields.push({
        page: pageNum,
        fieldName: (annot.fieldName as string | undefined) ?? "(unnamed)",
        fieldType: classifyFieldType((annot.fieldType as string | undefined) ?? ""),
        value: stringifyValue(annot.fieldValue),
      });
    }
  }

  return fields;
}
