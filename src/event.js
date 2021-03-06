const XML_CHAR_MAP = {
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  '"': '&quot;',
  '\'': '&apos;'
}

function encodeXml (str) {
  return str.replace(/[<>&"']/g, item => {
    return XML_CHAR_MAP[item]
  })
}

export default class Event {
  #headers = {}
  #body
  #type
  #subclass
  #headerIndex = -1

  /**
  constructor(headers: IHeadersMap, body?: string);
  constructor(type: string, subclass?: string);
  constructor(typeOrHeaders: IHeadersMap | string, subclassOrBody?: string)
  */
  constructor (typeOrHeaders, subclassOrBody) {
    if (typeof typeOrHeaders === 'string') {
      this.#type = typeOrHeaders
      this.#subclass = subclassOrBody || ''
      this.#body = ''

      this.addHeader('Event-Name', this.#type)
      if (this.#subclass) {
        this.addHeader('Event-Subclass', this.#subclass)
      }
    } else {
      this.#type = typeOrHeaders['Event-Name'] || ''
      this.#subclass = typeOrHeaders['Event-Subclass'] || ''
      this.#body = subclassOrBody || typeOrHeaders._body || ''

      this.#headers = typeOrHeaders
      delete this.#headers._body
    }
    this.delHeader('Content-Length')
  }

  get type () {
    return this.#type
  }

  get body () {
    return this.#body
  }

  get headers () {
    return this.#headers
  }

  serialize (format = 'json') {
    switch (format) {
      /*
        "Event-Name": "CUSTOM",
        "Core-UUID": "8b192020-7368-4498-9b11-cbe10f48a784",
        "FreeSWITCH-Hostname": "smsdev",
        "FreeSWITCH-Switchname": "smsdev",
        "FreeSWITCH-IPv4": "10.1.12.115",
        "FreeSWITCH-IPv6": "::1",
        "Event-Date-Local": "2012-09-25 14:22:37",
        "Event-Date-GMT": "Tue, 25 Sep 2012 18:22:37 GMT",
        "Event-Date-Timestamp": "1348597357036551",
        "Event-Calling-File": "switch_cpp.cpp",
        "Event-Calling-Function": "Event",
        "Event-Calling-Line-Number": "262",
        "Event-Sequence": "11027",
        "Event-Subclass": "SMS::SEND_MESSAGE",
        "proto": "sip",
        "dest_proto": "sip",
        "from": "9515529832",
        "from_full": "9515529832",
        "to": "internal/8507585138@sms-proxy-01.bandwidthclec.com",
        "subject": "PATLive Testing",
        "type": "text/plain",
        "hint": "the hint",
        "replying": "true",
        "Content-Length": "23",
        "_body": "Hello from Chad Engler!"
      */
      case 'json': {
        const obj = Object.assign({}, this.#headers)
        if (this.#body) {
          obj['Content-Length'] = Buffer.byteLength(this.#body, 'utf8').toString()
          obj._body = this.#body
        } else {
          delete obj['Content-Length']
        }
        return JSON.stringify(obj, null, 4)
      }
      /*
      Event-Name: CUSTOM
      Core-UUID: 8b192020-7368-4498-9b11-cbe10f48a784
      FreeSWITCH-Hostname: smsdev
      FreeSWITCH-Switchname: smsdev
      FreeSWITCH-IPv4: 10.1.12.115
      FreeSWITCH-IPv6: %3A%3A1
      Event-Date-Local: 2012-09-25%2014%3A21%3A56
      Event-Date-GMT: Tue,%2025%20Sep%202012%2018%3A21%3A56%20GMT
      Event-Date-Timestamp: 1348597316736546
      Event-Calling-File: switch_cpp.cpp
      Event-Calling-Function: Event
      Event-Calling-Line-Number: 262
      Event-Sequence: 11021
      Event-Subclass: SMS%3A%3ASEND_MESSAGE
      proto: sip
      dest_proto: sip
      from: 9515529832
      from_full: 9515529832
      to: internal/8507585138%40sms-proxy-01.bandwidthclec.com
      subject: PATLive%20Testing
      type: text/plain
      hint: the%20hint
      replying: true
      Content-Length: 23
      */
      case 'plain': {
        let output = ''
        const keys = Object.keys(this.#headers)
        for (let i = 0; i < keys.length; ++i) {
          const key = keys[i]
          if (key === 'Content-Length') continue
          const value = this.#headers[key]
          output += `${key}: ${value}\n`
        }

        if (this.#body) {
          const bodyLength = Buffer.byteLength(this.#body, 'utf8')
          output += `Content-Length: ${bodyLength}\n\n`
          output += this.#body
        }
        return output
      }
      /*
      <event>
          <headers>
          <Event-Name>CUSTOM</Event-Name>
          <Core-UUID>8b192020-7368-4498-9b11-cbe10f48a784</Core-UUID>
          <FreeSWITCH-Hostname>smsdev</FreeSWITCH-Hostname>
          <FreeSWITCH-Switchname>smsdev</FreeSWITCH-Switchname>
          <FreeSWITCH-IPv4>10.1.12.115</FreeSWITCH-IPv4>
          <FreeSWITCH-IPv6>%3A%3A1</FreeSWITCH-IPv6>
          <Event-Date-Local>2012-09-25%2014%3A26%3A17</Event-Date-Local>
          <Event-Date-GMT>Tue,%2025%20Sep%202012%2018%3A26%3A17%20GMT</Event-Date-GMT>
          <Event-Date-Timestamp>1348597577616542</Event-Date-Timestamp>
          <Event-Calling-File>switch_cpp.cpp</Event-Calling-File>
          <Event-Calling-Function>Event</Event-Calling-Function>
          <Event-Calling-Line-Number>262</Event-Calling-Line-Number>
          <Event-Sequence>11057</Event-Sequence>
          <Event-Subclass>SMS%3A%3ASEND_MESSAGE</Event-Subclass>
          <proto>sip</proto>
          <dest_proto>sip</dest_proto>
          <from>9515529832</from>
          <from_full>9515529832</from_full>
          <to>internal/8507585138%40sms-proxy-01.bandwidthclec.com</to>
          <subject>PATLive%20Testing</subject>
          <type>text/plain</type>
          <hint>the%20hint</hint>
          <replying>true</replying>
          </headers>
          <Content-Length>23</Content-Length>
          <body>Hello from Chad Engler!</body>
      </event>
      */
      case 'xml': {
        let output = ''
        const keys = Object.keys(this.#headers)

        output += '<event>\n'
        output += '    <headers>\n'

        for (let i = 0; i < keys.length; ++i) {
          const key = keys[i]
          if (key === 'Content-Length') {
            continue
          }
          const value = this.#headers[key]
          const encodedValue =
            typeof value === 'string' ? encodeXml(value) : value
          output += `        <${key}>${encodedValue}</${key}>\n`
        }

        if (this.#body) {
          const xmlEncodedBody = encodeXml(this.#body)
          const key = 'Content-Length'
          const value = Buffer.byteLength(xmlEncodedBody, 'utf8')
          output += `        <${key}>${value}</${key}>\n`
          output += '    </headers>\n'
          output += `    <body>${xmlEncodedBody}</body>\n`
        } else {
          output += '    </headers>\n'
        }
        output += '</event>'
        return output
      }
    }
    return ''
  }

  /**
   * Sets the priority of an event to `priority` in case it's fired.
   */
  setPriority (priority) {
    this.addHeader('priority', priority.toString())
  }

  /**
   * Gets the header with the key of `name` from the event object.
   */
  getHeader (name) {
    return this.#headers[name] ?? undefined
  }

  /**
   * Gets the body of the event object.
   */
  getBody () {
    return this.#body
  }

  /**
   * Gets the event type of the event object.
   */
  getType () {
    return this.#type
  }

  /**
   * Add `value` to the body of the event object.
   * This can be called multiple times for the same event object.
   *
   * @returns the new body after appending `value`.
   */
  addBody (value) {
    return (this.#body += value)
  }

  // Add a header with key = $header_name and value = $value
  // to an event object. This can be called multiple times
  // for the same event object.
  addHeader (name, value) {
    this.#headers[name] = value
  }

  /**
   * Delete the header with key `name` from the event object.
   */
  delHeader (name) {
    delete this.#headers[name]
  }

  /**
   * Sets the pointer to the first header in the event object,
   * and returns it's key name. This must be called before nextHeader is called.
   *
   * If there are no headers, then it will return `null`.
   */
  firstHeader () {
    this.#headerIndex = 0
    const keys = Object.keys(this.#headers)
    if (keys.length === 0) {
      return null
    }
    return keys[0]
  }

  /**
   * Moves the pointer to the next header in the event object,
   * and returns it's key name. `firstHeader` must be called
   * before this method to set the pointer. If you're already
   * on the last header when this method is called, then it will return `null`.
   */
  nextHeader () {
    // if no firstHeader called yet
    if (this.#headerIndex === -1) {
      return null
    }

    const keys = Object.keys(this.#headers)

    // if reached end
    if (this.#headerIndex === (keys.length - 1)) {
      this.#headerIndex = -1
      return null
    }

    ++this.#headerIndex

    return keys[this.#headerIndex]
  }
}
