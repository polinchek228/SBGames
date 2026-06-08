let _win = null;

async function getWin() {
  if (_win) return _win;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    _win = getCurrentWindow();
    return _win;
  } catch {
    return null;
  }
}

export const winMinimize = async () => { const w = await getWin(); w?.minimize(); };
export const winMaximize = async () => { const w = await getWin(); w?.toggleMaximize(); };
export const winClose    = async () => { const w = await getWin(); w?.close(); };
