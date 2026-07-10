import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { AppData, Expense, User } from '@shared/schema'
import { generateYearData } from '../lib/utils'
import { v4 as uuidv4 } from 'uuid'

const QUERY_KEY = ['finance-data']

declare global {
  interface Window {
    electronAPI: {
      login: () => Promise<{ success: boolean }>
      logout: () => Promise<{ success: boolean }>
      isAuthenticated: () => Promise<{ authenticated: boolean }>
      readData: () => Promise<{ success: boolean; data: AppData | null }>
      writeData: (data: AppData) => Promise<{ success: boolean }>
      getVersion: () => Promise<string>
      onMenuLogin: (callback: () => void) => void
      onMenuLogout: (callback: () => void) => void
      onMenuOpenUsers: (callback: () => void) => void
      onMenuOpenYears: (callback: () => void) => void
      onMenuOpenSettings: (callback: () => void) => void
      // Settings
      getDataPath: () => Promise<{ success: boolean; path: string }>
      getDefaultDataDir: () => Promise<{ success: boolean; path: string }>
      chooseDataDir: () => Promise<{ success: boolean; canceled?: boolean; path?: string }>
      setDataDir: (dir: string) => Promise<{ success: boolean; path?: string; error?: string }>
      resetDataDir: () => Promise<{ success: boolean; path?: string }>
    }
  }
}

export function useFinanceData() {
  return useQuery<AppData | null>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const result = await window.electronAPI.readData()
      return result.data
    },
    staleTime: 1000 * 60 * 5 // 5 minutes
  })
}

export function useAuthStatus() {
  return useQuery({
    queryKey: ['auth-status'],
    queryFn: async () => {
      const { authenticated } = await window.electronAPI.isAuthenticated()
      return authenticated
    },
    staleTime: 1000 * 30
  })
}

export function useAddExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      year,
      month,
      expense,
      recurringMonths
    }: {
      year: string
      month: string
      expense: Omit<Expense, 'id' | 'createdAt'>
      recurringMonths?: string[]
    }) => {
      const current = queryClient.getQueryData<AppData>(QUERY_KEY)
      if (!current) throw new Error('No data loaded')

      // Target months: current month plus any recurring months (deduped)
      const targetMonths = Array.from(new Set([month, ...(recurringMonths ?? [])]))
      const createdAt = new Date().toISOString()

      const yearData = { ...(current.years[year] ?? generateYearData()) }
      for (const m of targetMonths) {
        // All copies share the recurrenceGroupId carried on `expense`
        const newExpense: Expense = {
          ...expense,
          id: uuidv4(),
          createdAt
        }
        yearData[m] = {
          expenses: [...(yearData[m]?.expenses ?? []), newExpense]
        }
      }

      const updated: AppData = {
        ...current,
        years: {
          ...current.years,
          [year]: yearData
        }
      }

      await window.electronAPI.writeData(updated)
      return updated
    },
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEY, data)
    }
  })
}

export function useEditExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      year,
      month,
      expenseId,
      updates,
      userId
    }: {
      year: string
      month: string
      expenseId: string
      updates: Partial<Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'updatedBy'>>
      userId: string
    }) => {
      const current = queryClient.getQueryData<AppData>(QUERY_KEY)
      if (!current) throw new Error('No data loaded')

      const monthData = current.years[year]?.[month]
      if (!monthData) throw new Error('Month not found')

      const expenses = monthData.expenses.map((e) => {
        if (e.id === expenseId) {
          return {
            ...e,
            ...updates,
            updatedAt: new Date().toISOString(),
            updatedBy: userId
          }
        }
        return e
      })

      const updated: AppData = {
        ...current,
        years: {
          ...current.years,
          [year]: {
            ...current.years[year],
            [month]: {
              ...monthData,
              expenses
            }
          }
        }
      }

      await window.electronAPI.writeData(updated)
      return updated
    },
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEY, data)
    }
  })
}

export function useDeleteExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      year,
      month,
      expenseId
    }: {
      year: string
      month: string
      expenseId: string
    }) => {
      const current = queryClient.getQueryData<AppData>(QUERY_KEY)
      if (!current) throw new Error('No data loaded')

      const updated: AppData = {
        ...current,
        years: {
          ...current.years,
          [year]: {
            ...current.years[year],
            [month]: {
              expenses: (current.years[year]?.[month]?.expenses ?? []).filter(
                (e) => e.id !== expenseId
              )
            }
          }
        }
      }

      await window.electronAPI.writeData(updated)
      return updated
    },
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEY, data)
    }
  })
}

export function useAddUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ name, color }: { name: string; color?: string }) => {
      const current = queryClient.getQueryData<AppData>(QUERY_KEY)
      if (!current) throw new Error('No data loaded')

      const newUser: User = {
        id: uuidv4(),
        name,
        originalName: name,
        color,
        createdAt: new Date().toISOString()
      }

      const updated: AppData = {
        ...current,
        users: [...current.users, newUser]
      }

      await window.electronAPI.writeData(updated)
      return updated
    },
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEY, data)
    }
  })
}

export function useEditUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      userId,
      name,
      color
    }: {
      userId: string
      name: string
      color?: string
    }) => {
      const current = queryClient.getQueryData<AppData>(QUERY_KEY)
      if (!current) throw new Error('No data loaded')

      const updatedUsers = current.users.map((u) => {
        if (u.id === userId) {
          const originalName = u.originalName || u.name
          return {
            ...u,
            name,
            originalName,
            color
          }
        }
        return u
      })

      const updated: AppData = {
        ...current,
        users: updatedUsers
      }

      await window.electronAPI.writeData(updated)
      return updated
    },
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEY, data)
    }
  })
}

export function useAddYear() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (year: string) => {
      const current = queryClient.getQueryData<AppData>(QUERY_KEY)
      if (!current) throw new Error('No data loaded')

      if (current.years[year]) throw new Error(`Ano ${year} já existe`)

      const updated: AppData = {
        ...current,
        years: {
          ...current.years,
          [year]: generateYearData()
        }
      }

      await window.electronAPI.writeData(updated)
      return updated
    },
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEY, data)
    }
  })
}

export function useAddCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (name: string) => {
      const current = queryClient.getQueryData<AppData>(QUERY_KEY)
      if (!current) throw new Error('No data loaded')

      const newCategory = { id: uuidv4(), name }
      const updated: AppData = {
        ...current,
        categories: [...(current.categories ?? []), newCategory]
      }

      await window.electronAPI.writeData(updated)
      return updated
    },
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEY, data)
    }
  })
}

export function useSaveData() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: AppData) => {
      await window.electronAPI.writeData(data)
      return data
    },
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEY, data)
    }
  })
}
