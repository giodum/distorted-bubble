export default class Info {
  constructor(node) {
    this.node = node

    this.button = this.node.querySelector('.info-button')
    this.modal = this.node.querySelector('.info-modal')

    this.clickAction = this.clickAction.bind(this)

    this.init()
  }

  init() {
    this.addListeners()
  }

  addListeners() {
    this.button.addEventListener('click', this.clickAction)
  }

  clickAction(e) {
    e.preventDefault()

    this.modal.classList.toggle('open')
  }

  static init() {
    Info.item = new Info(document.querySelector('.info'))
  }
}
