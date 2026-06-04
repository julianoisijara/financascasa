import { useState } from 'react'
import { cn } from '../../lib/utils'

const COLOR_PRESETS = [
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#8b5cf6', // Purple
  '#f43f5e', // Rose
  '#f97316', // Orange
  '#06b6d4', // Teal
  '#f59e0b', // Amber
  '#ef4444' // Red
]

interface Props {
  onComplete: (userName: string, year: string, color?: string) => Promise<void>
  isLoading: boolean
}

export default function OnboardingScreen({ onComplete, isLoading }: Props) {
  const [userName, setUserName] = useState('')
  const [selectedColor, setSelectedColor] = useState(COLOR_PRESETS[0])
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!userName.trim()) return setError('Por favor, insira o seu nome.')
    const y = parseInt(year, 10)
    if (isNaN(y) || y < 2000 || y > 2100) return setError('Ano inválido.')
    await onComplete(userName.trim(), String(y), selectedColor)
  }

  return (
    <div className="flex h-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-md animate-slide-in">
        {/* Logo / Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20 text-3xl">
            💰
          </div>
          <h1 className="text-2xl font-bold text-foreground">Bem-vindo ao Finanças</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Controle financeiro compartilhado, sem complicação.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="card p-6 space-y-5">
          <div>
            <label className="label" htmlFor="userName">
              O seu nome
            </label>
            <input
              id="userName"
              className="input-field"
              type="text"
              placeholder="Ex: Juliano"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              autoFocus
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="label">A sua cor</label>
            <div className="flex flex-wrap gap-2 items-center pt-1">
              {COLOR_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={cn(
                    'h-7 w-7 rounded-full border-2 transition-all transform hover:scale-110 shadow-sm',
                    selectedColor === color
                      ? 'border-foreground scale-110 ring-2 ring-primary/20'
                      : 'border-transparent'
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => setSelectedColor(color)}
                  disabled={isLoading}
                  title="Escolher cor pré-definida"
                />
              ))}
              <label
                className={cn(
                  'h-7 w-7 rounded-full border-2 transition-all transform hover:scale-110 cursor-pointer flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-red-500 via-green-500 to-blue-500 shadow-sm',
                  !COLOR_PRESETS.includes(selectedColor)
                    ? 'border-foreground scale-110 ring-2 ring-primary/20'
                    : 'border-transparent'
                )}
                title="Escolher cor personalizada"
              >
                <span className="text-[8px] text-white font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                  Personalizar
                </span>
                <input
                  type="color"
                  value={COLOR_PRESETS.includes(selectedColor) ? '#3b82f6' : selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  disabled={isLoading}
                />
              </label>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="year">
              Ano inicial
            </label>
            <input
              id="year"
              className="input-field"
              type="number"
              placeholder={String(new Date().getFullYear())}
              value={year}
              onChange={(e) => setYear(e.target.value)}
              min={2000}
              max={2100}
              disabled={isLoading}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Os 12 meses serão criados automaticamente.
            </p>
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <button id="btn-start" type="submit" className="btn-primary w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <span className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                A guardar...
              </>
            ) : (
              'Começar →'
            )}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Os dados são guardados de forma privada no seu Google Drive.
        </p>
      </div>
    </div>
  )
}
