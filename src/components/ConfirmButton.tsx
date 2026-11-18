import { useEffect, useState, type ReactNode } from 'react'

/** A button that asks "Are you sure?" in place before running a destructive action. */
export function ConfirmButton({
  children,
  confirmLabel,
  onConfirm,
  className = '',
  skip = false,
}: {
  children: ReactNode
  confirmLabel: string
  onConfirm: () => void
  className?: string
  /** Run immediately without asking (e.g. nothing would be lost). */
  skip?: boolean
}) {
  const [asking, setAsking] = useState(false)
  useEffect(() => {
    if (!asking) return
    const t = setTimeout(() => setAsking(false), 5000)
    return () => clearTimeout(t)
  }, [asking])
  if (asking)
    return (
      <span className="confirm">
        <button className={`danger ${className}`} onClick={() => { setAsking(false); onConfirm() }}>
          {confirmLabel}
        </button>
        <button className="link" onClick={() => setAsking(false)}>
          Cancel
        </button>
      </span>
    )
  return (
    <button className={className} onClick={() => (skip ? onConfirm() : setAsking(true))}>
      {children}
    </button>
  )
}
