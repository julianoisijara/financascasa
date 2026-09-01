import { useState } from 'react'
import type { AppData, User } from '@shared/schema'
import { formatCurrency, getMonthName, cn } from '../../lib/utils'
import { useTheme } from '../../hooks/useTheme'
import { useResizableColumn } from '../../hooks/useResizableColumn'

interface Props {
  appData: AppData
  selectedYear: string
  selectedMonth: string
  onSelectYear: (y: string) => void
  onSelectMonth: (m: string) => void
  view: 'expenses' | 'dashboard' | 'settings'
  onViewChange: (v: 'expenses' | 'dashboard' | 'settings') => void
  onEditUser?: (user: User) => void
  onManageUsers?: () => void
}

const COLLAPSED_KEY = 'sidebar-collapsed'
const WIDTH_KEY = 'sidebar-width'
const DEFAULT_WIDTH = 224
const MIN_WIDTH = 180
const MAX_WIDTH = 420
const COLLAPSED_WIDTH = 48

export default function Sidebar({
  appData,
  selectedYear,
  selectedMonth,
  onSelectYear,
  onSelectMonth,
  view,
  onViewChange,
  onEditUser,
  onManageUsers
}: Props) {
  const years = Object.keys(appData.years).sort((a, b) => Number(b) - Number(a))
  const { theme, toggleTheme } = useTheme()
  // Coluna recolhida para a esquerda (persistida entre sessões)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === '1')

  const { width, isResizing, startResize, resetWidth } = useResizableColumn({
    storageKey: WIDTH_KEY,
    defaultWidth: DEFAULT_WIDTH,
    minWidth: MIN_WIDTH,
    maxWidth: MAX_WIDTH,
    edge: 'left'
  })

  const toggleCollapsed = (): void => {
    setCollapsed((prev) => {
      localStorage.setItem(COLLAPSED_KEY, prev ? '0' : '1')
      return !prev
    })
  }

  return (
    <aside
      className={cn(
        'flex flex-shrink-0 flex-col border-r border-white/5 bg-background/50 backdrop-blur-xl relative overflow-hidden',
        !isResizing && 'transition-[width] duration-300 ease-out'
      )}
      style={{ width: collapsed ? COLLAPSED_WIDTH : width }}
    >
      {/* Faixa vertical exibida quando a coluna está recolhida */}
      {collapsed && (
        <>
          {/* Área livre no topo para os controles da janela / arrastar */}
          <div className="absolute inset-x-0 top-0 h-10 drag-region" />
          <button
            type="button"
            onClick={toggleCollapsed}
            title="Expandir menu"
            aria-label="Expandir menu"
            className="group absolute inset-x-0 bottom-0 top-10 flex flex-col items-center gap-4 pt-4 cursor-pointer hover:bg-white/[0.03] transition-colors no-drag-region"
          >
            <svg
              className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary transition-colors"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors [writing-mode:vertical-rl]">
              Finanças
            </span>
          </button>
        </>
      )}

      {/* Conteúdo com largura fixa para não reposicionar durante a animação */}
      <div
        className={cn('flex min-h-0 flex-1 flex-col', collapsed && 'invisible pointer-events-none')}
        style={{ width }}
      >
        {/* Header */}
        <div className="px-5 py-6 border-b border-white/5 relative overflow-hidden drag-region">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-50" />
          <div className="relative flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                {/* Ícone de dinheiro (cifrão) */}
                <svg
                  className="h-[22px] w-[22px] text-primary"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="9" fill="currentColor" fillOpacity="0.1" />
                  <path d="M12 6.4v11.2" />
                  <path d="M14.9 9.3c-.6-.9-1.7-1.4-2.9-1.4-1.7 0-3 .9-3 2.2 0 3 6 1.7 6 4.7 0 1.3-1.3 2.2-3.1 2.2-1.3 0-2.4-.5-3-1.4" />
                </svg>
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-bold text-foreground tracking-tight truncate">
                  Finanças
                </h1>
                <p className="text-xs font-medium text-muted-foreground mt-0.5 truncate">
                  {appData.users.length} participante{appData.users.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <button
              onClick={toggleTheme}
              className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground transition-colors cursor-pointer no-drag-region"
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
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest">
              Participantes
            </p>
            {onManageUsers && (
              <button
                onClick={onManageUsers}
                className="text-[10px] font-bold text-primary hover:text-primary-hover transition-colors uppercase tracking-wider cursor-pointer"
                title="Gerenciar participantes"
              >
                Gerenciar
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            {appData.users.slice(0, 5).map((user) => {
              const hasChangedName = user.originalName && user.originalName !== user.name
              return (
                <button
                  key={user.id}
                  onClick={() => onEditUser?.(user)}
                  className="w-full flex items-center gap-3 text-left hover:bg-white/5 p-1.5 rounded-lg transition-all group cursor-pointer border border-transparent hover:border-white/5"
                  title="Clique para editar participante"
                >
                  <div
                    className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm border flex-shrink-0"
                    style={{
                      backgroundColor: user.color ? `${user.color}20` : 'rgba(16,185,129,0.2)',
                      borderColor: user.color ? `${user.color}30` : 'rgba(16,185,129,0.1)',
                      color: user.color || 'var(--primary)'
                    }}
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <span
                      className="text-sm font-semibold truncate group-hover:text-primary transition-colors"
                      style={user.color ? { color: user.color } : undefined}
                    >
                      {user.name}
                    </span>
                    {hasChangedName && (
                      <span className="text-[9px] text-muted-foreground/60 truncate mt-0.5 font-medium leading-none">
                        nome de criação: {user.originalName}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
            {appData.users.length > 5 && (
              <button
                onClick={onManageUsers}
                className="w-full text-xs text-left text-muted-foreground hover:text-primary transition-colors mt-2 pl-9 font-medium cursor-pointer"
              >
                +{appData.users.length - 5} mais
              </button>
            )}
          </div>
        </div>

        {/* Settings button */}
        <div className="border-t border-white/5 px-3 py-3 no-drag-region flex items-center gap-1">
          <button
            onClick={() => onViewChange('settings')}
            className={cn(
              'flex-1 min-w-0 flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200',
              view === 'settings'
                ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.1)]'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent'
            )}
          >
            <span className="text-base">⚙️</span>
            <span className="truncate">Configurações</span>
          </button>
          <button
            onClick={toggleCollapsed}
            title="Recolher para a esquerda"
            aria-label="Recolher para a esquerda"
            className="h-9 w-9 shrink-0 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent transition-colors cursor-pointer"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Alça de redimensionamento (duplo clique volta à largura padrão) */}
      {!collapsed && (
        <div
          onPointerDown={startResize}
          onDoubleClick={resetWidth}
          role="separator"
          aria-orientation="vertical"
          aria-label="Redimensionar menu"
          title="Arraste para redimensionar (duplo clique restaura)"
          className={cn(
            'absolute inset-y-0 right-0 z-20 w-1.5 cursor-col-resize no-drag-region',
            'after:absolute after:inset-y-0 after:right-0 after:w-0.5 after:bg-primary/60 after:opacity-0 after:transition-opacity hover:after:opacity-100',
            isResizing && 'after:opacity-100'
          )}
        />
      )}
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
