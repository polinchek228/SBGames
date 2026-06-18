//! #4 Fabric loader — обёртка над общим meta-резолвером.

use crate::loaders::meta_based::{install_meta_based, list_meta_loader_versions, FABRIC_CFG};

pub async fn install_fabric(
    mc_version: &str,
    loader_version: Option<&str>,
    instance_dir: &std::path::Path,
    app: &tauri::AppHandle,
) -> Result<String, String> {
    install_meta_based(&FABRIC_CFG, mc_version, loader_version, instance_dir, app).await
}

pub async fn list_versions(mc_version: &str) -> Result<Vec<String>, String> {
    list_meta_loader_versions(&FABRIC_CFG, mc_version).await
}
