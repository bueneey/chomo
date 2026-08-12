import { readFileSync, existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
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

let envCache: { mtimeMs: number; values: Record<string, string> } | null = null
let solPriceCache: { at: number; value: number } | null = null
let stateCache: { at: number; value: Awaited<ReturnType<typeof buildChomoState>> } | null = null
let stateInflight: Promise<Awaited<ReturnType<typeof buildChomoState>>> | null = null
let priceCache: { at: number; prices: Record<string, number> } | null = null

const STATE_TTL_MS = 8_000
const SOL_PRICE_TTL_MS = 60_000
const PRICE_TTL_MS = 45_000
const META_TTL_MS = 10 * 60_000
const metaCache = new Map<
  string,
  { at: number; symbol: string; name: string; logo?: string; priceUsd?: number }
>()

function parseEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) return {}
  const out: Record<string, string> = {}
  for (const raw of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

function readEnvFileCached(): Record<string, string> {
  const filePath = resolve(process.cwd(), '.env')
  if (!existsSync(filePath)) {
    envCache = null
    return {}
  }
  const mtimeMs = statSync(filePath).mtimeMs
  if (envCache && envCache.mtimeMs === mtimeMs) return envCache.values
  const values = parseEnvFile(filePath)
  envCache = { mtimeMs, values }
  return values
}

function env(name: string, fallback = ''): string {
  const fileEnv = readEnvFileCached()
  const value = fileEnv[name] ?? process.env[name] ?? fallback
  return String(value).trim()
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
  if (solPriceCache && Date.now() - solPriceCache.at < SOL_PRICE_TTL_MS) {
    return solPriceCache.value
  }

  let value = 150
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd', {
      headers: { Accept: 'application/json' },
    })
    if (res.ok) {
      const data = (await res.json()) as { solana?: { usd?: number } }
      if (data.solana?.usd) value = data.solana.usd
    }
  } catch {
    try {
      const res = await fetch(
        'https://lite-api.jup.ag/price/v3?ids=So11111111111111111111111111111111111111112',
      )
      if (res.ok) {
        const data = (await res.json()) as Record<string, { usdPrice?: number } | null>
        const price = Number(data.So11111111111111111111111111111111111111112?.usdPrice)
        if (Number.isFinite(price) && price > 0) value = price
      }
    } catch {
      /* keep fallback */
    }
  }

  solPriceCache = { at: Date.now(), value }
  return value
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

function chunkArray<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

function normalizeLogoUrl(raw?: string | null): string | undefined {
  if (!raw) return undefined
  let url = raw.trim()
  if (!url) return undefined

  if (url.startsWith('ipfs://')) {
    const path = url.slice('ipfs://'.length).replace(/^ipfs\//, '')
    url = `https://ipfs.io/ipfs/${path}`
  } else if (url.startsWith('ar://')) {
    url = `https://arweave.net/${url.slice('ar://'.length)}`
  } else if (url.startsWith('http://')) {
    url = `https://${url.slice('http://'.length)}`
  }

  if (!/^https?:\/\//i.test(url) && !url.startsWith('data:image')) return undefined
  // Skip metadata JSON URIs that Helius often puts first in files[]
  if (/\.json(\?|#|$)/i.test(url)) return undefined
  return url
}

function pickLogo(asset: {
  content?: {
    links?: { image?: string }
    files?: Array<{ uri?: string; cdn_uri?: string; mime?: string }>
  }
}): string | undefined {
  const fromLink = normalizeLogoUrl(asset.content?.links?.image)
  if (fromLink) return fromLink

  const files = asset.content?.files ?? []
  for (const file of files) {
    if (file.mime && !file.mime.startsWith('image/')) continue
    const candidate = normalizeLogoUrl(file.cdn_uri) || normalizeLogoUrl(file.uri)
    if (candidate) return candidate
  }
  for (const file of files) {
    const candidate = normalizeLogoUrl(file.cdn_uri) || normalizeLogoUrl(file.uri)
    if (candidate) return candidate
  }
  return undefined
}

async function fetchTokenPrices(mints: string[]): Promise<Record<string, number>> {
  if (!mints.length) return {}
  const unique = [...new Set(mints)].slice(0, 24)
  const now = Date.now()
  const out: Record<string, number> = {}

  // Reuse cached prices aggressively — this was the main lag source.
  if (priceCache && now - priceCache.at < PRICE_TTL_MS) {
    let hit = 0
    for (const mint of unique) {
      const price = priceCache.prices[mint]
      if (price != null && price > 0) {
        out[mint] = price
        hit += 1
      }
    }
    if (hit === unique.length) return out
  }

  const need = unique.filter((m) => out[m] == null)

  await Promise.all(
    chunkArray(need, 50).map(async (chunk) => {
      try {
        const res = await fetch(`https://lite-api.jup.ag/price/v3?ids=${chunk.join(',')}`, {
          headers: { Accept: 'application/json' },
        })
        if (!res.ok) return
        const data = (await res.json()) as Record<string, { usdPrice?: number } | null>
        for (const mint of chunk) {
          const price = Number(data[mint]?.usdPrice)
          if (Number.isFinite(price) && price > 0) out[mint] = price
        }
      } catch {
        /* ignore */
      }
    }),
  )

  const missing = need.filter((m) => out[m] == null)
  if (missing.length) {
    await Promise.all(
      chunkArray(missing, 30).map(async (chunk) => {
        try {
          const res = await fetch(
            `https://api.dexscreener.com/latest/dex/tokens/${chunk.join(',')}`,
            { headers: { Accept: 'application/json' } },
          )
          if (!res.ok) return
          const data = (await res.json()) as {
            pairs?: Array<{
              baseToken?: { address?: string }
              priceUsd?: string
              liquidity?: { usd?: number }
            }>
          }
          const best = new Map<string, { price: number; liq: number }>()
          for (const pair of data.pairs ?? []) {
            const mint = pair.baseToken?.address
            const price = Number(pair.priceUsd)
            const liq = Number(pair.liquidity?.usd ?? 0)
            if (!mint || !Number.isFinite(price) || price <= 0) continue
            const prev = best.get(mint)
            if (!prev || liq > prev.liq) best.set(mint, { price, liq })
          }
          for (const [mint, row] of best) out[mint] = row.price
        } catch {
          /* ignore */
        }
      }),
    )
  }

  priceCache = {
    at: now,
    prices: { ...(priceCache?.prices ?? {}), ...out },
  }
  return out
}

async function fetchAssetMeta(
  key: string,
  mints: string[],
): Promise<{
  meta: Record<string, { symbol: string; name: string; logo?: string }>
  prices: Record<string, number>
}> {
  if (!mints.length) return { meta: {}, prices: {} }
  const meta: Record<string, { symbol: string; name: string; logo?: string }> = {}
  const prices: Record<string, number> = {}
  const missing: string[] = []
  const now = Date.now()

  for (const mint of mints) {
    const cached = metaCache.get(mint)
    if (cached && now - cached.at < META_TTL_MS) {
      meta[mint] = {
        symbol: cached.symbol,
        name: cached.name,
        logo: normalizeLogoUrl(cached.logo),
      }
      if (cached.priceUsd != null && cached.priceUsd > 0) prices[mint] = cached.priceUsd
    } else {
      missing.push(mint)
    }
  }

  if (!missing.length) return { meta, prices }

  try {
    for (const chunk of chunkArray(missing, 40)) {
      const res = await fetch(HELIUS_RPC(key), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getAssetBatch',
          params: {
            ids: chunk,
            displayOptions: { showFungible: true },
          },
        }),
      })
      if (!res.ok) continue
      const json = (await res.json()) as {
        result?: Array<{
          id?: string
          content?: {
            metadata?: { symbol?: string; name?: string }
            links?: { image?: string }
            files?: Array<{ uri?: string; cdn_uri?: string; mime?: string }>
          }
          token_info?: {
            symbol?: string
            price_info?: { price_per_token?: number; currency?: string }
          }
        } | null>
      }
      for (const asset of json.result ?? []) {
        if (!asset?.id) continue
        const symbol =
          asset.content?.metadata?.symbol || asset.token_info?.symbol || asset.id.slice(0, 4)
        const name = asset.content?.metadata?.name || symbol
        const logo = pickLogo(asset)
        const priceUsd = Number(asset.token_info?.price_info?.price_per_token)
        const row = {
          symbol,
          name,
          logo,
          priceUsd: Number.isFinite(priceUsd) && priceUsd > 0 ? priceUsd : undefined,
        }
        meta[asset.id] = { symbol: row.symbol, name: row.name, logo: row.logo }
        if (row.priceUsd != null) prices[asset.id] = row.priceUsd
        metaCache.set(asset.id, { at: now, ...row })
      }
    }
  } catch {
    /* ignore */
  }
  return { meta, prices }
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

  // Drop dust; cap priced set so wallet scans stay snappy.
  const heldTokens = balances.tokens
    .filter((t) => t.amount / 10 ** t.decimals > 1e-6)
    .sort((a, b) => b.amount / 10 ** b.decimals - a.amount / 10 ** a.decimals)
    .slice(0, 24)
  const mints = heldTokens.map((t) => t.mint)
  const [marketPrices, assetInfo] = await Promise.all([
    fetchTokenPrices(mints),
    fetchAssetMeta(heliusKey, mints),
  ])
  const prices = { ...assetInfo.prices, ...marketPrices }
  const meta = assetInfo.meta

  const positions: Position[] = heldTokens
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
    .sort((a, b) => b.usdValue - a.usdValue || b.amount - a.amount)
    .slice(0, 24)

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
    subline: tokenAmount
      ? `${tokenAmount.toLocaleString(undefined, { maximumSignificantDigits: 6 })} tokens`
      : undefined,
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

function solDeltaForTx(tx: HeliusTx, wallet: string): number {
  let delta = 0
  for (const n of tx.nativeTransfers ?? []) {
    if (n.toUserAccount === wallet) delta += n.amount / 1e9
    if (n.fromUserAccount === wallet) delta -= n.amount / 1e9
  }
  if (tx.feePayer === wallet && tx.fee) delta -= tx.fee / 1e9
  return delta
}

function buildChartFromTxs(
  wallet: string,
  txs: HeliusTx[],
  solPriceUsd: number,
  startingBankroll: number,
  live: LiveWallet | null,
): ChartResponse {
  const chronological = [...txs].sort((a, b) => a.timestamp - b.timestamp)
  const deltas = chronological.map((tx) => ({
    timestamp: (tx.timestamp || 0) * 1000,
    delta: solDeltaForTx(tx, wallet),
  }))

  // Anchor to live SOL balance, walk backwards for accurate historical SOL.
  let sol = live?.balanceSol ?? 0
  const series: Array<{ timestamp: number; balanceSol: number }> = [
    { timestamp: Date.now(), balanceSol: sol },
  ]

  for (let i = deltas.length - 1; i >= 0; i--) {
    const row = deltas[i]!
    sol -= row.delta
    series.push({ timestamp: row.timestamp, balanceSol: Math.max(0, sol) })
  }
  series.reverse()

  if (series.length === 1 && live) {
    series.unshift({
      timestamp: Date.now() - 60_000,
      balanceSol: live.balanceSol,
    })
  }

  const points: ChartPoint[] = series.map((row, index) => {
    const isLatest = index === series.length - 1
    // Latest point uses full wallet equity (SOL + tokens). History approximates SOL×spot.
    const balanceUsd =
      isLatest && live ? live.equityUsd : row.balanceSol * solPriceUsd
    return {
      timestamp: row.timestamp,
      balanceUsd,
      balanceSol: isLatest && live ? live.balanceSol : row.balanceSol,
      equityUsd: balanceUsd,
      pnlUsd: live ? balanceUsd - startingBankroll : 0,
      pnlSol: solPriceUsd > 0 ? (balanceUsd - startingBankroll) / solPriceUsd : 0,
    }
  })

  const byTs = new Map<number, ChartPoint>()
  for (const p of points) byTs.set(p.timestamp, p)
  let deduped = [...byTs.values()].sort((a, b) => a.timestamp - b.timestamp)

  if (deduped.length > 80) {
    const step = Math.ceil(deduped.length / 80)
    const sampled: ChartPoint[] = []
    for (let i = 0; i < deduped.length; i += step) sampled.push(deduped[i]!)
    const last = deduped[deduped.length - 1]!
    if (sampled[sampled.length - 1] !== last) sampled.push(last)
    deduped = sampled
  }

  return {
    points: deduped,
    meta: {
      count: deduped.length,
      source: 'helius_sol_anchor_live_equity',
      kind: 'wallet_balance',
      startingBankrollUsd: startingBankroll,
    },
  }
}

export async function getChart(): Promise<ChartResponse> {
  const state = await getChomoState()
  return state.chart
}

function journalLine(item: FeedItem): string {
  const sol =
    item.solDelta != null ? ` · ${item.solDelta > 0 ? '+' : ''}${item.solDelta.toFixed(4)} SOL` : ''
  if (item.action === 'swap_buy') {
    return `bought ${item.tokenSymbol || 'something'}${sol}. bag updated. no thesis yet.`
  }
  if (item.action === 'swap_sell') {
    return `sold ${item.tokenSymbol || 'something'}${sol}. counting what’s left.`
  }
  if (item.action === 'receive') return `wallet received SOL${sol}. noted.`
  if (item.action === 'send') return `sent SOL${sol}. hope that was intentional.`
  if (item.action === 'transfer_in') {
    return `tokens in: ${item.tokenSymbol || 'unknown'}${item.subline ? ` · ${item.subline}` : ''}.`
  }
  if (item.action === 'transfer_out') {
    return `tokens out: ${item.tokenSymbol || 'unknown'}${item.subline ? ` · ${item.subline}` : ''}.`
  }
  return `${item.headline}${sol}`
}

function liveEventsFromFeed(feedItems: FeedItem[], walletLive: LiveWallet | null): AgentEvent[] {
  const tradeEvents: AgentEvent[] = feedItems.slice(0, 16).map((item) => ({
    id: `tx-${item.id}`,
    at: new Date(item.timestamp).toISOString(),
    kind: item.action.startsWith('swap') ? ('trade' as const) : ('did' as const),
    text: `${item.headline}${item.solDelta != null ? ` · ${item.solDelta.toFixed(4)} SOL` : ''}`,
  }))

  const journalEvents: AgentEvent[] = feedItems.slice(0, 12).map((item) => ({
    id: `journal-${item.id}`,
    at: new Date(item.timestamp + 1).toISOString(),
    kind: 'journal' as const,
    text: journalLine(item),
  }))

  const events = [...tradeEvents, ...journalEvents]
  if (walletLive) {
    events.unshift({
      id: `pnl-${walletLive.updatedAt}`,
      at: walletLive.updatedAt,
      kind: 'thought',
      text: `live bag ${walletLive.equityUsd.toFixed(2)} usd · ${walletLive.balanceSol.toFixed(3)} sol cash · pnl ${walletLive.totalPnlUsd >= 0 ? '+' : ''}${walletLive.totalPnlUsd.toFixed(2)}`,
    })
  }
  return events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
}

async function buildChomoState() {
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
          kind: 'wallet_balance',
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
          kind: 'wallet_balance',
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

  // One wallet fetch + one tx fetch (shared by feed + chart)
  const [walletLive, txs] = await Promise.all([
    getLiveWallet(),
    fetchTransactions(heliusKey, wallet, 60),
  ])

  const feedItems = txs.map((tx) => classifyTx(tx, wallet))
  // Resolve symbols/logos for feed mints (including sold tokens not in holdings).
  const feedMints = [
    ...new Set(feedItems.map((i) => i.tokenMint).filter((m): m is string => Boolean(m))),
  ].slice(0, 24)
  const feedMeta = feedMints.length ? await fetchAssetMeta(heliusKey, feedMints) : { meta: {}, prices: {} }
  const symbolByMint = new Map<string, string>()
  const logoByMint = new Map<string, string>()
  for (const p of walletLive?.positions ?? []) {
    symbolByMint.set(p.mint, p.symbol)
    if (p.logo) logoByMint.set(p.mint, p.logo)
  }
  for (const [mint, info] of Object.entries(feedMeta.meta)) {
    symbolByMint.set(mint, info.symbol)
    if (info.logo) logoByMint.set(mint, info.logo)
  }
  for (const item of feedItems) {
    if (!item.tokenMint) continue
    const symbol = symbolByMint.get(item.tokenMint)
    const logo = logoByMint.get(item.tokenMint)
    if (logo) item.tokenLogo = logo
    if (!symbol) continue
    item.tokenSymbol = symbol
    item.tokenName = symbol
    if (item.action === 'swap_buy') item.headline = `bought ${symbol}`
    else if (item.action === 'swap_sell') item.headline = `sold ${symbol}`
    else if (item.action === 'transfer_in') item.headline = `received ${symbol}`
    else if (item.action === 'transfer_out') item.headline = `sent ${symbol}`
  }

  const chart = buildChartFromTxs(
    wallet,
    txs,
    walletLive?.solPriceUsd ?? (await fetchSolPriceUsd()),
    startingBankroll,
    walletLive,
  )

  const events = liveEventsFromFeed(feedItems, walletLive)
  if (!events.length) {
    events.push({
      id: 'idle',
      at: new Date().toISOString(),
      kind: 'thought',
      text: 'watching the wallet. no moves yet. staring at the feed.',
    })
  }

  return {
    updatedAt: new Date().toISOString(),
    status: 'live' as const,
    model: 'openclaw',
    wallet: walletLive,
    chart,
    feed: feedItems,
    events,
    startingBankrollUsd: startingBankroll,
    solPriceUsd: walletLive?.solPriceUsd ?? 0,
  }
}

export async function getChomoState() {
  if (stateCache && Date.now() - stateCache.at < STATE_TTL_MS) {
    return stateCache.value
  }

  if (stateInflight) return stateInflight

  stateInflight = buildChomoState()
    .then((value) => {
      stateCache = { at: Date.now(), value }
      return value
    })
    .finally(() => {
      stateInflight = null
    })

  return stateInflight
}
