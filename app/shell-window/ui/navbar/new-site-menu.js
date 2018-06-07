/* globals beaker DatArchive */

import * as yo from 'yo-yo'
import {findParent} from '../../../lib/fg/event-handlers'
import * as pages from '../../pages'

// there can be many drop menu btns rendered at once, but they are all showing the same information
// the NewSiteMenuNavbarBtn manages all instances, and you should only create one

export class NewSiteMenuNavbarBtn {
  constructor () {
    this.isDropdownOpen = false

    // wire up events
    window.addEventListener('mousedown', this.onClickAnywhere.bind(this), true)
  }

  render () {
    // render the dropdown if open
    var dropdownEl = ''
    if (this.isDropdownOpen) {
      dropdownEl = yo`
        <div class="toolbar-dropdown dropdown toolbar-dropdown-menu-dropdown">
          <div class="dropdown-items with-triangle">
            todo
          </div>
        </div>`
    }

    // render btn
    return yo`
      <div class="toolbar-dropdown-menu new-site-dropdown-menu">
        <button class="new-site-btn ${this.isDropdownOpen ? 'pressed' : ''}" onclick=${e => this.onClickBtn(e)} title="Menu">
          New <span class="fa fa-plus"></span>
        </button>
        ${dropdownEl}
      </div>`
  }

  updateActives () {
    Array.from(document.querySelectorAll('.new-site-dropdown-menu')).forEach(el => yo.update(el, this.render()))
  }

  onClickBtn (e) {
    this.isDropdownOpen = !this.isDropdownOpen
    this.updateActives()
  }

  onClickAnywhere (e) {
    if (!this.isDropdownOpen) return
    var parent = findParent(e.target, 'new-site-dropdown-menu')
    if (parent) return // abort - this was a click on us!
    this.isDropdownOpen = false
    this.updateActives()
  }

  close () {
    if (this.isDropdownOpen) {
      this.isDropdownOpen = false
      this.updateActives()
    }
  }
}
