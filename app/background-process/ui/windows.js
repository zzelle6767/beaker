import { app, BrowserWindow, screen, ipcMain, Menu } from 'electron'
import { register as registerShortcut, unregisterAll as unregisterAllShortcuts } from 'electron-localshortcut'
import jetpack from 'fs-jetpack'
import path from 'path'
import * as downloads from './downloads'
import * as permissions from './permissions'
var debug = require('debug')('beaker')

// globals
// =
var userDataDir
var currentWindowIndex = 0 // currently focused window
var activeWindows = []
var switcherWindow = null
var isQuitting = false

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

  // listen for quitting state
  app.on('before-quit', () => {
    isQuitting = true
  })

  // create the persistent switcher window
  createSwitcherWindow()

  // create first shell window
  return createWindow()
}

export function createWindow (url='beaker:start', {background} = {}) {
  // create window
  var { x, y, width, height } = getWindowBounds()
  var win = new BrowserWindow({
    'standard-window': false, // ? what is this?
    x, y, width, height,
    // show: !background, TODO this isnt working
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
  currentWindowIndex = activeWindows.length - 1

  if (background) {
    // open behind the current window
    // TODO this isnt working
    // let lastWin = activeWindows[currentWindowIndex]
    // win.showInactive()
    // if (lastWin) lastWin.focus()
  }

  // create status-bar subwindow
  var { x, y, width, height } = getStatusBarBounds(win)
  win.statusBarWin = new BrowserWindow({
    parent: win,
    x, y, width, height,
    show: false,
    transparent: true,
    frame: false,
    focusable: false,
    hasShadow: false
  })
  win.statusBarWin.loadURL('beaker:status-bar')

  // register behaviors
  win.on('focus', onFocus(win))
  win.on('move', onReposition(win))
  win.on('resize', onReposition(win))
  win.on('page-title-updated', onPageTitleUpdated(win))
  win.on('close', onClose(win))
  win.webContents.on('new-window', onNewWindow(win))
  win.webContents.on('update-target-url', onUpdateTargetUrl(win))
  win.webContents.on('did-start-loading', onLoadingStateChange(win))
  win.webContents.on('did-stop-loading', onLoadingStateChange(win))

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

  switcherWindow = new BrowserWindow({
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
  switcherWindow.on('blur', onSwitcherSelect(switcherWindow))
  switcherWindow.on('close', (e) => {
    if (!isQuitting) {
      // only hide unless we're quitting
      e.preventDefault()
      switcherWindow.hide()
    }
  })

  // register shortcuts
  registerShortcut(switcherWindow, 'Ctrl+Tab', onNextWindow(switcherWindow))
  registerShortcut(switcherWindow, 'Ctrl+Shift+Tab', onNextWindow(switcherWindow, -1))
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
  // make visible
  renderSwitcher()
  switcherWindow.show()
  switcherWindow.focus()
}

export function toggleAlwaysOnTop (win) {
  console.log('setting always on top', !win.isAlwaysOnTop())
  win.setAlwaysOnTop(!win.isAlwaysOnTop())
}

// internal methods
// =

function setStatus (win, status) {
  if (!win.statusBarWin) return

  if (!status) {
    // no status - if loading, show 'loading...'
    if (win.webContents.isLoading()) {
      status = 'Loading...'
    }
  }

  if (!status) {
    // definitely no status, hide the bar
    win.statusBarWin.hide()
  } else {
    // show the bar with content
    win.statusBarWin.webContents.executeJavaScript(`
      setStatus(${JSON.stringify(status)})
    `)
    win.statusBarWin.show()
  }
}

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

function getWindowBounds () {
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

function getStatusBarBounds (win) {
  var {x, y, width, height} = win.getBounds()
  return {
    x,
    y: (y + height - 24),
    width: 400,
    height: 24,
  }
}

function renderSwitcher () {  
  var currentWindow = BrowserWindow.getFocusedWindow()

  // construct info about the current state
  var processes = activeWindows
    .map(w => ({
      title: w.getTitle(),
      url: w.webContents.getURL()
    }))

  // position on the screen
  var display
  if (currentWindow && currentWindow !== switcherWindow) {
    display = screen.getDisplayMatching(currentWindow.getBounds())
  }
  if (!display) {
    display = screen.getPrimaryDisplay()
  }
  var width = Math.min(1000, display.bounds.width - 100)
  var height = Math.min(processes.length * 40, display.bounds.height - 100)
  switcherWindow.setContentBounds({
    x: display.bounds.x + (display.bounds.width - width) / 2,
    y: display.bounds.y + ((display.bounds.height - display.bounds.y) / 2) - height,
    width,
    height
  })

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
    // track the current window
    currentWindowIndex = activeWindows.findIndex(w => w == win)
    if (currentWindowIndex === -1) currentWindowIndex = 0

    // update the app menu
    var menu = Menu.getApplicationMenu()
    var windowMenu = menu.items.find(m => m.label === 'Window')
    var alwaysOnTop = windowMenu.submenu.items.find(m => m.label === 'Always on Top')
    alwaysOnTop.checked = win.isAlwaysOnTop()
  }
}

function onReposition (win) {
  return e => {
    if (!win.statusBarWin) return
    win.statusBarWin.setBounds(getStatusBarBounds(win))
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
    createWindow(url, {background: disposition === 'background-tab'})
  }
}

function onUpdateTargetUrl (win) {
  return (e, url) => {
    setStatus(win, url)
  }
}

function onLoadingStateChange (win) {
  return (e) => {
    setStatus(win)
  }
}

function onClose (win) {
  return e => {
    var i = activeWindows.findIndex(w => w == win)
    if (i !== -1) activeWindows.splice(i, 1)
    else console.error('Failed to splice out window from activeWindows')

    // destroy statusbar
    if (win.statusBarWin) {
      win.statusBarWin.close()
      win.statusBarWin = null
    }

    // deny any outstanding permission requests
    permissions.denyAllRequests(win)

    // unregister shortcuts
    unregisterAllShortcuts(win)
  }
}

// shortcut event handlers
// =

function onWindowSelect (win, winIndex) {
  return () => {
    if (activeWindows[winIndex]) {
      currentWindowIndex = winIndex
      activeWindows[winIndex].focus()
    }
  }
}

function onNextWindow (win, direction=1) {
  return () => {
    if (!switcherWindow.isFocused()) {
      // show the switcher on first hit
      showSwitcherWindow()
    }
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
function onGoBack (win) {
  return () => win.webContents.goBack()
}

function onGoForward (win) {
  return () => win.webContents.goForward()
}

function onSwitcherSelect (win) {
  return () => {
    var winToFocus = activeWindows[currentWindowIndex]
    switcherWindow.hide()
    if (winToFocus) {
      winToFocus.show()
      winToFocus.focus()
    }
  }
}