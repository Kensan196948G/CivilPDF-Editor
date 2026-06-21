/// PDF encryption via Tauri command (lopdf).
/// Phase C placeholder — full AES/RC4 key derivation to be added in a follow-up PR.
#[tauri::command]
fn encrypt_pdf(
    _bytes: Vec<u8>,
    _user_password: String,
    _owner_password: String,
) -> Result<Vec<u8>, String> {
    Err("PDF暗号化コマンドは次のリリースで実装予定です。".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![encrypt_pdf])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
