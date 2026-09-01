import type { ReactElement } from 'react'
import { formatCurrency, cn } from '../../lib/utils'

export type ViewMode = 'lista' | 'cartoes' | 'agrupada'

// Linha normalizada de despesa — as três visualizações consomem esse mesmo formato
export interface ExpenseRow {
  id: string
  title: string
  description: string
  amount: number
  date: string
  payerName: string
  payerColor?: string
  payerInitial: string
  isExtra: boolean
  debtorName?: string
  debtorColor?: string
  groupKey: string
}

export interface ExpenseGroup {
  key: string
  title: string
  rows: ExpenseRow[]
  total: number
  pct: number | null // null = fora do rateio (Valor Extra)
  isExtra: boolean
}

interface ViewProps {
  rows: ExpenseRow[]
  onSelect: (id: string) => void
}

/* ---------------------------------- Ícones --------------------------------- */

function ListaIcon(): ReactElement {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="4.6" cy="6" r="1.35" fill="currentColor" stroke="none" />
      <circle cx="4.6" cy="12" r="1.35" fill="currentColor" stroke="none" />
      <circle cx="4.6" cy="18" r="1.35" fill="currentColor" stroke="none" />
      <path d="M9.4 6h10M9.4 12h10M9.4 18h10" />
    </svg>
  )
}

function CartoesIcon(): ReactElement {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <rect x="3.4" y="3.4" width="7.6" height="7.6" rx="2.1" />
      <rect x="13" y="3.4" width="7.6" height="7.6" rx="2.1" />
      <rect x="3.4" y="13" width="7.6" height="7.6" rx="2.1" />
      <rect x="13" y="13" width="7.6" height="7.6" rx="2.1" />
    </svg>
  )
}

function AgrupadaIcon(): ReactElement {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4.2 4.6v14.8" />
      <path d="M8 8h11.6M8 12h8.2M8 16h4.8" />
    </svg>
  )
}

function BoltIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M13 2 4.5 13.2h6L11 22l8.5-11.2h-6L13 2z" />
    </svg>
  )
}

/* ------------------------------ Seletor de modo ----------------------------- */

const VIEW_OPTIONS: { mode: ViewMode; label: string; icon: ReactElement }[] = [
  { mode: 'lista', label: 'Lista compacta', icon: <ListaIcon /> },
  { mode: 'cartoes', label: 'Cartões', icon: <CartoesIcon /> },
  { mode: 'agrupada', label: 'Agrupada por categoria', icon: <AgrupadaIcon /> }
]

export function ViewModeSwitch({
  value,
  onChange
}: {
  value: ViewMode
  onChange: (mode: ViewMode) => void
}): ReactElement {
  return (
    <div
      role="group"
      aria-label="Modo de visualização"
      className="flex-none flex gap-0.5 p-[3px] bg-black/5 dark:bg-white/5 border border-border rounded-[11px]"
    >
      {VIEW_OPTIONS.map((opt) => {
        const active = value === opt.mode
        return (
          <button
            key={opt.mode}
            type="button"
            onClick={() => onChange(opt.mode)}
            title={opt.label}
            aria-label={opt.label}
            aria-pressed={active}
            className={cn(
              'w-8 h-7 flex items-center justify-center rounded-lg transition-all duration-200',
              active
                ? 'bg-white dark:bg-white/10 text-primary shadow-[0_1px_2px_rgba(23,26,38,0.10)] ring-1 ring-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-white/[0.07]'
            )}
          >
            {opt.icon}
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------- Peças comuns ------------------------------- */

function Avatar({
  row,
  size,
  font
}: {
  row: ExpenseRow
  size: number
  font: number
}): ReactElement {
  const color = row.payerColor
  return (
    <div
      className="flex-none rounded-full border flex items-center justify-center font-bold leading-none"
      style={{
        width: size,
        height: size,
        fontSize: font,
        backgroundColor: color ? `${color}1F` : 'hsl(var(--primary) / 0.12)',
        borderColor: color ? `${color}33` : 'hsl(var(--primary) / 0.2)',
        color: color ?? 'hsl(var(--primary))'
      }}
      title={row.payerName}
    >
      {row.payerInitial}
    </div>
  )
}

function ExtraChip(): ReactElement {
  return (
    <span className="flex-none inline-flex items-center gap-[3px] text-[8.5px] font-bold tracking-[0.09em] leading-none text-amber-700 dark:text-amber-300 bg-amber-500/15 dark:bg-amber-500/20 px-1.5 py-[3px] rounded-full border border-amber-500/30">
      <BoltIcon className="w-[9px] h-[9px]" />
      VALOR EXTRA
    </span>
  )
}

function DebtLine({ row }: { row: ExpenseRow }): ReactElement {
  return (
    <span className="text-amber-700/90 dark:text-amber-300/90">
      <strong style={{ color: row.debtorColor }}>{row.debtorName}</strong> deve a{' '}
      <strong style={{ color: row.payerColor }}>{row.payerName}</strong>
    </span>
  )
}

/* --------------------------- 1. Lista compacta ------------------------------ */

export function ExpenseListaView({ rows, onSelect }: ViewProps): ReactElement {
  return (
    <div className="card overflow-hidden animate-fade-in">
      {rows.map((row) => (
        <button
          key={row.id}
          id={`expense-${row.id}`}
          onClick={() => onSelect(row.id)}
          className={cn(
            'relative w-full text-left grid grid-cols-[26px_1fr_auto] gap-3 items-center',
            'pl-[18px] pr-4 py-2.5 border-t border-border first:border-t-0 transition-colors',
            row.isExtra ? 'bg-amber-500/[0.06] hover:bg-amber-500/[0.11]' : 'hover:bg-primary/5'
          )}
        >
          <span
            className={cn(
              'absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-[3px] opacity-85',
              row.isExtra && 'bg-amber-600 dark:bg-amber-300'
            )}
            style={row.isExtra ? undefined : { backgroundColor: row.payerColor }}
          />
          <Avatar row={row} size={26} font={11} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className={cn(
                  'text-sm font-semibold truncate',
                  row.isExtra && 'text-amber-700 dark:text-amber-300'
                )}
              >
                {row.title}
              </span>
              {row.isExtra && <ExtraChip />}
            </div>
            <div className="text-[11.5px] text-muted-foreground truncate mt-0.5 leading-[1.35]">
              {row.isExtra && (
                <>
                  <DebtLine row={row} />
                  <span className="mx-[5px] opacity-45">·</span>
                </>
              )}
              {row.description}
            </div>
          </div>
          <div className="text-right">
            <div
              className={cn(
                'text-[15px] font-bold tabular-nums tracking-[-0.01em]',
                row.isExtra ? 'text-amber-700 dark:text-amber-300' : 'text-primary'
              )}
            >
              {formatCurrency(row.amount)}
            </div>
            <div className="text-[10.5px] text-muted-foreground/80 tabular-nums mt-px">
              {row.date}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}

/* ------------------------------- 2. Cartões --------------------------------- */

export function ExpenseCartoesView({ rows, onSelect }: ViewProps): ReactElement {
  return (
    <div className="grid grid-cols-2 gap-3 animate-fade-in">
      {rows.map((row) => (
        <button
          key={row.id}
          id={`expense-${row.id}`}
          onClick={() => onSelect(row.id)}
          className={cn(
            'card text-left p-3.5 flex flex-col gap-1.5 transition-all duration-300 hover:-translate-y-0.5',
            row.isExtra
              ? 'border-amber-500/30 bg-amber-500/[0.06] hover:border-amber-400/50'
              : 'hover:border-primary/35'
          )}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={cn(
                'text-sm font-semibold truncate',
                row.isExtra && 'text-amber-700 dark:text-amber-300'
              )}
            >
              {row.title}
            </span>
            {row.isExtra && <ExtraChip />}
          </div>
          <p className="text-[11.5px] text-muted-foreground leading-[1.4] min-h-[32px] line-clamp-2">
            {row.isExtra && (
              <>
                <DebtLine row={row} />
                <span className="mx-[5px] opacity-45">·</span>
              </>
            )}
            {row.description}
          </p>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <div className="flex items-center gap-[7px] min-w-0">
              <Avatar row={row} size={22} font={10} />
              <span
                className="text-[11.5px] font-semibold truncate"
                style={{ color: row.payerColor }}
              >
                {row.payerName}
              </span>
            </div>
            <span
              className={cn(
                'flex-none text-base font-bold tabular-nums tracking-[-0.015em]',
                row.isExtra ? 'text-amber-700 dark:text-amber-300' : 'text-primary'
              )}
            >
              {formatCurrency(row.amount)}
            </span>
          </div>
        </button>
      ))}
    </div>
  )
}

/* -------------------- 3. Agrupada por categoria ----------------------------- */

export function ExpenseAgrupadaView({
  groups,
  onSelect
}: {
  groups: ExpenseGroup[]
  onSelect: (id: string) => void
}): ReactElement {
  return (
    <div className="flex flex-col gap-3.5 animate-fade-in">
      {groups.map((group) => (
        <div
          key={group.key}
          className={cn(
            'card px-[15px] pt-[13px] pb-2',
            group.isExtra && 'border-amber-500/30 bg-amber-500/[0.06]'
          )}
        >
          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                'text-[13.5px] font-semibold',
                group.isExtra && 'text-amber-700 dark:text-amber-300 inline-flex items-center gap-1'
              )}
            >
              {group.isExtra && <BoltIcon className="w-[10px] h-[10px]" />}
              {group.title}
            </span>
            <span className="flex-none text-[10.5px] text-muted-foreground bg-muted-foreground/10 px-[7px] py-px rounded-full font-medium">
              {group.rows.length} {group.rows.length === 1 ? 'item' : 'itens'}
            </span>
            <span
              className={cn(
                'ml-auto text-[14.5px] font-bold tabular-nums tracking-[-0.01em]',
                group.isExtra ? 'text-amber-700 dark:text-amber-300' : 'text-primary'
              )}
            >
              {formatCurrency(group.total)}
            </span>
          </div>

          <div className="h-1 rounded-full bg-muted-foreground/[0.12] mt-[9px] overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full',
                group.isExtra ? 'bg-amber-600/55 dark:bg-amber-300/55' : 'bg-primary/85'
              )}
              style={{ width: `${group.pct ?? 100}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-[5px] tracking-[0.02em]">
            {group.pct !== null
              ? `${group.pct.toFixed(1).replace('.', ',')}% do total do mês`
              : 'fora do rateio'}
          </p>

          <div className="mt-2 border-t border-border pt-0.5">
            {group.rows.map((row) => (
              <button
                key={row.id}
                id={`expense-${row.id}`}
                onClick={() => onSelect(row.id)}
                className="w-full text-left grid grid-cols-[20px_1fr_auto_auto] gap-[9px] items-center py-[7px] rounded-md transition-colors hover:bg-primary/5"
              >
                <Avatar row={row} size={20} font={9} />
                <span className="text-xs text-foreground/85 truncate">
                  {row.description || row.title}
                </span>
                <span className="text-[10.5px] text-muted-foreground/80 tabular-nums">
                  {row.date}
                </span>
                <span
                  className={cn(
                    'text-[12.5px] font-semibold tabular-nums text-right min-w-[74px]',
                    group.isExtra ? 'text-amber-700 dark:text-amber-300' : 'text-foreground/90'
                  )}
                >
                  {formatCurrency(row.amount)}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
