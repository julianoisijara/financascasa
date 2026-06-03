import { ipcMain, app, dialog } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import type { AppData } from '../types/schema'

const DATA_FILE_NAME = 'finance-data.json'
const CONFIG_FILE_NAME = 'app-config.json'

/** Reads the persisted app configuration (custom data path, etc.) */
function getConfigPath(): string {
  return path.join(app.getPath('userData'), CONFIG_FILE_NAME)
}

function readConfig(): { customDataDir?: string } {
  try {
    const configPath = getConfigPath()
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    }
  } catch (err) {
    console.error('[Config] read error:', err)
  }
  return {}
}

function writeConfig(config: { customDataDir?: string }): void {
  try {
    fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), 'utf-8')
  } catch (err) {
    console.error('[Config] write error:', err)
  }
}

/** Returns the resolved path to the finance-data.json file */
function getDataFilePath(): string {
  const config = readConfig()
  if (config.customDataDir) {
    return path.join(config.customDataDir, DATA_FILE_NAME)
  }
  return path.join(app.getPath('userData'), DATA_FILE_NAME)
}

export function registerIpcHandlers(): void {
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
      const dataFilePath = getDataFilePath()
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
      const dataFilePath = getDataFilePath()
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

  // ─── Settings: data file path management ───

  /** Returns the current data file path */
  ipcMain.handle('settings:getDataPath', () => {
    return { success: true, path: getDataFilePath() }
  })

  /** Returns the default data directory (userData) */
  ipcMain.handle('settings:getDefaultDataDir', () => {
    return { success: true, path: app.getPath('userData') }
  })

  /** Opens a folder picker dialog and returns the chosen directory */
  ipcMain.handle('settings:chooseDataDir', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Escolha o local para salvar os dados',
      properties: ['openDirectory', 'createDirectory'],
      buttonLabel: 'Selecionar Pasta'
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true }
    }

    return { success: true, path: result.filePaths[0] }
  })

  /**
   * Changes the data directory.
   * - If data exists in the old location, copies it to the new one.
   * - If data already exists in the new location, uses it.
   * - If no data exists anywhere, creates a new empty file.
   */
  ipcMain.handle('settings:setDataDir', async (_event, newDir: string) => {
    try {
      const oldPath = getDataFilePath()
      const newPath = path.join(newDir, DATA_FILE_NAME)

      // Ensure directory exists
      if (!fs.existsSync(newDir)) {
        fs.mkdirSync(newDir, { recursive: true })
      }

      // If the new path already has a data file, just switch to it
      if (fs.existsSync(newPath)) {
        // Validate JSON
        const raw = fs.readFileSync(newPath, 'utf-8')
        JSON.parse(raw) // throws if invalid
      } else if (fs.existsSync(oldPath)) {
        // Copy old data to new location
        fs.copyFileSync(oldPath, newPath)
      } else {
        // Create an empty file
        fs.writeFileSync(newPath, '{}', 'utf-8')
      }

      // Persist new directory in config
      writeConfig({ customDataDir: newDir })

      return { success: true, path: newPath }
    } catch (err) {
      console.error('[IPC] settings:setDataDir error:', err)
      return { success: false, error: String(err) }
    }
  })

  /** Resets back to the default userData directory */
  ipcMain.handle('settings:resetDataDir', () => {
    try {
      writeConfig({}) // clear custom dir
      return { success: true, path: getDataFilePath() }
    } catch (err) {
      console.error('[IPC] settings:resetDataDir error:', err)
      return { success: false, error: String(err) }
    }
  })
}
