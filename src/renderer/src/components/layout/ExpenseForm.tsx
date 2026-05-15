import { useState } from 'react'
import type { AppData } from '@shared/schema'
import { maskCurrencyInput, parseCurrencyInput, cn } from '../../lib/utils'
import { useAddExpense, useAddCategory } from '../../hooks/useFinanceData'
import AddCategoryModal from '../modals/AddCategoryModal'

interface Props {
  appData: AppData
  year: string
  month: string
}

export default function ExpenseForm({ appData, year, month }: Props) {
  const addExpense = useAddExpense()
  const addCategory = useAddCategory()
  const [description, setDescription] = useState('')
  const [amountRaw, setAmountRaw] = useState('')
  const [paidBy, setPaidBy] = useState(appData.users[0]?.id ?? '')
  const [categoryId, setCategoryId] = useState('')
  const [isDebt, setIsDebt] = useState(false)
  const [debtToUserId, setDebtToUserId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [touched, setTouched] = useState(false)

  const categories = appData.categories ?? []

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
    if (isDebt && debtToUserId === paidBy) return setError('O devedor não pode ser a mesma pessoa que pagou.')

    await addExpense.mutateAsync({ year, month, expense: { description: description.trim(), amount, paidBy, categoryId, debtToUserId: isDebt ? debtToUserId : undefined } })

    // Reset
    setDescription('')
    setAmountRaw('')
    setCategoryId('')
    setIsDebt(false)
    setDebtToUserId('')
    setTouched(false)
    setSuccess(true)
    setTimeout(() => setSuccess(false), 2500)
  }

  const handleClear = () => {
    setDescription('')
    setAmountRaw('')
    setCategoryId('')
    setIsDebt(false)
    setDebtToUserId('')
    setError('')
    setTouched(false)
  }

  return (
    <aside className="flex w-[320px] flex-shrink-0 flex-col bg-background/60 backdrop-blur-2xl border-l border-white/5 relative z-10 shadow-[-20px_0_40px_rgba(0,0,0,0.3)]">
      {/* Header */}
      <div className="px-6 py-6 border-b border-white/5 relative overflow-hidden drag-region">
        <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent opacity-30 pointer-events-none" />
        <h2 className="text-base font-bold text-foreground tracking-tight relative z-10">Lançar Despesa</h2>
        <p className="text-xs font-medium text-muted-foreground mt-1 relative z-10">Adicione uma nova despesa ao mês</p>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
        {/* Category */}
        <div>
          <label className="label" htmlFor="expense-category">Categoria</label>
          <select
            id="expense-category"
            className={cn(
              "input-field cursor-pointer appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCAyNCAyNCIgc3Ryb2tlPSIjOThhM2EyIiBzdHJva2Utd2lkdGg9IjIiPjxwYXRoIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgZD0iTTE5IDlsLTcgNy03LTciLz48L3N2Zz4=')] bg-[length:16px_16px] bg-[position:right_12px_center] bg-no-repeat pr-10",
              touched && !categoryId && "border-destructive ring-1 ring-destructive/50"
            )}
            value={categoryId}
            onChange={handleCategoryChange}
            disabled={addExpense.isPending || addCategory.isPending}
          >
            <option value="">Nenhuma categoria</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
            <option value="new" className="font-bold text-primary">+ Nova categoria...</option>
          </select>
        </div>

        {/* Description */}
        <div>
          <label className="label" htmlFor="expense-desc">Descrição <span className="font-normal opacity-60">(opcional)</span></label>
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
          <label className="label" htmlFor="expense-amount">Valor</label>
          <div className="relative group">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-semibold group-focus-within:text-primary transition-colors">R$</span>
            <input
              id="expense-amount"
              className={cn(
                "input-field pl-10 font-medium text-lg tracking-wide",
                touched && (!amountRaw || parseCurrencyInput(amountRaw) <= 0) && "border-destructive ring-1 ring-destructive/50"
              )}
              type="text"
              inputMode="numeric"
              placeholder="0,00"
              value={amountRaw}
              onChange={handleAmountChange}
              disabled={addExpense.isPending}
            />
          </div>
        </div>

        {/* Paid by */}
        <div>
          <label className="label" htmlFor="expense-paidby">Pago por</label>
          <select
            id="expense-paidby"
            className="input-field cursor-pointer appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCAyNCAyNCIgc3Ryb2tlPSIjOThhM2EyIiBzdHJva2Utd2lkdGg9IjIiPjxwYXRoIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgZD0iTTE5IDlsLTcgNy03LTciLz48L3N2Zz4=')] bg-[length:16px_16px] bg-[position:right_12px_center] bg-no-repeat pr-10"
            value={paidBy}
            onChange={(e) => setPaidBy(e.target.value)}
            disabled={addExpense.isPending}
          >
            {appData.users.map((user) => (
              <option key={user.id} value={user.id}>{user.name}</option>
            ))}
          </select>
        </div>

        {/* Debt toggle */}
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 space-y-3">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isDebt}
              onChange={(e) => { setIsDebt(e.target.checked); if (!e.target.checked) setDebtToUserId('') }}
              disabled={addExpense.isPending}
              className="h-4 w-4 rounded border-amber-500/40 text-amber-500 focus:ring-amber-500/50 cursor-pointer accent-amber-500"
            />
            <span className="text-xs font-semibold text-amber-300">Despesa a ser paga por</span>
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
              {appData.users.filter(u => u.id !== paidBy).map((user) => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Error */}
        {error && (
          <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>
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

      {showAddCategory && (
        <AddCategoryModal
          onClose={() => setShowAddCategory(false)}
          onSuccess={(id) => setCategoryId(id)}
        />
      )}
    </aside>
  )
}
