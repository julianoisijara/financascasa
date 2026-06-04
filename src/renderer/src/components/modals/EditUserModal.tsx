import { useState, useEffect } from 'react'
import type { AppData, User } from '@shared/schema'
import { useEditUser } from '../../hooks/useFinanceData'
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
  user: User
  appData: AppData
}

export default function EditUserModal({ open, onClose, user, appData }: Props) {
  const [name, setName] = useState(user.name)
  const [selectedColor, setSelectedColor] = useState(user.color || COLOR_PRESETS[0])
  const [error, setError] = useState('')
  const editUser = useEditUser()

  useEffect(() => {
    if (open) {
      setName(user.name)
      setSelectedColor(user.color || COLOR_PRESETS[0])
      setError('')
    }
  }, [open, user])

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) return setError('Insira um nome.')

    // Check if name is taken by another user
    const nameTaken = appData.users.some(
      (u) => u.id !== user.id && u.name.toLowerCase() === name.trim().toLowerCase()
    )
    if (nameTaken) {
      return setError('Já existe um utilizador com este nome.')
    }

    await editUser.mutateAsync({
      userId: user.id,
      name: name.trim(),
      color: selectedColor
    })
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
          <h2 className="text-base font-semibold">Editar Participante</h2>
          <button
            id="modal-edit-user-close"
            className="btn-ghost p-1 text-muted-foreground"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="edit-user-name">
              Nome do participante
            </label>
            <input
              id="edit-user-name"
              className="input-field"
              type="text"
              placeholder="Ex: Maria"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              disabled={editUser.isPending}
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
                  disabled={editUser.isPending}
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
                  disabled={editUser.isPending}
                />
              </label>
            </div>
          </div>

          {user.originalName && user.originalName !== user.name && (
            <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 border border-white/5">
              Nome original de criação: <span className="font-semibold">{user.originalName}</span>
            </div>
          )}

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
              id="btn-confirm-edit-user"
              type="submit"
              className="btn-primary flex-1"
              disabled={editUser.isPending}
            >
              {editUser.isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
