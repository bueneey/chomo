import { useMemo, useState, type ReactNode } from 'react'
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

const NAV = [
  { to: '/', label: 'live' },
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
  const wallet = data?.wallet
  const pnl = wallet?.totalPnlUsd ?? 0
  const recent = (data?.feed ?? []).slice(0, 8)
  const thoughts = (data?.events ?? [])
    .filter((e: AgentEvent) => e.kind === 'thought' || e.kind === 'journal' || e.kind === 'trade')
    .slice(0, 10)

  return (
    <>
      {error ? (
        <section className="panel error-panel">
          <div className="panel-title">tracker error</div>
          <p>{(error as Error).message}</p>
        </section>
      ) : null}

      <div className="kpi-strip">
        <div className="kpi">
          <span>equity</span>
          <strong>{wallet ? formatUsd(wallet.equityUsd) : isLoading ? '…' : '—'}</strong>
        </div>
        <div className="kpi">
          <span>sol</span>
          <strong>{wallet ? formatSol(wallet.balanceSol, 3) : isLoading ? '…' : '—'}</strong>
        </div>
        <div className="kpi">
          <span>pnl</span>
          <strong className={pnl > 0 ? 'up' : pnl < 0 ? 'down' : ''}>
            {wallet ? formatPnl(pnl) : isLoading ? '…' : '—'}
          </strong>
        </div>
        <div className="kpi">
          <span>bag</span>
          <strong>${config.startingBankroll}</strong>
        </div>
      </div>

      <div className="dense-grid">
        <div className="dense-col">
          <section className="panel panel-tight">
            <div className="panel-head">
              <div className="panel-title">pnl · all time</div>
              <span className="muted">hover for details</span>
            </div>
            <PnlChart points={data?.chart.points ?? []} />
          </section>

          <section className="panel panel-tight">
            <div className="panel-head">
              <div className="panel-title">book</div>
              <span className="muted">{displayWallet(wallet?.address)}</span>
            </div>
            <div className="book-mini">
              <div>
                <span>cash</span>
                <strong>{wallet ? formatUsd(wallet.balanceUsd) : '—'}</strong>
              </div>
              <div>
                <span>tokens</span>
                <strong>{wallet ? formatUsd(wallet.tokenValueUsd) : '—'}</strong>
              </div>
              <div>
                <span>equity</span>
                <strong>{wallet ? formatUsd(wallet.equityUsd) : '—'}</strong>
              </div>
              <div>
                <span>pnl</span>
                <strong className={pnl > 0 ? 'up' : pnl < 0 ? 'down' : ''}>
                  {wallet ? formatPnl(pnl) : '—'}
                </strong>
              </div>
            </div>
          </section>

          <Fold title="holdings" meta={`${wallet?.positions.length ?? 0}`} defaultOpen>
            {!wallet?.positions.length ? (
              <p className="empty">cash sitting in sol</p>
            ) : (
              <div className="scroll-pane">
                {wallet.positions.map((p: Position) => (
                  <div className="pos-row" key={p.mint}>
                    {p.logo ? (
                      <img className="token-logo" src={p.logo} alt="" />
                    ) : (
                      <div className="token-logo fallback">{p.symbol.slice(0, 2)}</div>
                    )}
                    <div className="pos-main">
                      <strong>{p.symbol}</strong>
                      <span>
                        {p.amount.toPrecision(4)} · {formatUsd(p.priceUsd, 6)}
                      </span>
                    </div>
                    <div className="pos-val">
                      <strong>{formatUsd(p.usdValue)}</strong>
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
          </Fold>
        </div>

        <div className="dense-col">
          <section className="panel panel-tight">
            <div className="panel-head">
              <div className="panel-title">now / tape</div>
              <span className="muted">{data ? timeAgo(data.updatedAt) : '…'}</span>
            </div>
            <p className="now-line">
              {thoughts[0]?.text ?? 'waking up… opening fomo… trying not to lose the hundred.'}
            </p>
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

          <Fold title="damage report" meta={wallet ? (pnl >= 0 ? 'intact' : 'bleeding') : '—'}>
            <div className={`damage-big ${pnl > 0 ? 'up' : pnl < 0 ? 'down' : ''}`}>
              {wallet ? (pnl >= 0 ? 'bag intact.' : 'bleeding.') : 'awaiting funds.'}
            </div>
            <p className="about-text">
              starting <strong>${config.startingBankroll}</strong>
              {wallet ? (
                <>
                  . equity <strong>{formatUsd(wallet.equityUsd)}</strong>. don’t lose it.
                </>
              ) : null}
            </p>
          </Fold>

          <Fold title="about chomo">
            <p className="about-text">
              <strong>chomo</strong> = chud + fomo. no strategy. no brain. ${config.startingBankroll}{' '}
              bag. forced to learn on fomo via openclaw — first real autonomous fomo bot (no public
              api). from chud the trader, improved, open source.
            </p>
            <div className="inline-actions">
              <CopyBtn value={wallet?.address || config.walletAddress} label="copy wallet" />
              <CopyBtn value={config.tokenCa} label="copy ca" />
              <a
                className="btn solid"
                href={config.fomoProfileUrl || config.fomoAppUrl}
                target="_blank"
                rel="noreferrer"
              >
                watch on fomo
              </a>
            </div>
          </Fold>
        </div>
      </div>
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
          {displayWallet(wallet)} · {isLoading ? 'loading…' : `${data?.feed.length ?? 0}`}
        </span>
      </div>
      <section className="panel panel-tight">
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
    () => (data?.events ?? []).filter((e: AgentEvent) => e.kind === 'thought' || e.kind === 'journal'),
    [data?.events],
  )
  const actions = useMemo(
    () => (data?.events ?? []).filter((e: AgentEvent) => e.kind !== 'thought' && e.kind !== 'journal'),
    [data?.events],
  )

  return (
    <div className="dense-grid">
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
        <div className="top-row">
          <div className="brand-row brand-row-compact">
            <img src="/chomo-pfp.png" alt="chomo" width={44} height={44} />
            <div className="brand-copy">
              <h1>chomo</h1>
              <p>autonomous fomo chud · don’t lose the $100</p>
            </div>
          </div>
          <div className="top-row-right">
            <nav className="top-nav" aria-label="Primary">
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`top-nav-btn${location.pathname === item.to ? ' active' : ''}`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <StatusPill status={data?.status} />
          </div>
        </div>

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
                wallet {displayWallet(wallet)}
              </a>
            ) : (
              <span>wallet {displayWallet(wallet)}</span>
            )}
            <CopyBtn value={config.tokenCa} label={`ca ${displayCa()}`} />
            {sol ? (
              <span className="sol-ticker">
                <img
                  src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png"
                  alt=""
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
