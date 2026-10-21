import { app, BrowserWindow, ipcMain, Menu, type BaseWindow, type MenuItemConstructorOptions, type WebContents } from 'electron'
import type { HistoryCommand } from '../shared/api'
import { interfaceLanguageCodes, interfaceLanguages, type InterfaceLanguage } from '../shared/i18n/languages'
import type { InterfaceLanguageState } from './interfaceLanguage'
import { requireBoolean } from './ipcArgs'

// Okna (według id webContents), w których jest otwarty edytor CV – zgłasza je renderer.
// Wartość odpina nasłuchiwanie zamknięcia i przeładowania okna i usuwa flagę.
const activeEditors = new Map<number, () => void>()

// Menu aplikacji w języku interfejsu, przebudowywane przy jego zmianie. Cofnij / Ponów w edytorze CV działają
// na historii CV (jak Cmd+Z w edytorze), a poza edytorem jak zwykłe cofanie pola tekstowego.
export function registerAppMenu(language: InterfaceLanguageState): void {
  ipcMain.on('editor:active', (event, active: unknown) => {
    if (requireBoolean(active)) trackEditor(event.sender)
    else activeEditors.get(event.sender.id)?.()
  })
  const build = () => {
    app.setAboutPanelOptions({ applicationName: language.dictionary().appName })
    Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate(language)))
  }
  language.onChange(build)
  build()
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

function menuTemplate(language: InterfaceLanguageState): MenuItemConstructorOptions[] {
  const { appName, menu } = language.dictionary()
  const appMenu: MenuItemConstructorOptions = {
    label: appName,
    submenu: [
      { role: 'about', label: menu.about(appName) },
      { type: 'separator' },
      { role: 'hide', label: menu.hide(appName) },
      { role: 'hideOthers', label: menu.hideOthers },
      { role: 'unhide', label: menu.showAll },
      { type: 'separator' },
      { role: 'quit', label: menu.quit(appName) }
    ]
  }
  const editMenu: MenuItemConstructorOptions = {
    label: menu.edit,
    submenu: [
      { label: menu.undo, accelerator: 'CmdOrCtrl+Z', click: historyCommand('undo') },
      { label: menu.redo, accelerator: 'Shift+CmdOrCtrl+Z', click: historyCommand('redo') },
      { type: 'separator' },
      { role: 'cut', label: menu.cut },
      { role: 'copy', label: menu.copy },
      { role: 'paste', label: menu.paste },
      { role: 'selectAll', label: menu.selectAll }
    ]
  }
  const windowMenu: MenuItemConstructorOptions = {
    label: menu.window,
    submenu: [
      { role: 'minimize', label: menu.minimize },
      { role: 'zoom', label: menu.zoom },
      { role: 'close', label: menu.closeWindow }
    ]
  }
  // Zaznaczony jest wybór użytkownika (albo System), a nie wynik – np. System przy polskim systemie.
  const choose = (choice: InterfaceLanguage | null) => () => {
    language.choose(choice).catch((error: unknown) => console.error('Nie udało się zapisać języka interfejsu', error))
  }
  const languageMenu: MenuItemConstructorOptions = {
    label: menu.language,
    submenu: [
      ...interfaceLanguageCodes.map(
        (code): MenuItemConstructorOptions => ({
          label: interfaceLanguages[code].name,
          type: 'radio',
          checked: language.preference() === code,
          click: choose(code)
        })
      ),
      { label: menu.systemLanguage, type: 'radio', checked: language.preference() === undefined, click: choose(null) }
    ]
  }
  return process.platform === 'darwin'
    ? [appMenu, editMenu, languageMenu, windowMenu]
    : [editMenu, languageMenu, windowMenu]
}
