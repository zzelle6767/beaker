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

  // create first shell window
  return createWindow()
}

export function createWindow (url='beaker:start', {background} = {}) {
  // create window
  var win = new BrowserWindow(Object.assign(
    getWindowBounds(),
    {
      fullscreenable: false,
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
    }
  ))
  downloads.registerListener(win)
  win.loadURL(url)
  debug(`Opening ${url}`)

  if (background) {
    // open behind the current window
    // TODO this isnt working
    // let lastWin = activeWindows[currentWindowIndex]
    // win.showInactive()
    // if (lastWin) lastWin.focus()
  }

  // create nav-bar subwindow
  win.navBarWin = new BrowserWindow(Object.assign(
    getNavBarBounds(win),
    {
      parent: win,
      show: false,
      transparent: true,
      frame: false,
      focusable: false,
      hasShadow: false,
      movable: false,
      resizable: false,
      closable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true
    }
  ))
  win.navBarWin.loadURL('beaker:nav-bar')

  // create status-bar subwindow
  win.statusBarWin = new BrowserWindow(Object.assign(
    getStatusBarBounds(win),
    {
      parent: win,
      show: false,
      transparent: true,
      frame: false,
      focusable: false,
      hasShadow: false,
      movable: false,
      resizable: false,
      closable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true
    }
  ))
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

  // track the window
  addWindow(win)

  return win
}


export function closeWindow (win) {
  win.close()
}

export function getActiveWindow () {
  // try to pull the focused window; if there isnt one, fallback to the last created
  var win = BrowserWindow.getFocusedWindow()
  if (!win) {
    win = BrowserWindow.getAllWindows().pop()
  }
  return win
}

export function toggleAlwaysOnTop (win) {
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

function getCurrentDisplay () {
  var display
  var currentWindow = BrowserWindow.getFocusedWindow()
  if (currentWindow) {
    display = screen.getDisplayMatching(currentWindow.getBounds())
  }
  if (!display) {
    display = screen.getPrimaryDisplay()
  }
  return display
}

function getWindowBounds () {
  var bounds = getCurrentDisplay().bounds
  var width = Math.max(800, Math.min(1800, bounds.width - 50))
  var height = Math.max(600, Math.min(1200, bounds.height - 50))
  return {
    x: bounds.x + (bounds.width - width) / 2,
    y: bounds.y + (bounds.height - height) / 2,
    width,
    height
  }
}

function getNavBarBounds (win) {
  var {x, y, width, height} = win.getBounds()
  return {
    x: x + 85,
    y,
    width: width - 85,
    height: 24,
  }  
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

function addWindow (win) {
  // add to tracking
  activeWindows.push(win)
  currentWindowIndex = activeWindows.length - 1

  // update navbars
  renderNavBars()
}

function renderNavBars () {
  // construct info about the current state
  var tabs = activeWindows
    .map(w => ({
      title: w.webContents.getTitle(),
      url: w.webContents.getURL()
    }))
  tabs = JSON.stringify(tabs)

  // send data to the navbars
  activeWindows.forEach(w => {
    if (!w.navBarWin) return
    w.navBarWin.webContents.executeJavaScript(`
      setTabs(${tabs})
    `)
  })
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
    win.setTitle('')//win.webContents.getTitle() + ' - ' + win.webContents.getURL()) TODO remove?
    renderNavBars()
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
    // stop tracking
    var i = activeWindows.findIndex(w => w == win)
    if (i !== -1) activeWindows.splice(i, 1)
    else console.error('Failed to splice out window from activeWindows')

    // destroy navbar
    if (win.navBarWin) {
      win.navBarWin.close()
      win.navBarWin = null
    }

    // destroy statusbar
    if (win.statusBarWin) {
      win.statusBarWin.close()
      win.statusBarWin = null
    }

    // deny any outstanding permission requests
    permissions.denyAllRequests(win)

    // unregister shortcuts
    unregisterAllShortcuts(win)

    // render
    renderNavBars()
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

function onNextWindow (win, dir) {
  return () => {
    // TODO
    // currentWindowIndex += dir
    // while (currentWindowIndex >= activeWindows.length) {
    //   currentWindowIndex -= activeWindows.length
    // }
    // if (currentWindowIndex < 0) {
    //   currentWindowIndex = 0
    // }
    // activeWindows[currentWindowIndex].focus()
  }
}

function onGoBack (win) {
  return () => win.webContents.goBack()
}

function onGoForward (win) {
  return () => win.webContents.goForward()
}