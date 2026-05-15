import { useState } from 'react'
import type { AppData } from '@shared/schema'
import { useAddUser } from '../../hooks/useFinanceData'

interface Props {
  open: boolean
  onClose: () => void
  appData: AppData
}

export default function AddUserModal({ open, onClose, appData }: Props) {
  const [name, setName] = useState('')
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
    await addUser.mutateAsync(name.trim())
    setName('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-sm mx-4 card p-6 space-y-4 animate-slide-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Adicionar Utilizador</h2>
          <button id="modal-add-user-close" className="btn-ghost p-1 text-muted-foreground" onClick={onClose}>✕</button>
        </div>

        {/* Current users */}
        {appData.users.length > 0 && (
          <div className="space-y-1">
            <p className="label">Participantes actuais</p>
            {appData.users.map((u) => (
              <div key={u.id} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted text-sm">
                <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                  {u.name.charAt(0).toUpperCase()}
                </div>
                {u.name}
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label" htmlFor="new-user-name">Nome do novo participante</label>
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
          {error && <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>}
          <div className="flex gap-2">
            <button type="button" className="btn-secondary flex-1" onClick={onClose}>Cancelar</button>
            <button id="btn-confirm-add-user" type="submit" className="btn-primary flex-1" disabled={addUser.isPending}>
              {addUser.isPending ? 'A adicionar...' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
