import { contextBridge, ipcRenderer } from 'electron'
import type { Api } from '../shared/api'

// Wąskie API dla renderera.
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
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    addClause: (content) => ipcRenderer.invoke('settings:add-clause', content),
    updateClause: (id, content) => ipcRenderer.invoke('settings:update-clause', id, content),
    deleteClause: (id) => ipcRenderer.invoke('settings:delete-clause', id),
    setDefaultClause: (id) => ipcRenderer.invoke('settings:set-default-clause', id)
  },
  photo: {
    pick: () => ipcRenderer.invoke('photo:pick')
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
