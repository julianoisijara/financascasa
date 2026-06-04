import { useState, useEffect } from 'react'
import type { AppData } from '@shared/schema'
import Sidebar from './Sidebar'
import ExpenseList from './ExpenseList'
import ExpenseForm from './ExpenseForm'
import Dashboard from './Dashboard'
import Settings from './Settings'

interface Props {
  appData: AppData
}

export default function MainLayout({ appData }: Props) {
  const years = Object.keys(appData.years).sort((a, b) => Number(b) - Number(a))
  const defaultYear = years[0] ?? String(new Date().getFullYear())
  const months = Object.keys(appData.years[defaultYear] ?? {}).sort()
  const currentMonthIdx = new Date().getMonth()
  const defaultMonth = months[currentMonthIdx] ?? months[0] ?? '01'

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
      />

      {view === 'dashboard' ? (
        <Dashboard appData={appData} />
      ) : view === 'settings' ? (
        <Settings />
      ) : (
        <>
          {/* Column 2 — Expense list + settlements */}
          <ExpenseList appData={appData} year={selectedYear} month={selectedMonth} />

          {/* Column 3 — Add expense form */}
          <ExpenseForm appData={appData} year={selectedYear} month={selectedMonth} />
        </>
      )}
    </div>
  )
}
