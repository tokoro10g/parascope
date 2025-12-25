/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USERNAME_REGEX: string
  readonly VITE_USERNAME_DESCRIPTION: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
