import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose ipcRenderer to the Renderer Process ---------
// `exposeInMainWorld` can't receive native functions or classes.
contextBridge.exposeInMainWorld('electronAPI', {
  // Auth (Google)
  login: () => ipcRenderer.invoke('auth:login'),
  logout: () => ipcRenderer.invoke('auth:logout'),
  isAuthenticated: () => ipcRenderer.invoke('auth:check'),

  // Data (local file or Google Drive, depending on the storage mode)
  readData: () => ipcRenderer.invoke('drive:read'),
  writeData: (data: unknown) => ipcRenderer.invoke('drive:write', data),

  // Google Drive
  getDriveStatus: () => ipcRenderer.invoke('gdrive:status'),
  setDriveCredentials: (clientId: string, clientSecret?: string) =>
    ipcRenderer.invoke('gdrive:setCredentials', clientId, clientSecret),
  importDriveCredentialsFile: () => ipcRenderer.invoke('gdrive:importCredentialsFile'),
  cancelDriveConnect: () => ipcRenderer.invoke('gdrive:cancelConnect'),
  listDriveFolders: (parentId?: string) => ipcRenderer.invoke('gdrive:listFolders', parentId),
  createDriveFolder: (parentId: string, name: string) =>
    ipcRenderer.invoke('gdrive:createFolder', parentId, name),
  setDriveFolder: (folderId: string) => ipcRenderer.invoke('gdrive:setFolder', folderId),
  setDriveFile: (fileId: string) => ipcRenderer.invoke('gdrive:setFile', fileId),
  setStorageMode: (mode: 'local' | 'gdrive') => ipcRenderer.invoke('gdrive:setStorageMode', mode),
  downloadDriveToLocal: () => ipcRenderer.invoke('gdrive:downloadToLocal'),

  // App info
  getVersion: () => ipcRenderer.invoke('app:version'),

  // Menu events
  onMenuLogin: (callback: () => void) => ipcRenderer.on('menu:login', () => callback()),
  onMenuLogout: (callback: () => void) => ipcRenderer.on('menu:logout', () => callback()),
  onMenuOpenUsers: (callback: () => void) => ipcRenderer.on('menu:open-users', () => callback()),
  onMenuOpenYears: (callback: () => void) => ipcRenderer.on('menu:open-years', () => callback()),
  onMenuOpenSettings: (callback: () => void) =>
    ipcRenderer.on('menu:open-settings', () => callback()),

  // Settings (local storage)
  getDataPath: () => ipcRenderer.invoke('settings:getDataPath'),
  getDefaultDataDir: () => ipcRenderer.invoke('settings:getDefaultDataDir'),
  chooseDataDir: () => ipcRenderer.invoke('settings:chooseDataDir'),
  setDataDir: (dir: string) => ipcRenderer.invoke('settings:setDataDir', dir),
  resetDataDir: () => ipcRenderer.invoke('settings:resetDataDir')
})
