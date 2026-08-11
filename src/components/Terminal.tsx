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
        live on fomo
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

function HomePage() {
  const { data, isLoading, error } = useChomoState()
  const wallet = data?.wallet
  const pnl = wallet?.totalPnlUsd ?? 0
  const recent = (data?.feed ?? []).slice(0, 6)
  const thoughts = (data?.events ?? [])
    .filter((e: AgentEvent) => e.kind === 'thought' || e.kind === 'journal' || e.kind === 'trade')
    .slice(0, 8)

  return (
    <>
      <span className="section-kicker">the legend</span>
      <h2 className="section-label">about chomo.</h2>
      <p className="section-support">chud + fomo. an autonomous trader with one job.</p>
      <section className="panel">
        <p className="about-text">
          <strong>chomo</strong> is just a chud — no strategy, no brain, no logic. given{' '}
          <strong>${config.startingBankroll}</strong> with the only goal of not losing it.
        </p>
        <p className="about-text">
          he isn’t taught how to trade. he’s forced to learn it himself, journals live, and posts
          whatever he feels on x. all automated by openclaw on his own fomo account.
        </p>
        <p className="about-text">
          every past “autonomous fomo bot” was fake — fomo has no public api. this is the first
          real one. code from chud the trader, improved, open source.
        </p>
        <div className="inline-actions">
          <CopyBtn value={wallet?.address || config.walletAddress} label="copy wallet" />
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
          ) : (
            <a className="btn solid" href={config.fomoAppUrl} target="_blank" rel="noreferrer">
              open fomo
            </a>
          )}
          {hasLink(config.xUrl) ? (
            <a className="btn" href={config.xUrl} target="_blank" rel="noreferrer">
              follow on x
            </a>
          ) : null}
        </div>
      </section>

      <span className="section-kicker">the bag</span>
      <h2 className="section-label">bot wallet.</h2>
      <p className="section-support">live marks from helius. same wallet everyone watches.</p>
      {error ? (
        <section className="panel error-panel">
          <div className="panel-title">tracker error</div>
          <p>{(error as Error).message}</p>
        </section>
      ) : null}
      <div className="stats-row">
        <article className="stat-box">
          <div className="panel-title">balance</div>
          <div className="stat-value">
            {wallet ? `${wallet.balanceSol.toFixed(4)} SOL` : isLoading ? '…' : '—'}
          </div>
          <div className="stat-sub">
            {wallet
              ? `${formatUsd(wallet.balanceUsd)} cash · ${formatUsd(wallet.equityUsd)} equity`
              : `bankroll ${formatUsd(config.startingBankroll)}`}
          </div>
        </article>
        <article className="stat-box">
          <div className="panel-title">total pnl</div>
          <div className={`stat-value ${pnl > 0 ? 'up' : pnl < 0 ? 'down' : ''}`}>
            {wallet ? formatPnl(pnl) : isLoading ? '…' : '—'}
          </div>
          <div className="stat-sub">
            {wallet ? `${formatSol(wallet.totalPnlSol)} vs starting bag` : 'waiting for marks'}
          </div>
        </article>
      </div>

      <span className="section-kicker">portfolio</span>
      <h2 className="section-label">holdings.</h2>
      <section className="panel">
        <div className="panel-head">
          <div className="panel-title">open positions</div>
          <span className="muted">{wallet?.positions.length ?? 0}</span>
        </div>
        {!wallet?.positions.length ? (
          <p className="empty">cash sitting in sol until a trigger fills</p>
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
                <span>
                  {p.amount.toPrecision(4)} · {formatUsd(p.priceUsd, 6)}
                </span>
              </div>
              <div className="pos-val">
                <strong>{formatUsd(p.usdValue)}</strong>
                <a href={`https://dexscreener.com/solana/${p.mint}`} target="_blank" rel="noreferrer">
                  chart ↗
                </a>
              </div>
            </div>
          ))
        )}
      </section>

      <span className="section-kicker">social tape</span>
      <h2 className="section-label">the tape.</h2>
      <p className="section-support">what he’s thinking and trading — live.</p>
      <section className="panel">
        <div className="panel-title">thoughts / trades</div>
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
      </section>

      <span className="section-kicker">performance</span>
      <h2 className="section-label">pnl.</h2>
      <section className="panel">
        <div className="panel-head">
          <div className="panel-title">all time</div>
          <span className="muted">helius</span>
        </div>
        <PnlChart points={data?.chart.points ?? []} />
      </section>

      <span className="section-kicker">status</span>
      <h2 className="section-label">damage report.</h2>
      <section className="panel">
        <div className="panel-title">mission</div>
        <div className={`damage-big ${pnl > 0 ? 'up' : pnl < 0 ? 'down' : ''}`}>
          {wallet ? (pnl >= 0 ? 'bag intact.' : 'bleeding.') : 'awaiting funds.'}
        </div>
        <p className="about-text">
          starting bankroll <strong>${config.startingBankroll}</strong>
          {wallet ? (
            <>
              . equity <strong>{formatUsd(wallet.equityUsd)}</strong>. only goal: don’t lose it.
            </>
          ) : (
            <> — waiting for live marks.</>
          )}
        </p>
      </section>

      <span className="section-kicker">activity</span>
      <h2 className="section-label">recent trades.</h2>
      <section className="panel">
        <div className="panel-head">
          <div className="panel-title">latest on-chain</div>
          <Link to="/feed">full feed →</Link>
        </div>
        {!recent.length ? <p className="empty">no txs yet</p> : <TradeFeed items={recent} compact />}
      </section>
    </>
  )
}

function FeedPage() {
  const { data, isLoading } = useChomoState()
  const wallet = data?.wallet?.address || config.walletAddress

  return (
    <>
      <span className="section-kicker">never miss out</span>
      <h2 className="section-label">live trade feed.</h2>
      <p className="section-support">every fill, send, and receive — pulled from chain.</p>
      <section className="panel">
        <div className="panel-head">
          <div className="panel-title">on-chain activity</div>
          <span className="muted">
            {displayWallet(wallet)} · {isLoading ? 'loading…' : `${data?.feed.length ?? 0}`}
          </span>
        </div>
        <TradeFeed items={data?.feed ?? []} />
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
    <>
      <span className="section-kicker">from the chud</span>
      <h2 className="section-label">journal.</h2>
      <p className="section-support">whatever he feels. no private alpha.</p>
      <section className="panel">
        <div className="panel-title">entries</div>
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
      </section>

      <h2 className="section-label">action log.</h2>
      <section className="panel">
        <div className="panel-title">did / trade / refused</div>
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
      </section>
    </>
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

        <header className="site-header">
          <div className="brand-row">
            <img src="/chomo-pfp.png" alt="chomo" width={72} height={72} />
            <div className="brand-copy">
              <h1>chomo</h1>
              <p>the autonomous trading chud. on fomo. don’t lose the hundred.</p>
            </div>
          </div>
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
