import { message } from "@tauri-apps/plugin-dialog";

export interface EncryptOptions {
  userPassword: string;
  ownerPassword?: string;
}

/**
 * Encrypt a PDF with user/owner passwords.
 * pdf-lib v1.x does not support native PDF encryption;
 * full implementation requires a Tauri Rust command (lopdf / qpdf).
 */
export async function encryptPdf(
  docBytes: Uint8Array,
  opts: EncryptOptions,
): Promise<Uint8Array> {
  void docBytes;
  void opts;
  await message(
    "PDF暗号化は現在のバージョンでは未対応です。\n" +
    "次のリリースでRust側の実装（lopdf / qpdf）を予定しています。",
    { title: "暗号化未対応", kind: "warning" },
  );
  // Caller (saveAsEncrypted) aborts on this throw so the file is NOT saved.
  throw new Error("PDF encryption not yet implemented");
}
