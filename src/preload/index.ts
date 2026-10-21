import { contextBridge, ipcRenderer } from 'electron'
import type { Api } from '../shared/api'

// Wąskie API dla renderera. Ustawienia dojdą w kolejnych etapach.
const api: Api = {
  cv: {
    list: () => ipcRenderer.invoke('cv:list'),
    get: (id) => ipcRenderer.invoke('cv:get', id),
    create: () => ipcRenderer.invoke('cv:create'),
    duplicate: (id) => ipcRenderer.invoke('cv:duplicate', id),
    rename: (id, name) => ipcRenderer.invoke('cv:rename', id, name),
    update: (document) => ipcRenderer.invoke('cv:update', document),
    delete: (id) => ipcRenderer.invoke('cv:delete', id)
  },
  pdf: {
    export: (document) => ipcRenderer.invoke('pdf:export', document),
    open: (filePath) => ipcRenderer.invoke('pdf:open', filePath),
    showInFolder: (filePath) => ipcRenderer.invoke('pdf:show-in-folder', filePath)
  },
  print: {
    getDocument: () => ipcRenderer.invoke('print:document'),
    ready: () => ipcRenderer.send('print:ready')
  }
}

contextBridge.exposeInMainWorld('api', api)
