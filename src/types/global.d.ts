import type { ModeApi } from "@/lib/mode-script";

declare global {
  interface Window {
    /** Installed by the inline mode script before first paint. */
    __mode?: ModeApi;
  }
  interface WindowEventMap {
    modechange: CustomEvent<{ mode: "light" | "dark" | "now" }>;
  }
}

export {};
