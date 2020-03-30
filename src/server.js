import net from 'net'
import EventEmitter from 'events'
import Connection from './connection'
import { v4 as uuidv4 } from 'uuid'

export default class Server extends EventEmitter {
  #connections = {}
  #server
  #host
  #port

  constructor (host, port, readyCb) {
    super({ captureRejections: true })

    if (readyCb && typeof readyCb === 'function') {
      this.once('ready', readyCb)
    }

    this.#port = port
    this.#host = host

    this.#server = net.createServer((conn) => {
      this._onConnection(conn)
    })
    // this.#server.on('error', (err) => {
    //   throw err
    // })
    this.#server.listen(this.#port, () => {
      this.emit('ready')
    })
  }

  /**
   * Closes the server and stops listening for connections.
   *
   * @param callback Called when the server is closed.
   */
  close (cb) {
    this.#server.close(cb)
  }

  _onConnection (socket) {
    const conn = Connection.createOutbound(socket)
    const id = uuidv4()

    this.#connections[id] = conn

    this.emit('connection::open', conn)

    conn.on('esl::ready', async () => {
      this.emit('connection::ready', conn)
    })

    conn.on('esl::end', () => {
      this.emit('connection::close', conn)
      delete this.#connections[id]
    })
  }
}
