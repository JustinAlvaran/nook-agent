#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        // Native commands remain intentionally empty until pairing and policy APIs exist.
        .run(tauri::generate_context!())
        .expect("failed to start the Nook desktop scaffold");
}
