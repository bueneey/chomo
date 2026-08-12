import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useChomoState } from '../api/hooks'
import {
  config,
  displayCa,
  displayFomo,
  displayWallet,
  displayX,
  explorerWallet,
  formatAmount,
  formatPnl,
  formatSol,
  formatTokenPrice,
  formatUsd,
  hasLink,
  timeAgo,
} from '../config'
import type { AgentEvent, Position } from '../types'
import { PnlChart, type ChartRange } from './PnlChart'
import { TokenLogo } from './TokenLogo'
import { TradeFeed } from './TradeFeed'

const NAV = [
  { to: '/', label: 'home' },
  { to: '/feed', label: 'feed' },
  { to: '/journal', label: 'journal' },
] as const

function StatusPill({ status }: { status?: string }) {
  if (status === 'live') {
    return (
      <div className="live-pill">
        <span className="live-dot" />
        live
      </div>
    )
  }
  if (status === 'waiting') {
    return (
      <div className="live-pill warn">
        <span className="live-dot" />
        waiting
      </div>
    )
  }
  return (
    <div className="live-pill bad">
      <span className="live-dot" />
      offline
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

function Fold({
  title,
  meta,
  defaultOpen = false,
  children,
}: {
  title: string
  meta?: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  return (
    <details className="fold" open={defaultOpen}>
      <summary>
        <span>{title}</span>
        {meta ? <em>{meta}</em> : null}
      </summary>
      <div className="fold-body">{children}</div>
    </details>
  )
}

function HomePage() {
  const { data, isLoading, error } = useChomoState()
  const [range, setRange] = useState<ChartRange>('7d')
  const wallet = data?.wallet
  const vsBag = wallet ? wallet.equityUsd - (data?.startingBankrollUsd ?? config.startingBankroll) : 0
  const recent = (data?.feed ?? []).slice(0, 8)
  const thoughts = (data?.events ?? [])
    .filter(
      (e: AgentEvent) =>
        e.kind === 'thought' || e.kind === 'journal' || e.kind === 'trade' || e.kind === 'did',
    )
    .slice(0, 16)
  const [nowIndex, setNowIndex] = useState(0)
  const nowLine = thoughts[nowIndex % Math.max(thoughts.length, 1)]?.text ?? 'waiting on chain…'

  useEffect(() => {
    if (thoughts.length < 2) return
    const id = window.setInterval(() => {
      setNowIndex((i) => i + 1)
    }, 12_000)
    return () => window.clearInterval(id)
  }, [thoughts.length])

  return (
    <>
      {error ? (
        <section className="panel error-panel">
          <div className="panel-title">tracker error</div>
          <p>{(error as Error).message}</p>
        </section>
      ) : null}

      <section className="hero-balance">
        <div className="hero-balance-copy">
          <p className="eyebrow">wallet balance</p>
          <h2 className="hero-balance-value">
            {wallet ? formatUsd(wallet.equityUsd) : isLoading ? '…' : '—'}
          </h2>
          <p className="hero-balance-sub">
            {wallet
              ? `${formatSol(wallet.balanceSol, 3)} cash · ${formatUsd(wallet.tokenValueUsd)} in tokens · ${formatPnl(vsBag)} vs $${config.startingBankroll} bag`
              : `starting bag $${config.startingBankroll}`}
          </p>
        </div>
        <div className="hero-balance-actions">
          <CopyBtn value={wallet?.address || config.walletAddress} label="copy wallet" />
          <a
            className="btn solid"
            href={config.fomoProfileUrl || config.fomoAppUrl}
            target="_blank"
            rel="noreferrer"
          >
            watch on fomo
          </a>
        </div>
      </section>

      <section className="panel chart-panel">
        <div className="panel-head chart-panel-head">
          <div>
            <div className="panel-title">balance over time</div>
            <p className="muted tiny">hover for exact value · locked chart</p>
          </div>
          <span className="muted">wallet: {displayWallet(wallet?.address)}</span>
        </div>
        <PnlChart points={data?.chart.points ?? []} range={range} onRangeChange={setRange} />
      </section>

      <div className="story-grid">
        <section className="panel">
          <div className="panel-title">chomo says</div>
          <p className="now-line">{nowLine}</p>
          <div className="scroll-pane scroll-pane-sm">
            {!thoughts.length ? (
              <p className="empty">openclaw will write here</p>
            ) : (
              thoughts.map((ev: AgentEvent) => (
                <div className="event-row" key={ev.id}>
                  <div className={`event-kind ${ev.kind}`}>{ev.kind}</div>
                  <div>
                    <div>{ev.text}</div>
                    <div className="event-time">{timeAgo(ev.at)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div className="panel-title">holdings</div>
            <span className="muted">{wallet?.positions.length ?? 0}</span>
          </div>
          {!wallet?.positions.length ? (
            <p className="empty">cash sitting in sol</p>
          ) : (
            <div className="scroll-pane">
              {wallet.positions.map((p: Position) => (
                <div className="pos-row" key={p.mint}>
                  <TokenLogo src={p.logo} symbol={p.symbol} />
                  <div className="pos-main">
                    <strong>{p.symbol}</strong>
                    <span>
                      {formatAmount(p.amount)} · {formatTokenPrice(p.priceUsd)}
                    </span>
                  </div>
                  <div className="pos-val">
                    <strong>{p.usdValue > 0 ? formatUsd(p.usdValue) : '—'}</strong>
                    <a
                      href={`https://dexscreener.com/solana/${p.mint}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      chart ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <Fold title="recent trades" meta={`${recent.length}`} defaultOpen>
        <div className="fold-link">
          <Link to="/feed">full feed →</Link>
        </div>
        {!recent.length ? (
          <p className="empty">no txs yet</p>
        ) : (
          <div className="scroll-pane">
            <TradeFeed items={recent} compact />
          </div>
        )}
      </Fold>

      <Fold title="damage report" meta={wallet ? (vsBag >= 0 ? 'intact' : 'bleeding') : '—'}>
        <div className={`damage-big ${vsBag > 0 ? 'up' : vsBag < 0 ? 'down' : ''}`}>
          {wallet ? (vsBag >= 0 ? 'bag intact.' : 'bleeding.') : 'awaiting funds.'}
        </div>
        <p className="about-text">
          starting <strong>${config.startingBankroll}</strong>
          {wallet ? (
            <>
              . wallet balance <strong>{formatUsd(wallet.equityUsd)}</strong>. don’t lose it.
            </>
          ) : null}
        </p>
      </Fold>

      <Fold title="about chomo" defaultOpen={false}>
        <p className="about-text">
          <strong>chomo</strong> = chud + fomo. no strategy. no brain. ${config.startingBankroll} bag.
          forced to learn on fomo via openclaw — first real autonomous fomo bot. from chud the
          trader, improved, open source.
        </p>
        <div className="inline-actions">
          <CopyBtn value={config.tokenCa} label="copy ca" />
          {hasLink(config.xUrl) ? (
            <a className="btn" href={config.xUrl} target="_blank" rel="noreferrer">
              {displayX()}
            </a>
          ) : null}
        </div>
      </Fold>
    </>
  )
}

function FeedPage() {
  const { data, isLoading } = useChomoState()
  const wallet = data?.wallet?.address || config.walletAddress

  return (
    <>
      <div className="page-head">
        <h2 className="page-title">live trade feed</h2>
        <span className="muted">
          wallet: {displayWallet(wallet)} · {isLoading ? 'loading…' : `${data?.feed.length ?? 0}`}
        </span>
      </div>
      <section className="panel">
        <div className="scroll-pane scroll-pane-lg">
          <TradeFeed items={data?.feed ?? []} />
        </div>
      </section>
    </>
  )
}

function JournalPage() {
  const { data } = useChomoState()
  const thoughts = useMemo(
    () =>
      (data?.events ?? []).filter((e: AgentEvent) => e.kind === 'thought' || e.kind === 'journal'),
    [data?.events],
  )
  const actions = useMemo(
    () =>
      (data?.events ?? []).filter((e: AgentEvent) => e.kind !== 'thought' && e.kind !== 'journal'),
    [data?.events],
  )

  return (
    <div className="story-grid">
      <Fold title="journal" meta={`${thoughts.length}`} defaultOpen>
        <div className="scroll-pane scroll-pane-lg">
          {!thoughts.length ? (
            <p className="empty">no journal entries yet</p>
          ) : (
            thoughts.map((ev: AgentEvent) => (
              <div className="event-row" key={ev.id}>
                <div className={`event-kind ${ev.kind}`}>{ev.kind}</div>
                <div>
                  <div>{ev.text}</div>
                  <div className="event-time">{timeAgo(ev.at)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </Fold>
      <Fold title="action log" meta={`${actions.length}`} defaultOpen>
        <div className="scroll-pane scroll-pane-lg">
          {!actions.length ? (
            <p className="empty">quiet for now</p>
          ) : (
            actions.map((ev: AgentEvent) => (
              <div className="event-row" key={ev.id}>
                <div className={`event-kind ${ev.kind}`}>{ev.kind}</div>
                <div>
                  <div>{ev.text}</div>
                  <div className="event-time">{timeAgo(ev.at)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </Fold>
    </div>
  )
}

export function Terminal() {
  const location = useLocation()
  const { data } = useChomoState()
  const wallet = data?.wallet?.address || config.walletAddress
  const explorer = explorerWallet(wallet)
  const sol = data?.solPriceUsd

  return (
    <div className="app-wrap">
      <div className="bg-waves" aria-hidden="true" />
      <div className="app">
        <header className="site-bar">
          <div className="brand-row">
            <img
              src="/chomo-pfp.png"
              alt="chomo"
              width={52}
              height={52}
              decoding="async"
            />
            <div className="brand-copy">
              <h1>chomo</h1>
              <p>autonomous trading chud on fomo</p>
            </div>
          </div>
          <nav className="text-nav" aria-label="Primary">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`text-nav-link${location.pathname === item.to ? ' active' : ''}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <StatusPill status={data?.status} />
        </header>

        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/journal" element={<JournalPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        <footer className="footer">
          <div className="footer-links">
            <a href={config.githubUrl} target="_blank" rel="noreferrer">
              github
            </a>
            {hasLink(config.xUrl) ? (
              <a href={config.xUrl} target="_blank" rel="noreferrer">
                {displayX()}
              </a>
            ) : (
              <span>{displayX()}</span>
            )}
            <a href={config.fomoAppUrl} target="_blank" rel="noreferrer">
              fomo {displayFomo()}
            </a>
          </div>
          <div className="footer-links">
            {explorer ? (
              <a href={explorer} target="_blank" rel="noreferrer">
                wallet: {displayWallet(wallet)}
              </a>
            ) : (
              <span>wallet: {displayWallet(wallet)}</span>
            )}
            <CopyBtn value={config.tokenCa} label={`ca ${displayCa()}`} />
            {sol ? (
              <span className="sol-ticker">
                <img
                  src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png"
                  alt=""
                  referrerPolicy="no-referrer"
                  decoding="async"
                />
                ${sol.toFixed(2)}
              </span>
            ) : null}
          </div>
        </footer>
      </div>
    </div>
  )
}
