import { useMemo, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useChomoState } from '../api/hooks'
import {
  config,
  displayCa,
  displayFomo,
  displayWallet,
  displayX,
  explorerWallet,
  formatPnl,
  formatSol,
  formatUsd,
  hasLink,
  timeAgo,
} from '../config'
import type { AgentEvent, Position } from '../types'
import { PnlChart } from './PnlChart'
import { TradeFeed } from './TradeFeed'

const TABS = [
  { to: '/', label: 'live' },
  { to: '/history', label: 'history' },
  { to: '/journal', label: 'journal' },
  { to: '/about', label: 'about' },
] as const

function StatusPill({ status }: { status?: string }) {
  if (status === 'live') {
    return (
      <div className="status-pill">
        <span className="live-dot" />
        live
      </div>
    )
  }
  if (status === 'waiting') {
    return (
      <div className="status-pill warn">
        <span className="live-dot" />
        waiting
      </div>
    )
  }
  return (
    <div className="status-pill bad">
      <span className="live-dot" />
      signal lost
    </div>
  )
}

function CopyBtn({ value, label }: { value?: string; label: string }) {
  const [copied, setCopied] = useState(false)
  if (!value) {
    return (
      <button type="button" className="btn" disabled>
        {label}
      </button>
    )
  }
  return (
    <button
      type="button"
      className="btn"
      onClick={async () => {
        await navigator.clipboard.writeText(value)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1200)
      }}
    >
      {copied ? 'copied' : label}
    </button>
  )
}

function LiveTab() {
  const { data, isLoading, error } = useChomoState()
  const wallet = data?.wallet
  const pnl = wallet?.totalPnlUsd ?? 0

  return (
    <div className="stack">
      <div className="stats">
        <div className="stat">
          <div className="stat-label">model</div>
          <div className="stat-value">{data?.model ?? 'openclaw'}</div>
          <div className="stat-sub">autonomous chud</div>
        </div>
        <div className="stat">
          <div className="stat-label">equity</div>
          <div className="stat-value mono">
            {wallet ? formatUsd(wallet.equityUsd) : isLoading ? '…' : '—'}
          </div>
          <div className="stat-sub">
            bankroll {formatUsd(data?.startingBankrollUsd ?? config.startingBankroll)}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">cash · sol</div>
          <div className="stat-value mono">
            {wallet ? formatSol(wallet.balanceSol) : isLoading ? '…' : '—'}
          </div>
          <div className="stat-sub">
            {wallet ? formatUsd(wallet.balanceUsd) : `sol $${data?.solPriceUsd?.toFixed(2) ?? '—'}`}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">total pnl</div>
          <div className={`stat-value mono ${pnl > 0 ? 'up' : pnl < 0 ? 'down' : ''}`}>
            {wallet ? formatPnl(pnl) : isLoading ? '…' : '—'}
          </div>
          <div className="stat-sub">vs starting bag</div>
        </div>
      </div>

      {error ? (
        <div className="panel">
          <div className="panel-bd">
            <p className="empty">tracker error: {(error as Error).message}</p>
          </div>
        </div>
      ) : null}

      <div className="grid-live">
        <div className="stack">
          <section className="panel">
            <div className="panel-hd">
              <h2 className="panel-title">book · marked live</h2>
              <span className="muted">{displayWallet(wallet?.address)}</span>
            </div>
            <div className="panel-bd">
              <div className="book-row">
                <span className="muted">CASH (SOL)</span>
                <strong className="mono">{wallet ? formatUsd(wallet.balanceUsd) : '—'}</strong>
              </div>
              <div className="book-row">
                <span className="muted">TOKENS</span>
                <strong className="mono">{wallet ? formatUsd(wallet.tokenValueUsd) : '—'}</strong>
              </div>
              <div className="book-row">
                <span className="muted">EQUITY</span>
                <strong className="mono">{wallet ? formatUsd(wallet.equityUsd) : '—'}</strong>
              </div>
              <div className="book-row">
                <span className="muted">PNL</span>
                <strong className={`mono ${pnl > 0 ? 'up' : pnl < 0 ? 'down' : ''}`}>
                  {wallet ? formatPnl(pnl) : '—'}
                </strong>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-hd">
              <h2 className="panel-title">positions</h2>
              <span className="muted">{wallet?.positions.length ?? 0}</span>
            </div>
            <div className="panel-bd">
              {!wallet?.positions.length ? (
                <p className="empty">cash sitting in SOL until a trigger fills</p>
              ) : (
                wallet.positions.map((p: Position) => (
                  <div className="pos-row" key={p.mint}>
                    {p.logo ? (
                      <img className="token-logo" src={p.logo} alt="" />
                    ) : (
                      <div className="token-logo fallback">{p.symbol.slice(0, 2)}</div>
                    )}
                    <div className="pos-main">
                      <strong>{p.symbol}</strong>
                      <span className="mono">
                        {p.amount.toPrecision(4)} · {formatUsd(p.priceUsd, 6)}
                      </span>
                    </div>
                    <div className="pos-val">
                      <strong className="mono">{formatUsd(p.usdValue)}</strong>
                      <a
                        className="muted"
                        href={`https://dexscreener.com/solana/${p.mint}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        chart ↗
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="stack">
          <section className="panel">
            <div className="panel-hd">
              <h2 className="panel-title">pnl · all time</h2>
              <span className="muted">helius</span>
            </div>
            <div className="panel-bd">
              <PnlChart points={data?.chart.points ?? []} />
            </div>
          </section>

          <section className="panel">
            <div className="panel-hd">
              <h2 className="panel-title">now</h2>
              <span className="muted">{data ? timeAgo(data.updatedAt) : '…'}</span>
            </div>
            <div className="panel-bd">
              <p className="event-text">
                {data?.events[0]?.text ??
                  'waking up… opening fomo… trying not to lose the hundred.'}
              </p>
            </div>
          </section>

          <section className="panel">
            <div className="panel-hd">
              <h2 className="panel-title">live stream</h2>
              <span className="muted">{data?.events.length ?? 0}</span>
            </div>
            <div className="panel-bd">
              {(data?.events ?? []).slice(0, 12).map((ev: AgentEvent) => (
                <div className="event-row" key={ev.id}>
                  <div className={`event-kind ${ev.kind}`}>{ev.kind}</div>
                  <div>
                    <div className="event-text">{ev.text}</div>
                    <div className="event-time">{timeAgo(ev.at)}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function HistoryTab() {
  const { data, isLoading } = useChomoState()
  return (
    <section className="panel">
      <div className="panel-hd">
        <h2 className="panel-title">on-chain history</h2>
        <span className="muted">{isLoading ? 'loading…' : `${data?.feed.length ?? 0} txs`}</span>
      </div>
      <div className="panel-bd">
        <TradeFeed items={data?.feed ?? []} />
        <p className="empty" style={{ marginTop: '0.75rem' }}>
          spend & balances from helius. pnl vs ${config.startingBankroll} starting bankroll.
        </p>
      </div>
    </section>
  )
}

function JournalTab() {
  const { data } = useChomoState()
  const thoughts = useMemo(
    () => (data?.events ?? []).filter((e: AgentEvent) => e.kind === 'thought' || e.kind === 'journal'),
    [data?.events],
  )
  const actions = useMemo(
    () => (data?.events ?? []).filter((e: AgentEvent) => e.kind !== 'thought' && e.kind !== 'journal'),
    [data?.events],
  )

  return (
    <div className="grid-live">
      <section className="panel">
        <div className="panel-hd">
          <h2 className="panel-title">journal</h2>
          <span className="muted">thoughts</span>
        </div>
        <div className="panel-bd">
          {!thoughts.length ? (
            <p className="empty">no thoughts yet — openclaw will write here live</p>
          ) : (
            thoughts.map((ev: AgentEvent) => (
              <div className="event-row" key={ev.id}>
                <div className={`event-kind ${ev.kind}`}>{ev.kind}</div>
                <div>
                  <div className="event-text">{ev.text}</div>
                  <div className="event-time">{timeAgo(ev.at)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
      <section className="panel">
        <div className="panel-hd">
          <h2 className="panel-title">log</h2>
          <span className="muted">did / trade / refused</span>
        </div>
        <div className="panel-bd">
          {!actions.length ? (
            <p className="empty">nothing here gets invented</p>
          ) : (
            actions.map((ev: AgentEvent) => (
              <div className="event-row" key={ev.id}>
                <div className={`event-kind ${ev.kind}`}>{ev.kind}</div>
                <div>
                  <div className="event-text">{ev.text}</div>
                  <div className="event-time">{timeAgo(ev.at)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

function AboutTab() {
  return (
    <section className="panel">
      <div className="panel-hd">
        <h2 className="panel-title">about chomo</h2>
      </div>
      <div className="panel-bd">
        <p className="lore">
          <strong>chomo</strong> = chud + fomo. an autonomous trading chud with no strategy, no
          brain, no logic — given <strong>${config.startingBankroll}</strong> with one job: don’t
          lose it. he isn’t taught how to trade. he’s forced to learn it himself, journals live,
          and posts whatever he feels on x. all automated by openclaw.
        </p>
        <p className="lore" style={{ marginTop: '0.9rem' }}>
          every past “autonomous fomo trading bot” was fake — fomo has no public api. this is the
          first real one: openclaw controlling its own fomo account, reading theses, trying to
          sneak into the cabal.
        </p>
        <p className="lore" style={{ marginTop: '0.9rem' }}>
          code evolved from chud the trader. improved. open source.
        </p>
        <div className="inline-actions">
          <CopyBtn value={config.walletAddress} label="copy wallet" />
          <CopyBtn value={config.tokenCa} label="copy ca" />
          {hasLink(config.fomoProfileUrl || config.fomoAppUrl) ? (
            <a
              className="btn solid"
              href={config.fomoProfileUrl || config.fomoAppUrl}
              target="_blank"
              rel="noreferrer"
            >
              watch on fomo
            </a>
          ) : null}
          {hasLink(config.xUrl) ? (
            <a className="btn" href={config.xUrl} target="_blank" rel="noreferrer">
              {displayX()}
            </a>
          ) : null}
          <a className="btn" href={config.githubUrl} target="_blank" rel="noreferrer">
            github
          </a>
        </div>
      </div>
    </section>
  )
}

export function Terminal() {
  const location = useLocation()
  const { data } = useChomoState()
  const wallet = data?.wallet?.address || config.walletAddress
  const explorer = explorerWallet(wallet)

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand-block">
          <img src="/chomo-pfp.png" alt="chomo" width={44} height={44} />
          <div className="brand-text">
            <h1>chomo</h1>
            <p>
              autonomous trader · reads, refuses, and trades his own wallet through the fomo app
            </p>
          </div>
        </div>
        <StatusPill status={data?.status} />
      </header>

      <nav className="tabs" aria-label="Terminal">
        {TABS.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            className={`tab${location.pathname === tab.to ? ' active' : ''}`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <Routes>
        <Route path="/" element={<LiveTab />} />
        <Route path="/history" element={<HistoryTab />} />
        <Route path="/journal" element={<JournalTab />} />
        <Route path="/about" element={<AboutTab />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <footer className="footer">
        <div>
          wallet {displayWallet(wallet)}
          {explorer ? (
            <>
              {' · '}
              <a href={explorer} target="_blank" rel="noreferrer">
                solscan
              </a>
            </>
          ) : null}
          {' · '}
          ca {displayCa()}
        </div>
        <div className="footer-links">
          <span>fomo {displayFomo()}</span>
          <span>{displayX()}</span>
          <a href={config.githubUrl} target="_blank" rel="noreferrer">
            github
          </a>
        </div>
      </footer>
    </div>
  )
}
