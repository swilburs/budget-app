import { useState } from 'react'
import { parseMoney } from '../lib/money'

/** Dollar input that shows a plain number while editing and commits cents on blur or Enter. */
export function MoneyInput({
  cents,
  onChange,
  label,
  className = '',
}: {
  cents: number
  onChange: (cents: number) => void
  label: string
  className?: string
}) {
  const shown = (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)
  // Draft text only exists while editing; otherwise the input shows the stored value.
  const [draft, setDraft] = useState<string | null>(null)
  const text = draft ?? shown
  const commit = () => {
    const v = parseMoney(text)
    if (v !== null && v !== cents) onChange(v)
    setDraft(null)
  }
  return (
    <input
      className={`money-input ${className}`}
      inputMode="decimal"
      aria-label={label}
      value={text}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
    />
  )
}

/** Percent input (stores a fraction, shows 0-100). */
export function PctInput({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const shown = String(Math.round(value * 10000) / 100)
  const [draft, setDraft] = useState<string | null>(null)
  const text = draft ?? shown
  return (
    <input
      className="pct-input"
      inputMode="decimal"
      aria-label={label}
      value={text}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const n = Number(text.replace('%', ''))
        if (Number.isFinite(n) && text.trim() !== '' && n / 100 !== value) onChange(n / 100)
        setDraft(null)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
    />
  )
}
