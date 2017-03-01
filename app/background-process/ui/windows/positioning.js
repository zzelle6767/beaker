import { BrowserWindow, screen } from 'electron'

// exported api
// =

export function getCurrentDisplay () {
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

export function getContentWindowBounds () {
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

export function getNavBarBounds (win) {
  var {x, y, width, height} = win.getBounds()
  return {
    x: x + 85,
    y,
    width: width - 85,
    height: 24,
  }  
}

export function getStatusBarBounds (win) {
  var {x, y, width, height} = win.getBounds()
  return {
    x,
    y: (y + height - 24),
    width: 400,
    height: 24,
  }
}