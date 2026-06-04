import { useState } from 'react'
import type { AppData } from '@shared/schema'
import { useAddYear } from '../../hooks/useFinanceData'

interface Props {
  open: boolean
  onClose: () => void
  appData: AppData
}

export default function AddYearModal({ open, onClose, appData }: Props) {
  const [year, setYear] = useState(String(new Date().getFullYear() + 1))
  const [error, setError] = useState('')
  const addYear = useAddYear()

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const y = parseInt(year, 10)
    if (isNaN(y) || y < 2000 || y > 2100) return setError('Ano inválido.')
    try {
      await addYear.mutateAsync(String(y))
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao adicionar ano.')
    }
  }

  const existingYears = Object.keys(appData.years).sort((a, b) => Number(b) - Number(a))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm mx-4 card p-6 space-y-4 animate-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Adicionar Ano</h2>
          <button
            id="modal-add-year-close"
            className="btn-ghost p-1 text-muted-foreground"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {existingYears.length > 0 && (
          <div>
            <p className="label">Anos existentes</p>
            <div className="flex flex-wrap gap-1">
              {existingYears.map((y) => (
                <span key={y} className="text-xs bg-muted text-muted-foreground rounded px-2 py-1">
                  {y}
                </span>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label" htmlFor="new-year">
              Novo ano
            </label>
            <input
              id="new-year"
              className="input-field"
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(e) => setYear(e.target.value)}
              autoFocus
              disabled={addYear.isPending}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Os 12 meses serão criados automaticamente.
            </p>
          </div>
          {error && (
            <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button type="button" className="btn-secondary flex-1" onClick={onClose}>
              Cancelar
            </button>
            <button
              id="btn-confirm-add-year"
              type="submit"
              className="btn-primary flex-1"
              disabled={addYear.isPending}
            >
              {addYear.isPending ? 'A criar...' : 'Criar Ano'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
