import { getCurrentWindow } from "@tauri-apps/api/window";

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const safe = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
  } catch (e) {
    console.warn("window op failed", e);
  }
};

export const win = {
  close: () => (isTauri ? safe(() => getCurrentWindow().close()) : undefined),
  minimize: () => (isTauri ? safe(() => getCurrentWindow().minimize()) : undefined),
  toggleMaximize: () => (isTauri ? safe(() => getCurrentWindow().toggleMaximize()) : undefined),
  hide: () => (isTauri ? safe(() => getCurrentWindow().hide()) : undefined),
};
