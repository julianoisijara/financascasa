import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { DriveFolder } from '../../hooks/useFinanceData'

interface Props {
  onClose: () => void
  onSelect: (folder: DriveFolder, path: string) => Promise<void> | void
}

const ROOT: DriveFolder = { id: 'root', name: 'Meu Drive', kind: 'folder' }
const SHARED: DriveFolder = { id: 'shared', name: 'Compartilhados comigo', kind: 'folder' }
const LOCATIONS = [ROOT, SHARED]

// Paleta Material (Google) usada só neste diálogo
const M = {
  surface: '#ffffff',
  onSurface: '#1f1f1f',
  onSurfaceVariant: '#444746',
  icon: '#5f6368',
  outline: '#c4c7c5',
  divider: '#e3e3e3',
  hover: '#f2f2f2',
  field: '#f0f4f9',
  primary: '#0b57d0',
  selected: '#e8f0fe',
  error: '#b3261e',
  scrim: 'rgba(31, 31, 31, 0.32)'
}

const font = { fontFamily: 'Roboto, "Helvetica Neue", Arial, sans-serif' }

/**
 * Navegador de pastas do Google Drive (só Meu Drive), no estilo Material.
 * Um clique marca a pasta; a seta (ou duplo clique) abre. "Selecionar" usa a
 * pasta marcada ou, sem marcação, a pasta aberta.
 */
export default function DriveFolderPickerModal({ onClose, onSelect }: Props) {
  const queryClient = useQueryClient()
  const [trail, setTrail] = useState<DriveFolder[]>([ROOT])
  const [marked, setMarked] = useState<DriveFolder | null>(null)
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const newNameRef = useRef<HTMLInputElement>(null)

  const current = trail[trail.length - 1]

  const listQuery = useQuery({
    queryKey: ['drive-folders', current.id],
    queryFn: async () => {
      const res = await window.electronAPI.listDriveFolders(current.id)
      if (!res.success) throw new Error(res.error ?? 'Não foi possível listar as pastas.')
      return res.folders ?? []
    },
    staleTime: 30_000
  })
  const loading = listQuery.isPending
  const listError = listQuery.error instanceof Error ? listQuery.error.message : null

  const folders = useMemo(() => {
    const all = listQuery.data ?? []
    const q = search.trim().toLocaleLowerCase()
    return q ? all.filter((f) => f.name.toLocaleLowerCase().includes(q)) : all
  }, [listQuery.data, search])

  useEffect(() => {
    if (creating) newNameRef.current?.focus()
  }, [creating])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function resetView(): void {
    setMarked(null)
    setSearch('')
    setCreating(false)
    setError(null)
  }

  function open(folder: DriveFolder): void {
    setTrail((t) => [...t, folder])
    resetView()
  }

  function goTo(index: number): void {
    setTrail((t) => t.slice(0, index + 1))
    resetView()
  }

  function switchLocation(location: DriveFolder): void {
    setTrail([location])
    resetView()
  }

  function toggleMark(f: DriveFolder): void {
    setMarked((m) => (m?.id === f.id ? null : f))
  }

  async function handleCreate(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setSaving(true)
    setError(null)
    const res = await window.electronAPI.createDriveFolder(current.id, name)
    setSaving(false)
    if (res.success && res.folder) {
      setNewName('')
      setCreating(false)
      await queryClient.invalidateQueries({ queryKey: ['drive-folders', current.id] })
      setMarked(res.folder)
    } else {
      setError(res.error ?? 'Não foi possível criar a pasta.')
    }
  }

  async function handleSelect(): Promise<void> {
    const target = marked ?? current
    const path = [...trail.map((f) => f.name), ...(marked ? [marked.name] : [])].join('/')
    setSelecting(true)
    setError(null)
    try {
      await onSelect(target, path)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSelecting(false)
    }
  }

  const busy = loading || saving || selecting
  const atLocationRoot = trail.length === 1
  const isSharedLocation = trail[0].id === SHARED.id
  // A raiz "Compartilhados comigo" é virtual: não pode ser escolhida nem receber pastas.
  const canSelect = !!marked || !(isSharedLocation && atLocationRoot)
  const canCreate = !(isSharedLocation && atLocationRoot)
  const targetName = marked?.name ?? current.name
  const targetIsFile = marked?.kind === 'file'
  const shownError = error ?? listError

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center animate-fade-in"
      style={{ background: M.scrim, ...font }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="drive-picker-title"
    >
      <div
        className="w-full max-w-[600px] mx-4 flex flex-col overflow-hidden animate-slide-in"
        style={{
          background: M.surface,
          color: M.onSurface,
          borderRadius: 28,
          boxShadow: '0 8px 12px 6px rgba(0,0,0,0.15), 0 4px 4px rgba(0,0,0,0.30)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Título */}
        <div className="flex items-center gap-3" style={{ padding: '24px 16px 8px 24px' }}>
          <h1
            id="drive-picker-title"
            className="flex-1 m-0"
            style={{ fontSize: 24, lineHeight: '32px', fontWeight: 400, color: M.onSurface }}
          >
            Selecionar pasta
          </h1>
          <IconButton label="Fechar" onClick={onClose}>
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke={M.onSurfaceVariant}
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </IconButton>
        </div>

        {/* Busca */}
        <label
          className="flex items-center gap-3"
          style={{
            margin: '8px 24px 0',
            height: 44,
            padding: '0 16px',
            background: M.field,
            borderRadius: 22
          }}
        >
          <SearchIcon />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar pastas"
            className="flex-1 bg-transparent outline-none"
            style={{ fontSize: 14, lineHeight: '20px', color: M.onSurface, ...font }}
            disabled={loading}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Limpar busca"
              className="flex items-center justify-center"
              style={{ width: 28, height: 28, borderRadius: 14, color: M.onSurfaceVariant }}
            >
              ✕
            </button>
          )}
        </label>

        {/* Local: Meu Drive / Compartilhados comigo */}
        <div className="flex items-center gap-2" style={{ padding: '12px 24px 0' }}>
          {LOCATIONS.map((loc) => {
            const active = trail[0].id === loc.id
            return (
              <button
                key={loc.id}
                type="button"
                onClick={() => switchLocation(loc)}
                disabled={busy || active}
                className="flex items-center gap-2 transition-colors"
                style={{
                  height: 32,
                  padding: '0 14px 0 10px',
                  borderRadius: 8,
                  border: `1px solid ${active ? 'transparent' : M.outline}`,
                  background: active ? M.selected : 'transparent',
                  color: active ? M.primary : M.onSurfaceVariant,
                  fontSize: 14,
                  lineHeight: '20px',
                  fontWeight: 500,
                  cursor: active ? 'default' : 'pointer'
                }}
              >
                {loc.id === ROOT.id ? (
                  <DriveIcon color={active ? M.primary : M.icon} />
                ) : (
                  <PeopleIcon color={active ? M.primary : M.icon} />
                )}
                {loc.name}
              </button>
            )
          })}
        </div>

        {/* Trilha */}
        <nav
          className="flex items-center flex-wrap"
          style={{ gap: 2, padding: '12px 20px 4px' }}
          aria-label="Caminho"
        >
          {trail.map((f, i) => {
            const last = i === trail.length - 1
            return (
              <span key={f.id} className="flex items-center" style={{ gap: 2 }}>
                {i > 0 && <ChevronIcon size={18} />}
                <button
                  type="button"
                  onClick={() => goTo(i)}
                  disabled={busy || last}
                  className="flex items-center gap-2 transition-colors"
                  style={{
                    height: 32,
                    padding: '0 10px',
                    borderRadius: 16,
                    background: last ? M.hover : 'transparent',
                    fontSize: 14,
                    lineHeight: '20px',
                    fontWeight: last ? 500 : 400,
                    color: last ? M.onSurface : M.onSurfaceVariant,
                    cursor: last ? 'default' : 'pointer'
                  }}
                >
                  {i === 0 && (isSharedLocation ? <PeopleIcon /> : <DriveIcon />)}
                  {f.name}
                </button>
              </span>
            )
          })}
        </nav>

        {/* Lista */}
        <div
          className="flex flex-col overflow-y-auto"
          style={{
            height: 296,
            borderTop: `1px solid ${M.divider}`,
            borderBottom: `1px solid ${M.divider}`
          }}
        >
          {creating && (
            <form
              onSubmit={handleCreate}
              className="flex items-center gap-4"
              style={{
                height: 56,
                padding: '0 12px 0 20px',
                borderBottom: `1px solid ${M.divider}`,
                flexShrink: 0
              }}
            >
              <FolderIcon />
              <input
                ref={newNameRef}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nome da pasta"
                disabled={saving}
                className="flex-1 outline-none"
                style={{
                  height: 40,
                  padding: '0 12px',
                  border: `2px solid ${M.primary}`,
                  borderRadius: 4,
                  fontSize: 14,
                  color: M.onSurface,
                  background: M.surface,
                  ...font
                }}
              />
              <TextButton
                onClick={() => {
                  setCreating(false)
                  setNewName('')
                }}
                disabled={saving}
                small
              >
                Cancelar
              </TextButton>
              <FilledButton type="submit" disabled={saving || !newName.trim()} small>
                {saving ? 'Criando...' : 'Criar'}
              </FilledButton>
            </form>
          )}

          {loading ? (
            <div
              className="flex items-center justify-center gap-3 flex-1"
              style={{ color: M.onSurfaceVariant, fontSize: 14 }}
            >
              <span
                className="animate-spin rounded-full"
                style={{
                  width: 20,
                  height: 20,
                  border: `3px solid ${M.divider}`,
                  borderTopColor: M.primary
                }}
              />
              Carregando pastas...
            </div>
          ) : folders.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center flex-1 text-center"
              style={{ gap: 12, padding: 24 }}
            >
              <FolderIcon size={56} color={M.outline} />
              <span style={{ fontSize: 16, lineHeight: '24px', color: M.onSurface }}>
                {search
                  ? 'Nada encontrado'
                  : isSharedLocation && atLocationRoot
                    ? 'Nada foi compartilhado com você'
                    : 'Esta pasta está vazia'}
              </span>
              <span style={{ fontSize: 14, lineHeight: '20px', color: M.onSurfaceVariant }}>
                {search
                  ? 'Tente outro nome ou limpe a busca.'
                  : isSharedLocation && atLocationRoot
                    ? 'Peça a quem tem o arquivo para compartilhar a pasta ou o finance-data.json com você.'
                    : 'Você pode selecionar esta pasta ou criar uma nova dentro dela.'}
              </span>
            </div>
          ) : (
            <ul className="m-0 p-0 list-none">
              {folders.map((f) => {
                const isMarked = marked?.id === f.id
                const isFile = f.kind === 'file'
                return (
                  <li key={f.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      aria-pressed={isMarked}
                      onClick={() => toggleMark(f)}
                      onDoubleClick={() => (isFile ? toggleMark(f) : open(f))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (isFile ? toggleMark : open)(f)
                        if (e.key === ' ') {
                          e.preventDefault()
                          toggleMark(f)
                        }
                      }}
                      className="flex items-center gap-4 cursor-pointer select-none outline-none focus-visible:ring-2 transition-colors"
                      style={{
                        height: 48,
                        padding: '0 12px 0 20px',
                        background: isMarked ? M.selected : undefined
                      }}
                      onMouseEnter={(e) => {
                        if (!isMarked) e.currentTarget.style.background = M.hover
                      }}
                      onMouseLeave={(e) => {
                        if (!isMarked) e.currentTarget.style.background = ''
                      }}
                    >
                      {isFile ? <FileIcon /> : <FolderIcon />}
                      <span
                        className="flex-1 truncate"
                        style={{
                          fontSize: 14,
                          lineHeight: '20px',
                          fontWeight: isMarked ? 500 : 400,
                          color: isMarked ? M.primary : M.onSurface
                        }}
                      >
                        {f.name}
                      </span>
                      {isFile ? (
                        <span
                          style={{
                            fontSize: 11,
                            lineHeight: '16px',
                            color: M.onSurfaceVariant,
                            padding: '0 10px',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          arquivo de dados
                        </span>
                      ) : (
                        <IconButton
                          label={`Abrir ${f.name}`}
                          small
                          onClick={(e) => {
                            e.stopPropagation()
                            open(f)
                          }}
                        >
                          <ChevronIcon size={20} />
                        </IconButton>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {shownError && (
          <p
            className="m-0"
            style={{ padding: '12px 24px 0', fontSize: 13, lineHeight: '18px', color: M.error }}
          >
            {shownError}
          </p>
        )}

        {/* Rodapé */}
        <div className="flex items-center gap-2" style={{ padding: '16px 24px 24px 16px' }}>
          <button
            type="button"
            onClick={() => {
              setCreating(true)
              setError(null)
            }}
            disabled={busy || creating || !canCreate}
            className="flex items-center gap-2 transition-colors disabled:opacity-50"
            style={{
              height: 40,
              padding: '0 16px 0 12px',
              borderRadius: 20,
              border: `1px solid ${M.outline}`,
              color: M.primary,
              fontSize: 14,
              lineHeight: '20px',
              fontWeight: 500,
              background: 'transparent',
              whiteSpace: 'nowrap'
            }}
          >
            <NewFolderIcon />
            Nova pasta
          </button>
          <span
            className="flex-1 truncate"
            style={{
              fontSize: 12,
              lineHeight: '16px',
              color: M.onSurfaceVariant,
              padding: '0 8px'
            }}
          >
            {marked
              ? `${targetIsFile ? 'Arquivo' : 'Pasta'} marcado${targetIsFile ? '' : 'a'}: ${marked.name}`
              : isSharedLocation && atLocationRoot
                ? 'Marque uma pasta ou um arquivo compartilhado.'
                : 'Clique para marcar. Use a seta para abrir uma pasta.'}
          </span>
          <TextButton onClick={onClose} disabled={selecting}>
            Cancelar
          </TextButton>
          <FilledButton onClick={handleSelect} disabled={busy || !canSelect}>
            {selecting
              ? 'Aplicando...'
              : `${targetIsFile ? 'Usar arquivo' : 'Selecionar'} “${targetName}”`}
          </FilledButton>
        </div>
      </div>
    </div>
  )
}

// ─── Peças Material ───

function IconButton({
  children,
  label,
  onClick,
  small
}: {
  children: React.ReactNode
  label: string
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
  small?: boolean
}): React.JSX.Element {
  const size = small ? 36 : 40
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex items-center justify-center transition-colors hover:bg-black/[0.06]"
      style={{ width: size, height: size, borderRadius: size / 2, flexShrink: 0 }}
    >
      {children}
    </button>
  )
}

function TextButton({
  children,
  onClick,
  disabled,
  small
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  small?: boolean
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="transition-colors hover:bg-[#0b57d0]/[0.08] disabled:opacity-50"
      style={{
        height: small ? 36 : 40,
        padding: '0 16px',
        borderRadius: 20,
        color: M.primary,
        fontSize: 14,
        lineHeight: '20px',
        fontWeight: 500,
        whiteSpace: 'nowrap'
      }}
    >
      {children}
    </button>
  )
}

function FilledButton({
  children,
  onClick,
  disabled,
  small,
  type = 'button'
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  small?: boolean
  type?: 'button' | 'submit'
}): React.JSX.Element {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="transition-colors hover:bg-[#0842a0] disabled:opacity-40"
      style={{
        height: small ? 36 : 40,
        padding: small ? '0 16px' : '0 24px',
        borderRadius: 20,
        background: M.primary,
        color: '#ffffff',
        fontSize: 14,
        lineHeight: '20px',
        fontWeight: 500,
        whiteSpace: 'nowrap',
        maxWidth: 260,
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }}
    >
      {children}
    </button>
  )
}

function FolderIcon({
  size = 20,
  color = M.icon
}: {
  size?: number
  color?: string
}): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={size > 30 ? 1.4 : 1.8}
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.6l2 2h8.4A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" />
    </svg>
  )
}

function NewFolderIcon(): React.JSX.Element {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke={M.primary}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.6l2 2h8.4A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" />
      <path d="M12 10v6M9 13h6" />
    </svg>
  )
}

function ChevronIcon({ size }: { size: number }): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={M.icon}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

function DriveIcon({ color = M.icon }: { color?: string }): React.JSX.Element {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinejoin="round"
    >
      <path d="M9 4h6l6 10.5-3 5.5H6l-3-5.5z" />
      <path d="M9 4l3 5.5M15 4l-3 5.5M3 14.5h18" />
    </svg>
  )
}

function PeopleIcon({ color = M.icon }: { color?: string }): React.JSX.Element {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 19c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M16 13.5c3 0 5.5 1.9 5.5 4.5" />
    </svg>
  )
}

function FileIcon(): React.JSX.Element {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke={M.icon}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <path d="M6 3h8l5 5v13H6z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </svg>
  )
}

function SearchIcon(): React.JSX.Element {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke={M.onSurfaceVariant}
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  )
}
