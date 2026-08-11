import type {
  AgentEvent,
  ChartPoint,
  ChartResponse,
  FeedAction,
  FeedItem,
  FeedResponse,
  LiveWallet,
  Position,
} from '../src/types'

const HELIUS_RPC = (key: string) => `https://mainnet.helius-rpc.com/?api-key=${key}`
const HELIUS_API = (path: string, key: string) =>
  `https://api.helius.xyz${path}${path.includes('?') ? '&' : '?'}api-key=${key}`

function env(name: string, fallback = ''): string {
  return (process.env[name] ?? fallback).trim()
}

export function getConfig() {
  return {
    heliusKey: env('HELIUS_API_KEY'),
    wallet: env('VITE_WALLET_ADDRESS') || env('WALLET_ADDRESS'),
    startingBankroll: Number(env('VITE_STARTING_BANKROLL', '100')) || 100,
  }
}

async function rpc<T>(key: string, method: string, params: unknown[]): Promise<T> {
  const res = await fetch(HELIUS_RPC(key), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  if (!res.ok) throw new Error(`Helius RPC HTTP ${res.status}`)
  const json = (await res.json()) as { result?: T; error?: { message?: string } }
  if (json.error) throw new Error(json.error.message || 'Helius RPC error')
  return json.result as T
}

export async function fetchSolPriceUsd(): Promise<number> {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd', {
      headers: { Accept: 'application/json' },
    })
    if (res.ok) {
      const data = (await res.json()) as { solana?: { usd?: number } }
      if (data.solana?.usd) return data.solana.usd
    }
  } catch {
    /* fall through */
  }

  try {
    const res = await fetch('https://price.jup.ag/v6/price?ids=SOL')
    if (res.ok) {
      const data = (await res.json()) as { data?: { SOL?: { price?: number } } }
      if (data.data?.SOL?.price) return data.data.SOL.price
    }
  } catch {
    /* fall through */
  }

  return 150
}

type HeliusTokenBalance = {
  mint: string
  amount: number
  decimals: number
  tokenAccount?: string
}

type HeliusBalances = {
  tokens?: Array<{
    mint: string
    amount: number
    decimals: number
    token_account?: string
  }>
  nativeBalance?: number
}

async function fetchTokenPrices(mints: string[]): Promise<Record<string, number>> {
  if (!mints.length) return {}
  const out: Record<string, number> = {}
  const chunk = mints.slice(0, 100)
  try {
    const res = await fetch(`https://api.jup.ag/price/v2?ids=${chunk.join(',')}`)
    if (res.ok) {
      const data = (await res.json()) as { data?: Record<string, { price?: string } | null> }
      for (const mint of chunk) {
        const price = Number(data.data?.[mint]?.price)
        if (Number.isFinite(price)) out[mint] = price
      }
    }
  } catch {
    /* ignore */
  }
  return out
}

async function fetchAssetMeta(
  key: string,
  mints: string[],
): Promise<Record<string, { symbol: string; name: string; logo?: string }>> {
  if (!mints.length) return {}
  const out: Record<string, { symbol: string; name: string; logo?: string }> = {}
  try {
    const res = await fetch(HELIUS_RPC(key), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getAssetBatch',
        params: { ids: mints.slice(0, 100) },
      }),
    })
    if (!res.ok) return out
    const json = (await res.json()) as {
      result?: Array<{
        id?: string
        content?: {
          metadata?: { symbol?: string; name?: string }
          links?: { image?: string }
          files?: Array<{ uri?: string; cdn_uri?: string }>
        }
        token_info?: { symbol?: string }
      } | null>
    }
    for (const asset of json.result ?? []) {
      if (!asset?.id) continue
      const symbol =
        asset.content?.metadata?.symbol || asset.token_info?.symbol || asset.id.slice(0, 4)
      const name = asset.content?.metadata?.name || symbol
      const logo =
        asset.content?.links?.image ||
        asset.content?.files?.[0]?.cdn_uri ||
        asset.content?.files?.[0]?.uri
      out[asset.id] = { symbol, name, logo }
    }
  } catch {
    /* ignore */
  }
  return out
}

async function fetchBalances(key: string, wallet: string): Promise<{
  lamports: number
  tokens: HeliusTokenBalance[]
}> {
  // Prefer Helius balances API
  try {
    const res = await fetch(HELIUS_API(`/v0/addresses/${wallet}/balances`, key))
    if (res.ok) {
      const data = (await res.json()) as HeliusBalances
      const tokens = (data.tokens ?? [])
        .filter((t) => t.amount > 0)
        .map((t) => ({
          mint: t.mint,
          amount: t.amount,
          decimals: t.decimals,
          tokenAccount: t.token_account,
        }))
      return {
        lamports: data.nativeBalance ?? 0,
        tokens,
      }
    }
  } catch {
    /* fall through to RPC */
  }

  const balanceRes = await rpc<{ value: number }>(key, 'getBalance', [
    wallet,
    { commitment: 'confirmed' },
  ])
  const lamports = balanceRes.value

  const tokenPrograms = [
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
  ]

  const tokens: HeliusTokenBalance[] = []
  for (const programId of tokenPrograms) {
    try {
      const tokenRes = await rpc<{
        value: Array<{
          account: {
            data: {
              parsed: {
                info: {
                  mint: string
                  tokenAmount: { amount: string; decimals: number; uiAmount: number | null }
                }
              }
            }
          }
        }>
      }>(key, 'getTokenAccountsByOwner', [
        wallet,
        { programId },
        { encoding: 'jsonParsed' },
      ])

      for (const row of tokenRes.value) {
        const info = row.account.data.parsed.info
        const amount = Number(info.tokenAmount.amount)
        if (amount > 0) {
          tokens.push({
            mint: info.mint,
            amount,
            decimals: info.tokenAmount.decimals,
          })
        }
      }
    } catch {
      /* ignore program */
    }
  }

  return { lamports, tokens }
}

export async function getLiveWallet(): Promise<LiveWallet | null> {
  const { heliusKey, wallet, startingBankroll } = getConfig()
  if (!wallet) return null
  if (!heliusKey) {
    throw new Error('HELIUS_API_KEY is missing')
  }

  const [solPriceUsd, balances] = await Promise.all([
    fetchSolPriceUsd(),
    fetchBalances(heliusKey, wallet),
  ])

  const balanceSol = balances.lamports / 1e9
  const balanceUsd = balanceSol * solPriceUsd

  const mints = balances.tokens.map((t) => t.mint)
  const [prices, meta] = await Promise.all([
    fetchTokenPrices(mints),
    fetchAssetMeta(heliusKey, mints),
  ])

  const positions: Position[] = balances.tokens
    .map((t) => {
      const amount = t.amount / 10 ** t.decimals
      const priceUsd = prices[t.mint] ?? 0
      const info = meta[t.mint]
      return {
        mint: t.mint,
        symbol: info?.symbol || t.mint.slice(0, 4),
        name: info?.name || info?.symbol || 'unknown',
        amount,
        decimals: t.decimals,
        usdValue: amount * priceUsd,
        priceUsd,
        logo: info?.logo,
      }
    })
    .filter((p) => p.amount > 0)
    .sort((a, b) => b.usdValue - a.usdValue)

  const tokenValueUsd = positions.reduce((sum, p) => sum + p.usdValue, 0)
  const equityUsd = balanceUsd + tokenValueUsd
  const totalPnlUsd = equityUsd - startingBankroll
  const totalPnlSol = solPriceUsd > 0 ? totalPnlUsd / solPriceUsd : 0

  return {
    address: wallet,
    balanceSol,
    balanceUsd,
    equityUsd,
    tokenValueUsd,
    totalPnlUsd,
    totalPnlSol,
    realizedPnlUsd: totalPnlUsd,
    unrealizedPnlUsd: 0,
    lifetimeNetDepositUsd: startingBankroll,
    solPriceUsd,
    positions,
    source: 'helius',
    updatedAt: new Date().toISOString(),
  }
}

type HeliusTx = {
  signature: string
  timestamp: number
  type?: string
  description?: string
  fee?: number
  feePayer?: string
  nativeTransfers?: Array<{ fromUserAccount?: string; toUserAccount?: string; amount: number }>
  tokenTransfers?: Array<{
    fromUserAccount?: string
    toUserAccount?: string
    mint: string
    tokenAmount: number
    tokenStandard?: string
  }>
  events?: {
    swap?: {
      nativeInput?: { amount: number }
      nativeOutput?: { amount: number }
      tokenInputs?: Array<{ mint: string; rawTokenAmount?: { tokenAmount: string; decimals: number } }>
      tokenOutputs?: Array<{ mint: string; rawTokenAmount?: { tokenAmount: string; decimals: number } }>
    }
  }
}

async function fetchTransactions(key: string, wallet: string, limit = 100): Promise<HeliusTx[]> {
  const res = await fetch(
    HELIUS_API(`/v0/addresses/${wallet}/transactions?limit=${limit}`, key),
  )
  if (!res.ok) {
    throw new Error(`Helius tx HTTP ${res.status}`)
  }
  return (await res.json()) as HeliusTx[]
}

function classifyTx(tx: HeliusTx, wallet: string): FeedItem {
  const type = (tx.type || '').toUpperCase()
  const swap = tx.events?.swap
  let action: FeedAction = 'unknown'
  let solDelta = 0
  let tokenMint: string | undefined
  let tokenAmount = 0

  for (const n of tx.nativeTransfers ?? []) {
    if (n.toUserAccount === wallet) solDelta += n.amount / 1e9
    if (n.fromUserAccount === wallet) solDelta -= n.amount / 1e9
  }

  const outs = tx.tokenTransfers?.filter((t) => t.toUserAccount === wallet) ?? []
  const ins = tx.tokenTransfers?.filter((t) => t.fromUserAccount === wallet) ?? []

  if (type.includes('SWAP') || swap) {
    if (outs.length && solDelta < 0) {
      action = 'swap_buy'
      tokenMint = outs[0]?.mint
      tokenAmount = outs[0]?.tokenAmount ?? 0
    } else if (ins.length && solDelta > 0) {
      action = 'swap_sell'
      tokenMint = ins[0]?.mint
      tokenAmount = ins[0]?.tokenAmount ?? 0
    } else {
      action = 'swap'
      tokenMint = outs[0]?.mint || ins[0]?.mint
      tokenAmount = outs[0]?.tokenAmount || ins[0]?.tokenAmount || 0
    }
  } else if (solDelta > 0 && !outs.length && !ins.length) {
    action = 'receive'
  } else if (solDelta < 0 && !outs.length && !ins.length) {
    action = 'send'
  } else if (outs.length && !ins.length) {
    action = 'transfer_in'
    tokenMint = outs[0]?.mint
    tokenAmount = outs[0]?.tokenAmount ?? 0
  } else if (ins.length && !outs.length) {
    action = 'transfer_out'
    tokenMint = ins[0]?.mint
    tokenAmount = ins[0]?.tokenAmount ?? 0
  }

  const symbol = tokenMint ? tokenMint.slice(0, 4) : 'SOL'
  const absSol = Math.abs(solDelta)
  const label =
    action === 'swap_buy'
      ? 'BUY'
      : action === 'swap_sell'
        ? 'SELL'
        : action === 'receive'
          ? 'RECV'
          : action === 'send'
            ? 'SEND'
            : action === 'transfer_in'
              ? 'IN'
              : action === 'transfer_out'
                ? 'OUT'
                : type || 'TX'

  const headline =
    action === 'swap_buy'
      ? `bought ${symbol}`
      : action === 'swap_sell'
        ? `sold ${symbol}`
        : action === 'receive'
          ? `received SOL`
          : action === 'send'
            ? `sent SOL`
            : tx.description || `${label} ${symbol}`

  return {
    id: tx.signature,
    action,
    label,
    timestamp: (tx.timestamp || 0) * 1000,
    txHash: tx.signature,
    tokenMint,
    tokenSymbol: symbol,
    tokenName: symbol,
    headline,
    description: tx.description,
    subline: tokenAmount ? `${tokenAmount.toPrecision(4)} tokens` : undefined,
    solDelta: absSol > 0.00001 ? solDelta : undefined,
  }
}

export async function getFeed(limit = 50): Promise<FeedResponse> {
  const { heliusKey, wallet } = getConfig()
  if (!wallet) {
    return { items: [], wallet: '', source: 'helius', count: 0 }
  }
  if (!heliusKey) throw new Error('HELIUS_API_KEY is missing')

  const txs = await fetchTransactions(heliusKey, wallet, limit)
  const items = txs.map((tx) => classifyTx(tx, wallet))
  return { items, wallet, source: 'helius', count: items.length }
}

export async function getChart(): Promise<ChartResponse> {
  const { heliusKey, wallet, startingBankroll } = getConfig()
  if (!wallet || !heliusKey) {
    return {
      points: [],
      meta: {
        count: 0,
        source: 'helius',
        kind: 'equity_pnl',
        startingBankrollUsd: startingBankroll,
      },
    }
  }

  const [solPriceUsd, live, txs] = await Promise.all([
    fetchSolPriceUsd(),
    getLiveWallet(),
    fetchTransactions(heliusKey, wallet, 100),
  ])

  // Reconstruct equity path from oldest → newest using net SOL flow as proxy,
  // then anchor the latest point to live equity.
  const chronological = [...txs].sort((a, b) => a.timestamp - b.timestamp)
  let solBalance = 0
  const points: ChartPoint[] = []

  // Seed with starting bankroll converted to SOL at current price (approx)
  const startSol = solPriceUsd > 0 ? startingBankroll / solPriceUsd : 0
  solBalance = startSol
  if (chronological.length) {
    points.push({
      timestamp: chronological[0]!.timestamp * 1000 - 60_000,
      pnlUsd: 0,
      pnlSol: 0,
      equityUsd: startingBankroll,
    })
  }

  for (const tx of chronological) {
    let delta = 0
    for (const n of tx.nativeTransfers ?? []) {
      if (n.toUserAccount === wallet) delta += n.amount / 1e9
      if (n.fromUserAccount === wallet) delta -= n.amount / 1e9
    }
    // fees
    if (tx.feePayer === wallet && tx.fee) delta -= tx.fee / 1e9
    solBalance += delta
    const equityUsd = solBalance * solPriceUsd
    const pnlUsd = equityUsd - startingBankroll
    points.push({
      timestamp: tx.timestamp * 1000,
      pnlUsd,
      pnlSol: solPriceUsd > 0 ? pnlUsd / solPriceUsd : 0,
      equityUsd,
    })
  }

  if (live) {
    points.push({
      timestamp: Date.now(),
      pnlUsd: live.totalPnlUsd,
      pnlSol: live.totalPnlSol,
      equityUsd: live.equityUsd,
    })
  }

  // Deduplicate by timestamp keeping last
  const byTs = new Map<number, ChartPoint>()
  for (const p of points) byTs.set(p.timestamp, p)
  const deduped = [...byTs.values()].sort((a, b) => a.timestamp - b.timestamp)

  return {
    points: deduped,
    meta: {
      count: deduped.length,
      source: 'helius_flow_anchor',
      kind: 'equity_pnl',
      startingBankrollUsd: startingBankroll,
    },
  }
}

export async function getChomoState() {
  const { startingBankroll, wallet, heliusKey } = getConfig()

  if (!wallet) {
    return {
      updatedAt: new Date().toISOString(),
      status: 'waiting' as const,
      model: 'openclaw',
      wallet: null,
      chart: {
        points: [],
        meta: {
          count: 0,
          source: 'none',
          kind: 'equity_pnl',
          startingBankrollUsd: startingBankroll,
        },
      },
      feed: [],
      events: [
        {
          id: 'boot',
          at: new Date().toISOString(),
          kind: 'thought' as const,
          text: 'wallet not set. waiting for coordinates in .env',
        },
      ],
      startingBankrollUsd: startingBankroll,
      solPriceUsd: await fetchSolPriceUsd().catch(() => 0),
    }
  }

  if (!heliusKey) {
    return {
      updatedAt: new Date().toISOString(),
      status: 'offline' as const,
      model: 'openclaw',
      wallet: null,
      chart: {
        points: [],
        meta: {
          count: 0,
          source: 'none',
          kind: 'equity_pnl',
          startingBankrollUsd: startingBankroll,
        },
      },
      feed: [],
      events: [
        {
          id: 'no-key',
          at: new Date().toISOString(),
          kind: 'refused' as const,
          text: 'HELIUS_API_KEY missing — cannot read chain',
        },
      ],
      startingBankrollUsd: startingBankroll,
      solPriceUsd: 0,
    }
  }

  const [walletLive, chart, feed] = await Promise.all([
    getLiveWallet(),
    getChart(),
    getFeed(40),
  ])

  const events: AgentEvent[] = feed.items.slice(0, 20).map((item, i) => ({
    id: `${item.id}-${i}`,
    at: new Date(item.timestamp).toISOString(),
    kind: item.action.startsWith('swap') ? 'trade' : 'did',
    text: item.headline + (item.solDelta != null ? ` · ${item.solDelta.toFixed(4)} SOL` : ''),
  }))

  if (!events.length) {
    events.push({
      id: 'idle',
      at: new Date().toISOString(),
      kind: 'thought',
      text: 'wallet funded. staring at the feed. waiting for a thesis to feel real.',
    })
  }

  return {
    updatedAt: new Date().toISOString(),
    status: 'live' as const,
    model: 'openclaw',
    wallet: walletLive,
    chart,
    feed: feed.items,
    events,
    startingBankrollUsd: startingBankroll,
    solPriceUsd: walletLive?.solPriceUsd ?? (await fetchSolPriceUsd()),
  }
}
