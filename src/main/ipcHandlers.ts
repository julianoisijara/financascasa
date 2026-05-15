import { ipcMain, app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import type { AppData } from '../types/schema'

export function registerIpcHandlers(): void {
  const userDataPath = app.getPath('userData')
  const dataFilePath = path.join(userDataPath, 'finance-data.json')

  // Auth handlers
  ipcMain.handle('auth:login', async () => {
    return { success: true }
  })

  ipcMain.handle('auth:logout', () => {
    return { success: true }
  })

  ipcMain.handle('auth:check', async () => {
    return { authenticated: true }
  })

  // Drive data handlers (now saving locally)
  ipcMain.handle('drive:read', async () => {
    try {
      if (fs.existsSync(dataFilePath)) {
        const rawData = fs.readFileSync(dataFilePath, 'utf-8')
        return { success: true, data: JSON.parse(rawData) }
      }
      return { success: true, data: null }
    } catch (err) {
      console.error('[IPC] local:read error:', err)
      return { success: false, data: null, error: String(err) }
    }
  })

  ipcMain.handle('drive:write', async (_event, data: AppData) => {
    try {
      fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2), 'utf-8')
      return { success: true }
    } catch (err) {
      console.error('[IPC] local:write error:', err)
      return { success: false, error: String(err) }
    }
  })

  // App info
  ipcMain.handle('app:version', () => {
    return app.getVersion()
  })
}
