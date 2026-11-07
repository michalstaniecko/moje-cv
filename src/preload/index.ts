import { contextBridge, ipcRenderer } from 'electron'
import type { Api } from '../shared/api'
import type { InterfaceLanguage } from '../shared/i18n/languages'

// Wąskie API dla renderera.
const api: Api = {
  app: {
    version: () => ipcRenderer.invoke('app:version')
  },
  cv: {
    list: () => ipcRenderer.invoke('cv:list'),
    get: (id) => ipcRenderer.invoke('cv:get', id),
    create: () => ipcRenderer.invoke('cv:create'),
    addSample: () => ipcRenderer.invoke('cv:add-sample'),
    duplicate: (id) => ipcRenderer.invoke('cv:duplicate', id),
    rename: (id, name) => ipcRenderer.invoke('cv:rename', id, name),
    setTags: (id, tags) => ipcRenderer.invoke('cv:set-tags', id, tags),
    update: (document) => ipcRenderer.invoke('cv:update', document),
    delete: (id) => ipcRenderer.invoke('cv:delete', id),
    exportFile: (id) => ipcRenderer.invoke('cv:export-file', id),
    importFile: () => ipcRenderer.invoke('cv:import-file')
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
  language: {
    get: () => ipcRenderer.invoke('language:get'),
    onChange: (listener) => {
      const changed = (_event: Electron.IpcRendererEvent, language: InterfaceLanguage) => listener(language)
      ipcRenderer.on('language:changed', changed)
      return () => {
        ipcRenderer.off('language:changed', changed)
      }
    }
  },
  editor: {
    setActive: (active) => ipcRenderer.send('editor:active', active),
    onHistoryCommand: (listener) => {
      const undo = () => listener('undo')
      const redo = () => listener('redo')
      ipcRenderer.on('editor:undo', undo)
      ipcRenderer.on('editor:redo', redo)
      return () => {
        ipcRenderer.off('editor:undo', undo)
        ipcRenderer.off('editor:redo', redo)
      }
    }
  },
  sponsor: {
    isAvailable: () => ipcRenderer.invoke('sponsor:is-available'),
    open: () => ipcRenderer.invoke('sponsor:open')
  },
  print: {
    getDocument: () => ipcRenderer.invoke('print:document'),
    ready: () => ipcRenderer.send('print:ready')
  }
}

contextBridge.exposeInMainWorld('api', api)
