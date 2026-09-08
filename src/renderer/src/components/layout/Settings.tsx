import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '../../lib/utils'
import { useDriveStatus, type StorageMode } from '../../hooks/useFinanceData'
import GoogleCredentialsForm from '../settings/GoogleCredentialsForm'
import { GoogleIcon } from '../auth/LoginScreen'
import DriveFolderPickerModal from '../modals/DriveFolderPickerModal'
import type { DriveFolder } from '../../hooks/useFinanceData'

type Feedback = { type: 'success' | 'error' | 'warning'; message: string } | null

export default function Settings() {
  const queryClient = useQueryClient()
  const { data: drive, refetch: refetchDrive } = useDriveStatus()

  const [currentPath, setCurrentPath] = useState('')
  const [defaultDir, setDefaultDir] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [showCredentials, setShowCredentials] = useState(false)
  const [showFolderPicker, setShowFolderPicker] = useState(false)
  const [version, setVersion] = useState('')

  useEffect(() => {
    Promise.all([window.electronAPI.getDataPath(), window.electronAPI.getDefaultDataDir()])
      .then(([pathResult, defaultResult]) => {
        if (pathResult.success) setCurrentPath(pathResult.path)
        if (defaultResult.success) setDefaultDir(defaultResult.path)
      })
      .catch((err) => console.error('[Settings] loadPaths error:', err))
    window.electronAPI
      .getVersion()
      .then(setVersion)
      .catch(() => undefined)
  }, [])

  /** Recarrega os dados da fonte ativa depois de trocar o modo. */
  async function reloadData() {
    await refetchDrive()
    await queryClient.invalidateQueries({ queryKey: ['finance-data'] })
    await queryClient.invalidateQueries({ queryKey: ['auth-status'] })
  }

  // ─── Modo de armazenamento ───

  async function handleSetMode(mode: StorageMode) {
    if (!drive || drive.mode === mode) return
    if (mode === 'gdrive' && !drive.connected) {
      setFeedback({
        type: 'warning',
        message: 'Conecte sua conta Google abaixo antes de ativar o armazenamento na nuvem.'
      })
      return
    }

    setLoading(true)
    setFeedback(
      mode === 'gdrive'
        ? { type: 'warning', message: 'Verificando seus dados no Google Drive...' }
        : null
    )
    const result = await window.electronAPI.setStorageMode(mode)
    setLoading(false)

    if (!result.success) {
      setFeedback({ type: 'error', message: result.error ?? 'Não foi possível trocar o modo.' })
      return
    }

    const messages: Record<string, string> = {
      'drive-existing':
        'Google Drive ativado! Encontramos um finance-data.json na sua conta e ele passou a ser usado.',
      'uploaded-local':
        'Google Drive ativado! Seus dados atuais foram enviados para Meu Drive/FinancasCasa.',
      empty: 'Google Drive ativado! O arquivo será criado na nuvem no primeiro lançamento.',
      local: 'Os dados voltaram a ser salvos neste computador.'
    }
    setFeedback({ type: 'success', message: messages[result.source ?? 'local'] })
    await reloadData()
  }

  // ─── Conta Google ───

  async function handleConnect() {
    setLoading(true)
    setFeedback({
      type: 'warning',
      message: 'Abrimos o navegador para você autorizar o acesso. Volte aqui quando terminar.'
    })
    const result = await window.electronAPI.login()
    setLoading(false)
    if (result.success) {
      setFeedback({
        type: 'success',
        message: `Conta ${result.email ?? 'Google'} conectada! Agora escolha "Google Drive" acima para salvar na nuvem.`
      })
      await refetchDrive()
    } else {
      setFeedback({ type: 'error', message: result.error ?? 'Falha ao conectar.' })
    }
  }

  async function handleCancelConnect() {
    await window.electronAPI.cancelDriveConnect()
  }

  async function handleDisconnect() {
    setLoading(true)
    await window.electronAPI.logout()
    setLoading(false)
    setFeedback({
      type: 'success',
      message:
        'Conta desconectada. Os dados passaram a ser salvos neste computador (uma cópia do Drive fica guardada como segurança).'
    })
    await reloadData()
  }

  async function handleSelectFolder(folder: DriveFolder) {
    if (folder.kind === 'file') {
      const result = await window.electronAPI.setDriveFile(folder.id)
      if (!result.success) {
        throw new Error(result.error ?? 'Não foi possível usar esse arquivo.')
      }
      setShowFolderPicker(false)
      setFeedback({
        type: result.canEdit === false ? 'warning' : 'success',
        message:
          result.canEdit === false
            ? `Usando ${result.folderPath}/${result.fileName}, mas você só tem permissão de leitura. Peça ao dono acesso de edição para lançar despesas.`
            : `Agora o app usa o arquivo ${result.folderPath}/${result.fileName}.`
      })
      await reloadData()
      return
    }

    const result = await window.electronAPI.setDriveFolder(folder.id)
    if (!result.success) {
      // O modal exibe a mensagem; lançar mantém o seletor aberto.
      throw new Error(result.error ?? 'Não foi possível trocar a pasta.')
    }
    setShowFolderPicker(false)
    const messages = {
      existing: `Pasta alterada para ${result.folderPath}. Já existia um finance-data.json lá e ele passou a ser usado.`,
      moved: `Pasta alterada para ${result.folderPath}. Seu arquivo foi movido para lá.`,
      copied: `Pasta alterada para ${result.folderPath}. O arquivo original não podia ser movido, então uma cópia foi criada lá e passa a ser usada.`,
      empty: `Pasta alterada para ${result.folderPath}. O arquivo será criado lá no primeiro lançamento.`
    }
    setFeedback({ type: 'success', message: messages[result.result ?? 'empty'] })
    await reloadData()
  }

  async function handleDownloadToLocal() {
    setLoading(true)
    const result = await window.electronAPI.downloadDriveToLocal()
    setLoading(false)
    if (result.success) {
      setFeedback({ type: 'success', message: `Cópia do Drive salva em ${result.path}.` })
    } else if (!result.canceled) {
      setFeedback({ type: 'error', message: result.error ?? 'Falha ao baixar.' })
    }
  }

  // ─── Pasta local ───

  async function handleChooseDir() {
    setLoading(true)
    setFeedback(null)
    try {
      const result = await window.electronAPI.chooseDataDir()
      if (result.canceled || !result.path) {
        setLoading(false)
        return
      }

      // Cloud folders (Google Drive/OneDrive) may need to download the file first.
      setFeedback({
        type: 'warning',
        message: 'Preparando a pasta... isso pode demorar um pouco em pastas da nuvem.'
      })

      const setResult = await window.electronAPI.setDataDir(result.path)
      if (setResult.success && setResult.path) {
        setCurrentPath(setResult.path)
        setFeedback(
          setResult.warning
            ? { type: 'warning', message: setResult.warning }
            : {
                type: 'success',
                message:
                  'Local dos dados alterado com sucesso! Reinicie o aplicativo para carregar os dados do novo local.'
              }
        )
      } else {
        setFeedback({
          type: 'error',
          message: setResult.error ?? 'Erro ao alterar o local dos dados.'
        })
      }
    } catch (err) {
      setFeedback({ type: 'error', message: String(err) })
    }
    setLoading(false)
  }

  async function handleReset() {
    setLoading(true)
    setFeedback(null)
    try {
      const result = await window.electronAPI.resetDataDir()
      if (result.success && result.path) {
        setCurrentPath(result.path)
        setFeedback({
          type: 'success',
          message:
            'Local dos dados restaurado para o padrão! Reinicie o aplicativo para carregar os dados.'
        })
      } else {
        setFeedback({
          type: 'error',
          message: result.error ?? 'Erro ao restaurar o local padrão.'
        })
      }
    } catch (err) {
      setFeedback({ type: 'error', message: String(err) })
    }
    setLoading(false)
  }

  const isCustomPath = currentPath && defaultDir && !currentPath.startsWith(defaultDir)
  const mode: StorageMode = drive?.mode ?? 'local'

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      {/* Top bar */}
      <div className="px-8 py-6 border-b border-white/5 bg-white/[0.01] drag-region">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 border border-purple-500/20 flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.15)]">
            <span className="text-xl">⚙️</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Configurações</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Gerencie as configurações do sistema
            </p>
          </div>
        </div>
      </div>

      <div className="px-8 py-8 space-y-8 max-w-2xl">
        {/* ─── Onde salvar ─── */}
        <div className="card p-6 space-y-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/20 flex items-center justify-center">
              <span className="text-sm">💾</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Onde salvar os dados</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Escolha onde o arquivo{' '}
                <code className="bg-white/5 px-1.5 py-0.5 rounded text-primary font-mono text-[10px]">
                  finance-data.json
                </code>{' '}
                será guardado
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <ModeCard
              active={mode === 'local'}
              disabled={loading}
              icon="🖥️"
              title="Neste computador"
              description="Arquivo local, em uma pasta à sua escolha."
              onClick={() => handleSetMode('local')}
            />
            <ModeCard
              active={mode === 'gdrive'}
              disabled={loading}
              icon="☁️"
              title="Google Drive"
              description={
                drive?.connected
                  ? `Sincronizado com ${drive.email ?? 'sua conta Google'}.`
                  : 'Conecte uma conta Google para ativar.'
              }
              onClick={() => handleSetMode('gdrive')}
            />
          </div>

          {/* Feedback message */}
          {feedback && (
            <div
              className={cn(
                'rounded-xl px-4 py-3 text-xs font-medium border leading-relaxed',
                feedback.type === 'success' &&
                  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                feedback.type === 'warning' && 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                feedback.type === 'error' &&
                  'bg-destructive/10 text-destructive border-destructive/20'
              )}
            >
              {feedback.type === 'success' ? '✅' : feedback.type === 'warning' ? '⏳' : '❌'}{' '}
              {feedback.message}
            </div>
          )}
        </div>

        {/* ─── Google Drive ─── */}
        <div className="card p-6 space-y-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-sky-500/20 to-sky-500/5 border border-sky-500/20 flex items-center justify-center">
              <span className="text-sm">☁️</span>
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-bold text-foreground">Conta Google Drive</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                O arquivo fica na pasta do Drive que você escolher (padrão{' '}
                <code className="font-mono text-primary/70 text-[10px]">
                  Meu Drive/FinancasCasa
                </code>
                )
              </p>
            </div>
            {drive && (
              <span
                className={cn(
                  'flex-shrink-0 text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border',
                  drive.connected
                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                    : 'text-muted-foreground bg-white/5 border-border'
                )}
              >
                {drive.connected ? 'Conectado' : 'Desconectado'}
              </span>
            )}
          </div>

          {drive?.connected && (
            <div className="flex items-center gap-3 bg-white/[0.03] border border-border rounded-xl px-4 py-3">
              <GoogleIcon />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground/90 truncate">
                  {drive.email ?? 'Conta Google conectada'}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {mode === 'gdrive'
                    ? 'Cada lançamento é salvo direto na nuvem.'
                    : 'Conectada, mas os dados ainda são salvos localmente.'}
                </p>
              </div>
            </div>
          )}

          {drive?.connected && drive.needsReconnect && (
            <div className="rounded-xl px-4 py-3 text-xs font-medium border leading-relaxed bg-amber-500/10 text-amber-400 border-amber-500/20">
              ⚠️ Esta conta foi conectada com uma permissão antiga, que não permite escolher a
              pasta. Clique em <strong>Desconectar</strong> e conecte novamente.
            </div>
          )}

          {drive?.connected && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Pasta no Drive
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-white/[0.03] border border-border rounded-xl px-4 py-3 min-h-[44px] flex items-center">
                  <span className="text-xs font-mono text-foreground/80 break-all leading-relaxed">
                    {drive.folderPath}/{drive.fileName}
                  </span>
                </div>
                <button
                  onClick={() => setShowFolderPicker(true)}
                  disabled={loading || drive.needsReconnect}
                  className={cn(
                    'flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200',
                    'bg-primary/15 text-primary border border-primary/20 hover:bg-primary/25',
                    (loading || drive.needsReconnect) && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <span>📂</span>
                  <span>Escolher pasta ou arquivo</span>
                </button>
              </div>
            </div>
          )}

          {drive && !drive.configured && (
            <GoogleCredentialsForm status={drive} onSaved={() => refetchDrive()} />
          )}

          <div className="flex flex-wrap items-center gap-3">
            {drive?.configured && !drive.connected && (
              <button
                onClick={loading ? handleCancelConnect : handleConnect}
                className={cn(
                  'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200',
                  'bg-primary/15 text-primary border border-primary/20 hover:bg-primary/25'
                )}
              >
                {loading ? (
                  <>
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    <span>Aguardando... (cancelar)</span>
                  </>
                ) : (
                  <>
                    <GoogleIcon />
                    <span>Conectar conta Google</span>
                  </>
                )}
              </button>
            )}

            {drive?.connected && (
              <>
                <button
                  onClick={handleDownloadToLocal}
                  disabled={loading}
                  className={cn(
                    'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                    'bg-white/5 text-muted-foreground border border-border hover:bg-white/10 hover:text-foreground',
                    loading && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <span>⬇️</span>
                  <span>Baixar cópia para este computador</span>
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={loading}
                  className={cn(
                    'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                    'bg-white/5 text-muted-foreground border border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20',
                    loading && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <span>🔌</span>
                  <span>Desconectar</span>
                </button>
              </>
            )}

            {drive?.configured && (
              <button
                onClick={() => setShowCredentials((v) => !v)}
                className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-4 ml-auto"
              >
                {showCredentials ? 'Ocultar credenciais' : 'Usar minhas próprias credenciais'}
              </button>
            )}
          </div>

          {drive?.configured && showCredentials && (
            <GoogleCredentialsForm
              status={drive}
              onSaved={() => {
                setShowCredentials(false)
                setFeedback({
                  type: 'success',
                  message: 'Credenciais salvas. Conecte sua conta Google novamente.'
                })
                reloadData()
              }}
            />
          )}

          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 space-y-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              ℹ️ Como funciona
            </p>
            <ul className="space-y-1.5 text-[11px] text-muted-foreground leading-relaxed">
              <li className="flex gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>
                  Ao ativar o Google Drive, seus{' '}
                  <strong className="text-foreground/80">dados atuais são enviados</strong> para a
                  nuvem. Se já existir um arquivo lá, ele é usado no lugar.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>
                  Ao <strong className="text-foreground/80">trocar a pasta</strong>, o arquivo é
                  movido para ela. Se a nova pasta já tiver um finance-data.json, ele é usado no
                  lugar.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>
                  Sem internet, o app abre a{' '}
                  <strong className="text-foreground/80">última cópia sincronizada</strong> em modo
                  somente leitura.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>
                  A sessão fica guardada de forma criptografada neste computador. Para outro
                  computador usar os mesmos dados, basta conectar a mesma conta Google.
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* ─── Pasta local ─── */}
        <div className={cn('card p-6 space-y-5', mode === 'gdrive' && 'opacity-70')}>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/20 flex items-center justify-center">
              <span className="text-sm">📁</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Pasta local</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {mode === 'gdrive'
                  ? 'Usada apenas quando "Neste computador" estiver selecionado'
                  : 'Pasta onde o arquivo local é salvo'}
              </p>
            </div>
          </div>

          {/* Current path display */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Caminho Atual
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-white/[0.03] border border-border rounded-xl px-4 py-3 min-h-[44px] flex items-center">
                <span className="text-xs font-mono text-foreground/80 break-all leading-relaxed">
                  {currentPath || 'Carregando...'}
                </span>
              </div>
              {isCustomPath && (
                <span className="flex-shrink-0 text-[9px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                  Personalizado
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleChooseDir}
              disabled={loading}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200',
                'bg-primary/15 text-primary border border-primary/20 hover:bg-primary/25',
                'shadow-[0_0_15px_rgba(16,185,129,0.08)] hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]',
                loading && 'opacity-50 cursor-not-allowed'
              )}
            >
              <span>📂</span>
              <span>Alterar Local</span>
            </button>

            {isCustomPath && (
              <button
                onClick={handleReset}
                disabled={loading}
                className={cn(
                  'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                  'bg-white/5 text-muted-foreground border border-border hover:bg-white/10 hover:text-foreground',
                  loading && 'opacity-50 cursor-not-allowed'
                )}
              >
                <span>↩️</span>
                <span>Restaurar Padrão</span>
              </button>
            )}
          </div>

          {/* Info box */}
          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 space-y-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              ℹ️ Como funciona
            </p>
            <ul className="space-y-1.5 text-[11px] text-muted-foreground leading-relaxed">
              <li className="flex gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>
                  Ao alterar o local, o sistema{' '}
                  <strong className="text-foreground/80">copia os dados atuais</strong> para a nova
                  pasta automaticamente.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>
                  Se já existir um arquivo{' '}
                  <code className="font-mono text-primary/70 text-[10px]">finance-data.json</code>{' '}
                  na pasta escolhida, ele será{' '}
                  <strong className="text-foreground/80">utilizado diretamente</strong>.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber-400 mt-0.5">•</span>
                <span>
                  Após alterar,{' '}
                  <strong className="text-amber-800 dark:text-amber-300/80">
                    reinicie o aplicativo
                  </strong>{' '}
                  para garantir que os dados carreguem corretamente.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber-400 mt-0.5">•</span>
                <span>
                  Em pastas sincronizadas (Google Drive para computador / OneDrive), escolha uma
                  subpasta — a pasta raiz é somente leitura — e marque-a como{' '}
                  <strong className="text-foreground/80">&quot;Disponível off-line&quot;</strong>.
                  Para sincronizar direto pela API, prefira a opção{' '}
                  <strong className="text-foreground/80">Google Drive</strong> acima.
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* System Info */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500/20 to-indigo-500/5 border border-indigo-500/20 flex items-center justify-center">
              <span className="text-sm">💻</span>
            </div>
            <h2 className="text-sm font-bold text-foreground">Informações do Sistema</h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <InfoRow label="Aplicativo" value="Finanças da Casa" />
            <InfoRow label="Versão" value={version || '...'} />
            <InfoRow label="Plataforma" value={navigator.platform} />
            <InfoRow
              label="Armazenamento"
              value={mode === 'gdrive' ? 'Google Drive' : 'Neste computador'}
            />
          </div>
        </div>
      </div>

      {showFolderPicker && (
        <DriveFolderPickerModal
          onClose={() => setShowFolderPicker(false)}
          onSelect={handleSelectFolder}
        />
      )}
    </div>
  )
}

function ModeCard({
  active,
  disabled,
  icon,
  title,
  description,
  onClick
}: {
  active: boolean
  disabled?: boolean
  icon: string
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        'text-left rounded-xl border p-4 transition-all duration-200 flex items-start gap-3',
        active
          ? 'bg-primary/10 border-primary/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
          : 'bg-white/[0.02] border-border hover:bg-white/5 hover:border-foreground/10',
        disabled && 'opacity-60 cursor-not-allowed'
      )}
    >
      <span className="text-xl leading-none mt-0.5">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2">
          <span className={cn('text-sm font-bold', active ? 'text-primary' : 'text-foreground')}>
            {title}
          </span>
          {active && (
            <span className="text-[9px] font-bold uppercase tracking-wider text-primary bg-primary/15 border border-primary/20 px-2 py-0.5 rounded-md">
              Ativo
            </span>
          )}
        </span>
        <span className="block text-[11px] text-muted-foreground mt-1 leading-relaxed">
          {description}
        </span>
      </span>
    </button>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2.5">
      <p className="text-[9px] font-bold text-muted-foreground/70 uppercase tracking-widest mb-0.5">
        {label}
      </p>
      <p className="text-xs font-medium text-foreground/80 truncate">{value}</p>
    </div>
  )
}
