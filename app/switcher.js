var currentProcess = 1
var processes = []

window.setCurrent = n => {currentProcess = n}
window.setProcesses = p => {processes = p}

window.render = () => {
  processesDiv.innerHTML = processes.map((process, i) => `
    <div class="process ${i == currentProcess ? 'selected' : ''}">
      <img src="beaker-favicon:${process.url}">
      <div class="title">${process.title}</div>
    </div>
  `).join('')
}

window.addEventListener('keyup', e => {
  if (e.key === 'Control') {
    window.close()
  }
})