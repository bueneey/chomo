function env(key: keyof ImportMetaEnv, fallback = ''): string {
  const value = import.meta.env[key]
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function shortAddress(address: string, size = 4): string {
  if (!address || address.length < size * 2 + 2) return address
  return `${address.slice(0, size + 2)}…${address.slice(-size)}`
}

export const config = {
  tokenCa: env('VITE_TOKEN_CA'),
  walletAddress: env('VITE_WALLET_ADDRESS'),
  walletExplorerUrl: env('VITE_WALLET_EXPLORER_URL'),
  fomoUsername: env('VITE_FOMO_USERNAME'),
  fomoProfileUrl: env('VITE_FOMO_PROFILE_URL'),
  fomoAppUrl: env('VITE_FOMO_APP_URL', 'https://fomo.family/'),
  xHandle: env('VITE_X_HANDLE'),
  xUrl: env('VITE_X_URL'),
  githubUrl: env('VITE_GITHUB_URL', 'https://github.com/bueneey/chomo'),
  startingBankroll: env('VITE_STARTING_BANKROLL', '100'),
  siteUrl: env('VITE_SITE_URL'),
  tokenTicker: env('VITE_TOKEN_TICKER', 'CHOMO'),
  tokenName: env('VITE_TOKEN_NAME', 'Chomo the Trader'),
}

export function displayWallet(): string {
  return config.walletAddress ? shortAddress(config.walletAddress) : 'coming soon'
}

export function displayCa(): string {
  return config.tokenCa ? shortAddress(config.tokenCa) : 'coming soon'
}

export function displayX(): string {
  if (config.xHandle) {
    return config.xHandle.startsWith('@') ? config.xHandle : `@${config.xHandle}`
  }
  return 'coming soon'
}

export function displayFomo(): string {
  return config.fomoUsername ? `@${config.fomoUsername.replace(/^@/, '')}` : 'coming soon'
}

export function hasLink(url: string | undefined): url is string {
  return Boolean(url && url.length > 0)
}
