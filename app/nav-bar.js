
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
  tabsDiv.innerHTML = tabs.map(tab => {
    return `<span class="tab">
      <img src="beaker-favicon:${tab.url}">
      ${tab.title}
    </span>`
  }).join('')
}