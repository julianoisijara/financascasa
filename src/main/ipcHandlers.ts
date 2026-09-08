import { ipcMain, app, dialog } from 'electron'
import * as fs from 'fs'
import * as fsp from 'fs/promises'
import * as path from 'path'
import type { AppData } from '../types/schema'
import {
  assertWritableDir,
  copyFileSafe,
  describeFsError,
  errorCode,
  pathExists,
  readFileSafe,
  writeFileSafe
} from './fsSafe'

const DATA_FILE_NAME = 'finance-data.json'
const CONFIG_FILE_NAME = 'app-config.json'

/** Reads the persisted app configuration (custom data path, etc.) */
function getConfigPath(): string {
  return path.join(app.getPath('userData'), CONFIG_FILE_NAME)
}

// The config file always lives in userData (never on a cloud mount), so plain
// sync I/O is safe here — unlike the data file, which the user can point at
// Google Drive / OneDrive.
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
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), 'utf-8')
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
    const dataFilePath = getDataFilePath()
    try {
      const rawData = await readFileSafe(dataFilePath)
      return { success: true, data: JSON.parse(rawData) }
    } catch (err) {
      if (errorCode(err) === 'ENOENT') {
        return { success: true, data: null }
      }
      console.error('[IPC] local:read error:', err)
      return { success: false, data: null, error: describeFsError(err) }
    }
  })

  ipcMain.handle('drive:write', async (_event, data: AppData) => {
    try {
      await writeFileSafe(getDataFilePath(), JSON.stringify(data, null, 2))
      return { success: true }
    } catch (err) {
      console.error('[IPC] local:write error:', err)
      return { success: false, error: describeFsError(err) }
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
   *
   * The target may be a cloud-sync folder, where every step can time out while
   * the provider downloads a placeholder. All I/O goes through fsSafe, and a
   * destination file we cannot read is accepted with a warning instead of
   * failing the whole switch — it is a valid file, just not materialised yet.
   */
  ipcMain.handle('settings:setDataDir', async (_event, newDir: string) => {
    const oldPath = getDataFilePath()
    const newPath = path.join(newDir, DATA_FILE_NAME)

    try {
      await fsp.mkdir(newDir, { recursive: true })
    } catch (err) {
      if (errorCode(err) !== 'EEXIST') {
        console.error('[IPC] settings:setDataDir mkdir error:', err)
        return { success: false, error: describeFsError(err) }
      }
    }

    // Fail early and clearly on read-only mounts (e.g. the Google Drive root).
    try {
      await assertWritableDir(newDir)
    } catch (err) {
      console.error('[IPC] settings:setDataDir not writable:', err)
      return { success: false, error: describeFsError(err) }
    }

    let warning: string | undefined

    try {
      let destinationExists: boolean
      try {
        destinationExists = await pathExists(newPath)
      } catch (err) {
        // Cannot confirm whether a file is there. Never overwrite on a guess.
        console.error('[IPC] settings:setDataDir stat error:', err)
        return { success: false, error: describeFsError(err) }
      }

      if (destinationExists) {
        try {
          JSON.parse(await readFileSafe(newPath))
        } catch (err) {
          if (err instanceof SyntaxError) {
            return {
              success: false,
              error: `Já existe um ${DATA_FILE_NAME} nessa pasta, mas ele está corrompido (JSON inválido). Renomeie ou remova esse arquivo e tente novamente.`
            }
          }
          // I/O problem (cloud placeholder not downloaded yet): the file is
          // there and will be read on the next app start, so accept the change.
          console.warn('[IPC] settings:setDataDir validation skipped:', err)
          warning = `O arquivo existente não pôde ser lido agora (${describeFsError(err)}) O local foi alterado mesmo assim; deixe a pasta sincronizar e reinicie o aplicativo.`
        }
      } else {
        // Whether the current file exists decides between "migrate" and "start
        // fresh". Guessing wrong would silently orphan the user's data, so a
        // stat we cannot complete aborts the switch instead.
        let sourceExists: boolean
        try {
          sourceExists = await pathExists(oldPath)
        } catch (err) {
          console.error('[IPC] settings:setDataDir source stat error:', err)
          return {
            success: false,
            error: `Não foi possível acessar os dados atuais em "${oldPath}". ${describeFsError(err)}`
          }
        }

        if (sourceExists) {
          await copyFileSafe(oldPath, newPath)
        } else {
          await writeFileSafe(newPath, '{}')
        }
      }

      // Persist new directory in config only after the data file is in place.
      writeConfig({ customDataDir: newDir })

      return { success: true, path: newPath, warning }
    } catch (err) {
      console.error('[IPC] settings:setDataDir error:', err)
      return { success: false, error: describeFsError(err) }
    }
  })

  /** Resets back to the default userData directory */
  ipcMain.handle('settings:resetDataDir', () => {
    try {
      writeConfig({}) // clear custom dir
      return { success: true, path: getDataFilePath() }
    } catch (err) {
      console.error('[IPC] settings:resetDataDir error:', err)
      return { success: false, error: describeFsError(err) }
    }
  })
}
