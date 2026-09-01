export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(cents / 100)
}

export function parseCurrencyInput(value: string): number {
  // Remove everything except digits and comma
  const cleaned = value.replace(/[^\d,]/g, '').replace(',', '.')
  const float = parseFloat(cleaned)
  if (isNaN(float)) return 0
  return Math.round(float * 100)
}

export function maskCurrencyInput(value: string): string {
  // Keep only digits
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  const number = parseInt(digits, 10) / 100
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(number)
}

export function formatShortDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

export const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro'
]

export function getMonthName(month: string): string {
  const idx = parseInt(month, 10) - 1
  return MONTH_NAMES[idx] ?? month
}

export function generateYearData(): Record<string, { expenses: [] }> {
  const months: Record<string, { expenses: [] }> = {}
  for (let m = 1; m <= 12; m++) {
    months[String(m).padStart(2, '0')] = { expenses: [] }
  }
  return months
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
