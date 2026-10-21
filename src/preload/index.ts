import { contextBridge, ipcRenderer } from 'electron'
import type { Api } from '../shared/api'

// Wąskie API dla renderera. Operacje na CV i ustawieniach dojdą w kolejnych etapach.
const api: Api = {
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
