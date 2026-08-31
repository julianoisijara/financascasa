import { formatCurrency, getMonthName } from '../../lib/utils'

interface Props {
  count: number
  categoryName: string
  description: string
  amount: number
  month: string
  year: string
  isEdit?: boolean
  onCancel: () => void
  onConfirm: () => void
}

/**
 * Alerta exibido quando já existe um lançamento igual no mês de destino
 * (mesma categoria, mesma descrição e mesmo valor). Não bloqueia: pergunta.
 */
export default function DuplicateExpenseModal({
  count,
  categoryName,
  description,
  amount,
  month,
  year,
  isEdit = false,
  onCancel,
  onConfirm
}: Props): React.JSX.Element {
  const label = description ? `${categoryName} — ${description}` : categoryName

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
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-lg">
            ⚠️
          </span>
          <div>
            <h2 className="text-base font-bold text-foreground">Lançamento duplicado</h2>
            <p className="text-xs font-medium text-muted-foreground mt-1">
              {count === 1
                ? 'Já existe um lançamento igual a este'
                : `Já existem ${count} lançamentos iguais a este`}{' '}
              em {getMonthName(month)}/{year}.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <p className="text-sm font-semibold text-foreground break-words">{label}</p>
          <p className="text-sm font-bold text-foreground mt-0.5">{formatCurrency(amount)}</p>
        </div>

        <p className="text-sm font-medium text-foreground">
          {isEdit ? 'Deseja salvar mesmo assim?' : 'Deseja realizar o lançamento mesmo assim?'}
        </p>

        <div className="flex gap-2 pt-1">
          <button type="button" className="btn-secondary flex-1" onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className="btn-primary flex-1" onClick={onConfirm}>
            {isEdit ? 'Salvar mesmo assim' : 'Lançar mesmo assim'}
          </button>
        </div>
      </div>
    </div>
  )
}
