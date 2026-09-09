import { ipcMain, app, dialog } from 'electron'
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
import {
  DATA_FILE_NAME,
  getLocalDataFilePath,
  getStorageMode,
  readConfig,
  updateConfig,
  writeConfig,
  type StorageMode
} from './config'
import * as gdrive from './googleDrive'

const DRIVE_BACKUP_FILE_NAME = 'finance-data.gdrive-backup.json'

/**
 * Modo realmente em uso. "gdrive" só vale com credenciais e conta conectada;
 * caso contrário o app abre com os dados locais, sem pedir login, e a nuvem
 * volta a valer assim que o usuário conectar em Configurações.
 */
function getEffectiveStorageMode(): StorageMode {
  if (getStorageMode() !== 'gdrive') return 'local'
  const status = gdrive.getStatus()
  return status.configured && status.connected ? 'gdrive' : 'local'
}

/** Cópia local do último conteúdo sincronizado com o Drive (somente segurança). */
function getDriveBackupPath(): string {
  return path.join(app.getPath('userData'), DRIVE_BACKUP_FILE_NAME)
}

/** Um arquivo "{}" (ou parcial) equivale a "sem dados": leva ao onboarding. */
function normalizeData(raw: string): AppData | null {
  const parsed = JSON.parse(raw)
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.users)) return null
  return parsed as AppData
}

async function readLocal(): Promise<{
  success: boolean
  data: AppData | null
  error?: string
}> {
  const dataFilePath = getLocalDataFilePath()
  try {
    const rawData = await readFileSafe(dataFilePath)
    return { success: true, data: normalizeData(rawData) }
  } catch (err) {
    if (errorCode(err) === 'ENOENT') {
      return { success: true, data: null }
    }
    console.error('[IPC] local:read error:', err)
    return { success: false, data: null, error: describeFsError(err) }
  }
}

async function readDrive(): Promise<{
  success: boolean
  data: AppData | null
  error?: string
  offline?: boolean
}> {
  try {
    const raw = await gdrive.readDataFile()
    if (raw === null) return { success: true, data: null }
    const data = normalizeData(raw)
    // Mantém a cópia de segurança em dia com o que está na nuvem
    await writeFileSafe(getDriveBackupPath(), raw).catch(() => undefined)
    return { success: true, data }
  } catch (err) {
    const driveErr = gdrive.toDriveError(err)
    console.error('[IPC] drive:read error:', driveErr.message)

    // Sem internet: abre a última cópia sincronizada em modo somente leitura
    if (driveErr.kind === 'offline') {
      try {
        const raw = await readFileSafe(getDriveBackupPath())
        return { success: true, data: normalizeData(raw), offline: true, error: driveErr.message }
      } catch {
        /* sem backup local */
      }
    }
    return { success: false, data: null, error: driveErr.message }
  }
}

export function registerIpcHandlers(): void {
  // ─── Auth (Google Drive) ───
  ipcMain.handle('auth:login', async () => {
    try {
      const { email } = await gdrive.connect()
      return { success: true, email }
    } catch (err) {
      const e = gdrive.toDriveError(err)
      return { success: false, error: e.message, kind: e.kind }
    }
  })

  ipcMain.handle('auth:logout', async () => {
    await gdrive.disconnect()
    // Sem conta conectada o modo nuvem não funciona; volta para local.
    updateConfig({ storageMode: 'local' })
    return { success: true }
  })

  /**
   * Local nunca precisa de login; nuvem precisa de credenciais e de uma conta
   * conectada. Um build sem Client ID (ex.: instalador gerado sem .env) cai na
   * tela de login, que permite informar as credenciais ou voltar ao modo local.
   */
  ipcMain.handle('auth:check', async () => {
    // O app nunca bloqueia na abertura; o login só é pedido ao ativar o Drive.
    return { authenticated: true }
  })

  // ─── Dados (roteados pelo modo de armazenamento) ───
  ipcMain.handle('drive:read', async () => {
    return getEffectiveStorageMode() === 'gdrive' ? readDrive() : readLocal()
  })

  ipcMain.handle('drive:write', async (_event, data: AppData) => {
    const contents = JSON.stringify(data, null, 2)
    if (getEffectiveStorageMode() === 'gdrive') {
      try {
        await gdrive.writeDataFile(contents)
        await writeFileSafe(getDriveBackupPath(), contents).catch(() => undefined)
        return { success: true }
      } catch (err) {
        const e = gdrive.toDriveError(err)
        console.error('[IPC] drive:write error:', e.message)
        return { success: false, error: e.message }
      }
    }
    try {
      await writeFileSafe(getLocalDataFilePath(), contents)
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

  // ─── Google Drive ───

  ipcMain.handle('gdrive:status', () => {
    return { success: true, mode: getEffectiveStorageMode(), ...gdrive.getStatus() }
  })

  ipcMain.handle('gdrive:setCredentials', (_event, clientId: string, clientSecret?: string) => {
    try {
      gdrive.setCredentials(clientId, clientSecret)
      return { success: true, ...gdrive.getStatus() }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('gdrive:listFolders', async (_event, parentId?: string) => {
    try {
      return { success: true, folders: await gdrive.listEntries(parentId || 'root') }
    } catch (err) {
      return { success: false, error: gdrive.toDriveError(err).message }
    }
  })

  ipcMain.handle('gdrive:createFolder', async (_event, parentId: string, name: string) => {
    try {
      return { success: true, folder: await gdrive.createFolder(parentId || 'root', name) }
    } catch (err) {
      return { success: false, error: gdrive.toDriveError(err).message }
    }
  })

  ipcMain.handle('gdrive:setFile', async (_event, fileId: string) => {
    try {
      return { success: true, ...(await gdrive.setFile(fileId)) }
    } catch (err) {
      return { success: false, error: gdrive.toDriveError(err).message }
    }
  })

  ipcMain.handle('gdrive:setFolder', async (_event, folderId: string) => {
    try {
      return { success: true, ...(await gdrive.setFolder(folderId)) }
    } catch (err) {
      return { success: false, error: gdrive.toDriveError(err).message }
    }
  })

  /**
   * Importa o JSON de credenciais baixado do Google Cloud
   * (client_secret_*.json, com a chave "installed" ou "web"). Só lê o arquivo.
   */
  ipcMain.handle('gdrive:importCredentialsFile', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Escolha o arquivo de credenciais do Google Cloud',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
      buttonLabel: 'Carregar'
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true }
    }

    try {
      const raw = await fsp.readFile(result.filePaths[0], 'utf-8')
      const parsed = JSON.parse(raw) as Record<
        string,
        { client_id?: string; client_secret?: string }
      >
      const kind = parsed.installed ? 'installed' : parsed.web ? 'web' : null
      const creds = kind ? parsed[kind] : null
      if (!creds?.client_id) {
        return {
          success: false,
          error:
            'Este arquivo não parece ser um JSON de credenciais OAuth do Google Cloud (esperado um objeto "installed" com "client_id").'
        }
      }
      gdrive.setCredentials(creds.client_id, creds.client_secret)
      return {
        success: true,
        clientId: creds.client_id,
        warning:
          kind === 'web'
            ? 'O arquivo é de um cliente do tipo "Aplicativo da Web". Prefira criar um do tipo "Aplicativo para computador" para o login funcionar.'
            : undefined
      }
    } catch (err) {
      if (err instanceof SyntaxError) {
        return { success: false, error: 'O arquivo não é um JSON válido.' }
      }
      return { success: false, error: describeFsError(err) }
    }
  })

  ipcMain.handle('gdrive:cancelConnect', () => {
    gdrive.cancelConnect()
    return { success: true }
  })

  /**
   * Troca o modo de armazenamento.
   * Ao ativar o Drive:
   * - se já existe finance-data.json na nuvem, ele passa a ser usado;
   * - senão, os dados locais atuais (se houver) são enviados para o Drive.
   */
  ipcMain.handle('gdrive:setStorageMode', async (_event, mode: StorageMode) => {
    if (mode === 'local') {
      updateConfig({ storageMode: 'local' })
      return { success: true, mode, source: 'local' as const }
    }

    if (!gdrive.isConnected()) {
      return {
        success: false,
        error: 'Conecte sua conta Google antes de ativar o armazenamento na nuvem.'
      }
    }

    try {
      if (await gdrive.hasDataFile()) {
        updateConfig({ storageMode: 'gdrive' })
        return { success: true, mode, source: 'drive-existing' as const }
      }

      const localPath = getLocalDataFilePath()
      let localRaw: string | null = null
      try {
        localRaw = await readFileSafe(localPath)
        if (!normalizeData(localRaw)) localRaw = null
      } catch (err) {
        if (errorCode(err) !== 'ENOENT') {
          return {
            success: false,
            error: `Não foi possível ler os dados locais para enviar à nuvem. ${describeFsError(err)}`
          }
        }
      }

      if (localRaw) {
        await gdrive.writeDataFile(localRaw)
        await writeFileSafe(getDriveBackupPath(), localRaw).catch(() => undefined)
        updateConfig({ storageMode: 'gdrive' })
        return { success: true, mode, source: 'uploaded-local' as const }
      }

      updateConfig({ storageMode: 'gdrive' })
      return { success: true, mode, source: 'empty' as const }
    } catch (err) {
      const e = gdrive.toDriveError(err)
      console.error('[IPC] gdrive:setStorageMode error:', e.message)
      return { success: false, error: e.message }
    }
  })

  /** Baixa o arquivo atual do Drive por cima do arquivo local (com confirmação). */
  ipcMain.handle('gdrive:downloadToLocal', async () => {
    try {
      const raw = await gdrive.readDataFile()
      if (raw === null) {
        return { success: false, error: 'Não há dados no Google Drive para baixar.' }
      }
      const localPath = getLocalDataFilePath()
      if (await pathExists(localPath)) {
        const { response } = await dialog.showMessageBox({
          type: 'warning',
          buttons: ['Substituir', 'Cancelar'],
          defaultId: 1,
          cancelId: 1,
          message: 'Substituir os dados locais?',
          detail: `O arquivo em "${localPath}" será substituído pela versão que está no Google Drive.`
        })
        if (response !== 0) return { success: false, canceled: true }
      }
      await writeFileSafe(localPath, raw)
      return { success: true, path: localPath }
    } catch (err) {
      const e = gdrive.toDriveError(err)
      return { success: false, error: e.message }
    }
  })

  // ─── Settings: data file path management ───

  /** Returns the current data file path */
  ipcMain.handle('settings:getDataPath', () => {
    return { success: true, path: getLocalDataFilePath() }
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
    const oldPath = getLocalDataFilePath()
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
      updateConfig({ customDataDir: newDir })

      return { success: true, path: newPath, warning }
    } catch (err) {
      console.error('[IPC] settings:setDataDir error:', err)
      return { success: false, error: describeFsError(err) }
    }
  })

  /** Resets back to the default userData directory */
  ipcMain.handle('settings:resetDataDir', () => {
    try {
      const config = readConfig()
      delete config.customDataDir
      writeConfig(config)
      return { success: true, path: getLocalDataFilePath() }
    } catch (err) {
      console.error('[IPC] settings:resetDataDir error:', err)
      return { success: false, error: describeFsError(err) }
    }
  })
}
