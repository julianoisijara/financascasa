import { useState } from 'react'
import { cn } from '../../lib/utils'
import type { DriveStatus } from '../../hooks/useFinanceData'

interface Props {
  status: DriveStatus | undefined
  onSaved: () => void
  /** Estilo compacto para a tela de login */
  compact?: boolean
}

/**
 * Formulário do Client ID / Client Secret do Google Cloud.
 * Só aparece quando o app não foi compilado com credenciais (.env) ou quando o
 * usuário quer usar as próprias.
 */
export default function GoogleCredentialsForm({ status, onSaved, compact }: Props) {
  const [clientId, setClientId] = useState(status?.clientId ?? '')
  const [clientSecret, setClientSecret] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function handleImportFile() {
    setSaving(true)
    setError(null)
    setNotice(null)
    const result = await window.electronAPI.importDriveCredentialsFile()
    setSaving(false)
    if (result.canceled) return
    if (!result.success) {
      setError(result.error ?? 'Não foi possível ler o arquivo.')
      return
    }
    setClientId(result.clientId ?? '')
    setClientSecret('')
    setNotice(
      result.warning ?? 'Credenciais carregadas do arquivo. Agora conecte sua conta Google.'
    )
    onSaved()
  }

  async function handleSave() {
    if (!clientId.trim()) {
      setError('Informe o Client ID.')
      return
    }
    setSaving(true)
    setError(null)
    const result = await window.electronAPI.setDriveCredentials(clientId, clientSecret)
    setSaving(false)
    if (!result.success) {
      setError(result.error ?? 'Não foi possível salvar as credenciais.')
      return
    }
    setClientSecret('')
    onSaved()
  }

  return (
    <div
      className={cn(
        'space-y-3',
        !compact && 'bg-white/[0.02] border border-white/5 rounded-xl p-4'
      )}
    >
      <div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          🔑 Credenciais do Google Cloud
        </p>
        <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
          Crie um <strong className="text-foreground/80">ID do cliente OAuth</strong> do tipo{' '}
          <strong className="text-foreground/80">&quot;Aplicativo para computador&quot;</strong> no
          Google Cloud Console, com a API do Google Drive ativada. Cole os valores aqui ou carregue
          o arquivo <code className="font-mono text-primary/70">client_secret_….json</code> baixado
          de lá. O passo a passo está no README do projeto. Isso só é necessário para salvar na
          nuvem; o app funciona normalmente com os dados deste computador.
        </p>
      </div>

      <div className="space-y-2">
        <label className="label">Client ID</label>
        <input
          className="input-field font-mono text-xs"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          placeholder="xxxxxxxx.apps.googleusercontent.com"
          spellCheck={false}
        />
      </div>
      <div className="space-y-2">
        <label className="label">
          Client Secret{' '}
          <span className="font-normal normal-case tracking-normal">
            (o valor &quot;GOCSPX-...&quot; do arquivo JSON, não o Client ID)
          </span>
        </label>
        <input
          className="input-field font-mono text-xs"
          type="password"
          value={clientSecret}
          onChange={(e) => setClientSecret(e.target.value)}
          placeholder={status?.clientId ? '•••••••• (mantido)' : 'GOCSPX-...'}
          spellCheck={false}
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
      {notice && <p className="text-xs text-emerald-400">{notice}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={handleSave} disabled={saving} className="btn-secondary text-xs">
          {saving ? 'Salvando...' : 'Salvar credenciais'}
        </button>
        <button
          onClick={handleImportFile}
          disabled={saving}
          className="btn-secondary text-xs"
          title="Arquivo client_secret_....json baixado em Credenciais no Google Cloud Console"
        >
          📄 Carregar arquivo JSON
        </button>
        {status?.credentialsFromBuild && !status.clientId && (
          <span className="text-[11px] text-muted-foreground">
            Este build já inclui credenciais; preencha apenas para usar as suas.
          </span>
        )}
      </div>
    </div>
  )
}
