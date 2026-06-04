import { useState } from 'react'
import type { AppData, Expense } from '@shared/schema'
import { formatCurrency, getMonthName, cn } from '../../lib/utils'

interface Props {
  appData: AppData
}

type PeriodFilter = 'month' | 'year' | 'all'

export default function Dashboard({ appData }: Props) {
  const years = Object.keys(appData.years).sort((a, b) => Number(b) - Number(a))
  const currentYear = String(new Date().getFullYear())
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0')

  const [selectedYear, setSelectedYear] = useState(
    years.includes(currentYear) ? currentYear : (years[0] ?? currentYear)
  )
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [period, setPeriod] = useState<PeriodFilter>('year')
  const [filterUserId, setFilterUserId] = useState<string>('all')
  const [filterCategoryId, setFilterCategoryId] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all') // 'all' | 'shared' | 'extra'

  const categories = appData.categories ?? []
  const userMap = new Map(appData.users.map((u) => [u.id, u.name]))

  // Collect expenses based on period
  function getExpenses(): Expense[] {
    let expenses: Expense[] = []
    if (period === 'month') {
      expenses = appData.years[selectedYear]?.[selectedMonth]?.expenses ?? []
    } else if (period === 'year') {
      const yearData = appData.years[selectedYear] ?? {}
      for (const m of Object.values(yearData)) {
        expenses.push(...m.expenses)
      }
    } else {
      for (const yearData of Object.values(appData.years)) {
        for (const m of Object.values(yearData)) {
          expenses.push(...m.expenses)
        }
      }
    }
    return expenses
  }

  let expenses = getExpenses()

  // Apply filters
  if (filterUserId !== 'all') {
    expenses = expenses.filter((e) => e.paidBy === filterUserId)
  }
  if (filterCategoryId !== 'all') {
    expenses = expenses.filter((e) => e.categoryId === filterCategoryId)
  }
  if (filterType === 'shared') {
    expenses = expenses.filter((e) => !e.debtToUserId)
  } else if (filterType === 'extra') {
    expenses = expenses.filter((e) => !!e.debtToUserId)
  }

  // Calculations
  const totalGeral = expenses.reduce((s, e) => s + e.amount, 0)
  const totalShared = expenses.filter((e) => !e.debtToUserId).reduce((s, e) => s + e.amount, 0)
  const totalExtra = expenses.filter((e) => !!e.debtToUserId).reduce((s, e) => s + e.amount, 0)
  const expenseCount = expenses.length

  // Per-user breakdown
  const userTotals = new Map<string, number>()
  for (const e of expenses) {
    userTotals.set(e.paidBy, (userTotals.get(e.paidBy) ?? 0) + e.amount)
  }

  // Per-category breakdown
  const catTotals = new Map<string, number>()
  for (const e of expenses) {
    const catName = categories.find((c) => c.id === e.categoryId)?.name ?? 'Sem categoria'
    catTotals.set(catName, (catTotals.get(catName) ?? 0) + e.amount)
  }
  const catEntries = Array.from(catTotals.entries()).sort((a, b) => b[1] - a[1])

  // Top 5 most expensive
  const top5 = [...expenses].sort((a, b) => b.amount - a.amount).slice(0, 5)

  // Monthly evolution for selected year
  const monthlyData: { month: string; categories: Record<string, number>; total: number }[] = []
  if (appData.years[selectedYear]) {
    for (let m = 1; m <= 12; m++) {
      const mKey = String(m).padStart(2, '0')
      let mExpenses = appData.years[selectedYear]?.[mKey]?.expenses ?? []

      if (filterUserId !== 'all') mExpenses = mExpenses.filter((e) => e.paidBy === filterUserId)
      if (filterCategoryId !== 'all')
        mExpenses = mExpenses.filter((e) => e.categoryId === filterCategoryId)
      if (filterType === 'shared') mExpenses = mExpenses.filter((e) => !e.debtToUserId)
      if (filterType === 'extra') mExpenses = mExpenses.filter((e) => !!e.debtToUserId)

      const mCats: Record<string, number> = {}
      let mTotal = 0

      for (const e of mExpenses) {
        const catName = categories.find((c) => c.id === e.categoryId)?.name ?? 'Sem categoria'
        mCats[catName] = (mCats[catName] ?? 0) + e.amount
        mTotal += e.amount
      }

      monthlyData.push({ month: mKey, categories: mCats, total: mTotal })
    }
  }
  const maxMonthly = Math.max(...monthlyData.map((d) => d.total), 1)

  // Category colors
  const catColors = [
    'bg-emerald-500',
    'bg-blue-500',
    'bg-amber-500',
    'bg-purple-500',
    'bg-rose-500',
    'bg-cyan-500',
    'bg-orange-500',
    'bg-indigo-500'
  ]
  const getColorForCategory = (catName: string) => {
    const idx = categories.findIndex((c) => c.name === catName)
    return catColors[(idx >= 0 ? idx : categories.length) % catColors.length]
  }

  const months = Object.keys(appData.years[selectedYear] ?? {}).sort()

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      {/* Top bar */}
      <div className="px-8 py-6 border-b border-white/5 bg-white/[0.01] drag-region">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Dashboard</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Visão geral das suas finanças</p>
          </div>
          <div className="flex items-center gap-2 no-drag-region">
            <span className="text-xs text-muted-foreground">Período:</span>
            {(['month', 'year', 'all'] as PeriodFilter[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  period === p
                    ? 'bg-primary text-primary-foreground shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                    : 'bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground'
                )}
              >
                {p === 'month' ? 'Mensal' : p === 'year' ? 'Anual' : 'Total'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* Filters row */}
        <div className="flex flex-wrap gap-3 items-center">
          {(period === 'month' || period === 'year') && (
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-white/5 border border-border rounded-lg text-xs font-medium text-foreground px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
            >
              {years.map((y) => (
                <option key={y} value={y} className="bg-background">
                  {y}
                </option>
              ))}
            </select>
          )}
          {period === 'month' && (
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-white/5 border border-border rounded-lg text-xs font-medium text-foreground px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
            >
              {months.map((m) => (
                <option key={m} value={m} className="bg-background">
                  {getMonthName(m)}
                </option>
              ))}
            </select>
          )}

          <div className="h-5 w-px bg-white/10" />

          <select
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
            className="bg-white/5 border border-border rounded-lg text-xs font-medium text-foreground px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
          >
            <option value="all" className="bg-background">
              Todos os Usuários
            </option>
            {appData.users.map((u) => (
              <option key={u.id} value={u.id} className="bg-background">
                {u.name}
              </option>
            ))}
          </select>

          <select
            value={filterCategoryId}
            onChange={(e) => setFilterCategoryId(e.target.value)}
            className="bg-white/5 border border-border rounded-lg text-xs font-medium text-foreground px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
          >
            <option value="all" className="bg-background">
              Todas as Categorias
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id} className="bg-background">
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-white/5 border border-border rounded-lg text-xs font-medium text-foreground px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
          >
            <option value="all" className="bg-background">
              Todos os Tipos
            </option>
            <option value="shared" className="bg-background">
              Custo da Casa
            </option>
            <option value="extra" className="bg-background">
              ⚡ Valor Extra
            </option>
          </select>

          {(filterUserId !== 'all' || filterCategoryId !== 'all' || filterType !== 'all') && (
            <button
              onClick={() => {
                setFilterUserId('all')
                setFilterCategoryId('all')
                setFilterType('all')
              }}
              className="text-[10px] bg-destructive/10 hover:bg-destructive/20 text-destructive px-3 py-2 rounded-lg border border-destructive/20 transition-colors font-medium"
            >
              Limpar Filtros ✕
            </button>
          )}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-4">
          <SummaryCard
            label="Total Geral"
            value={formatCurrency(totalGeral)}
            icon="💰"
            accent="emerald"
          />
          <SummaryCard
            label="Custo da Casa"
            value={formatCurrency(totalShared)}
            icon="🏠"
            accent="blue"
          />
          <SummaryCard
            label="Valor Extra"
            value={formatCurrency(totalExtra)}
            icon="⚡"
            accent="amber"
          />
          <SummaryCard label="Despesas" value={String(expenseCount)} icon="📊" accent="purple" />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-3 gap-5">
          {/* Monthly chart */}
          <div className="col-span-2 card p-6 flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-2xl font-bold text-foreground">{formatCurrency(totalGeral)}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Visão geral do balanço em {selectedYear}
                </p>
              </div>
              <div className="flex flex-wrap justify-end gap-3 text-[9px] font-bold text-muted-foreground uppercase tracking-wider max-w-[50%]">
                {categories.slice(0, 4).map((c) => (
                  <span key={c.id} className="flex items-center gap-1.5">
                    <span
                      className={cn('w-2 h-2 rounded-[3px]', getColorForCategory(c.name))}
                    ></span>
                    {c.name.slice(0, 10)}
                    {c.name.length > 10 ? '...' : ''}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative flex-1 min-h-[220px] flex">
              {/* Background horizontal bars (Grid replacement) */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none z-0 pb-6">
                {[4, 3, 2, 1, 0].map((i) => {
                  const val = (maxMonthly * i) / 4
                  return (
                    <div key={i} className="flex items-center w-full group">
                      <span className="text-[10px] text-muted-foreground w-14 flex-shrink-0 font-medium">
                        {val === 0 ? '0' : formatCurrency(val).split(',')[0]}
                      </span>
                      <div className="h-6 w-full bg-white/[0.02] dark:bg-white/[0.01] rounded-lg border-t border-white/[0.03]" />
                    </div>
                  )
                })}
              </div>

              {/* Bars */}
              <div className="relative z-10 flex items-end justify-between w-full pl-14 pr-2 pb-6 pt-2 h-full">
                {monthlyData.map((d) => {
                  const totalPct = maxMonthly > 0 ? (d.total / maxMonthly) * 100 : 0
                  const isCurrentMonth = period === 'month' && d.month === selectedMonth

                  return (
                    <div
                      key={d.month}
                      className="relative flex flex-col items-center group h-full justify-end w-10 hover:z-50"
                    >
                      {/* Capsule Background Track */}
                      <div className="absolute inset-x-1 top-0 bottom-0 bg-black/[0.05] dark:bg-white/[0.03] rounded-full" />

                      {/* Bar Wrapper */}
                      <div className="relative w-8 z-10" style={{ height: `${totalPct}%` }}>
                        {/* Total Value Above Bar */}
                        {d.total > 0 && (
                          <div className="absolute bottom-full mb-2 w-full text-center pointer-events-none z-20">
                            <span className="text-[10px] font-bold text-foreground drop-shadow-md whitespace-nowrap">
                              {formatCurrency(d.total)}
                            </span>
                          </div>
                        )}

                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0 pointer-events-none z-[60] w-48 bg-background border border-border shadow-2xl rounded-xl p-3">
                          <p className="text-[10px] text-muted-foreground font-medium mb-2 pb-2 border-b border-border">
                            {getMonthName(d.month)}, {selectedYear}
                          </p>
                          <div className="space-y-2">
                            {Object.entries(d.categories)
                              .sort((a, b) => b[1] - a[1])
                              .slice(0, 5)
                              .map(([catName, amount]) => (
                                <div
                                  key={catName}
                                  className="flex justify-between items-center text-xs"
                                >
                                  <span className="flex items-center gap-1.5 text-muted-foreground truncate max-w-[100px]">
                                    <span
                                      className={cn(
                                        'w-1.5 h-1.5 rounded-full',
                                        getColorForCategory(catName)
                                      )}
                                    ></span>
                                    {catName}
                                  </span>
                                  <span className="font-bold text-foreground">
                                    {formatCurrency(amount)}
                                  </span>
                                </div>
                              ))}
                            <div className="flex justify-between items-center text-xs pt-1 mt-1 border-t border-border/50">
                              <span className="text-muted-foreground font-medium">Total</span>
                              <span className="font-bold text-foreground">
                                {formatCurrency(d.total)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Progress Capsule Stacked */}
                        <div
                          className={cn(
                            'w-full h-full rounded-full transition-all duration-500 flex flex-col overflow-hidden',
                            isCurrentMonth
                              ? 'ring-2 ring-primary/50 ring-offset-2 ring-offset-background shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                              : d.total === 0
                                ? 'bg-transparent'
                                : 'bg-white/[0.02]'
                          )}
                        >
                          {d.total > 0 &&
                            Object.entries(d.categories)
                              .sort((a, b) => a[1] - b[1]) // ascending so largest is at the bottom
                              .map(([catName, amount]) => (
                                <div
                                  key={catName}
                                  className={cn(
                                    'w-full transition-all duration-300',
                                    getColorForCategory(catName)
                                  )}
                                  style={{ height: `${(amount / d.total) * 100}%` }}
                                  title={`${catName}: ${formatCurrency(amount)}`}
                                />
                              ))}
                        </div>
                      </div>

                      {/* X-axis label */}
                      <span
                        className={cn(
                          'absolute -bottom-6 text-[10px] font-medium transition-colors',
                          isCurrentMonth ? 'text-primary font-bold' : 'text-muted-foreground'
                        )}
                      >
                        {getMonthName(d.month).slice(0, 3)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Category breakdown */}
          <div className="card p-5">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">
              Categorias
            </p>
            {catEntries.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">Sem dados</p>
            ) : (
              <div className="space-y-3">
                {catEntries.slice(0, 6).map(([catName, amount]) => {
                  const pct = totalGeral > 0 ? (amount / totalGeral) * 100 : 0
                  return (
                    <div key={catName}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-foreground/80 font-medium truncate flex items-center gap-1.5">
                          <span
                            className={cn('w-1.5 h-1.5 rounded-full', getColorForCategory(catName))}
                          ></span>
                          {catName}
                        </span>
                        <span className="text-muted-foreground font-medium ml-2 flex-shrink-0">
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-700',
                            getColorForCategory(catName)
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatCurrency(amount)}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-2 gap-5">
          {/* Per-user */}
          <div className="card p-5">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">
              Gastos por Participante
            </p>
            {userTotals.size === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">Sem dados</p>
            ) : (
              <div className="space-y-3">
                {Array.from(userTotals.entries())
                  .sort((a, b) => b[1] - a[1])
                  .map(([userId, amount]) => {
                    const pct = totalGeral > 0 ? (amount / totalGeral) * 100 : 0
                    const name = userMap.get(userId) ?? '?'
                    const userObj = appData.users.find((u) => u.id === userId)
                    const userColor = userObj?.color
                    return (
                      <div key={userId} className="flex items-center gap-3">
                        <div
                          className="h-8 w-8 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold shadow-sm border"
                          style={{
                            backgroundColor: userColor ? `${userColor}20` : 'rgba(16,185,129,0.2)',
                            borderColor: userColor ? `${userColor}30` : 'rgba(16,185,129,0.1)',
                            color: userColor || 'var(--primary)'
                          }}
                        >
                          {name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between text-xs mb-1">
                            <span
                              className="text-foreground/90 font-semibold truncate"
                              style={userColor ? { color: userColor } : undefined}
                            >
                              {name}
                            </span>
                            <span className="text-foreground font-bold ml-2 flex-shrink-0">
                              {formatCurrency(amount)}
                            </span>
                          </div>
                          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: userColor || 'var(--primary)'
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>

          {/* Top 5 expenses */}
          <div className="card p-5">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">
              Top 5 Maiores Despesas
            </p>
            {top5.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">Sem dados</p>
            ) : (
              <div className="space-y-2.5">
                {top5.map((e, idx) => {
                  const catName =
                    categories.find((c) => c.id === e.categoryId)?.name ?? e.name ?? 'Sem categoria'
                  const isExtra = !!e.debtToUserId
                  return (
                    <div
                      key={e.id}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-colors',
                        isExtra
                          ? 'bg-amber-500/5 border-amber-500/20'
                          : 'bg-white/[0.02] border-white/5'
                      )}
                    >
                      <span className="text-xs font-bold text-muted-foreground w-5 text-center">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            'text-sm font-medium truncate',
                            isExtra ? 'text-amber-300' : 'text-foreground/90'
                          )}
                        >
                          {catName}
                          {isExtra && <span className="ml-1.5 text-[10px] text-amber-400">⚡</span>}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          <strong
                            style={{
                              color: appData.users.find((u) => u.id === e.paidBy)?.color
                            }}
                          >
                            {userMap.get(e.paidBy) ?? '?'}
                          </strong>{' '}
                          • {new Date(e.createdAt).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'text-sm font-bold flex-shrink-0',
                          isExtra ? 'text-amber-400' : 'text-primary'
                        )}
                      >
                        {formatCurrency(e.amount)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  icon,
  accent
}: {
  label: string
  value: string
  icon: string
  accent: string
}) {
  const colors: Record<string, string> = {
    emerald:
      'from-emerald-500/15 to-emerald-500/5 border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.08)]',
    blue: 'from-blue-500/15 to-blue-500/5 border-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.08)]',
    amber:
      'from-amber-500/15 to-amber-500/5 border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.08)]',
    purple:
      'from-purple-500/15 to-purple-500/5 border-purple-500/20 shadow-[0_0_20px_rgba(168,85,247,0.08)]'
  }
  const textColors: Record<string, string> = {
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    amber: 'text-amber-400',
    purple: 'text-purple-400'
  }
  return (
    <div
      className={cn(
        'rounded-2xl bg-gradient-to-br border p-5 relative overflow-hidden transition-transform hover:scale-[1.02]',
        colors[accent]
      )}
    >
      <div className="absolute -right-4 -top-4 text-4xl opacity-15">{icon}</div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
        {label}
      </p>
      <p className={cn('text-2xl font-bold', textColors[accent])}>{value}</p>
    </div>
  )
}
