import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { Expense, User, YearData } from '@shared/schema'
import {
  formatCurrency,
  maskCurrencyInput,
  parseCurrencyInput,
  cn,
  getMonthName
} from '../../lib/utils'
import { findDuplicateExpenses } from '../../lib/duplicates'
import { useEditExpense, useAddExpense, useAddCategory } from '../../hooks/useFinanceData'
import AddCategoryModal from './AddCategoryModal'
import RecurrenceModal from './RecurrenceModal'
import DuplicateExpenseModal from './DuplicateExpenseModal'
import RecurringEditScopeModal from './RecurringEditScopeModal'

interface Props {
  expense: Expense
  users: User[]
  categories: { id: string; name: string }[]
  year: string
  month: string
  yearData: YearData
  onClose: () => void
  onDelete: () => void
  isDeleting: boolean
}

export default function ExpenseDetailModal({
  expense,
  users,
  categories,
  year,
  month,
  yearData,
  onClose,
  onDelete,
  isDeleting
}: Props) {
  const [isEditing, setIsEditing] = useState(false)
  // Outros lançamentos do mês iguais ao que está sendo salvo
  const [pendingDuplicates, setPendingDuplicates] = useState<Expense[]>([])
  // Valor aguardando a resposta de "aplicar também nos meses futuros?"
  const [pendingScopeAmount, setPendingScopeAmount] = useState<number | null>(null)

  // Edit form state
  const [description, setDescription] = useState(expense.description)
  // format amount back to currency string for input mask (amount is in cents)
  const initialAmountRaw = (expense.amount / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
  const [amountRaw, setAmountRaw] = useState(initialAmountRaw)
  const [paidBy, setPaidBy] = useState(expense.paidBy)
  const [categoryId, setCategoryId] = useState(expense.categoryId ?? '')
  const [showAddCategory, setShowAddCategory] = useState(false)
  // Months (other than this one) that currently hold a copy of this recurring expense.
  // Derived live from the data (never from a stored snapshot) so deleted copies stop showing.
  const groupMonths = expense.recurrenceGroupId
    ? Object.entries(yearData)
        .filter(
          ([m, data]) =>
            m !== month &&
            data.expenses.some((e) => e.recurrenceGroupId === expense.recurrenceGroupId)
        )
        .map(([m]) => m)
    : []
  // Meses posteriores ao editado que já possuem uma cópia desta recorrência
  const futureGroupMonths = groupMonths.filter((m) => m > month)
  const [recurringMonths, setRecurringMonths] = useState<string[]>(groupMonths)
  const [showRecurrence, setShowRecurrence] = useState(false)

  const editExpense = useEditExpense()
  const addExpense = useAddExpense()
  const addCategory = useAddCategory()

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    if (val === 'new') {
      setShowAddCategory(true)
    } else {
      setCategoryId(val)
    }
  }

  const payer = users.find((u) => u.id === expense.paidBy)
  const date = new Date(expense.createdAt).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  const updatedDate = expense.updatedAt
    ? new Date(expense.updatedAt).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : null
  const updater = expense.updatedBy ? users.find((u) => u.id === expense.updatedBy) : null
  const category = categories.find((c) => c.id === expense.categoryId)
  const isDebtExpense = !!expense.debtToUserId
  const debtor = isDebtExpense ? users.find((u) => u.id === expense.debtToUserId) : null

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmountRaw(maskCurrencyInput(e.target.value))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!categoryId) return
    const amount = parseCurrencyInput(amountRaw)
    if (amount <= 0) return

    // Já existe outro lançamento igual neste mês? (ignora a própria despesa)
    const duplicates = findDuplicateExpenses(
      { categoryId, description, amount },
      yearData[month]?.expenses ?? [],
      expense.id
    )
    if (duplicates.length > 0) {
      setPendingDuplicates(duplicates)
      return
    }

    await requestSave(amount)
  }

  /**
   * Se a despesa for recorrente e existirem cópias em meses futuros, pergunta
   * antes se a edição deve valer também para esses meses.
   */
  const requestSave = async (amount: number): Promise<void> => {
    const changed =
      description.trim() !== expense.description.trim() ||
      amount !== expense.amount ||
      paidBy !== expense.paidBy ||
      categoryId !== (expense.categoryId ?? '')

    if (changed && futureGroupMonths.length > 0) {
      setPendingScopeAmount(amount)
      return
    }

    await performSave(amount, false)
  }

  const performSave = async (amount: number, applyToFuture: boolean): Promise<void> => {
    // Fallback to first user if we need an updatedBy ID
    const updaterId = users[0]?.id

    // Reuse the existing recurrence group, or start one if the user just enabled recurrence
    const groupId = expense.recurrenceGroupId ?? (recurringMonths.length > 0 ? uuidv4() : undefined)

    await editExpense.mutateAsync({
      year,
      month,
      expenseId: expense.id,
      userId: updaterId,
      updates: {
        description: description.trim(),
        amount,
        paidBy,
        categoryId: categoryId || undefined,
        recurrenceGroupId: groupId
      },
      applyToMonths: applyToFuture ? futureGroupMonths : undefined
    })

    // Replicate only into months that don't already hold a copy
    const newMonths = recurringMonths.filter((m) => !groupMonths.includes(m))
    if (newMonths.length > 0) {
      const [firstMonth, ...restMonths] = newMonths
      await addExpense.mutateAsync({
        year,
        month: firstMonth,
        recurringMonths: restMonths,
        expense: {
          description: description.trim(),
          amount,
          paidBy,
          categoryId,
          debtToUserId: expense.debtToUserId,
          recurrenceGroupId: groupId
        }
      })
    }

    setIsEditing(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm mx-4 card bg-popover dark:bg-popover p-6 space-y-5 animate-slide-in flex flex-col max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-foreground truncate">
              {isEditing ? 'Editar Despesa' : (category?.name ?? expense.name ?? 'Sem categoria')}
            </h2>
            {!isEditing && (
              <p className="text-xs text-muted-foreground mt-0.5">Criado em: {date}</p>
            )}
            {!isEditing && updatedDate && updater && (
              <p className="text-[10px] text-muted-foreground/80 mt-1 flex items-center gap-1">
                <span>✎</span> Editado por{' '}
                <strong style={{ color: updater.color }}>{updater.name}</strong> em {updatedDate}
              </p>
            )}
          </div>
          <button
            id="modal-close"
            onClick={onClose}
            className="btn-ghost text-muted-foreground hover:text-foreground p-1 flex-shrink-0 rounded-full"
          >
            ✕
          </button>
        </div>

        {isEditing ? (
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="label">Categoria</label>
              <select
                className="input-field cursor-pointer appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCAyNCAyNCIgc3Ryb2tlPSIjOThhM2EyIiBzdHJva2Utd2lkdGg9IjIiPjxwYXRoIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgZD0iTTE5IDlsLTcgNy03LTciLz48L3N2Zz4=')] bg-[length:16px_16px] bg-[position:right_12px_center] bg-no-repeat pr-10"
                value={categoryId}
                onChange={handleCategoryChange}
                disabled={editExpense.isPending || addCategory.isPending}
                required
              >
                <option value="">Nenhuma categoria</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                <option value="new" className="font-bold text-primary">
                  + Nova categoria...
                </option>
              </select>
            </div>

            <div>
              <label className="label">
                Descrição <span className="font-normal opacity-60">(opcional)</span>
              </label>
              <textarea
                className="input-field resize-none h-20"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={editExpense.isPending}
              />
            </div>

            <div>
              <label className="label">Valor</label>
              <div className="relative group">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-semibold group-focus-within:text-primary transition-colors">
                  R$
                </span>
                <input
                  className="input-field pl-10 font-medium text-lg tracking-wide"
                  type="text"
                  inputMode="numeric"
                  value={amountRaw}
                  onChange={handleAmountChange}
                  disabled={editExpense.isPending}
                  required
                />
              </div>

              {/* Recurrence */}
              <button
                type="button"
                onClick={() => setShowRecurrence(true)}
                disabled={editExpense.isPending || addExpense.isPending}
                className={cn(
                  'mt-2.5 flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors',
                  recurringMonths.length > 0
                    ? 'border-primary/40 bg-primary/10 text-foreground'
                    : 'border-white/5 bg-white/[0.02] text-muted-foreground hover:border-white/10 hover:text-foreground'
                )}
              >
                <svg
                  className="h-4 w-4 shrink-0"
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
                <span className="flex-1 text-left">Recorrente</span>
                {recurringMonths.length > 0 && (
                  <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-bold text-primary">
                    {recurringMonths.length} {recurringMonths.length === 1 ? 'mês' : 'meses'}
                  </span>
                )}
              </button>

              {recurringMonths.length > 0 && (
                <p className="mt-2 text-xs font-medium text-muted-foreground">
                  Também será lançada em:{' '}
                  <span className="text-foreground">
                    {[...recurringMonths]
                      .sort()
                      .map((m) => getMonthName(m))
                      .join(', ')}
                  </span>
                </p>
              )}
            </div>

            <div>
              <label className="label">Pago por</label>
              <select
                className="input-field cursor-pointer appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCAyNCAyNCIgc3Ryb2tlPSIjOThhM2EyIiBzdHJva2Utd2lkdGg9IjIiPjxwYXRoIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgZD0iTTE5IDlsLTcgNy03LTciLz48L3N2Zz4=')] bg-[length:16px_16px] bg-[position:right_12px_center] bg-no-repeat pr-10"
                value={paidBy}
                onChange={(e) => setPaidBy(e.target.value)}
                disabled={editExpense.isPending}
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => setIsEditing(false)}
                disabled={editExpense.isPending}
              >
                Cancelar
              </button>
              <button type="submit" className="btn-primary flex-1" disabled={editExpense.isPending}>
                {editExpense.isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        ) : (
          <>
            {/* Amount */}
            <div
              className={cn(
                'rounded-lg border px-4 py-3 text-center relative group',
                isDebtExpense
                  ? 'bg-amber-500/10 border-amber-500/20'
                  : 'bg-primary/10 border-primary/20'
              )}
            >
              {isDebtExpense && (
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400 mb-1">
                  ⚡ Valor Extra
                </p>
              )}
              <p className="text-xs text-muted-foreground mb-1">Valor pago</p>
              <p
                className={cn(
                  'text-2xl font-bold',
                  isDebtExpense ? 'text-amber-400' : 'text-primary'
                )}
              >
                {formatCurrency(expense.amount)}
              </p>
            </div>

            {isDebtExpense && debtor && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 text-center">
                <p className="text-xs text-amber-800 dark:text-amber-200/80">
                  Esta despesa será paga integralmente por{' '}
                  <strong style={{ color: debtor.color || 'var(--amber-400)' }}>
                    {debtor.name}
                  </strong>{' '}
                  para{' '}
                  <strong style={{ color: payer?.color || 'var(--amber-400)' }}>
                    {payer?.name}
                  </strong>
                  .
                </p>
              </div>
            )}

            {/* Details */}
            <div className="space-y-3 bg-black/5 dark:bg-black/20 rounded-xl p-4 border border-border">
              <DetailRow
                label="Pago por"
                value={payer ? <span style={{ color: payer.color }}>{payer.name}</span> : '—'}
              />
              {expense.description && <DetailRow label="Descrição" value={expense.description} />}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button className="btn-secondary flex-1" onClick={() => setIsEditing(true)}>
                Editar
              </button>
              <button
                id={`btn-delete-${expense.id}`}
                className="btn-destructive flex-1"
                onClick={onDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <span className="h-4 w-4 rounded-full border-2 border-destructive-foreground border-t-transparent animate-spin" />
                ) : (
                  'Apagar'
                )}
              </button>
            </div>
          </>
        )}
      </div>

      {pendingDuplicates.length > 0 && (
        <DuplicateExpenseModal
          count={pendingDuplicates.length}
          categoryName={categories.find((c) => c.id === categoryId)?.name ?? ''}
          description={description.trim()}
          amount={parseCurrencyInput(amountRaw)}
          month={month}
          year={year}
          isEdit
          onCancel={() => setPendingDuplicates([])}
          onConfirm={async () => {
            setPendingDuplicates([])

            await requestSave(parseCurrencyInput(amountRaw))
          }}
        />
      )}

      {pendingScopeAmount !== null && (
        <RecurringEditScopeModal
          month={month}
          year={year}
          futureMonths={futureGroupMonths}
          onCancel={() => setPendingScopeAmount(null)}
          onOnlyThis={async () => {
            const amount = pendingScopeAmount
            setPendingScopeAmount(null)
            await performSave(amount, false)
          }}
          onAllFuture={async () => {
            const amount = pendingScopeAmount
            setPendingScopeAmount(null)
            await performSave(amount, true)
          }}
        />
      )}

      {showAddCategory && (
        <AddCategoryModal
          onClose={() => setShowAddCategory(false)}
          onSuccess={(id) => setCategoryId(id)}
        />
      )}

      {showRecurrence && (
        <RecurrenceModal
          year={year}
          currentMonth={month}
          selected={recurringMonths}
          onClose={() => setShowRecurrence(false)}
          onConfirm={(months) => setRecurringMonths(months)}
        />
      )}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}
