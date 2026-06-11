fn main() {
    // Windows: psapi нужен для EnumProcessModulesEx (сканер DLL)
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        println!("cargo:rustc-link-lib=psapi");
    }
    tauri_build::build()
}
