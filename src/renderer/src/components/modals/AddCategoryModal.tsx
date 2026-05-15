import { useState } from 'react'
import { useAddCategory } from '../../hooks/useFinanceData'

interface Props {
  onClose: () => void
  onSuccess: (categoryId: string) => void
}

export default function AddCategoryModal({ onClose, onSuccess }: Props) {
  const [name, setName] = useState('')
  const addCategory = useAddCategory()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    const updated = await addCategory.mutateAsync(name.trim())
    const newCat = updated.categories?.find(c => c.name === name.trim())
    if (newCat) {
      onSuccess(newCat.id)
    }
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs mx-4 card p-6 space-y-5 animate-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">Nova Categoria</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Nome da Categoria</label>
            <input
              autoFocus
              className="input-field"
              placeholder="Ex: Alimentação, Lazer..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={addCategory.isPending}
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary flex-1"
              onClick={onClose}
              disabled={addCategory.isPending}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={addCategory.isPending || !name.trim()}
            >
              {addCategory.isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
