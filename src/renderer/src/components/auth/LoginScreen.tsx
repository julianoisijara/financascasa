import { useState } from 'react'

export default function LoginScreen() {
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    try {
      await window.electronAPI.login()
      window.location.reload()
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm animate-slide-in text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-500/20 to-primary/30 text-4xl shadow-lg">
          💰
        </div>
        <h1 className="text-3xl font-bold text-foreground">Finanças</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Controle financeiro compartilhado e sincronizado via Google Drive.
        </p>

        <div className="mt-8 card p-6 space-y-4">
          <p className="text-sm text-muted-foreground text-left">
            Para começar, conecte a sua conta Google. O programa guardará os seus dados de forma
            privada na pasta <span className="text-primary font-medium">appDataFolder</span> do seu
            Drive — invisível para outros apps.
          </p>

          <button
            id="btn-login-google"
            onClick={handleLogin}
            disabled={loading}
            className="btn-primary w-full text-base py-3"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                A abrir navegador...
              </>
            ) : (
              <>
                <GoogleIcon />
                Entrar com Google
              </>
            )}
          </button>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Apenas pede acesso à pasta de dados da app. Os seus ficheiros pessoais do Drive ficam
          intocados.
        </p>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
      <path
        d="M43.6 20.2H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 2.9l5.7-5.7C34.5 6.5 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.8z"
        fill="#FFC107"
      />
      <path
        d="M6.3 14.7l6.6 4.8C14.6 15.5 18.9 12 24 12c3.1 0 5.8 1.1 8 2.9l5.7-5.7C34.5 6.5 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
        fill="#FF3D00"
      />
      <path
        d="M24 44c5.4 0 10.3-2 14-5.3l-6.5-5.5C29.5 35 26.9 36 24 36c-5.2 0-9.6-3.1-11.3-7.5L6.1 33.6C9.5 39.7 16.2 44 24 44z"
        fill="#4CAF50"
      />
      <path
        d="M43.6 20.2H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6.5 5.5C37.5 39.1 44 34 44 24c0-1.3-.1-2.6-.4-3.8z"
        fill="#1976D2"
      />
    </svg>
  )
}
