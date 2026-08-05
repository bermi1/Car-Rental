/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origin of the backend API. Empty/unset means same-origin (dev proxy). */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
