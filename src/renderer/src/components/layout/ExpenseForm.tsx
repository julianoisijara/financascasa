import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { AppData, Expense } from '@shared/schema'
import { maskCurrencyInput, parseCurrencyInput, cn, getMonthName } from '../../lib/utils'
import { findDuplicateExpenses } from '../../lib/duplicates'
import { useAddExpense, useAddCategory } from '../../hooks/useFinanceData'
import { useResizableColumn } from '../../hooks/useResizableColumn'
import AddCategoryModal from '../modals/AddCategoryModal'
import RecurrenceModal from '../modals/RecurrenceModal'
import DuplicateExpenseModal from '../modals/DuplicateExpenseModal'

interface Props {
  appData: AppData
  year: string
  month: string
}

const COLLAPSED_KEY = 'expense-form-collapsed'
const WIDTH_KEY = 'expense-form-width'
const DEFAULT_WIDTH = 320
const MIN_WIDTH = 280
const MAX_WIDTH = 560
const COLLAPSED_WIDTH = 48

export default function ExpenseForm({ appData, year, month }: Props) {
  const addExpense = useAddExpense()
  const addCategory = useAddCategory()
  const [description, setDescription] = useState('')
  const [amountRaw, setAmountRaw] = useState('')
  const [paidBy, setPaidBy] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [isDebt, setIsDebt] = useState(false)
  const [debtToUserId, setDebtToUserId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [touched, setTouched] = useState(false)
  const [recurringMonths, setRecurringMonths] = useState<string[]>([])
  const [showRecurrence, setShowRecurrence] = useState(false)
  // Lançamentos já existentes no mês de destino iguais ao que está sendo lançado
  const [pendingDuplicates, setPendingDuplicates] = useState<Expense[]>([])
  // Target month/year the expense will be launched into (defaults to the app's current selection)
  const [targetYear, setTargetYear] = useState(year)
  const [targetMonth, setTargetMonth] = useState(month)
  // Coluna recolhida para a direita (persistida entre sessões)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === '1')

  const { width, isResizing, startResize, resetWidth } = useResizableColumn({
    storageKey: WIDTH_KEY,
    defaultWidth: DEFAULT_WIDTH,
    minWidth: MIN_WIDTH,
    maxWidth: MAX_WIDTH,
    edge: 'right'
  })

  const toggleCollapsed = (): void => {
    setCollapsed((prev) => {
      localStorage.setItem(COLLAPSED_KEY, prev ? '0' : '1')
      return !prev
    })
  }

  // Follow the app's month/year when the user navigates it in the sidebar (reset during render)
  const [selectionKey, setSelectionKey] = useState(`${year}-${month}`)
  if (selectionKey !== `${year}-${month}`) {
    setSelectionKey(`${year}-${month}`)
    setTargetYear(year)
    setTargetMonth(month)
    setRecurringMonths([])
  }

  const availableYears = Object.keys(appData.years).sort()
  const monthOptions = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))

  const categories = [...(appData.categories ?? [])].sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR')
  )

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    if (val === 'new') {
      setShowAddCategory(true)
    } else {
      setCategoryId(val)
      setError('')
    }
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskCurrencyInput(e.target.value)
    setAmountRaw(masked)
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    setError('')
    setSuccess(false)
    if (!categoryId) return setError('Selecione uma categoria.')
    const amount = parseCurrencyInput(amountRaw)
    if (amount <= 0) return setError('Insira um valor válido.')
    if (!paidBy) return setError('Selecione o responsável pelo pagamento.')
    if (isDebt && !debtToUserId) return setError('Selecione quem deve pagar essa despesa.')
    if (isDebt && debtToUserId === paidBy)
      return setError('O devedor não pode ser a mesma pessoa que pagou.')

    // Já existe lançamento igual (mesma categoria, descrição e valor) neste mês?
    const duplicates = findDuplicateExpenses(
      { categoryId, description, amount },
      appData.years[targetYear]?.[targetMonth]?.expenses ?? []
    )
    if (duplicates.length > 0) {
      setPendingDuplicates(duplicates)
      return
    }

    await submitExpense(amount)
  }

  const submitExpense = async (amount: number): Promise<void> => {
    await addExpense.mutateAsync({
      year: targetYear,
      month: targetMonth,
      recurringMonths,
      expense: {
        description: description.trim(),
        amount,
        paidBy,
        categoryId,
        debtToUserId: isDebt ? debtToUserId : undefined,
        recurrenceGroupId: recurringMonths.length > 0 ? uuidv4() : undefined
      }
    })

    // Reset
    setDescription('')
    setAmountRaw('')
    setCategoryId('')
    setPaidBy('')
    setIsDebt(false)
    setDebtToUserId('')
    setRecurringMonths([])
    setTouched(false)
    setSuccess(true)
    setTimeout(() => setSuccess(false), 2500)
  }

  const handleClear = () => {
    setDescription('')
    setAmountRaw('')
    setCategoryId('')
    setPaidBy('')
    setIsDebt(false)
    setDebtToUserId('')
    setRecurringMonths([])
    setError('')
    setTouched(false)
  }

  return (
    <aside
      className={cn(
        'flex flex-shrink-0 flex-col bg-background/60 backdrop-blur-2xl border-l border-white/5 relative z-10 shadow-[-20px_0_40px_rgba(0,0,0,0.3)] overflow-hidden',
        !isResizing && 'transition-[width] duration-300 ease-out'
      )}
      style={{ width: collapsed ? COLLAPSED_WIDTH : width }}
    >
      {/* Faixa vertical exibida quando a coluna está recolhida */}
      {collapsed && (
        <button
          type="button"
          onClick={toggleCollapsed}
          title="Expandir lançamento de despesa"
          aria-label="Expandir lançamento de despesa"
          className="group absolute inset-0 flex w-12 flex-col items-center gap-4 pt-6 cursor-pointer hover:bg-white/[0.03] transition-colors no-drag-region"
        >
          <svg
            className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary transition-colors"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors [writing-mode:vertical-rl]">
            Lançar Despesa
          </span>
        </button>
      )}

      {/* Conteúdo com largura fixa para não reposicionar durante a animação */}
      <div
        className={cn('flex min-h-0 flex-1 flex-col', collapsed && 'invisible pointer-events-none')}
        style={{ width }}
      >
        {/* Header */}
        <div className="px-6 py-6 border-b border-white/5 relative overflow-hidden drag-region">
          <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent opacity-30 pointer-events-none" />
          <div className="relative z-10 flex items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-foreground tracking-tight">Lançar Despesa</h2>
              <p className="text-xs font-medium text-muted-foreground mt-1">
                Adicione uma nova despesa ao mês
              </p>
            </div>
            <button
              type="button"
              onClick={toggleCollapsed}
              title="Recolher para a direita"
              aria-label="Recolher para a direita"
              className="h-8 w-8 shrink-0 -mr-2 rounded-full flex items-center justify-center text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground transition-colors cursor-pointer no-drag-region"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          {/* Target month / year */}
          <div>
            <label className="label">Mês / Ano</label>
            <div className="grid grid-cols-2 gap-2">
              <select
                id="expense-month"
                className="input-field cursor-pointer appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCAyNCAyNCIgc3Ryb2tlPSIjOThhM2EyIiBzdHJva2Utd2lkdGg9IjIiPjxwYXRoIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgZD0iTTE5IDlsLTcgNy03LTciLz48L3N2Zz4=')] bg-[length:16px_16px] bg-[position:right_12px_center] bg-no-repeat pr-10"
                value={targetMonth}
                onChange={(e) => {
                  setTargetMonth(e.target.value)
                  setRecurringMonths([])
                }}
                disabled={addExpense.isPending}
              >
                {monthOptions.map((m) => (
                  <option key={m} value={m}>
                    {getMonthName(m)}
                  </option>
                ))}
              </select>
              <select
                id="expense-year"
                className="input-field cursor-pointer appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCAyNCAyNCIgc3Ryb2tlPSIjOThhM2EyIiBzdHJva2Utd2lkdGg9IjIiPjxwYXRoIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgZD0iTTE5IDlsLTcgNy03LTciLz48L3N2Zz4=')] bg-[length:16px_16px] bg-[position:right_12px_center] bg-no-repeat pr-10"
                value={targetYear}
                onChange={(e) => {
                  setTargetYear(e.target.value)
                  setRecurringMonths([])
                }}
                disabled={addExpense.isPending}
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="label" htmlFor="expense-category">
              Categoria
            </label>
            <select
              id="expense-category"
              className={cn(
                "input-field cursor-pointer appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCAyNCAyNCIgc3Ryb2tlPSIjOThhM2EyIiBzdHJva2Utd2lkdGg9IjIiPjxwYXRoIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgZD0iTTE5IDlsLTcgNy03LTciLz48L3N2Zz4=')] bg-[length:16px_16px] bg-[position:right_12px_center] bg-no-repeat pr-10",
                touched && !categoryId && 'border-destructive ring-1 ring-destructive/50'
              )}
              value={categoryId}
              onChange={handleCategoryChange}
              disabled={addExpense.isPending || addCategory.isPending}
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

          {/* Description */}
          <div>
            <label className="label" htmlFor="expense-desc">
              Descrição <span className="font-normal opacity-60">(opcional)</span>
            </label>
            <textarea
              id="expense-desc"
              className="input-field resize-none h-20"
              placeholder="Detalhes adicionais..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={addExpense.isPending}
            />
          </div>

          {/* Amount */}
          <div>
            <label className="label" htmlFor="expense-amount">
              Valor
            </label>
            <div className="relative group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-semibold group-focus-within:text-primary transition-colors">
                R$
              </span>
              <input
                id="expense-amount"
                className={cn(
                  'input-field pl-10 font-medium text-lg tracking-wide',
                  touched &&
                    (!amountRaw || parseCurrencyInput(amountRaw) <= 0) &&
                    'border-destructive ring-1 ring-destructive/50'
                )}
                type="text"
                inputMode="numeric"
                placeholder="0,00"
                value={amountRaw}
                onChange={handleAmountChange}
                disabled={addExpense.isPending}
              />
            </div>

            {/* Recurrence */}
            <button
              type="button"
              onClick={() => setShowRecurrence(true)}
              disabled={addExpense.isPending}
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

          {/* Paid by */}
          <div>
            <label className="label" htmlFor="expense-paidby">
              Pago por
            </label>
            <select
              id="expense-paidby"
              className={cn(
                "input-field cursor-pointer appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCAyNCAyNCIgc3Ryb2tlPSIjOThhM2EyIiBzdHJva2Utd2lkdGg9IjIiPjxwYXRoIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgZD0iTTE5IDlsLTcgNy03LTciLz48L3N2Zz4=')] bg-[length:16px_16px] bg-[position:right_12px_center] bg-no-repeat pr-10",
                touched && !paidBy && 'border-destructive ring-1 ring-destructive/50'
              )}
              value={paidBy}
              onChange={(e) => {
                setPaidBy(e.target.value)
                setError('')
              }}
              disabled={addExpense.isPending}
            >
              <option value="">Selecione quem pagou...</option>
              {appData.users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>

          {/* Debt toggle */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isDebt}
                onChange={(e) => {
                  setIsDebt(e.target.checked)
                  if (!e.target.checked) setDebtToUserId('')
                }}
                disabled={addExpense.isPending}
                className="h-4 w-4 rounded border-amber-500/40 text-amber-500 focus:ring-amber-500/50 cursor-pointer accent-amber-500"
              />
              <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                Despesa a ser paga por
              </span>
            </label>
            {isDebt && (
              <select
                id="expense-debtto"
                className="input-field cursor-pointer appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCAyNCAyNCIgc3Ryb2tlPSIjOThhM2EyIiBzdHJva2Utd2lkdGg9IjIiPjxwYXRoIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgZD0iTTE5IDlsLTcgNy03LTciLz48L3N2Zz4=')] bg-[length:16px_16px] bg-[position:right_12px_center] bg-no-repeat pr-10 border-amber-500/30"
                value={debtToUserId}
                onChange={(e) => setDebtToUserId(e.target.value)}
                disabled={addExpense.isPending}
              >
                <option value="">Selecione o devedor...</option>
                {appData.users
                  .filter((u) => u.id !== paidBy)
                  .map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
              </select>
            )}
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          {/* Success */}
          {success && (
            <p className="text-xs text-emerald-400 bg-emerald-400/10 rounded-md px-3 py-2 animate-fade-in">
              ✅ Despesa lançada com sucesso!
            </p>
          )}

          <button
            id="btn-add-expense"
            type="submit"
            className="btn-primary w-full"
            disabled={addExpense.isPending}
          >
            {addExpense.isPending ? (
              <>
                <span className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                A guardar...
              </>
            ) : (
              '+ Lançar Despesa'
            )}
          </button>

          <button
            type="button"
            onClick={handleClear}
            className="btn-secondary w-full"
            disabled={addExpense.isPending}
          >
            Limpar
          </button>
        </form>

        {/* Sync status */}
        <div className="px-6 py-4 border-t border-white/5 bg-white/[0.01]">
          <div className="flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
            <span>Salvo localmente com segurança</span>
          </div>
        </div>
      </div>

      {/* Alça de redimensionamento (duplo clique volta à largura padrão) */}
      {!collapsed && (
        <div
          onPointerDown={startResize}
          onDoubleClick={resetWidth}
          role="separator"
          aria-orientation="vertical"
          aria-label="Redimensionar coluna de lançamento"
          title="Arraste para redimensionar (duplo clique restaura)"
          className={cn(
            'absolute inset-y-0 left-0 z-20 w-1.5 cursor-col-resize no-drag-region',
            'after:absolute after:inset-y-0 after:left-0 after:w-0.5 after:bg-primary/60 after:opacity-0 after:transition-opacity hover:after:opacity-100',
            isResizing && 'after:opacity-100'
          )}
        />
      )}

      {showAddCategory && (
        <AddCategoryModal
          onClose={() => setShowAddCategory(false)}
          onSuccess={(id) => setCategoryId(id)}
        />
      )}

      {pendingDuplicates.length > 0 && (
        <DuplicateExpenseModal
          count={pendingDuplicates.length}
          categoryName={categories.find((c) => c.id === categoryId)?.name ?? ''}
          description={description.trim()}
          amount={parseCurrencyInput(amountRaw)}
          month={targetMonth}
          year={targetYear}
          onCancel={() => setPendingDuplicates([])}
          onConfirm={async () => {
            setPendingDuplicates([])
            await submitExpense(parseCurrencyInput(amountRaw))
          }}
        />
      )}

      {showRecurrence && (
        <RecurrenceModal
          year={targetYear}
          currentMonth={targetMonth}
          selected={recurringMonths}
          onClose={() => setShowRecurrence(false)}
          onConfirm={(months) => setRecurringMonths(months)}
        />
      )}
    </aside>
  )
}
