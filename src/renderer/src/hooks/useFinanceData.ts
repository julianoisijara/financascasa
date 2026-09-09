import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { AppData, Expense, User, YearData } from '@shared/schema'
import { generateYearData } from '../lib/utils'
import { v4 as uuidv4 } from 'uuid'

const QUERY_KEY = ['finance-data']

/** Grava no local/nuvem e transforma falhas em erro (para o mutation.isError). */
async function persist(data: AppData): Promise<void> {
  const result = await window.electronAPI.writeData(data)
  if (!result.success) {
    throw new Error(result.error ?? 'Não foi possível salvar os dados.')
  }
}

export type StorageMode = 'local' | 'gdrive'

export interface DriveStatus {
  success: boolean
  mode: StorageMode
  configured: boolean
  connected: boolean
  email?: string
  credentialsFromBuild: boolean
  clientId?: string
  folderPath?: string
  needsReconnect: boolean
  fileName: string
}

export interface DriveFolder {
  id: string
  name: string
  kind?: 'folder' | 'file'
}

export interface ReadStatus {
  /** Sem internet: exibindo a última cópia sincronizada com o Drive */
  offline: boolean
  error?: string
}

declare global {
  interface Window {
    electronAPI: {
      login: () => Promise<{ success: boolean; email?: string; error?: string; kind?: string }>
      logout: () => Promise<{ success: boolean }>
      isAuthenticated: () => Promise<{ authenticated: boolean }>
      readData: () => Promise<{
        success: boolean
        data: AppData | null
        error?: string
        offline?: boolean
      }>
      writeData: (data: AppData) => Promise<{ success: boolean; error?: string }>
      // Google Drive
      getDriveStatus: () => Promise<DriveStatus>
      setDriveCredentials: (
        clientId: string,
        clientSecret?: string
      ) => Promise<{ success: boolean; error?: string }>
      importDriveCredentialsFile: () => Promise<{
        success: boolean
        canceled?: boolean
        clientId?: string
        warning?: string
        error?: string
      }>
      cancelDriveConnect: () => Promise<{ success: boolean }>
      listDriveFolders: (
        parentId?: string
      ) => Promise<{ success: boolean; folders?: DriveFolder[]; error?: string }>
      createDriveFolder: (
        parentId: string,
        name: string
      ) => Promise<{ success: boolean; folder?: DriveFolder; error?: string }>
      setDriveFolder: (folderId: string) => Promise<{
        success: boolean
        folderPath?: string
        result?: 'existing' | 'moved' | 'copied' | 'empty'
        error?: string
      }>
      setDriveFile: (fileId: string) => Promise<{
        success: boolean
        folderPath?: string
        fileName?: string
        canEdit?: boolean
        error?: string
      }>
      setStorageMode: (mode: StorageMode) => Promise<{
        success: boolean
        mode?: StorageMode
        source?: 'local' | 'drive-existing' | 'uploaded-local' | 'empty'
        error?: string
      }>
      downloadDriveToLocal: () => Promise<{
        success: boolean
        canceled?: boolean
        path?: string
        error?: string
      }>
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
      setDataDir: (
        dir: string
      ) => Promise<{ success: boolean; path?: string; error?: string; warning?: string }>
      resetDataDir: () => Promise<{ success: boolean; path?: string; error?: string }>
    }
  }
}

const READ_STATUS_KEY = ['read-status']

export function useFinanceData() {
  const queryClient = useQueryClient()
  return useQuery<AppData | null>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const result = await window.electronAPI.readData()
      if (!result.success) {
        throw new Error(result.error ?? 'Não foi possível carregar os dados.')
      }
      queryClient.setQueryData<ReadStatus>(READ_STATUS_KEY, {
        offline: !!result.offline,
        error: result.error
      })
      return result.data
    },
    staleTime: 1000 * 60 * 5 // 5 minutes
  })
}

/** Estado da última leitura (ex.: modo off-line com a cópia local do Drive). */
export function useReadStatus() {
  return useQuery<ReadStatus>({
    queryKey: READ_STATUS_KEY,
    queryFn: () => ({ offline: false }),
    staleTime: Infinity
  })
}

export function useDriveStatus() {
  return useQuery<DriveStatus>({
    queryKey: ['drive-status'],
    queryFn: () => window.electronAPI.getDriveStatus(),
    staleTime: 1000 * 30
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

      await persist(updated)
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
      userId,
      applyToMonths
    }: {
      year: string
      month: string
      expenseId: string
      updates: Partial<Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'updatedBy'>>
      userId: string
      /**
       * Outros meses do mesmo ano cujas cópias da recorrência devem receber as
       * mesmas alterações. Só tem efeito se a despesa pertencer a um grupo de
       * recorrência.
       */
      applyToMonths?: string[]
    }) => {
      const current = queryClient.getQueryData<AppData>(QUERY_KEY)
      if (!current) throw new Error('No data loaded')

      const yearMonths = current.years[year]
      const monthData = yearMonths?.[month]
      if (!yearMonths || !monthData) throw new Error('Month not found')

      const updatedAt = new Date().toISOString()
      const target = monthData.expenses.find((e) => e.id === expenseId)
      const groupId = updates.recurrenceGroupId ?? target?.recurrenceGroupId

      const expenses = monthData.expenses.map((e) => {
        if (e.id === expenseId) {
          return {
            ...e,
            ...updates,
            updatedAt,
            updatedBy: userId
          }
        }
        return e
      })

      const nextYear: YearData = {
        ...yearMonths,
        [month]: {
          ...monthData,
          expenses
        }
      }

      // Propaga a mesma edição para as cópias da recorrência nos meses pedidos
      if (groupId && applyToMonths && applyToMonths.length > 0) {
        for (const m of applyToMonths) {
          const data = nextYear[m]
          if (!data || m === month) continue
          nextYear[m] = {
            ...data,
            expenses: data.expenses.map((e) =>
              e.recurrenceGroupId === groupId
                ? { ...e, ...updates, updatedAt, updatedBy: userId }
                : e
            )
          }
        }
      }

      const updated: AppData = {
        ...current,
        years: {
          ...current.years,
          [year]: nextYear
        }
      }

      await persist(updated)
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

      await persist(updated)
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

      await persist(updated)
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
      color,
      avatar
    }: {
      userId: string
      name: string
      color?: string
      avatar?: string
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
            color,
            avatar
          }
        }
        return u
      })

      const updated: AppData = {
        ...current,
        users: updatedUsers
      }

      await persist(updated)
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

      await persist(updated)
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

      await persist(updated)
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
      await persist(data)
      return data
    },
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEY, data)
    }
  })
}
