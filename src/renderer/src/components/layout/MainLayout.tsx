import { useState, useEffect } from 'react'
import type { AppData, User } from '@shared/schema'
import Sidebar from './Sidebar'
import ExpenseList from './ExpenseList'
import ExpenseForm from './ExpenseForm'
import Dashboard from './Dashboard'
import Settings from './Settings'
interface Props {
  appData: AppData
  onManageUsers?: () => void
  onEditUser?: (user: User) => void
}

export default function MainLayout({ appData, onManageUsers, onEditUser }: Props) {
  const years = Object.keys(appData.years).sort((a, b) => Number(b) - Number(a))
  const systemYear = String(new Date().getFullYear())
  const systemMonth = String(new Date().getMonth() + 1).padStart(2, '0')
  const defaultYear = years.includes(systemYear) ? systemYear : (years[0] ?? systemYear)
  const months = Object.keys(appData.years[defaultYear] ?? {}).sort()
  const defaultMonth = months.includes(systemMonth) ? systemMonth : (months[0] ?? systemMonth)

  const [selectedYear, setSelectedYear] = useState(defaultYear)
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth)
  const [view, setView] = useState<'expenses' | 'dashboard' | 'settings'>('expenses')

  useEffect(() => {
    if (window.electronAPI?.onMenuOpenSettings) {
      window.electronAPI.onMenuOpenSettings(() => setView('settings'))
    }
  }, [])

  return (
    <div className="flex h-full bg-background overflow-hidden">
      {/* Column 1 — Month/Year navigation */}
      <Sidebar
        appData={appData}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
        onSelectYear={setSelectedYear}
        onSelectMonth={(m) => {
          setSelectedMonth(m)
          setView('expenses')
        }}
        view={view}
        onViewChange={setView}
        onEditUser={onEditUser}
        onManageUsers={onManageUsers}
      />

      {view === 'dashboard' ? (
        <Dashboard appData={appData} onEditUser={onEditUser} />
      ) : view === 'settings' ? (
        <Settings />
      ) : (
        <>
          {/* Column 2 — Expense list + settlements */}
          <ExpenseList
            appData={appData}
            year={selectedYear}
            month={selectedMonth}
          />

          {/* Column 3 — Add expense form */}
          <ExpenseForm appData={appData} year={selectedYear} month={selectedMonth} />
        </>
      )}
    </div>
  )
}
