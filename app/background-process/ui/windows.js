import { app, BrowserWindow, screen, ipcMain } from 'electron'
import { register as registerShortcut, unregisterAll as unregisterAllShortcuts } from 'electron-localshortcut'
import jetpack from 'fs-jetpack'
import path from 'path'
import * as downloads from './downloads'
import * as permissions from './permissions'
var debug = require('debug')('beaker')

// globals
// =
var userDataDir
var stateStoreFile = 'shell-window-state.json'
var currentWindowIndex = 0 // currently focused window
var activeWindows = []
var switcherWindow = null

// exported methods
// =

export function setup () {
  // config
  userDataDir = jetpack.cwd(app.getPath('userData'))

  // load pinned tabs
  // TODO:notabs
  // ipcMain.on('shell-window-ready', e => {
  //   // if this is the first window opened (since app start or since all windows closing)
  //   if (activeWindows.length === 1) {
  //     e.sender.webContents.send('command', 'load-pinned-tabs')
  //   }
  // })

  // create the persistent switcher window
  createSwitcherWindow()

  // create first shell window
  return createWindow()
}

export function createWindow (url='beaker:start') {
  // create window
  var { x, y, width, height } = ensureVisibleOnSomeDisplay(restoreState())
  var win = new BrowserWindow({
    'standard-window': false, // ? what is this?
    x, y, width, height,
    webPreferences: {
      webSecurity: true,
      nodeIntegration: false,
      preload: path.join(app.getAppPath(), 'webview-preload.build.js'),
      allowDisplayingInsecureContent: true,
      allowRunningInsecureContent: false
      // sandbox: true, TODO!
      // contextIsolation: true TODO!
    },
    icon: path.join(__dirname, (process.platform === 'win32') ? './assets/img/logo.ico' : './assets/img/logo.png')
  })
  downloads.registerListener(win)
  win.loadURL(url)
  debug(`Opening ${url}`)
  activeWindows.push(win)

  // register behaviors
  win.on('focus', onFocus(win))
  win.on('page-title-updated', onPageTitleUpdated(win))
  win.on('close', onClose(win))
  win.webContents.on('new-window', onNewWindow(win))

  // register shortcuts
  registerShortcut(win, 'Ctrl+Tab', onNextWindow(win))
  registerShortcut(win, 'Ctrl+Shift+Tab', onNextWindow(win, -1))
  for (var i=1; i <= 9; i++)
    registerShortcut(win, 'CmdOrCtrl+'+i, onWindowSelect(win, i-1))
  registerShortcut(win, 'CmdOrCtrl+[', onGoBack(win))
  registerShortcut(win, 'CmdOrCtrl+]', onGoForward(win))

  return win
}

export function createSwitcherWindow () {
  if (switcherWindow) return

  // TODO choose good dimensions
  var x = 5
  var y = 5
  var width = 400
  var height = 100
  switcherWindow = new BrowserWindow({
    x, y, width, height,
    frame: false,
    show: false,
    webPreferences: {
      webSecurity: true,
      nodeIntegration: false
    },
    icon: path.join(__dirname, (process.platform === 'win32') ? './assets/img/logo.ico' : './assets/img/logo.png')
  })
  switcherWindow.loadURL('beaker:switcher')

  // register behaviors
  switcherWindow.on('blur', onHide(switcherWindow))

  // register shortcuts
  registerShortcut(switcherWindow, 'Ctrl+Tab', onNextWindow(switcherWindow))
  registerShortcut(switcherWindow, 'Ctrl+Shift+Tab', onNextWindow(switcherWindow, -1))
  registerShortcut(switcherWindow, 'Escape', onHide(switcherWindow))
  registerShortcut(switcherWindow, 'Enter', onSelect(switcherWindow))
}

export function closeWindow (win) {
  if (win === switcherWindow) {
    // just hide
    switcherWindow.hide()    
  } else {
    win.close()
  }
}

export function getActiveWindow () {
  // try to pull the focused window; if there isnt one, fallback to the last created
  var win = BrowserWindow.getFocusedWindow()
  if (!win) {
    win = BrowserWindow.getAllWindows().pop()
  }
  return win
}

export function showSwitcherWindow () {
  var currentWindow = BrowserWindow.getFocusedWindow()

  // position on the screen
  var display
  if (currentWindow && currentWindow !== switcherWindow) {
    display = screen.getDisplayMatching(currentWindow.getBounds())
  }
  if (!display) {
    display = screen.getPrimaryDisplay()
  }
  var width = Math.min(1000, display.bounds.width - 100)
  switcherWindow.setContentBounds({
    x: display.bounds.x + (display.bounds.width - width) / 2,
    y: display.bounds.y + ((display.bounds.height - display.bounds.y) / 2) - 100,
    width: width,
    height: 115
  })

  // make visible
  renderSwitcher()
  switcherWindow.show()
  switcherWindow.focus()
}

// internal methods
// =

function getCurrentPosition (win) {
  var position = win.getPosition()
  var size = win.getSize()
  return {
    x: position[0],
    y: position[1],
    width: size[0],
    height: size[1]
  }
}

function windowWithinBounds (windowState, bounds) {
  return windowState.x >= bounds.x &&
    windowState.y >= bounds.y &&
    windowState.x + windowState.width <= bounds.x + bounds.width &&
    windowState.y + windowState.height <= bounds.y + bounds.height
}

function restoreState () {
  var restoredState = {}
  try {
    restoredState = userDataDir.read(stateStoreFile, 'json')
  } catch (err) {
    // For some reason json can't be read (might be corrupted).
    // No worries, we have defaults.
  }
  return Object.assign({}, defaultState(), restoredState)
}

function defaultState () {
  var bounds = screen.getPrimaryDisplay().bounds
  var width = Math.max(800, Math.min(1800, bounds.width - 50))
  var height = Math.max(600, Math.min(1200, bounds.height - 50))
  return Object.assign({}, {
    x: (bounds.width - width) / 2,
    y: (bounds.height - height) / 2,
    width,
    height
  })
}

function ensureVisibleOnSomeDisplay (windowState) {
  var visible = screen.getAllDisplays().some(display => windowWithinBounds(windowState, display.bounds))
  if (!visible) {
    // Window is partially or fully not visible now.
    // Reset it to safe defaults.
    return defaultState(windowState)
  }
  return windowState
}

function renderSwitcher () {  
  // construct info about the current state
  var processes = activeWindows.map(w => ({
    title: w.getTitle(),
    url: w.webContents.getURL()
  }))

  // send data to the switcher
  switcherWindow.webContents.executeJavaScript(`
    setCurrent(${currentWindowIndex})
    setProcesses(${JSON.stringify(processes)})
    render()
  `)
}

// event handlers
// =

function onFocus (win) {
  return e => {
    currentWindowIndex = activeWindows.findIndex(w => w == win)
    if (currentWindowIndex === -1) currentWindowIndex = 0
  }
}

function onPageTitleUpdated (win) {
  return e => {
    e.preventDefault()
    win.setTitle(win.webContents.getTitle() + ' - ' + win.webContents.getURL())
  }
}

function onNewWindow (win) {
  return (e, url, frameName, disposition) => {
    e.preventDefault()
    createWindow(url)
  }
}

function onClose (win) {
  return e => {
    var i = activeWindows.findIndex(w => w == win)
    if (i !== -1) activeWindows.splice(i, 1)
    else console.error('Failed to splice out window from activeWindows')

    // deny any outstanding permission requests
    permissions.denyAllRequests(win)

    // unregister shortcuts
    unregisterAllShortcuts(win)

    // save state
    // NOTE this is called by .on('close')
    // if quitting multiple windows at once, the final saved state is unpredictable
    if (!win.isMinimized() && !win.isMaximized()) {
      var state = getCurrentPosition(win)
      userDataDir.write(stateStoreFile, state, { atomic: true })
    }
  }
}

// shortcut event handlers
// =

function onWindowSelect (win, winIndex) {
  return () => {
    if (activeWindows[winIndex]) {
      activeWindows[winIndex].focus()
    }
  }
}

function onNextWindow (win, direction=1) {
  return () => {
    if (!switcherWindow.isFocused()) {
      // show the switcher on first hit
      showSwitcherWindow()
    } else {
      // cycle through active windows
      currentWindowIndex += direction
      if (currentWindowIndex < 0) {
        currentWindowIndex += activeWindows.length
      }
      if (currentWindowIndex >= activeWindows.length) {
        currentWindowIndex -= activeWindows.length
      }
      renderSwitcher()
    }
  }
}
function onGoBack (win) {
  return () => win.webContents.goBack()
}

function onGoForward (win) {
  return () => win.webContents.goForward()
}

function onSelect (win) {
  return () => {
    var winToFocus = activeWindows[currentWindowIndex]
    switcherWindow.hide()
    if (winToFocus) {
      winToFocus.show()
      winToFocus.focus()
    }
  }
}

function onHide (win) {
  return () => win.hide()
}