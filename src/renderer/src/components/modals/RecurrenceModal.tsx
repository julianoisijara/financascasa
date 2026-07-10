import { useState } from 'react'
import { MONTH_NAMES, getMonthName, cn } from '../../lib/utils'

interface Props {
  year: string
  currentMonth: string
  selected: string[]
  onClose: () => void
  onConfirm: (months: string[]) => void
}

export default function RecurrenceModal({
  year,
  currentMonth,
  selected,
  onClose,
  onConfirm
}: Props) {
  const [picked, setPicked] = useState<string[]>(selected)

  const months = MONTH_NAMES.map((_, i) => String(i + 1).padStart(2, '0'))

  const toggle = (month: string) => {
    setPicked((prev) => (prev.includes(month) ? prev.filter((m) => m !== month) : [...prev, month]))
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm mx-4 card p-6 space-y-5 animate-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-foreground">Repetir despesa</h2>
            <p className="text-xs font-medium text-muted-foreground mt-1">
              Selecione os meses de {year} em que essa cobrança deve se repetir
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {months.map((month) => {
            const isCurrent = month === currentMonth
            const isPicked = picked.includes(month)
            return (
              <button
                key={month}
                type="button"
                disabled={isCurrent}
                onClick={() => toggle(month)}
                className={cn(
                  'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors text-left',
                  isCurrent
                    ? 'border-white/5 bg-white/[0.02] text-muted-foreground cursor-not-allowed'
                    : isPicked
                      ? 'border-primary/40 bg-primary/10 text-foreground'
                      : 'border-white/5 bg-white/[0.02] text-muted-foreground hover:border-white/10 hover:text-foreground'
                )}
              >
                <span
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                    isCurrent
                      ? 'border-white/10'
                      : isPicked
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-white/20'
                  )}
                >
                  {isPicked && !isCurrent && (
                    <svg
                      className="h-3 w-3"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                <span className="truncate">
                  {getMonthName(month)}
                  {isCurrent && <span className="opacity-60"> (atual)</span>}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex gap-2 pt-1">
          <button type="button" className="btn-secondary flex-1" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary flex-1"
            onClick={() => {
              onConfirm(picked.filter((m) => m !== currentMonth))
              onClose()
            }}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}
