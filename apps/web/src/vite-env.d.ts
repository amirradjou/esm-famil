/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public URL of the game server; empty for same-origin. */
  readonly VITE_SERVER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
