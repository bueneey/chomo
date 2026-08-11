/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TOKEN_CA: string
  readonly VITE_WALLET_ADDRESS: string
  readonly VITE_WALLET_EXPLORER_URL: string
  readonly VITE_FOMO_USERNAME: string
  readonly VITE_FOMO_PROFILE_URL: string
  readonly VITE_FOMO_APP_URL: string
  readonly VITE_X_HANDLE: string
  readonly VITE_X_URL: string
  readonly VITE_GITHUB_URL: string
  readonly VITE_STARTING_BANKROLL: string
  readonly VITE_SITE_URL: string
  readonly VITE_TOKEN_TICKER: string
  readonly VITE_TOKEN_NAME: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
