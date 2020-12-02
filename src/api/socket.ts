class Socket {
  handlers: Record<string, Array<Function>>;
  ws: WebSocket;
  connected: Promise<boolean>;

  constructor (server: string) {
    this.ws = new WebSocket(`ws://${server}/slice`)
    this.handlers = {}
    this.connected = Promise.resolve(true)
    this.connect(`ws://${server}/slice`)
  }

  connect = (url: string) => {
    this.ws = new WebSocket(url)
    this.ws.binaryType = 'arraybuffer'
    this.connected = new Promise((resolve) => {
      this.ws.onopen = () => {
        console.log('connected')
        resolve(true)
      }
    })
    this.ws.onmessage = this.onmessage
  }

  onmessage = (msg: MessageEvent) => {
    const { data } = msg
    if (typeof data === 'string') {
      try {
        const json = JSON.parse(data)
        if (!json.type) {
          throw new Error()
        }

        if (this.handlers[json.type]) {
          this.handlers[json.type].forEach((handler) => {
            handler(json.data)
          })
        }
      } catch (e) {
        console.log('不支持的消息: ', data)
      }
      return
    }

    this.handleNewImage(data)
  }

  handleNewImage = (data: any) => {
    const bytes = new Uint8Array(data)
    const blob = new Blob([bytes.buffer], { type: 'image/jpeg' })
    const url = URL.createObjectURL(blob)
    if (this.handlers.image) {
      this.handlers.image.forEach((handler) => {
        handler(url)
      })
    }
  }

  send = async (data: any) => {
    if (!this.ws) return

    await this.connected
    this.ws.send(JSON.stringify(data))
  }

  getDatasetList = () => {
    this.send({ type: 'datasets' })
  }

  on (event: string, handler: Function) {
    if (!this.handlers[event]) {
      this.handlers[event] = []
    }

    this.handlers[event].push(handler)
  }

  off (event: string, handler: Function) {
    if (!this.handlers[event]) {
      return
    }

    const handlers = this.handlers[event]
    const idx = handlers.indexOf(handler)

    if (idx === -1) {
      return
    }

    handlers.splice(idx, 1)
  }
}

export default Socket
