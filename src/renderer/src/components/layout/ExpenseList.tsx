import { useState } from 'react'
import type { AppData } from '@shared/schema'
import { formatCurrency, formatShortDate, getMonthName, cn } from '../../lib/utils'
import { useDeleteExpense } from '../../hooks/useFinanceData'
import { calculateSettlements } from '../../lib/calculations'
import ExpenseDetailModal from '../modals/ExpenseDetailModal'
import {
  ViewModeSwitch,
  ExpenseListaView,
  ExpenseCartoesView,
  ExpenseAgrupadaView,
  type ViewMode,
  type ExpenseRow,
  type ExpenseGroup
} from './ExpenseViews'

interface Props {
  appData: AppData
  year: string
  month: string
}

type SortOption =
  | 'date-desc'
  | 'date-asc'
  | 'amount-desc'
  | 'amount-asc'
  | 'user-asc'
  | 'user-desc'
  | 'category-asc'
  | 'category-desc'

const VIEW_MODE_KEY = 'expense-view-mode'

export default function ExpenseList({ appData, year, month }: Props) {
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null)
  const [filterUserId, setFilterUserId] = useState<string | null>(null)
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [sortOption, setSortOption] = useState<SortOption>('date-desc')
  // Modo de visualização das despesas (persistido entre sessões)
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem(VIEW_MODE_KEY)
    return saved === 'cartoes' || saved === 'agrupada' ? saved : 'lista'
  })
  const deleteExpense = useDeleteExpense()

  const monthData = appData.years[year]?.[month] ?? { expenses: [] }
  const categories = [...(appData.categories ?? [])].sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR')
  )

  // Rótulos usados nas ordenações alfabéticas (usuário e categoria)
  const userNameOf = (userId: string): string =>
    appData.users.find((u) => u.id === userId)?.name ?? ''
  const categoryNameOf = (expense: (typeof monthData.expenses)[number]): string =>
    categories.find((c) => c.id === expense.categoryId)?.name ?? expense.name ?? ''
  const compareText = (a: string, b: string): number => a.localeCompare(b, 'pt-BR')

  const sortedExpenses = [...monthData.expenses].sort((a, b) => {
    switch (sortOption) {
      case 'date-desc':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      case 'date-asc':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      case 'amount-desc':
        return b.amount - a.amount
      case 'amount-asc':
        return a.amount - b.amount
      case 'user-asc':
        return (
          compareText(userNameOf(a.paidBy), userNameOf(b.paidBy)) ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      case 'user-desc':
        return (
          compareText(userNameOf(b.paidBy), userNameOf(a.paidBy)) ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      case 'category-asc':
        return (
          compareText(categoryNameOf(a), categoryNameOf(b)) ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      case 'category-desc':
        return (
          compareText(categoryNameOf(b), categoryNameOf(a)) ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      default:
        return 0
    }
  })

  let expenses = filterUserId
    ? sortedExpenses.filter((e) => e.paidBy === filterUserId)
    : sortedExpenses

  if (filterCategory === 'extra') {
    expenses = expenses.filter((e) => !!e.debtToUserId)
  } else if (filterCategory === 'no-extra') {
    expenses = expenses.filter((e) => !e.debtToUserId)
  } else if (filterCategory !== 'all') {
    expenses = expenses.filter((e) => e.categoryId === filterCategory)
  }
  const summary = calculateSettlements(monthData, appData.users)

  const selectedExpense = expenses.find((e) => e.id === selectedExpenseId) || null

  const changeViewMode = (mode: ViewMode): void => {
    localStorage.setItem(VIEW_MODE_KEY, mode)
    setViewMode(mode)
  }

  // Modelo normalizado consumido pelas três visualizações
  const rows: ExpenseRow[] = expenses.map((expense) => {
    const payer = appData.users.find((u) => u.id === expense.paidBy)
    const debtor = expense.debtToUserId
      ? appData.users.find((u) => u.id === expense.debtToUserId)
      : undefined
    const payerName = payer?.name ?? '?'
    return {
      id: expense.id,
      title:
        categories.find((c) => c.id === expense.categoryId)?.name ??
        expense.name ??
        'Sem categoria',
      description: expense.description ?? '',
      amount: expense.amount,
      date: formatShortDate(expense.createdAt),
      payerName,
      payerColor: payer?.color,
      payerInitial: payerName.charAt(0).toUpperCase(),
      isExtra: !!expense.debtToUserId,
      debtorName: debtor?.name,
      debtorColor: debtor?.color,
      groupKey: expense.categoryId || 'sem-categoria'
    }
  })

  // Agrupamento por categoria; os Valores Extra ficam num grupo próprio, fora do rateio
  const sharedTotal = rows.filter((r) => !r.isExtra).reduce((sum, r) => sum + r.amount, 0)
  const groupMap = new Map<string, ExpenseGroup>()
  for (const row of rows) {
    const key = row.isExtra ? '__extra__' : row.groupKey
    let group = groupMap.get(key)
    if (!group) {
      group = {
        key,
        title: row.isExtra ? 'Valor Extra' : row.title,
        rows: [],
        total: 0,
        pct: null,
        isExtra: row.isExtra
      }
      groupMap.set(key, group)
    }
    group.rows.push(row)
    group.total += row.amount
  }
  const groups: ExpenseGroup[] = [...groupMap.values()]
    .map((g) => ({
      ...g,
      pct: g.isExtra || sharedTotal === 0 ? null : (g.total / sharedTotal) * 100
    }))
    .sort((a, b) => {
      if (a.isExtra !== b.isExtra) return a.isExtra ? 1 : -1
      return b.total - a.total
    })

  return (
    <div className="flex flex-col flex-1 min-w-0 border-r border-white/5 bg-transparent backdrop-blur-sm">
      {/* Header */}
      <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-white/[0.01] drag-region">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {getMonthName(month)} <span className="text-muted-foreground font-normal">{year}</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
            <span>
              {filterUserId
                ? `${expenses.length} de despesas filtradas`
                : `${expenses.length} despesa${expenses.length !== 1 ? 's' : ''}`}
            </span>
            <span className="text-muted-foreground/30">•</span>
            <span className="text-sm font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-lg border border-primary/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
              {filterUserId ? 'Filtrado: ' : 'Total Mensal: '}
              {formatCurrency(
                filterCategory === 'extra'
                  ? expenses.reduce((sum, e) => sum + e.amount, 0)
                  : expenses.filter((e) => !e.debtToUserId).reduce((sum, e) => sum + e.amount, 0)
              )}
            </span>
            {filterUserId && (
              <button
                onClick={() => setFilterUserId(null)}
                className="text-[10px] bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground px-2 py-0.5 rounded border border-white/5 transition-colors ml-1"
              >
                Limpar Filtro ✕
              </button>
            )}
          </p>
        </div>
      </div>

      {/* Settlement summary */}
      {summary.settlements.length > 0 && (
        <div className="mx-6 mt-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 px-5 py-4 shadow-[0_0_30px_rgba(16,185,129,0.05)] relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Finanças
          </p>
          <div className="space-y-2">
            {summary.settlements.map((s, i) => {
              const fromUser = appData.users.find((u) => u.name === s.from)
              const toUser = appData.users.find((u) => u.name === s.to)
              return (
                <div key={i} className="flex items-center gap-2 text-sm text-foreground/90">
                  <span
                    className="font-semibold bg-white/5 px-2 py-0.5 rounded-md"
                    style={fromUser?.color ? { color: fromUser.color } : undefined}
                  >
                    {s.from}
                  </span>
                  <span className="text-muted-foreground text-xs">deve</span>
                  <span className="font-bold text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]">
                    {formatCurrency(s.amount)}
                  </span>
                  <span className="text-muted-foreground text-xs">para</span>
                  <span
                    className="font-semibold bg-white/5 px-2 py-0.5 rounded-md"
                    style={toUser?.color ? { color: toUser.color } : undefined}
                  >
                    {s.to}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="pt-3 border-t border-emerald-500/10 mt-4 flex items-center justify-between text-xs text-emerald-800/60 dark:text-emerald-100/50">
            <span>
              Cota ideal:{' '}
              <strong className="text-emerald-900 dark:text-emerald-100 font-medium">
                {formatCurrency(summary.fairShare)}
              </strong>
            </span>
            <span>
              {summary.participantCount} participante{summary.participantCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}

      {/* Per-person breakdown */}
      {summary.participants.length > 0 && (
        <div className="mx-6 mt-4 grid grid-cols-2 gap-3">
          {summary.participants.map((p) => {
            const userObj = appData.users.find((u) => u.id === p.userId)
            const userColor = userObj?.color
            const extraPaid = monthData.expenses
              .filter((e) => e.paidBy === p.userId && !!e.debtToUserId)
              .reduce((sum, e) => sum + e.amount, 0)
            return (
              <button
                key={p.userId}
                onClick={() => setFilterUserId(filterUserId === p.userId ? null : p.userId)}
                className={cn(
                  'rounded-xl border backdrop-blur-md px-4 py-3 flex items-center justify-between gap-3 transition-all duration-300 hover:scale-[1.02]',
                  filterUserId === p.userId
                    ? 'bg-primary/20 border-primary shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                    : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'
                )}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className={cn(
                      'h-8 w-8 flex-shrink-0 rounded-full border flex items-center justify-center text-sm font-bold transition-colors'
                    )}
                    style={
                      filterUserId === p.userId
                        ? {
                            backgroundColor: userColor || 'var(--primary)',
                            borderColor: userColor || 'var(--primary)',
                            color: '#ffffff'
                          }
                        : {
                            backgroundColor: userColor ? `${userColor}20` : 'rgba(16,185,129,0.2)',
                            borderColor: userColor ? `${userColor}30` : 'rgba(16,185,129,0.1)',
                            color: userColor || 'var(--primary)'
                          }
                    }
                  >
                    {p.userName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col justify-center min-w-0 text-left">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="text-sm font-semibold truncate"
                        style={
                          filterUserId === p.userId
                            ? { color: 'var(--foreground)' }
                            : userColor
                              ? { color: userColor }
                              : undefined
                        }
                      >
                        {p.userName}
                      </span>
                    </div>
                    {userObj?.originalName && userObj.originalName !== userObj.name && (
                      <span className="text-[9px] text-muted-foreground/60 truncate mt-0.5 font-medium leading-none">
                        nome de criação: {userObj.originalName}
                      </span>
                    )}
                    {extraPaid > 0 && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 font-medium leading-none">
                        ⚡ Extra: {formatCurrency(extraPaid)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-bold text-foreground">
                    {formatCurrency(p.paid - extraPaid)}
                  </div>
                  <div
                    className={`text-xs font-medium mt-0.5 ${p.balance >= 0 ? 'text-emerald-400' : 'text-red-400/90'}`}
                  >
                    {p.balance >= 0 ? '+' : ''}
                    {formatCurrency(p.balance)}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Filters and Sorting */}
      {monthData.expenses.length > 0 && (
        <div className="px-6 pt-4 flex gap-3 items-center">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="flex-1 min-w-0 bg-black/5 dark:bg-white/5 border border-border rounded-md text-xs font-medium text-foreground px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer appearance-none pr-7 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCAyNCAyNCIgc3Ryb2tlPSIjOThhM2EyIiBzdHJva2Utd2lkdGg9IjIiPjxwYXRoIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgZD0iTTE5IDlsLTcgNy03LTciLz48L3N2Zz4=')] bg-[length:12px_12px] bg-[position:right_8px_center] bg-no-repeat truncate"
            title="Filtrar por tipo ou categoria"
          >
            <option value="all" className="bg-background text-foreground">
              Todas as Despesas
            </option>
            <option value="no-extra" className="bg-background text-emerald-500 font-bold">
              🏠 Nenhuma despesa extra
            </option>
            <option value="extra" className="bg-background text-amber-500 font-bold">
              ⚡ Somente Extras
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id} className="bg-background text-foreground">
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as SortOption)}
            className="flex-1 min-w-0 bg-black/5 dark:bg-white/5 border border-border rounded-md text-xs font-medium text-foreground px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer appearance-none pr-7 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCAyNCAyNCIgc3Ryb2tlPSIjOThhM2EyIiBzdHJva2Utd2lkdGg9IjIiPjxwYXRoIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgZD0iTTE5IDlsLTcgNy03LTciLz48L3N2Zz4=')] bg-[length:12px_12px] bg-[position:right_8px_center] bg-no-repeat truncate"
            title="Ordenar despesas"
          >
            <option value="date-desc" className="bg-background text-foreground">
              Mais recentes
            </option>
            <option value="date-asc" className="bg-background text-foreground">
              Mais antigas
            </option>
            <option value="amount-desc" className="bg-background text-foreground">
              Maior valor
            </option>
            <option value="amount-asc" className="bg-background text-foreground">
              Menor valor
            </option>
            <option value="user-asc" className="bg-background text-foreground">
              Usuário (A-Z)
            </option>
            <option value="user-desc" className="bg-background text-foreground">
              Usuário (Z-A)
            </option>
            <option value="category-asc" className="bg-background text-foreground">
              Categoria (A-Z)
            </option>
            <option value="category-desc" className="bg-background text-foreground">
              Categoria (Z-A)
            </option>
          </select>

          <ViewModeSwitch value={viewMode} onChange={changeViewMode} />
        </div>
      )}

      {/* Expense list */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {expenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center bg-white/[0.01] rounded-2xl border border-white/5 border-dashed mx-2">
            <span className="text-4xl mb-3 opacity-50">📋</span>
            <p className="text-sm font-medium text-foreground/80">
              {filterCategory !== 'all'
                ? 'Nenhuma despesa encontrada para este filtro'
                : 'Nenhuma despesa lançada'}
            </p>
            <p className="text-xs text-muted-foreground mt-1.5">
              {filterCategory !== 'all'
                ? 'Altere o filtro para ver outras despesas.'
                : 'Use o painel ao lado para adicionar a primeira.'}
            </p>
          </div>
        ) : viewMode === 'lista' ? (
          <ExpenseListaView rows={rows} onSelect={setSelectedExpenseId} />
        ) : viewMode === 'cartoes' ? (
          <ExpenseCartoesView rows={rows} onSelect={setSelectedExpenseId} />
        ) : (
          <ExpenseAgrupadaView groups={groups} onSelect={setSelectedExpenseId} />
        )}
      </div>

      {selectedExpense && (
        <ExpenseDetailModal
          expense={selectedExpense}
          users={appData.users}
          categories={categories}
          year={year}
          month={month}
          yearData={appData.years[year] ?? {}}
          onClose={() => setSelectedExpenseId(null)}
          onDelete={async () => {
            await deleteExpense.mutateAsync({ year, month, expenseId: selectedExpense.id })
            setSelectedExpenseId(null)
          }}
          isDeleting={deleteExpense.isPending}
        />
      )}
    </div>
  )
}
