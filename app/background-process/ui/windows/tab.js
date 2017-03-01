import {app, BrowserWindow} from 'electron'
import {EventEmitter} from 'events'
import path from 'path'
import {register as registerShortcut, unregisterAll as unregisterAllShortcuts} from 'electron-localshortcut'
import {getContentWindowBounds, getNavBarBounds, getStatusBarBounds} from './positioning'
import * as downloads from '../downloads'
import * as permissions from '../permissions'

// exported api
// =

export default class Tab extends EventEmitter {
  constructor() {
    super()

    // create windows
    this.content = createContentWindow()
    this.navBar = createNavBarWindow(this.content)
    this.statusBar = createStatusBarWindow(this.content)

    // register behaviors
    downloads.registerListener(this.content)
    this.content.on('move', this.onReposition.bind(this))
    this.content.on('resize', this.onReposition.bind(this))
    this.content.on('close', this.onClose.bind(this))
    this.content.on('page-title-updated', e => e.preventDefault())
    this.content.webContents.on('update-target-url', this.onUpdateTargetUrl.bind(this))
    this.content.webContents.on('did-start-loading', this.onLoadingStateChange.bind(this))
    this.content.webContents.on('did-stop-loading', this.onLoadingStateChange.bind(this))
    this.content.webContents.on('new-window', this.onNewWindow.bind(this))
    registerShortcut(this.content, 'CmdOrCtrl+[', this.onGoBack.bind(this))
    registerShortcut(this.content, 'CmdOrCtrl+]', this.onGoForward.bind(this))

    // register emitters
    registerShortcut(this.content, 'Ctrl+Tab', emit(this, 'change-tab', 1))
    registerShortcut(this.content, 'Ctrl+Shift+Tab', emit(this, 'change-tab', -1))
    for (var i=1; i <= 9; i++) {
      registerShortcut(this.content, 'CmdOrCtrl+'+i, emit(this, 'set-tab', i-1))
    }
  }

  // methods
  // =

  loadURL(url) {
    console.log('loading', url)
    this.content.loadURL(url)
  }

  setStatus(status) {
    if (!this.statusBar) {
      return
    }

    if (!status) {
      // no status - if loading, show 'loading...'
      if (this.content.webContents.isLoading()) {
        status = 'Loading...'
      }
    }

    if (!status) {
      // no status, hide the bar
      this.statusBar.hide()
    } else {
      // show the bar with content
      this.statusBar.webContents.executeJavaScript(`
        setStatus(${JSON.stringify(status)})
      `)
      this.statusBar.show()
    }
  }

  show() {
    this.content.show()
    this.content.focus()
  }

  hide() {
    this.content.hide()
  }

  getTitle() {
    return this.content.webContents.getTitle()
  }

  getURL() {
    return this.content.webContents.getURL()
  }

  close() {
    // deny any outstanding permission requests
    permissions.denyAllRequests(this.content)

    // unregister shortcuts
    unregisterAllShortcuts(this.content)

    // destroy all windows
    if (this.content) {
      this.content.close()
      this.content = null
    }
    if (this.navBar) {
      this.navBar.close()
      this.navBar = null
    }
    if (this.statusBar) {
      this.statusBar.close()
      this.statusBar = null
    }

    // emit
    this.emit('close', this)
  }

  // event handlers
  // =

  onClose(e) {
    // TODO needed?
    console.log('CLOSE! do something?', e)
  }

  onReposition(e) {
    if (this.navBar) {
      this.navBar.setBounds(getNavBarBounds(this.content))
    }
    if (this.statusBar) {
      this.statusBar.setBounds(getStatusBarBounds(this.content))
    }
  }

  onUpdateTargetUrl(e, url) {
    this.setStatus( url)
  }

  onLoadingStateChange (e) {
    this.setStatus()
    this.emit('loading-state-change')
  }

  onNewWindow(e, url, frameName, disposition) {
    e.preventDefault()
    this.emit('new-window', e, url, frameName, disposition)
  }

  onGoBack () {
    this.content.webContents.goBack()
  }

  onGoForward () {
    this.content.webContents.goForward()
  }
}

// internal api
// =

function createContentWindow () {
  return new BrowserWindow(Object.assign(
    {},
    getContentWindowBounds(),
    {
      title: '',
      fullscreenable: false,
      show: false,
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
}

function createNavBarWindow (win) {
  var navBarWin = new BrowserWindow(Object.assign(
    {},
    getNavBarBounds(win),
    {
      parent: win,
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
  navBarWin.loadURL('beaker:nav-bar')
  return navBarWin
}

function createStatusBarWindow (win) {
  var statusBarWin = new BrowserWindow(Object.assign(
    {},
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
  statusBarWin.loadURL('beaker:status-bar')
  return statusBarWin
}

function emit (tabWindow, ...args) {
  return () => {
    tabWindow.emit(...args)
  }
}