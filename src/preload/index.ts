import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose ipcRenderer to the Renderer Process ---------
// `exposeInMainWorld` can't receive native functions or classes.
contextBridge.exposeInMainWorld('electronAPI', {
  // Auth
  login: () => ipcRenderer.invoke('auth:login'),
  logout: () => ipcRenderer.invoke('auth:logout'),
  isAuthenticated: () => ipcRenderer.invoke('auth:check'),

  // Drive data
  readData: () => ipcRenderer.invoke('drive:read'),
  writeData: (data: unknown) => ipcRenderer.invoke('drive:write', data),

  // App info
  getVersion: () => ipcRenderer.invoke('app:version'),

  // Menu events
  onMenuLogin: (callback: () => void) => ipcRenderer.on('menu:login', () => callback()),
  onMenuLogout: (callback: () => void) => ipcRenderer.on('menu:logout', () => callback()),
  onMenuOpenUsers: (callback: () => void) => ipcRenderer.on('menu:open-users', () => callback()),
  onMenuOpenYears: (callback: () => void) => ipcRenderer.on('menu:open-years', () => callback()),
  onMenuOpenSettings: (callback: () => void) =>
    ipcRenderer.on('menu:open-settings', () => callback()),

  // Settings
  getDataPath: () => ipcRenderer.invoke('settings:getDataPath'),
  getDefaultDataDir: () => ipcRenderer.invoke('settings:getDefaultDataDir'),
  chooseDataDir: () => ipcRenderer.invoke('settings:chooseDataDir'),
  setDataDir: (dir: string) => ipcRenderer.invoke('settings:setDataDir', dir),
  resetDataDir: () => ipcRenderer.invoke('settings:resetDataDir')
})
