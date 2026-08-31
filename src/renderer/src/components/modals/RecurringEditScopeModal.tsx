import { getMonthName } from '../../lib/utils'

interface Props {
  /** Mês que está sendo editado (formato "01".."12") */
  month: string
  year: string
  /** Meses futuros do mesmo ano que também possuem uma cópia dessa recorrência */
  futureMonths: string[]
  onCancel: () => void
  /** Salvar somente o mês atual */
  onOnlyThis: () => void
  /** Salvar o mês atual e replicar nos meses futuros */
  onAllFuture: () => void
}

/**
 * Alerta exibido ao salvar a edição de uma despesa recorrente: pergunta se as
 * alterações devem valer só para o mês editado ou também para os meses futuros
 * da mesma recorrência.
 */
export default function RecurringEditScopeModal({
  month,
  year,
  futureMonths,
  onCancel,
  onOnlyThis,
  onAllFuture
}: Props): React.JSX.Element {
  const sorted = [...futureMonths].sort()

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm mx-4 card bg-popover dark:bg-popover p-6 space-y-5 animate-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h5M20 20v-5h-5M4 9a8 8 0 0113.5-3.5L20 8M20 15a8 8 0 01-13.5 3.5L4 16"
              />
            </svg>
          </span>
          <div>
            <h2 className="text-base font-bold text-foreground">Despesa recorrente</h2>
            <p className="text-xs font-medium text-muted-foreground mt-1">
              Esta despesa também está lançada em outros meses de {year}. Deseja aplicar as
              alterações aos meses futuros?
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Meses futuros
          </p>
          <p className="text-sm font-semibold text-foreground mt-1 break-words">
            {sorted.map((m) => getMonthName(m)).join(', ')}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Escolhendo “Só este mês”, apenas {getMonthName(month)} será alterado.
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <button type="button" className="btn-primary w-full" onClick={onAllFuture}>
            Atualizar meses futuros
          </button>
          <button type="button" className="btn-secondary w-full" onClick={onOnlyThis}>
            Só este mês
          </button>
          <button
            type="button"
            className="btn-ghost w-full text-sm font-medium text-muted-foreground hover:text-foreground"
            onClick={onCancel}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
