import { app, BrowserWindow, ipcMain, Menu, type BaseWindow, type MenuItemConstructorOptions, type WebContents } from 'electron'
import type { HistoryCommand } from '../shared/api'
import { requireBoolean } from './ipcArgs'

// Okna (według id webContents), w których jest otwarty edytor CV – zgłasza je renderer.
// Wartość odpina nasłuchiwanie zamknięcia i przeładowania okna i usuwa flagę.
const activeEditors = new Map<number, () => void>()

// Polskie menu aplikacji. Cofnij / Ponów w edytorze CV działają na historii CV (jak Cmd+Z w edytorze),
// a poza edytorem jak zwykłe cofanie pola tekstowego.
export function registerAppMenu(): void {
  ipcMain.on('editor:active', (event, active: unknown) => {
    if (requireBoolean(active)) trackEditor(event.sender)
    else activeEditors.get(event.sender.id)?.()
  })
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate()))
}

// Flaga znika razem z oknem i przy przeładowaniu strony (edytor zgłosi się ponownie po otwarciu).
function trackEditor(contents: WebContents) {
  if (activeEditors.has(contents.id)) return
  const id = contents.id
  const onNavigation = (details: Electron.Event<Electron.WebContentsDidStartNavigationEventParams>) => {
    if (details.isMainFrame && !details.isSameDocument) clear()
  }
  const clear = () => {
    activeEditors.delete(id)
    if (contents.isDestroyed()) return
    contents.off('did-start-navigation', onNavigation)
    contents.off('destroyed', clear)
  }
  contents.on('did-start-navigation', onNavigation)
  contents.once('destroyed', clear)
  activeEditors.set(id, clear)
}

// Skrót Cmd+Z obsłużony przez edytor (preventDefault) nie dociera do menu, więc tu trafia tylko kliknięcie
// w menu albo skrót poza edytorem.
function historyCommand(command: HistoryCommand) {
  return (_item: Electron.MenuItem, window: BaseWindow | undefined) => {
    if (!(window instanceof BrowserWindow)) return
    const contents = window.webContents
    if (activeEditors.has(contents.id)) contents.send(`editor:${command}`)
    else contents[command]()
  }
}

function menuTemplate(): MenuItemConstructorOptions[] {
  const appMenu: MenuItemConstructorOptions = {
    label: app.name,
    submenu: [
      { role: 'about', label: `O aplikacji ${app.name}` },
      { type: 'separator' },
      { role: 'hide', label: `Ukryj ${app.name}` },
      { role: 'hideOthers', label: 'Ukryj pozostałe' },
      { role: 'unhide', label: 'Pokaż wszystkie' },
      { type: 'separator' },
      { role: 'quit', label: `Zakończ ${app.name}` }
    ]
  }
  const editMenu: MenuItemConstructorOptions = {
    label: 'Edycja',
    submenu: [
      { label: 'Cofnij', accelerator: 'CmdOrCtrl+Z', click: historyCommand('undo') },
      { label: 'Ponów', accelerator: 'Shift+CmdOrCtrl+Z', click: historyCommand('redo') },
      { type: 'separator' },
      { role: 'cut', label: 'Wytnij' },
      { role: 'copy', label: 'Kopiuj' },
      { role: 'paste', label: 'Wklej' },
      { role: 'selectAll', label: 'Zaznacz wszystko' }
    ]
  }
  const windowMenu: MenuItemConstructorOptions = {
    label: 'Okno',
    submenu: [
      { role: 'minimize', label: 'Minimalizuj' },
      { role: 'zoom', label: 'Zoom' },
      { role: 'close', label: 'Zamknij okno' }
    ]
  }
  return process.platform === 'darwin' ? [appMenu, editMenu, windowMenu] : [editMenu, windowMenu]
}
