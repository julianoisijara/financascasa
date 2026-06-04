import { useState } from 'react'
import type { AppData } from '@shared/schema'
import { useAddUser } from '../../hooks/useFinanceData'
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
  open: boolean
  onClose: () => void
  appData: AppData
}

export default function AddUserModal({ open, onClose, appData }: Props) {
  const [name, setName] = useState('')
  const [selectedColor, setSelectedColor] = useState(COLOR_PRESETS[0])
  const [error, setError] = useState('')
  const addUser = useAddUser()

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) return setError('Insira um nome.')
    if (appData.users.some((u) => u.name.toLowerCase() === name.trim().toLowerCase())) {
      return setError('Já existe um utilizador com este nome.')
    }
    await addUser.mutateAsync({ name: name.trim(), color: selectedColor })
    setName('')
    setSelectedColor(COLOR_PRESETS[0])
    onClose()
  }

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
          <h2 className="text-base font-semibold">Adicionar Utilizador</h2>
          <button
            id="modal-add-user-close"
            className="btn-ghost p-1 text-muted-foreground"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Current users */}
        {appData.users.length > 0 && (
          <div className="space-y-1">
            <p className="label">Participantes actuais</p>
            <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
              {appData.users.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted text-sm"
                >
                  <div
                    className="h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold shadow-sm border"
                    style={{
                      backgroundColor: u.color ? `${u.color}20` : 'rgba(16,185,129,0.2)',
                      borderColor: u.color ? `${u.color}30` : 'rgba(16,185,129,0.1)',
                      color: u.color || 'var(--primary)'
                    }}
                  >
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-semibold" style={{ color: u.color }}>
                    {u.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="new-user-name">
              Nome do novo participante
            </label>
            <input
              id="new-user-name"
              className="input-field"
              type="text"
              placeholder="Ex: Maria"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              disabled={addUser.isPending}
            />
          </div>

          <div>
            <label className="label">Cor do participante</label>
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
                  disabled={addUser.isPending}
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
                  disabled={addUser.isPending}
                />
              </label>
            </div>
          </div>

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <button type="button" className="btn-secondary flex-1" onClick={onClose}>
              Cancelar
            </button>
            <button
              id="btn-confirm-add-user"
              type="submit"
              className="btn-primary flex-1"
              disabled={addUser.isPending}
            >
              {addUser.isPending ? 'A adicionar...' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
