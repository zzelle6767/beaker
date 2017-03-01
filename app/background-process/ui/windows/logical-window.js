import Tab from './tab'

export default class LogicalWindow {
  constructor() {
    this.tabs = []
    this.currentTabIndex = 0
  }

  // getters
  // =

  get currentTab() {
    return this.tabs[this.currentTabIndex] || this.tabs[0]
  }

  // methods
  // =

  openTab(url, {background} = {}) {
    // create tab
    var tab = new Tab()
    tab.loadURL(url)

    // register events
    tab.on('new-window', this.onNewWindow.bind(this))
    tab.on('close', this.onClose.bind(this))
    tab.on('change-tab', this.onChangeTab.bind(this))
    tab.on('set-tab', this.onSetTab.bind(this))
    tab.on('loading-state-change', this.onLoadingStateChange.bind(this))

    // add to tracking
    this.tabs.push(tab)
    if (!background) {
      this.setCurrentTab(this.tabs.length - 1)
    }

    // update navbars
    this.renderNavBars()
  }

  setCurrentTab(index) {
    if (!this.tabs[index]) {
      return
    }

    // hide old tab, show new tab
    var oldTab = this.currentTab
    this.currentTabIndex = index
    this.currentTab.show()
    if (oldTab && oldTab !== this.currentTab) {
      oldTab.hide()
    }
    this.renderNavBars()
  }

  renderNavBars() {
    // construct info about the current state
    var tabInfo = this.tabs.map((t,i) => ({
      title: t.getTitle(),
      url: t.getURL(),
      selected: i === this.currentTabIndex
    }))
    tabInfo = JSON.stringify(tabInfo)

    // send data to the navbars
    this.tabs.forEach(tab => {
      if (!tab.navBar) return
      // TODO
      tab.navBar.webContents.executeJavaScript(`
        setTabs(${tabInfo})
      `)
    })
  }

  // event handlers
  // =

  onNewWindow(e, url, frameName, disposition) {
    this.openTab(url, {background: disposition === 'background-tab'})
  }

  onClose(tab) {
    // stop tracking 
    var index = this.tabs.findIndex(t => t == tab)
    if (index !== -1) {
      this.tabs.splice(index, 1)
    }
    // show another tab
    if (tabs.length) {
      this.setCurrentTab(index > 0 ? index - 1 : 0)
    }
  }
  
  onSetTab(index) {
    this.setCurrentTab(index)
  }

  onChangeTab(dir) {
    var newIndex = this.currentTabIndex + dir
    if (newIndex >= this.tabs.length) newIndex -= this.tabs.length
    if (newIndex < 0) newIndex += this.tabs.length 
    this.setCurrentTab(newIndex)
  }

  onLoadingStateChange() {
    this.renderNavBars()
  }
}