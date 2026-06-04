import { useState, useEffect } from 'react'
import { cn } from '../../lib/utils'

export default function Settings() {
  const [currentPath, setCurrentPath] = useState('')
  const [defaultDir, setDefaultDir] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  )

  useEffect(() => {
    loadPaths()
  }, [])

  async function loadPaths() {
    try {
      const [pathResult, defaultResult] = await Promise.all([
        window.electronAPI.getDataPath(),
        window.electronAPI.getDefaultDataDir()
      ])
      if (pathResult.success) setCurrentPath(pathResult.path)
      if (defaultResult.success) setDefaultDir(defaultResult.path)
    } catch (err) {
      console.error('[Settings] loadPaths error:', err)
    }
  }

  async function handleChooseDir() {
    setLoading(true)
    setFeedback(null)
    try {
      const result = await window.electronAPI.chooseDataDir()
      if (result.canceled || !result.path) {
        setLoading(false)
        return
      }

      const setResult = await window.electronAPI.setDataDir(result.path)
      if (setResult.success && setResult.path) {
        setCurrentPath(setResult.path)
        setFeedback({
          type: 'success',
          message:
            'Local dos dados alterado com sucesso! Reinicie o aplicativo para carregar os dados do novo local.'
        })
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
        setFeedback({ type: 'error', message: 'Erro ao restaurar o local padrão.' })
      }
    } catch (err) {
      setFeedback({ type: 'error', message: String(err) })
    }
    setLoading(false)
  }

  const isCustomPath = currentPath && defaultDir && !currentPath.startsWith(defaultDir)

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
        {/* Data File Location */}
        <div className="card p-6 space-y-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/20 flex items-center justify-center">
              <span className="text-sm">📁</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Local dos Dados</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Escolha onde o arquivo{' '}
                <code className="bg-white/5 px-1.5 py-0.5 rounded text-primary font-mono text-[10px]">
                  finance-data.json
                </code>{' '}
                será salvo
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

          {/* Feedback message */}
          {feedback && (
            <div
              className={cn(
                'rounded-xl px-4 py-3 text-xs font-medium border',
                feedback.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-destructive/10 text-destructive border-destructive/20'
              )}
            >
              {feedback.type === 'success' ? '✅' : '❌'} {feedback.message}
            </div>
          )}

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
                <span className="text-primary mt-0.5">•</span>
                <span>
                  Se nenhum arquivo existir, um{' '}
                  <strong className="text-foreground/80">novo será criado</strong> automaticamente.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber-400 mt-0.5">•</span>
                <span>
                  Após alterar, <strong className="text-amber-300/80">reinicie o aplicativo</strong>{' '}
                  para garantir que os dados carreguem corretamente.
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
            <InfoRow label="Versão" value="1.0.0" />
            <InfoRow label="Plataforma" value={navigator.platform} />
            <InfoRow label="Arquivo" value="finance-data.json" />
          </div>
        </div>
      </div>
    </div>
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
