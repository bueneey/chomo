export type LiveWallet = {
  address: string
  balanceSol: number
  balanceUsd: number
  equityUsd: number
  tokenValueUsd: number
  totalPnlUsd: number
  totalPnlSol: number
  realizedPnlUsd: number
  unrealizedPnlUsd: number
  lifetimeNetDepositUsd: number
  solPriceUsd: number
  positions: Position[]
  source: string
  updatedAt: string
}

export type Position = {
  mint: string
  symbol: string
  name: string
  amount: number
  decimals: number
  usdValue: number
  priceUsd: number
  logo?: string
}

export type ChartPoint = {
  timestamp: number
  pnlUsd: number
  pnlSol: number
  equityUsd?: number
}

export type ChartResponse = {
  points: ChartPoint[]
  meta: {
    count: number
    source: string
    kind: string
    startingBankrollUsd: number
  }
}

export type FeedAction =
  | 'swap_buy'
  | 'swap_sell'
  | 'swap'
  | 'receive'
  | 'send'
  | 'transfer_in'
  | 'transfer_out'
  | 'unknown'

export type FeedItem = {
  id: string
  action: FeedAction
  label: string
  timestamp: number
  txHash: string
  tokenMint?: string
  tokenSymbol?: string
  tokenName?: string
  tokenLogo?: string
  headline: string
  description?: string
  subline?: string
  solDelta?: number
  usdDelta?: number
}

export type FeedResponse = {
  items: FeedItem[]
  wallet: string
  source: string
  count: number
}

export type AgentEvent = {
  id: string
  at: string
  kind: 'thought' | 'did' | 'read' | 'refused' | 'trade' | 'journal'
  text: string
}

export type ChomoState = {
  updatedAt: string
  status: 'live' | 'waiting' | 'offline'
  model: string
  wallet: LiveWallet | null
  chart: ChartResponse
  feed: FeedItem[]
  events: AgentEvent[]
  startingBankrollUsd: number
  solPriceUsd: number
}
