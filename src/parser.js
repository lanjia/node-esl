import { EventEmitter } from 'events'
import Event from './event'
import xmlParser from 'fast-xml-parser'

const options = {
  explicitRoot: false,
  attributeNamePrefix: '@_',
  attrNodeName: 'attr', // default is 'false'
  textNodeName: '#text',
  ignoreAttributes: true,
  ignoreNameSpace: false,
  allowBooleanAttributes: false,
  parseNodeValue: true,
  parseAttributeValue: false,
  trimValues: true,
  // cdataTagName: '__cdata', //default is 'false'
  cdataPositionChar: '\\c',
  parseTrueNumberOnly: false,
  arrayMode: false, // 'strict'
  // attrValueProcessor: (val, attrName) => he.decode(val, { isAttributeValue: true }), // default is a=>a
  // tagValueProcessor: (val, tagName) => he.decode(val), // default is a=>a
  stopNodes: ['parse-me-as-string']
}

export default class Parser extends EventEmitter {
  #buffer = Buffer.alloc(0)
  // #buffer = Buffer.from([])
  #bodyLen = 0
  #encoding = 'utf8'
  #headers = {}

  constructor (socket, encoding = 'utf8') {
    super({ captureRejections: true })

    this.#encoding = encoding
    socket.on('data', (data) => {
      this._onData(data)
    })
    socket.on('end', () => {
      this._onEnd()
    })
  }

  static parseHeaderText (text) {
    // console.log('parseHeaderText:', text)
    // console.log('--------------')
    const lines = text.split('\n')
    const headers = {}

    for (let i = 0; i < lines.length; ++i) {
      const line = lines[i]

      if (!line) {
        continue
      }

      const data = lines[i].split(': ')
      const key = data.shift()
      const value = decodeURIComponent(data.join(': '))

      if (!key) {
        continue
      }

      if (key === 'Content-Length') {
        headers[key] = parseInt(value, 10)
      } else {
        headers[key] = value
      }
    }
    return headers
  }

  static parsePlainBody (text) {
    // if the body is event-plain then it is just a bunch of key/value pairs
    const headerEnd = text.indexOf('\n\n')
    const headers = Parser.parseHeaderText(text.substring(0, headerEnd))
    const contentLengthHeader = headers['Content-Length']

    let error
    if (contentLengthHeader) {
      const len = parseInt(contentLengthHeader, 10)
      const start = headerEnd + 2
      const end = start + len

      if (end > text.length) {
        error = new Error('Invalid content length for plain body.')
      } else {
        headers._body = text.substring(start, end)
      }
    }
    return { error, headers }
  }

  static parseXmlBody (xmlText) {
    // In the form:
    // <event>
    //     <headers>...</headers>
    //     <Content-Length>4</Content-Length> [optional]
    //     <body>...</body> [optional]
    // </event>
    // console.log('parseXmlBody:', xmlText)
    let error
    let headers
    try {
      var data = xmlParser.parse(xmlText, options).event
      headers = data?.headers
      if (headers['Content-Length']) {
        headers['Content-Length'] = parseInt(headers['Content-Length'], 10)
        headers._body = data.body
      } else if (data['Content-Length']) {
        headers['Content-Length'] = parseInt(data['Content-Length'], 10)
        headers._body = data.body
      }
    } catch (err) {
      error = err
    }

    return { error, headers }
  }

  _onData (data) {
    this.#buffer = Buffer.concat([this.#buffer, data], this.#buffer.length + data.length)

    if (this.#bodyLen > 0) {
      this._parseBody()
    } else {
      this._parseHeaders()
    }
  }

  _onEnd () { }

  _indexOfHeaderEnd () {
    for (let i = 0, len = this.#buffer.length - 1; i < len; ++i) {
      // Check for '\n\n' pattern
      if (this.#buffer[i] === 0x0a && this.#buffer[i + 1] === 0x0a) {
        return i
      }
    }
    return -1
  }

  _parseHeaders () {
    // get end of header marker
    const headEnd = this._indexOfHeaderEnd()

    // if the headers haven't ended yet, keep buffering
    if (headEnd === -1) return

    // if the headers have ended pull out the header text
    const headText = this.#buffer.toString(this.#encoding, 0, headEnd)

    // remove header text from buffer
    this.#buffer = this.#buffer.slice(headEnd + 2)

    // parse text into object
    this.#headers = Parser.parseHeaderText(headText)

    const contentLengthHeader = this.#headers['Content-Length']

    if (contentLengthHeader) {
      this.#bodyLen = parseInt(contentLengthHeader, 10)

      if (this.#buffer.length) this._parseBody()
    } else {
      this._parseEvent('')

      if (this.#buffer.length) this._parseHeaders()
    }
  }

  _parseBody () {
    if (this.#buffer.length < this.#bodyLen) return

    const body = this.#buffer.toString(this.#encoding, 0, this.#bodyLen)

    this.#buffer = this.#buffer.slice(this.#bodyLen)
    this.#bodyLen = 0

    this._parseEvent(body)
    this._parseHeaders()
  }

  _parseEvent (body) {
    let data

    switch (this.#headers['Content-Type']) {
      // parse body as JSON event data
      case 'text/event-json': {
        try {
          data = JSON.parse(body)
        } catch (err) {
          this.emit('error', err, 'Parser parseEvent text/event-json')
          return
        }
        break
      }
      // parse body as PLAIN event data
      case 'text/event-plain': {
        const { error, headers } = Parser.parsePlainBody(body)

        if (error) {
          this.emit('error', error, 'Parser parseEvent text/event-plain')
        }
        data = headers
        break
      }
      // parse body as XML event data
      case 'text/event-xml': {
        const { error, headers } = Parser.parseXmlBody(body)
        if (error) {
          this.emit('error', error, 'Parser parseEvent text/event-xml')
        }
        data = headers
        break
      }
    }

    let event

    if (data) {
      event = new Event(data)
    } else {
      event = new Event(this.#headers, body)
    }
    const reply = event.getHeader('Reply-Text')
    if (reply) {
      if (reply.startsWith('-ERR')) {
        event.addHeader('Nodesl-Reply-ERR', reply.substring(5))
      } else if (reply.startsWith('+OK')) {
        event.addHeader('success', true)
        event.addHeader('Nodesl-Reply-OK', reply.substring(4))
      }
    }
    this.emit('esl::event', event, this.#headers, body)
  }
}
