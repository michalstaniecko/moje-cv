import { contextBridge, ipcRenderer } from 'electron'
import type { Api, MenuCommand } from '../shared/api'
import type { InterfaceLanguage } from '../shared/i18n/languages'

// Prośba o zapis przed zamknięciem okna (`editor:flush-request` z identyfikatorem) dostaje zawsze odpowiedź: wynik
// zapisu z edytora CV albo `true`, gdy żaden edytor nie słucha (nie ma czego zapisywać).
let flushListener: (() => Promise<boolean>) | null = null
ipcRenderer.on('editor:flush-request', async (_event, requestId: string) => {
  const saved = flushListener ? await flushListener().catch(() => false) : true
  ipcRenderer.send('editor:flush-result', requestId, saved === true)
})

// Wąskie API dla renderera.
const api: Api = {
  app: {
    version: () => ipcRenderer.invoke('app:version'),
    reload: () => ipcRenderer.invoke('app:reload')
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
    export: (document) => ipcRenderer.invoke('pdf:export', document)
  },
  exported: {
    open: (filePath) => ipcRenderer.invoke('exported:open', filePath),
    showInFolder: (filePath) => ipcRenderer.invoke('exported:show-in-folder', filePath)
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
    onHistoryCommand: (listener) => {
      const undo = () => listener('undo')
      const redo = () => listener('redo')
      ipcRenderer.on('editor:undo', undo)
      ipcRenderer.on('editor:redo', redo)
      return () => {
        ipcRenderer.off('editor:undo', undo)
        ipcRenderer.off('editor:redo', redo)
      }
    },
    onFlushRequest: (listener) => {
      flushListener = listener
      return () => {
        if (flushListener === listener) flushListener = null
      }
    }
  },
  menu: {
    setScreen: (screen) => ipcRenderer.send('menu:screen', screen),
    onCommand: (listener) => {
      const command = (_event: Electron.IpcRendererEvent, value: MenuCommand) => listener(value)
      ipcRenderer.on('menu:command', command)
      return () => {
        ipcRenderer.off('menu:command', command)
      }
    }
  },
  sponsor: {
    isAvailable: () => ipcRenderer.invoke('sponsor:is-available'),
    open: () => ipcRenderer.invoke('sponsor:open')
  },
  updates: {
    notice: () => ipcRenderer.invoke('updates:notice'),
    onNotice: (listener) => {
      const changed = (_event: Electron.IpcRendererEvent, version: string) => listener(version)
      ipcRenderer.on('updates:notice-changed', changed)
      return () => {
        ipcRenderer.off('updates:notice-changed', changed)
      }
    },
    download: () => ipcRenderer.invoke('updates:download'),
    dismiss: () => ipcRenderer.invoke('updates:dismiss')
  },
  print: {
    getDocument: () => ipcRenderer.invoke('print:document'),
    ready: () => ipcRenderer.send('print:ready')
  }
}

contextBridge.exposeInMainWorld('api', api)
