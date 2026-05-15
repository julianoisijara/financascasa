import { useState } from 'react'
import type { Expense, User } from '@shared/schema'
import { formatCurrency, maskCurrencyInput, parseCurrencyInput } from '../../lib/utils'
import { useEditExpense, useAddCategory } from '../../hooks/useFinanceData'
import AddCategoryModal from './AddCategoryModal'

interface Props {
  expense: Expense
  users: User[]
  categories: { id: string; name: string }[]
  year: string
  month: string
  onClose: () => void
  onDelete: () => void
  isDeleting: boolean
}

export default function ExpenseDetailModal({ expense, users, categories, year, month, onClose, onDelete, isDeleting }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  
  // Edit form state
  const [name, setName] = useState(expense.name)
  const [description, setDescription] = useState(expense.description)
  // format amount back to currency string for input mask (amount is in cents)
  const initialAmountRaw = (expense.amount / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const [amountRaw, setAmountRaw] = useState(initialAmountRaw)
  const [paidBy, setPaidBy] = useState(expense.paidBy)
  const [categoryId, setCategoryId] = useState(expense.categoryId ?? '')
  const [showAddCategory, setShowAddCategory] = useState(false)
  
  const editExpense = useEditExpense()
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
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })

  const updatedDate = expense.updatedAt ? new Date(expense.updatedAt).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }) : null
  const updater = expense.updatedBy ? users.find((u) => u.id === expense.updatedBy) : null
  const category = categories.find(c => c.id === expense.categoryId)

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmountRaw(maskCurrencyInput(e.target.value))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const amount = parseCurrencyInput(amountRaw)
    if (amount <= 0) return
    
    // Fallback to first user if we need an updatedBy ID
    const updaterId = users[0]?.id

    await editExpense.mutateAsync({
      year,
      month,
      expenseId: expense.id,
      userId: updaterId,
      updates: {
        name: name.trim(),
        description: description.trim(),
        amount,
        paidBy,
        categoryId: categoryId || undefined
      }
    })
    setIsEditing(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm mx-4 card p-6 space-y-5 animate-slide-in flex flex-col max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-foreground truncate">
              {isEditing ? 'Editar Despesa' : expense.name}
            </h2>
            {!isEditing && (
              <p className="text-xs text-muted-foreground mt-0.5">Criado em: {date}</p>
            )}
            {!isEditing && updatedDate && updater && (
              <p className="text-[10px] text-muted-foreground/80 mt-1 flex items-center gap-1">
                <span>✎</span> Editado por {updater.name} em {updatedDate}
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
              <label className="label">Nome da despesa</label>
              <input
                className="input-field"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={editExpense.isPending}
                required
              />
            </div>
            
            <div>
              <label className="label">Descrição <span className="font-normal opacity-60">(opcional)</span></label>
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
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-semibold group-focus-within:text-primary transition-colors">R$</span>
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
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Categoria</label>
              <select
                className="input-field cursor-pointer appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCAyNCAyNCIgc3Ryb2tlPSIjOThhM2EyIiBzdHJva2Utd2lkdGg9IjIiPjxwYXRoIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgZD0iTTE5IDlsLTcgNy03LTciLz48L3N2Zz4=')] bg-[length:16px_16px] bg-[position:right_12px_center] bg-no-repeat pr-10"
                value={categoryId}
                onChange={handleCategoryChange}
                disabled={editExpense.isPending || addCategory.isPending}
              >
                <option value="">Nenhuma categoria</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
                <option value="new" className="font-bold text-primary">+ Nova categoria...</option>
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
              <button 
                type="submit" 
                className="btn-primary flex-1"
                disabled={editExpense.isPending}
              >
                {editExpense.isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        ) : (
          <>
            {/* Amount */}
            <div className="rounded-lg bg-primary/10 border border-primary/20 px-4 py-3 text-center relative group">
              <p className="text-xs text-muted-foreground mb-1">Valor pago</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(expense.amount)}</p>
            </div>

            {/* Details */}
            <div className="space-y-3 bg-black/5 dark:bg-black/20 rounded-xl p-4 border border-border">
              <DetailRow label="Pago por" value={payer?.name ?? '—'} />
              <DetailRow label="Categoria" value={category?.name ?? 'Sem categoria'} />
              {expense.description && (
                <DetailRow label="Descrição" value={expense.description} />
              )}
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

      {showAddCategory && (
        <AddCategoryModal
          onClose={() => setShowAddCategory(false)}
          onSuccess={(id) => setCategoryId(id)}
        />
      )}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}
