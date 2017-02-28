var currentProcess = 1
var processes = []

window.setCurrent = n => {currentProcess = n}
window.setProcesses = p => {processes = p}

window.render = () => {
  iconsDiv.innerHTML = processes.map((process, i) => `
    <div class="icon ${i == currentProcess ? 'selected' : ''}">
      <img src="beaker-favicon:${process.url}">
    </div>
  `).join('')
  locationInput.value = processes[currentProcess].title
}