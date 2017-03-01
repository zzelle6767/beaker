
// globals
// =

var tabs = []

// exported api
// =

window.setTabs = t => {
  tabs = t
  renderTabs()
}

// internal methods
// =

function renderTabs () {
  tabsDiv.innerHTML = tabs.map((tab, i) => {
    var cls = `tab ${tab.selected?'selected':''}`
    return `<span class="${cls}"><img src="beaker-favicon:${tab.url}">${tab.title}</span>`
  }).join('')
  urlDiv.innerText = tabs.find(t => t.selected).url
}