import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  config,
  displayCa,
  displayFomo,
  displayWallet,
  displayX,
  hasLink,
} from './config'

function useScrolled(threshold = 12) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold])

  return scrolled
}

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          el.classList.add('is-in')
          observer.unobserve(el)
        }
      },
      { threshold: 0.18, rootMargin: '0px 0px -8% 0px' },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return ref
}

function Reveal({
  children,
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'section' | 'article'
}) {
  const ref = useReveal<HTMLDivElement>()
  return (
    <Tag ref={ref as never} className={`reveal ${className}`.trim()}>
      {children}
    </Tag>
  )
}

function CopyValue({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const canCopy = Boolean(value) && value !== 'coming soon'

  async function copy() {
    if (!canCopy) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      type="button"
      className={`copy-btn${copied ? ' copied' : ''}`}
      onClick={copy}
      disabled={!canCopy}
      aria-label={`Copy ${label}`}
    >
      {copied ? 'copied' : canCopy ? 'copy' : 'soon'}
    </button>
  )
}

function ExternalLink({
  href,
  className,
  children,
}: {
  href?: string
  className?: string
  children: ReactNode
}) {
  if (!hasLink(href)) {
    return <span className={`${className ?? ''} is-disabled`.trim()}>{children}</span>
  }

  return (
    <a href={href} className={className} target="_blank" rel="noreferrer">
      {children}
    </a>
  )
}

export default function App() {
  const scrolled = useScrolled()
  const bankroll = `$${config.startingBankroll}`

  return (
    <div className="app">
      <div className="atmosphere" aria-hidden="true" />

      <header className={`nav${scrolled ? ' is-scrolled' : ''}`}>
        <div className="shell nav-inner">
          <a className="brand" href="#top">
            <img src="/chomo-pfp.png" alt="" width={32} height={32} />
            chomo
          </a>
          <nav className="nav-links" aria-label="Primary">
            <a className="nav-link" href="#real">
              why real
            </a>
            <a className="nav-link" href="#how">
              how
            </a>
            <a className="nav-link" href="#links">
              links
            </a>
            <ExternalLink href={config.githubUrl} className="nav-link primary">
              open source
            </ExternalLink>
          </nav>
        </div>
      </header>

      <main id="top">
        <section className="hero" aria-label="Hero">
          <div className="hero-media" aria-hidden="true">
            <img src="/chomo-pfp.png" alt="" />
          </div>
          <div className="hero-content">
            <div className="live-pill">
              <span className="live-dot" />
              live on fomo · openclaw
            </div>
            <h1 className="brand-mark">chomo</h1>
            <p className="hero-line">the autonomous trading chud.</p>
            <p className="hero-sub">
              no strategy. no brain. no logic. given {bankroll} with one job: don’t lose it.
            </p>
            <div className="cta-row">
              <ExternalLink
                href={config.fomoProfileUrl || config.fomoAppUrl}
                className="btn btn-solid"
              >
                watch on fomo
              </ExternalLink>
              <ExternalLink href={config.xUrl} className="btn btn-ghost">
                follow on x
              </ExternalLink>
            </div>
          </div>
        </section>

        <section className="section" id="mission" aria-labelledby="mission-title">
          <div className="shell">
            <Reveal className="section-head">
              <span className="section-kicker">the brief</span>
              <h2 className="section-title" id="mission-title">
                forced to learn. allowed to fail.
              </h2>
              <p className="section-copy">
                he isn’t taught how to trade. he has to figure it out himself — journaling every
                move live, posting whatever he feels like on x, and trying not to rug his own
                bankroll.
              </p>
            </Reveal>

            <Reveal>
              <div className="mission-grid">
                <article className="mission-item">
                  <h3>{bankroll}</h3>
                  <p>starting bankroll. the whole experiment.</p>
                </article>
                <article className="mission-item">
                  <h3>0 alpha</h3>
                  <p>no playbook. no signals. pure chud instinct.</p>
                </article>
                <article className="mission-item">
                  <h3>1 rule</h3>
                  <p>don’t lose the bag. everything else is noise.</p>
                </article>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="section" id="real" aria-labelledby="real-title">
          <div className="shell">
            <Reveal className="real">
              <div>
                <span className="section-kicker">the claim</span>
                <h2 className="section-title" id="real-title">
                  the first real autonomous fomo bot.
                </h2>
                <p className="section-copy" style={{ marginBottom: '1.75rem' }}>
                  every “autonomous fomo trading bot” before this was fake. fomo has no public api.
                  you can’t script it the normal way.
                </p>
                <div className="real-points">
                  <div className="real-point">
                    <strong>no public api</strong>
                    <p>
                      past bots were theater — dashboards pretending to trade while nothing
                      actually touched fomo.
                    </p>
                  </div>
                  <div className="real-point">
                    <strong>openclaw in the seat</strong>
                    <p>
                      chomo runs his own fomo account through openclaw. real clicks. real orders.
                      real skin.
                    </p>
                  </div>
                  <div className="real-point">
                    <strong>cabal hunting</strong>
                    <p>
                      he reads theses in the feed, stalks conviction, and tries to sneak into the
                      cabal before the crowd shows up.
                    </p>
                  </div>
                </div>
              </div>
              <aside className="quote-block">
                <p>
                  “chud + fomo = chomo. upgraded from chud the trader — now on steroids, on fomo,
                  and open source.”
                </p>
                <span>built from the old project. rewritten for real autonomy.</span>
              </aside>
            </Reveal>
          </div>
        </section>

        <section className="section" id="how" aria-labelledby="how-title">
          <div className="shell">
            <Reveal className="section-head">
              <span className="section-kicker">the loop</span>
              <h2 className="section-title" id="how-title">
                how the chud runs.
              </h2>
              <p className="section-copy">
                all automated by openclaw. he trades, journals, and posts — unsupervised.
              </p>
            </Reveal>

            <Reveal>
              <div className="how-list">
                <article className="how-row">
                  <div className="how-index">01</div>
                  <div>
                    <h3>trade on fomo</h3>
                    <p>
                      controls his own fomo account end-to-end. memecoins, viral tokens, whatever
                      the feed is screaming about.
                    </p>
                  </div>
                </article>
                <article className="how-row">
                  <div className="how-index">02</div>
                  <div>
                    <h3>journal live</h3>
                    <p>
                      every entry, exit, and excuse gets written down in public. no private alpha.
                      no hidden losses.
                    </p>
                  </div>
                </article>
                <article className="how-row">
                  <div className="how-index">03</div>
                  <div>
                    <h3>post on x</h3>
                    <p>
                      tweets whatever he feels — thesis takes, cope, victory laps, or silence when
                      he’s underwater.
                    </p>
                  </div>
                </article>
                <article className="how-row">
                  <div className="how-index">04</div>
                  <div>
                    <h3>read the room</h3>
                    <p>
                      analyzes other traders’ theses and tries to slip into the cabal before it
                      becomes consensus.
                    </p>
                  </div>
                </article>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="section" id="origin" aria-labelledby="origin-title">
          <div className="shell">
            <Reveal className="origin">
              <div>
                <span className="section-kicker">lineage</span>
                <h2 className="section-title" id="origin-title">
                  born from chud the trader.
                </h2>
                <p className="section-copy">
                  the code came from the old chud the trader project — cleaned up, hardened, and
                  pointed at fomo. same unhinged energy. realer execution. fully open source.
                </p>
              </div>
              <div>
                <div className="origin-stat">
                  <strong>open source</strong>
                  <span>fork it. roast it. improve it.</span>
                </div>
                <div className="origin-stat" style={{ marginTop: '1.5rem' }}>
                  <strong>openclaw</strong>
                  <span>agent hands on a real fomo account.</span>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="section" id="links" aria-labelledby="links-title">
          <div className="shell">
            <Reveal className="section-head">
              <span className="section-kicker">coordinates</span>
              <h2 className="section-title" id="links-title">
                follow the bag.
              </h2>
              <p className="section-copy">
                wallet, ca, fomo, and x — drop them in when they’re live.
              </p>
            </Reveal>

            <Reveal>
              <div className="meta-strip">
                <div className="meta-item">
                  <div>
                    <div className="meta-label">wallet</div>
                    <div className="meta-value">{displayWallet()}</div>
                  </div>
                  <CopyValue value={config.walletAddress} label="wallet" />
                </div>

                <div className="meta-item">
                  <div>
                    <div className="meta-label">ca</div>
                    <div className="meta-value">{displayCa()}</div>
                  </div>
                  <CopyValue value={config.tokenCa} label="contract address" />
                </div>

                {hasLink(config.fomoProfileUrl) ? (
                  <a
                    className="meta-item"
                    href={config.fomoProfileUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <div>
                      <div className="meta-label">fomo</div>
                      <div className="meta-value">{displayFomo()}</div>
                    </div>
                    <span className="copy-btn">open</span>
                  </a>
                ) : (
                  <div className="meta-item">
                    <div>
                      <div className="meta-label">fomo</div>
                      <div className="meta-value">{displayFomo()}</div>
                    </div>
                    <span className="copy-btn">soon</span>
                  </div>
                )}

                {hasLink(config.xUrl) ? (
                  <a className="meta-item" href={config.xUrl} target="_blank" rel="noreferrer">
                    <div>
                      <div className="meta-label">x</div>
                      <div className="meta-value">{displayX()}</div>
                    </div>
                    <span className="copy-btn">open</span>
                  </a>
                ) : (
                  <div className="meta-item">
                    <div>
                      <div className="meta-label">x</div>
                      <div className="meta-value">{displayX()}</div>
                    </div>
                    <span className="copy-btn">soon</span>
                  </div>
                )}
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="shell footer-inner">
          <div className="footer-brand">
            <img src="/chomo-pfp.png" alt="" width={28} height={28} />
            chomo the trader
          </div>
          <p className="footer-note">an autonomous trading chud. don’t lose the {bankroll}.</p>
          <div className="footer-links">
            <ExternalLink href={config.fomoAppUrl}>fomo</ExternalLink>
            <ExternalLink href={config.xUrl}>x</ExternalLink>
            <ExternalLink href={config.githubUrl}>github</ExternalLink>
          </div>
        </div>
      </footer>
    </div>
  )
}
