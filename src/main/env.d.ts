/// <reference types="electron-vite/node" />

interface ImportMetaEnv {
  /** OAuth Client ID (Desktop app) do Google Cloud, injetado no build via .env */
  readonly MAIN_VITE_GOOGLE_CLIENT_ID?: string
  readonly MAIN_VITE_GOOGLE_CLIENT_SECRET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
