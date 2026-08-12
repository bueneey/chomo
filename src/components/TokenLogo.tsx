import { useState } from 'react'

export function TokenLogo({
  src,
  symbol,
  className = 'token-logo',
}: {
  src?: string
  symbol: string
  className?: string
}) {
  const [broken, setBroken] = useState(false)
  const label = (symbol || '?').slice(0, 2).toUpperCase()

  if (!src || broken) {
    return <div className={`${className} fallback`}>{label}</div>
  }

  return (
    <img
      className={className}
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  )
}
