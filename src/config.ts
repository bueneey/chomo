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
  startingBankroll: Number(env('VITE_STARTING_BANKROLL', '100')) || 100,
  siteUrl: env('VITE_SITE_URL'),
  tokenTicker: env('VITE_TOKEN_TICKER', 'CHOMO'),
  tokenName: env('VITE_TOKEN_NAME', 'Chomo the Trader'),
  apiBase: env('VITE_API_BASE', '/api'),
}

export function displayWallet(address = config.walletAddress): string {
  return address ? shortAddress(address) : 'not set'
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

export function hasLink(url?: string): url is string {
  return Boolean(url && url.length > 0)
}

export function explorerWallet(address?: string): string {
  if (config.walletExplorerUrl) return config.walletExplorerUrl
  if (address) return `https://solscan.io/account/${address}`
  return ''
}

export function formatUsd(n: number, digits = 2): string {
  const sign = n < 0 ? '-' : ''
  return `${sign}$${Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`
}

export function formatSol(n: number, digits = 4): string {
  return `${n.toLocaleString(undefined, {
    minimumFractionDigits: Math.min(2, digits),
    maximumFractionDigits: digits,
  })} SOL`
}

export function formatPnl(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '' : ''
  return `${sign}${formatUsd(n)}`
}

export function timeAgo(ts: number | string): string {
  const t = typeof ts === 'string' ? Date.parse(ts) : ts
  const diff = Math.max(0, Date.now() - t)
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}h`
  const d = Math.floor(h / 24)
  return `${d}d`
}
