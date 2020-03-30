import net from 'net'
import { once, EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'
import Parser from './parser'

function toCommandString (command, args) {
  const commands = []
  commands.push(command + '\n')
  if (args) {
    for (const [key, value] of Object.entries(args)) {
      commands.push(key + ': ' + value + '\n')
    }
  }
  commands.push('\n')
  return commands.join('')
}

export default class Connection extends EventEmitter {
  #socket
  #connecting = true
  #apiCallbackQueue = []
  #cmdCallbackQueue = []
  #host
  #port
  #password
  #authed = false
  #execAsync
  #execLock
  #inbound
  #channelData
  #UniqueID
  #parser

  /**
    host, port, password
    net.Socket
   */
  constructor (socket, type, readyCallback) {
    super({ captureRejections: true })
    this.on('error', (err, title) => {
      console.log('Connection Error title:', title, ' err:', err.message)
    })

    this.#socket = socket
    if (readyCallback && typeof readyCallback === 'function') {
      this.once('esl::ready', readyCallback)
    }
    if (type === 'inbound') {
      if (socket.connecting) {
        socket.on('connect', () => this._onConnect())
      } else {
        this._onConnect()
      }
    } else {
      this._onConnect();
      (async () => {
        let res
        res = await this.sendRecv('connect')
        if (res.err || !res.data.getHeader('success')) {
          this.emit('error', new Error('connect fails'), 'Connection constructor')
          return false
        }
        // res = await this.subscribe(['CHANNEL_EXECUTE_COMPLETE','CHANNEL_ANSWER'])
        // if (res.err || !res.data.getHeader('success')) {
        //   this.emit('error', new Error('subscribe fails'), 'Connection constructor')
        // }
        res = await this.sendRecv('myevents')
        if (res.err || !res.data.getHeader('success')) {
          this.emit('error', new Error('myevents fails'), 'Connection constructor')
        }
        res = await this.sendRecv('linger 1')
        if (res.err || !res.data.getHeader('success')) {
          this.emit('error', new Error('linger fails'), 'Connection constructor')
        }
        this.emit('esl::ready')
      })()
    }

    this.#socket.on('error', err => {
      // console.error('socket error', err)
      this.emit('error', err, 'socket error')
    })

    this.#socket.on('end', () => {
      // console.log('socket end')
      this.emit('esl::end')
    })
  }

  static createInbound (host, port, password, readyCallback) {
    const socket = net.connect(port, host)
    const conn = new Connection(socket, 'inbound', readyCallback)
    conn.once('esl::event::auth::request', async () => {
      await conn.auth(password)
    })
    return conn
  }

  static createOutbound (socket) {
    return new Connection(socket, 'outbound')
  }

  /**
 * Close the socket connection to the FreeSWITCH server.
 */
  disconnect () {
    this.send('exit')
    this.#socket.end()
  }

  // =======================
  socketDescriptor () { }

  connected () { }

  getInfo () {
    return this.#channelData
  }

  send (command, args) {
    // console.log('send:', command, args)

    this.#socket.write(toCommandString(command, args))
    // try {
    //   this.#socket.write(toCommandString(command, args))
    // } catch (err) {
    //   this.emit('error', err, 'Connection send')
    // }
  }

  async sendRecv (command, args, timeout = 3000) {
    const fun = () => this.send(command, args)
    // return await this.recvEventTimed(fun, command, 'esl::event::command::reply')
    return await this.onceAsync(fun, command, 'esl::event::command::reply', timeout)
  }

  async api (command, timeout = 3000) {
    const jobId = uuidv4()
    const eventName = `esl::event::BACKGROUND_JOB::${jobId}`
    const fun = () => this.send(`bgapi ${command}`, { 'Job-UUID': jobId })
    const res = await this.onceAsync(fun, command, eventName, timeout)
    if (!res.err) {
      res.data = res.data.getBody()
    } 
    return res
  }

  async bgapi (command, timeout = 3000) {
    return await this.api(command, timeout)
  }

  async sendEvent (event, timeout = 3000) {
    return await this.sendRecv(`sendevent ${event.getHeader('Event-Name')}'\n'${event.serialize()}`, null, timeout)
  }

  async recvEvent (eventName) {
    const [value] = await once(this, eventName)
    return value
  }

  async recvEventTimed (fun, command, eventName, timeout = 3000) {
    return await this.onceAsync(fun, command, eventName, timeout)
  }

  async filter (header, value, timeout = 3000) {
    return await this.sendRecv(`filter ${header} ${value}`, null, timeout)
  }

  async filterDelete (header, value, timeout = 3000) {
    return await this.sendRecv(`filter delete ${header}${value ? ' ' + value : ''}`, null, timeout)
  }

  async events (eventType, value, timeout = 3000) {
    if (!['plain', 'xml', 'json'].includes(eventType)) {
      return false
    }
    return await this.sendRecv(`event ${eventType} ${value.join(' ')}`, '', timeout)
  }

  async execute (app, arg, timeout = 3000) {
    const options = {}
    options['call-command'] = 'execute'
    options['execute-app-name'] = app
    if (arg) {
      options['execute-app-arg'] = arg.toString()
    }
    options.async = 'true'
    // options['event-lock'] = 'true'
    const eventUuid = uuidv4()
    options['Event-UUID'] = eventUuid

    const eventName = `esl::event::CHANNEL_EXECUTE_COMPLETE::${eventUuid}`
    const fun = () => this.send(`sendmsg ${this.#UniqueID}`, options)

    return await this.onceAsync(fun, app, eventName, timeout)
  }

  async executeAsync (app, arg, timeout = 3000) {
    return await this.execute(app, arg, timeout)
  }

  setAsyncExecute (value) {
    this.#execAsync = value
  }

  setEventLock (value) {
    this.#execLock = value
  }

  /**
   * Higher-level Library-Specific Functions
   * Some of these simply provide syntatic sugar
   */
  async auth (password) {
    const res = await this.sendRecv(`auth ${password}`)
    if (res.err) {
      this.emit('error', res.err, 'Connection auth')
      this.#authed = false
      return this.#authed
    }
    this.#authed = res.data.getHeader('Nodesl-Reply-OK') === 'accepted'
    if (this.#authed) {
      this.emit('esl::ready')
    } else {
      this.emit('error', new Error('Authentication Failed'), 'Connection auth')
    }
    return this.#authed
  }

  async subscribe (events, type = 'json') {
    return await this.events(type, events ?? ['all'])
  }

  /**
   * Called when socket connects to FSW ESL Server or when we successfully listen to the fd
   */
  _onConnect () {
    this.#parser = new Parser(this.#socket)
    this.#parser.on('esl::event', (event, headers, body) => { this._onEvent(event, headers, body) })
    this.#parser.on('error', (err) => this.emit('error', err, 'Connection onConnect parser error'))
    this.#connecting = false
    this.emit('esl::connect')
  }

  /**
  * When we get a generic ESLevent from FSW
  */
  _onEvent (event, headers, body) {
    const contentType = headers['Content-Type']
    // const uuid = event.getHeader('Unique-ID') || event.getHeader('Core-UUID')
    let emitName
    switch (contentType) {
      case 'auth/request':
        emitName = 'esl::event::auth::request'
        break
      case 'api/response':
        emitName = 'esl::event::api::response'
        break
      case 'command/reply':
        emitName = 'esl::event::command::reply'
        if (!this.#inbound && headers['Event-Name'] === 'CHANNEL_DATA') {
          this.#channelData = event
          this.#UniqueID = event.getHeader('Unique-ID')
          // this.emit('esl::event::CHANNEL_DATA' + (uuid ? '::' + uuid : ''), body)
        }
        break
      case 'log/data':
        emitName = 'esl::event::logdata'
        break
      case 'text/disconnect-notice':
        emitName = 'esl::event::disconnect::notice'
        break
      case 'text/event-json':
      case 'text/event-plain':
      case 'text/event-xml': {
        const eventName = event.getHeader('Event-Name')
        if (eventName === 'BACKGROUND_JOB') {
          const uuid = event.getHeader('Job-UUID')
          if (uuid) {
            emitName = `esl::event::${eventName}::${uuid}`
          }
        } else if (eventName === 'CHANNEL_EXECUTE_COMPLETE') {
          // console.log(event.getHeader('Application'))
          const uuid = event.getHeader('Application-UUID')
          if (uuid) {
            emitName = `esl::event::${eventName}::${uuid}`
          }
        } else {
          emitName = `esl::event::${eventName}`
        }
      }
        break
      default:
        emitName = `esl::event::raw::${contentType}`
    }
    // console.log(`----------${emitName}----------`)
    // console.log('event:', event.serialize())
    // console.log('headers:', headers)
    // console.log('body:', body)
    if (emitName) {
      this.emit(emitName, event, headers, body)
    }
  }

  async onceAsync (fun, command, eventName, timeout = 3000) {
    let timeId = 0
    const fn = new Promise((resolve, reject) => {
      this.once(eventName, (evt) => {
        if (timeId > 0) {
          clearTimeout(timeId)
        }
        resolve(evt)
      })
      try {
        fun()
      } catch (err) {
        if (timeId > 0) {
          clearTimeout(timeId)
        }
        this.removeAllListeners(eventName)
        reject(err)
      }
    })
    const timeoutAsync = new Promise((resolve, reject) => {
      timeId = setTimeout(() => {
        this.removeAllListeners(eventName)
        reject(new Error(`${command} TimeOut`))
      }, timeout)
    })
    return Promise.race([fn, timeoutAsync]).then(data => { return { data: data } }).catch(err => { return { err: err } })
  }

  // async onAsync (fun, command, eventName, timeout = 3000) {
  //   let timeId = 0
  //   const fn = new Promise(resolve => {
  //     this.on(eventName, (...args) => {
  //       if (timeId > 0) {
  //         clearTimeout(timeId)
  //       }
  //       this.removeAllListeners(eventName)
  //       resolve(args[0])
  //     })
  //     fun()
  //   })
  //   const timeout = new Promise((resolve, reject) => {
  //     timeId = setTimeout(() => {
  //       this.removeAllListeners(eventName)
  //       reject(new Error(`${command} TimeOut`))
  //     }, timeout)
  //   })
  //   return Promise.race([fn, timeout])
  // }
}
