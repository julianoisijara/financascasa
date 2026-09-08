import { useState, useEffect, useRef } from 'react'
import type { AppData, User } from '@shared/schema'
import { useEditUser } from '../../hooks/useFinanceData'
import { cn, isPhotoAvatar } from '../../lib/utils'
import {
  cropImageToDataUrl,
  loadImageSource,
  readFileAsDataUrl,
  type CropRect,
  type CropSource
} from '../../lib/image'
import UserAvatar from '../ui/UserAvatar'
import ImageCropper from '../ui/ImageCropper'

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

const EMOJI_PRESETS = [
  '😀',
  '😎',
  '🥰',
  '🤓',
  '🦊',
  '🐱',
  '🐶',
  '🐼',
  '🦁',
  '🐨',
  '🌟',
  '🔥',
  '🌺',
  '🍀',
  '⚽',
  '🎸',
  '🚀',
  '💎',
  '👑',
  '🍕'
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
  const [avatar, setAvatar] = useState(user.avatar || '')
  // Foto escolhida à espera de enquadramento; enquanto existe, o modal mostra o recorte
  const [cropSource, setCropSource] = useState<CropSource | null>(null)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const editUser = useEditUser()

  useEffect(() => {
    if (open) {
      setName(user.name)
      setSelectedColor(user.color || COLOR_PRESETS[0])
      setAvatar(user.avatar || '')
      setCropSource(null)
      setError('')
    }
  }, [open, user])

  if (!open) return null

  const handlePickPhoto = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    e.target.value = '' // permite reescolher o mesmo arquivo
    if (!file) return
    if (!file.type.startsWith('image/')) {
      return setError('Escolha um arquivo de imagem.')
    }
    try {
      setError('')
      setCropSource(await loadImageSource(await readFileAsDataUrl(file)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar a imagem.')
    }
  }

  /** Reabre o recorte usando a foto já guardada */
  const handleAdjustPhoto = async (): Promise<void> => {
    if (!isPhotoAvatar(avatar)) return
    try {
      setError('')
      setCropSource(await loadImageSource(avatar))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar a imagem.')
    }
  }

  const handleCropConfirm = async (rect: CropRect): Promise<void> => {
    if (!cropSource) return
    try {
      setAvatar(await cropImageToDataUrl(cropSource.src, rect))
      setCropSource(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível processar a imagem.')
    }
  }

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
      color: selectedColor,
      avatar: avatar || undefined
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm mx-4 card p-6 space-y-4 animate-slide-in max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">
            {cropSource ? 'Enquadrar Foto' : 'Editar Participante'}
          </h2>
          <button
            id="modal-edit-user-close"
            className="btn-ghost p-1 text-muted-foreground"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {cropSource && (
          <>
            <ImageCropper
              source={cropSource}
              onCancel={() => setCropSource(null)}
              onConfirm={handleCropConfirm}
            />
            {error && (
              <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">
                {error}
              </p>
            )}
          </>
        )}

        <form onSubmit={handleSubmit} className={cn('space-y-4', cropSource && 'hidden')}>
          {/* Pré-visualização + foto de perfil */}
          <div className="flex items-center gap-4">
            <UserAvatar
              name={name || user.name}
              avatar={avatar}
              color={selectedColor}
              size={64}
              className="shadow-sm"
            />
            <div className="flex-1 min-w-0 space-y-1.5">
              <label className="label">Exibição</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-secondary text-xs px-3 py-1.5"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={editUser.isPending}
                >
                  {isPhotoAvatar(avatar) ? 'Trocar foto' : 'Carregar foto'}
                </button>
                {isPhotoAvatar(avatar) && (
                  <button
                    type="button"
                    className="btn-secondary text-xs px-3 py-1.5"
                    onClick={handleAdjustPhoto}
                    disabled={editUser.isPending}
                  >
                    Enquadrar
                  </button>
                )}
                {avatar && (
                  <button
                    type="button"
                    className="btn-ghost text-xs px-3 py-1.5 text-muted-foreground"
                    onClick={() => setAvatar('')}
                    disabled={editUser.isPending}
                  >
                    Remover
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePickPhoto}
                disabled={editUser.isPending}
              />
            </div>
          </div>

          {/* Emojis */}
          <div>
            <label className="label">Ou escolha um emoji</label>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {EMOJI_PRESETS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className={cn(
                    'h-8 w-8 rounded-lg text-base leading-none flex items-center justify-center border transition-all hover:scale-110 hover:bg-white/5',
                    avatar === emoji
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                      : 'border-white/10'
                  )}
                  onClick={() => setAvatar(avatar === emoji ? '' : emoji)}
                  disabled={editUser.isPending}
                  title={`Usar ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <input
              className="input-field mt-2 text-center text-base"
              type="text"
              maxLength={4}
              placeholder="Ou cole aqui outro emoji"
              value={isPhotoAvatar(avatar) ? '' : avatar}
              onChange={(e) => setAvatar(e.target.value.trim())}
              disabled={editUser.isPending || isPhotoAvatar(avatar)}
            />
          </div>

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
