import { useState, useEffect } from 'react'
import { useAuthStatus, useFinanceData, useSaveData } from './hooks/useFinanceData'
import OnboardingScreen from './components/onboarding/OnboardingScreen'
import MainLayout from './components/layout/MainLayout'
import LoginScreen from './components/auth/LoginScreen'
import type { AppData } from '@shared/schema'
import { generateYearData } from './lib/utils'
import { v4 as uuidv4 } from 'uuid'
import AddUserModal from './components/modals/AddUserModal'
import AddYearModal from './components/modals/AddYearModal'
import { useTheme } from './hooks/useTheme'

export default function App() {
  useTheme() // Initialize theme
  const { data: isAuthenticated, isLoading: authLoading } = useAuthStatus()
  const { data: appData, isLoading: dataLoading } = useFinanceData()
  const saveData = useSaveData()

  const [showAddUser, setShowAddUser] = useState(false)
  const [showAddYear, setShowAddYear] = useState(false)

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

  const handleOnboardingComplete = async (userName: string, year: string) => {
    const newData: AppData = {
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      users: [{ id: uuidv4(), name: userName, createdAt: new Date().toISOString() }],
      years: { [year]: generateYearData() }
    }
    await saveData.mutateAsync(newData)
  }

  if (authLoading) {
    return <LoadingScreen message="A verificar autenticação..." />
  }

  if (!isAuthenticated) {
    return <LoginScreen />
  }

  if (dataLoading) {
    return <LoadingScreen message="A carregar dados do Drive..." />
  }

  // First access — no data or no users
  if (!appData || appData.users.length === 0) {
    return (
      <OnboardingScreen
        onComplete={handleOnboardingComplete}
        isLoading={saveData.isPending}
      />
    )
  }

  return (
    <>
      <MainLayout appData={appData} />
      <AddUserModal open={showAddUser} onClose={() => setShowAddUser(false)} appData={appData} />
      <AddYearModal open={showAddYear} onClose={() => setShowAddYear(false)} appData={appData} />
    </>
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
