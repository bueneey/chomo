import { useMemo, useState } from 'react'
import type { FeedAction, FeedItem } from '../types'
import { formatSol, timeAgo } from '../config'

const FILTERS: Array<{ id: 'all' | FeedAction; label: string }> = [
  { id: 'all', label: 'all' },
  { id: 'swap_buy', label: 'buys' },
  { id: 'swap_sell', label: 'sells' },
  { id: 'swap', label: 'swaps' },
  { id: 'receive', label: 'recv' },
  { id: 'send', label: 'send' },
]

export function TradeFeed({ items, compact = false }: { items: FeedItem[]; compact?: boolean }) {
  const [filter, setFilter] = useState<'all' | FeedAction>('all')
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return items.filter((item) => {
      if (filter !== 'all' && item.action !== filter) return false
      if (!query) return true
      return [item.headline, item.tokenSymbol, item.tokenMint, item.txHash, item.description]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(query))
    })
  }, [items, filter, q])

  return (
    <div>
      {!compact ? (
        <>
          <input
            className="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="search symbol, mint, tx…"
          />
          <div className="filters">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`filter-btn${filter === f.id ? ' active' : ''}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {!filtered.length ? (
        <p className="empty">no on-chain activity yet</p>
      ) : (
        filtered.map((item) => (
          <article className="feed-row" key={item.id}>
            <div className={`badge ${item.action}`}>{item.label}</div>
            <div className="feed-main">
              <strong>{item.headline}</strong>
              {item.subline || item.description ? (
                <p>{item.subline || item.description}</p>
              ) : null}
              {item.solDelta != null ? (
                <span className="sol-pill">
                  {item.solDelta > 0 ? '+' : ''}
                  {formatSol(item.solDelta, 4)}
                </span>
              ) : null}
            </div>
            <div className="feed-side">
              <div>{timeAgo(item.timestamp)}</div>
              <a href={`https://solscan.io/tx/${item.txHash}`} target="_blank" rel="noreferrer">
                solscan ↗
              </a>
              {item.tokenMint ? (
                <>
                  <br />
                  <a
                    href={`https://dexscreener.com/solana/${item.tokenMint}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    chart ↗
                  </a>
                </>
              ) : null}
            </div>
          </article>
        ))
      )}
    </div>
  )
}
