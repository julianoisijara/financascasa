import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

export const DATA_FILE_NAME = 'finance-data.json'
const CONFIG_FILE_NAME = 'app-config.json'

export type StorageMode = 'local' | 'gdrive'

export interface GoogleConfig {
  /** OAuth Client ID (Desktop app) informado pelo usuário nas Configurações */
  clientId?: string
  clientSecret?: string
  /** Refresh token criptografado (safeStorage) em base64 */
  tokens?: string
  /** E-mail da conta conectada, só para exibição */
  email?: string
  /** ID do finance-data.json no Drive */
  fileId?: string
  /** Pasta do Drive escolhida pelo usuário (padrão: "Meu Drive/FinancasCasa") */
  folderId?: string
  /** Caminho da pasta, só para exibição */
  folderPath?: string
  /** Nome do arquivo em uso, só para exibição (arquivo compartilhado) */
  fileName?: string
  /** Escopos concedidos no último login (para detectar login antigo) */
  scope?: string
}

export interface AppConfig {
  customDataDir?: string
  storageMode?: StorageMode
  google?: GoogleConfig
}

function getConfigPath(): string {
  return path.join(app.getPath('userData'), CONFIG_FILE_NAME)
}

// The config file always lives in userData (never on a cloud mount), so plain
// sync I/O is safe here — unlike the data file, which the user can point at
// Google Drive / OneDrive.
export function readConfig(): AppConfig {
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

export function writeConfig(config: AppConfig): void {
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), 'utf-8')
}

/** Shallow-merge `patch` into the persisted config. */
export function updateConfig(patch: Partial<AppConfig>): AppConfig {
  const next = { ...readConfig(), ...patch }
  writeConfig(next)
  return next
}

export function updateGoogleConfig(patch: Partial<GoogleConfig>): AppConfig {
  const current = readConfig()
  return updateConfig({ google: { ...(current.google ?? {}), ...patch } })
}

export function getStorageMode(): StorageMode {
  return readConfig().storageMode === 'gdrive' ? 'gdrive' : 'local'
}

/** Returns the resolved path to the local finance-data.json file */
export function getLocalDataFilePath(): string {
  const config = readConfig()
  if (config.customDataDir) {
    return path.join(config.customDataDir, DATA_FILE_NAME)
  }
  return path.join(app.getPath('userData'), DATA_FILE_NAME)
}
