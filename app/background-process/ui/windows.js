import {app, ipcMain} from 'electron'
import LogicalWindow from './windows/logical-window'

// globals
// =

var windows = []

// exported methods
// =

export function setup () {
  // load pinned tabs
  // TODO:notabs
  // ipcMain.on('shell-window-ready', e => {
  //   // if this is the first window opened (since app start or since all windows closing)
  //   if (activeWindows.length === 1) {
  //     e.sender.webContents.send('command', 'load-pinned-tabs')
  //   }
  // })

  // create first shell window
  return createWindow()
}

export function createWindow (url='beaker:start') {
  var win = new LogicalWindow()
  win.openTab(url)
  windows.push(win)
  return win
}

export function openTab (url='beaker:start', window=null, {background} = {}) {
  window = window || windows[0]
  window.openTab(url, {background})
}

export function closeWindow (win) {
  // TODO
  win.close()
}

// event handlers
// =

// TODO replace
// function onPageTitleUpdated (win) {
//   return e => {
//     e.preventDefault()
//     win.setTitle('')//win.webContents.getTitle() + ' - ' + win.webContents.getURL()) TODO remove?
//     renderNavBars()
//   }
// }
