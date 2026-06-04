import { useState } from 'react'
import type { AppData } from '@shared/schema'
import { formatCurrency, getMonthName, cn } from '../../lib/utils'
import { useTheme } from '../../hooks/useTheme'

interface Props {
  appData: AppData
  selectedYear: string
  selectedMonth: string
  onSelectYear: (y: string) => void
  onSelectMonth: (m: string) => void
  view: 'expenses' | 'dashboard' | 'settings'
  onViewChange: (v: 'expenses' | 'dashboard' | 'settings') => void
}

export default function Sidebar({
  appData,
  selectedYear,
  selectedMonth,
  onSelectYear,
  onSelectMonth,
  view,
  onViewChange
}: Props) {
  const years = Object.keys(appData.years).sort((a, b) => Number(b) - Number(a))
  const { theme, toggleTheme } = useTheme()

  return (
    <aside className="flex w-56 flex-shrink-0 flex-col border-r border-white/5 bg-background/50 backdrop-blur-xl">
      {/* Header */}
      <div className="px-5 py-6 border-b border-white/5 relative overflow-hidden drag-region">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-50" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.15)]">
              <span className="text-xl">✨</span>
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground tracking-tight">Finanças</h1>
              <p className="text-xs font-medium text-muted-foreground mt-0.5">
                {appData.users.length} participante{appData.users.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground transition-colors no-drag-region"
            title="Alternar tema"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </div>

      {/* Dashboard button */}
      <div className="px-3 pt-3 no-drag-region">
        <button
          onClick={() => onViewChange('dashboard')}
          className={cn(
            'w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200',
            view === 'dashboard'
              ? 'bg-primary/15 text-primary border border-primary/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
              : 'text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent'
          )}
        >
          <span className="text-base">📊</span>
          <span>Dashboard</span>
        </button>
      </div>

      {/* Year/Month selector */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-1">
        {years.map((year) => (
          <YearGroup
            key={year}
            year={year}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            appData={appData}
            onSelectYear={onSelectYear}
            onSelectMonth={onSelectMonth}
            view={view}
            onViewChange={onViewChange}
          />
        ))}
      </nav>

      {/* Users list */}
      <div className="border-t border-white/5 px-5 py-4 bg-white/[0.01]">
        <p className="text-[10px] font-bold text-muted-foreground/80 mb-3 uppercase tracking-widest">
          Participantes
        </p>
        <div className="space-y-1.5">
          {appData.users.slice(0, 5).map((user) => (
            <div key={user.id} className="flex items-center gap-3">
              <div
                className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm border"
                style={{
                  backgroundColor: user.color ? `${user.color}20` : 'rgba(16,185,129,0.2)',
                  borderColor: user.color ? `${user.color}30` : 'rgba(16,185,129,0.1)',
                  color: user.color || 'var(--primary)'
                }}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span
                className="text-sm font-semibold truncate"
                style={user.color ? { color: user.color } : undefined}
              >
                {user.name}
              </span>
            </div>
          ))}
          {appData.users.length > 5 && (
            <p className="text-xs text-muted-foreground mt-2 pl-9 font-medium">
              +{appData.users.length - 5} mais
            </p>
          )}
        </div>
      </div>

      {/* Settings button */}
      <div className="border-t border-white/5 px-3 py-3 no-drag-region">
        <button
          onClick={() => onViewChange('settings')}
          className={cn(
            'w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200',
            view === 'settings'
              ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.1)]'
              : 'text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent'
          )}
        >
          <span className="text-base">⚙️</span>
          <span>Configurações</span>
        </button>
      </div>
    </aside>
  )
}

function YearGroup({
  year,
  selectedYear,
  selectedMonth,
  appData,
  onSelectYear,
  onSelectMonth,
  view,
  onViewChange
}: Props & { year: string }) {
  const [open, setOpen] = useState(year === selectedYear)
  const months = Object.keys(appData.years[year] ?? {}).sort()

  const totalAmountForYear = months.reduce((sum, m) => {
    const monthExpenses = appData.years[year]?.[m]?.expenses ?? []
    const monthTotal = monthExpenses
      .filter((e) => !e.debtToUserId)
      .reduce((mSum, e) => mSum + e.amount, 0)
    return sum + monthTotal
  }, 0)

  return (
    <div>
      <button
        id={`year-${year}`}
        className={cn(
          'w-full flex items-center justify-between px-4 py-2 text-sm font-semibold transition-colors',
          selectedYear === year && view === 'expenses'
            ? 'text-primary'
            : 'text-muted-foreground hover:text-foreground'
        )}
        onClick={() => {
          setOpen(!open)
          onSelectYear(year)
          if (!open && months.length > 0) {
            onSelectMonth(months[0])
          }
        }}
      >
        <span>{year}</span>
        <span className="flex items-center gap-1">
          {totalAmountForYear > 0 && (
            <span className="text-xs bg-primary/20 text-primary rounded-full px-2 py-0.5 whitespace-nowrap">
              {formatCurrency(totalAmountForYear)}
            </span>
          )}
          <span className="text-xs">{open ? '▾' : '▸'}</span>
        </span>
      </button>

      {open && (
        <div className="pb-1">
          {months.map((month) => {
            const expenses = appData.years[year]?.[month]?.expenses ?? []
            const totalAmount = expenses
              .filter((e) => !e.debtToUserId)
              .reduce((sum, e) => sum + e.amount, 0)
            const isSelected =
              selectedYear === year && selectedMonth === month && view === 'expenses'
            return (
              <button
                key={month}
                id={`month-${year}-${month}`}
                onClick={() => {
                  onSelectYear(year)
                  onSelectMonth(month)
                  onViewChange('expenses')
                }}
                className={cn(
                  'w-full flex items-center justify-between px-6 py-1.5 text-xs transition-all duration-150',
                  isSelected
                    ? 'bg-primary/15 text-primary font-medium border-r-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                <span>{getMonthName(month)}</span>
                {totalAmount > 0 && (
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 whitespace-nowrap',
                      isSelected ? 'bg-primary/30 text-primary' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {formatCurrency(totalAmount)}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
