import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  useAuthStatus,
  useDriveStatus,
  useFinanceData,
  useReadStatus,
  useSaveData
} from './hooks/useFinanceData'
import OnboardingScreen from './components/onboarding/OnboardingScreen'
import MainLayout from './components/layout/MainLayout'
import LoginScreen from './components/auth/LoginScreen'
import type { AppData, User } from '@shared/schema'
import { generateYearData } from './lib/utils'
import { v4 as uuidv4 } from 'uuid'
import AddUserModal from './components/modals/AddUserModal'
import AddYearModal from './components/modals/AddYearModal'
import EditUserModal from './components/modals/EditUserModal'
import { useTheme } from './hooks/useTheme'
import { SAVE_ERROR_EVENT } from './lib/events'

export default function App() {
  useTheme() // Initialize theme
  const queryClient = useQueryClient()
  const { data: isAuthenticated, isLoading: authLoading } = useAuthStatus()
  const { data: driveStatus } = useDriveStatus()
  const {
    data: appData,
    isLoading: dataLoading,
    isError: dataError,
    error: dataErrorObj,
    refetch: refetchData
  } = useFinanceData()
  const { data: readStatus } = useReadStatus()
  const saveData = useSaveData()

  const [showAddUser, setShowAddUser] = useState(false)
  const [showAddYear, setShowAddYear] = useState(false)
  const [userToEdit, setUserToEdit] = useState<User | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Listen for menu events from main process
  useEffect(() => {
    const handleMenuLogin = () => window.electronAPI.login().then(() => window.location.reload())
    const handleMenuLogout = () => window.electronAPI.logout().then(() => window.location.reload())
    const handleMenuUsers = () => setShowAddUser(true)
    const handleMenuYears = () => setShowAddYear(true)

    if (window.electronAPI) {
      window.electronAPI.onMenuLogin(handleMenuLogin)
      window.electronAPI.onMenuLogout(handleMenuLogout)
      window.electronAPI.onMenuOpenUsers(handleMenuUsers)
      window.electronAPI.onMenuOpenYears(handleMenuYears)
    }
  }, [])

  // Falhas ao salvar (local ou Drive) chegam aqui via MutationCache (main.tsx)
  useEffect(() => {
    const handler = (e: Event) => setSaveError((e as CustomEvent<string>).detail)
    window.addEventListener(SAVE_ERROR_EVENT, handler)
    return () => window.removeEventListener(SAVE_ERROR_EVENT, handler)
  }, [])

  useEffect(() => {
    if (!saveError) return
    const t = setTimeout(() => setSaveError(null), 8000)
    return () => clearTimeout(t)
  }, [saveError])

  const handleOnboardingComplete = async (userName: string, year: string, color?: string) => {
    const newData: AppData = {
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      users: [
        {
          id: uuidv4(),
          name: userName,
          originalName: userName,
          color,
          createdAt: new Date().toISOString()
        }
      ],
      years: { [year]: generateYearData() }
    }
    await saveData.mutateAsync(newData)
  }

  const handleUseLocal = async () => {
    await window.electronAPI.setStorageMode('local')
    await queryClient.invalidateQueries()
    window.location.reload()
  }

  if (authLoading) {
    return <LoadingScreen message="Verificando conta..." />
  }

  if (!isAuthenticated) {
    return <LoginScreen />
  }

  const isDrive = driveStatus?.mode === 'gdrive'

  if (dataLoading) {
    return (
      <LoadingScreen
        message={isDrive ? 'Carregando dados do Google Drive...' : 'Carregando dados...'}
      />
    )
  }

  if (dataError) {
    return (
      <ErrorScreen
        message={(dataErrorObj as Error)?.message ?? 'Não foi possível carregar os dados.'}
        onRetry={() => refetchData()}
        onUseLocal={isDrive ? handleUseLocal : undefined}
      />
    )
  }

  // First access — no data or no users
  if (!appData || appData.users.length === 0) {
    return <OnboardingScreen onComplete={handleOnboardingComplete} isLoading={saveData.isPending} />
  }

  return (
    <div className="flex h-full flex-col">
      {readStatus?.offline && (
        <Banner tone="warning">
          ☁️ Sem conexão com o Google Drive. Exibindo a última cópia sincronizada; novos lançamentos
          não serão salvos até a conexão voltar.{' '}
          <button onClick={() => refetchData()} className="underline underline-offset-2 ml-1">
            Tentar novamente
          </button>
        </Banner>
      )}
      {saveError && (
        <Banner tone="error">
          ❌ Não foi possível salvar: {saveError}{' '}
          <button onClick={() => setSaveError(null)} className="underline underline-offset-2 ml-1">
            Fechar
          </button>
        </Banner>
      )}
      <div className="flex-1 min-h-0">
        <MainLayout
          appData={appData}
          onManageUsers={() => setShowAddUser(true)}
          onEditUser={setUserToEdit}
        />
      </div>
      <AddUserModal
        open={showAddUser}
        onClose={() => setShowAddUser(false)}
        appData={appData}
        onEditUser={(u) => {
          setShowAddUser(false)
          setUserToEdit(u)
        }}
      />
      <AddYearModal open={showAddYear} onClose={() => setShowAddYear(false)} appData={appData} />
      {userToEdit && (
        <EditUserModal
          open={!!userToEdit}
          onClose={() => setUserToEdit(null)}
          user={userToEdit}
          appData={appData}
        />
      )}
    </div>
  )
}

function Banner({ tone, children }: { tone: 'warning' | 'error'; children: React.ReactNode }) {
  return (
    <div
      className={
        tone === 'warning'
          ? 'px-4 py-2 text-xs font-medium bg-amber-500/15 text-amber-300 border-b border-amber-500/20 no-drag-region'
          : 'px-4 py-2 text-xs font-medium bg-destructive/15 text-destructive border-b border-destructive/20 no-drag-region'
      }
    >
      {children}
    </div>
  )
}

function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-muted-foreground text-sm">{message}</p>
      </div>
    </div>
  )
}

function ErrorScreen({
  message,
  onRetry,
  onUseLocal
}: {
  message: string
  onRetry: () => void
  onUseLocal?: () => void
}) {
  return (
    <div className="flex h-full items-center justify-center bg-background p-6">
      <div className="card p-6 max-w-md w-full space-y-4 animate-fade-in text-center">
        <div className="text-4xl">⚠️</div>
        <h2 className="text-lg font-bold text-foreground">Não foi possível carregar os dados</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
        <div className="flex flex-col gap-2 pt-2">
          <button onClick={onRetry} className="btn-primary w-full">
            Tentar novamente
          </button>
          {onUseLocal && (
            <button onClick={onUseLocal} className="btn-secondary w-full text-xs">
              Usar os dados salvos neste computador
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
