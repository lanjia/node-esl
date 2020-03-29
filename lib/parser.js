"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _events = require("events");

var _event = _interopRequireDefault(require("./event"));

var _fastXmlParser = _interopRequireDefault(require("fast-xml-parser"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classPrivateFieldGet(receiver, privateMap) { var descriptor = privateMap.get(receiver); if (!descriptor) { throw new TypeError("attempted to get private field on non-instance"); } if (descriptor.get) { return descriptor.get.call(receiver); } return descriptor.value; }

function _classPrivateFieldSet(receiver, privateMap, value) { var descriptor = privateMap.get(receiver); if (!descriptor) { throw new TypeError("attempted to set private field on non-instance"); } if (descriptor.set) { descriptor.set.call(receiver, value); } else { if (!descriptor.writable) { throw new TypeError("attempted to set read only private field"); } descriptor.value = value; } return value; }

const options = {
  explicitRoot: false,
  attributeNamePrefix: '@_',
  attrNodeName: 'attr',
  textNodeName: '#text',
  ignoreAttributes: true,
  ignoreNameSpace: false,
  allowBooleanAttributes: false,
  parseNodeValue: true,
  parseAttributeValue: false,
  trimValues: true,
  cdataPositionChar: '\\c',
  parseTrueNumberOnly: false,
  arrayMode: false,
  stopNodes: ['parse-me-as-string']
};

class Parser extends _events.EventEmitter {
  constructor(socket, encoding = 'utf8') {
    super({
      captureRejections: true
    });

    _buffer.set(this, {
      writable: true,
      value: Buffer.alloc(0)
    });

    _bodyLen.set(this, {
      writable: true,
      value: 0
    });

    _encoding.set(this, {
      writable: true,
      value: 'utf8'
    });

    _headers.set(this, {
      writable: true,
      value: {}
    });

    _classPrivateFieldSet(this, _encoding, encoding);

    socket.on('data', data => {
      this._onData(data);
    });
    socket.on('end', () => {
      this._onEnd();
    });
  }

  static parseHeaderText(text) {
    const lines = text.split('\n');
    const headers = {};

    for (let i = 0; i < lines.length; ++i) {
      const line = lines[i];

      if (!line) {
        continue;
      }

      const data = lines[i].split(': ');
      const key = data.shift();
      const value = decodeURIComponent(data.join(': '));

      if (!key) {
        continue;
      }

      if (key === 'Content-Length') {
        headers[key] = parseInt(value, 10);
      } else {
        headers[key] = value;
      }
    }

    return headers;
  }

  static parsePlainBody(text) {
    const headerEnd = text.indexOf('\n\n');
    const headers = Parser.parseHeaderText(text.substring(0, headerEnd));
    const contentLengthHeader = headers['Content-Length'];
    let error;

    if (contentLengthHeader) {
      const len = parseInt(contentLengthHeader, 10);
      const start = headerEnd + 2;
      const end = start + len;

      if (end > text.length) {
        error = new Error('Invalid content length for plain body.');
      } else {
        headers._body = text.substring(start, end);
      }
    }

    return {
      error,
      headers
    };
  }

  static parseXmlBody(xmlText) {
    let error;
    let headers;

    try {
      var data = _fastXmlParser.default.parse(xmlText, options).event;

      headers = data === null || data === void 0 ? void 0 : data.headers;

      if (headers['Content-Length']) {
        headers['Content-Length'] = parseInt(headers['Content-Length'], 10);
        headers._body = data.body;
      } else if (data['Content-Length']) {
        headers['Content-Length'] = parseInt(data['Content-Length'], 10);
        headers._body = data.body;
      }
    } catch (err) {
      error = err;
    }

    return {
      error,
      headers
    };
  }

  _onData(data) {
    _classPrivateFieldSet(this, _buffer, Buffer.concat([_classPrivateFieldGet(this, _buffer), data], _classPrivateFieldGet(this, _buffer).length + data.length));

    if (_classPrivateFieldGet(this, _bodyLen) > 0) {
      this._parseBody();
    } else {
      this._parseHeaders();
    }
  }

  _onEnd() {}

  _indexOfHeaderEnd() {
    for (let i = 0, len = _classPrivateFieldGet(this, _buffer).length - 1; i < len; ++i) {
      if (_classPrivateFieldGet(this, _buffer)[i] === 0x0a && _classPrivateFieldGet(this, _buffer)[i + 1] === 0x0a) {
        return i;
      }
    }

    return -1;
  }

  _parseHeaders() {
    const headEnd = this._indexOfHeaderEnd();

    if (headEnd === -1) return;

    const headText = _classPrivateFieldGet(this, _buffer).toString(_classPrivateFieldGet(this, _encoding), 0, headEnd);

    _classPrivateFieldSet(this, _buffer, _classPrivateFieldGet(this, _buffer).slice(headEnd + 2));

    _classPrivateFieldSet(this, _headers, Parser.parseHeaderText(headText));

    const contentLengthHeader = _classPrivateFieldGet(this, _headers)['Content-Length'];

    if (contentLengthHeader) {
      _classPrivateFieldSet(this, _bodyLen, parseInt(contentLengthHeader, 10));

      if (_classPrivateFieldGet(this, _buffer).length) this._parseBody();
    } else {
      this._parseEvent('');

      if (_classPrivateFieldGet(this, _buffer).length) this._parseHeaders();
    }
  }

  _parseBody() {
    if (_classPrivateFieldGet(this, _buffer).length < _classPrivateFieldGet(this, _bodyLen)) return;

    const body = _classPrivateFieldGet(this, _buffer).toString(_classPrivateFieldGet(this, _encoding), 0, _classPrivateFieldGet(this, _bodyLen));

    _classPrivateFieldSet(this, _buffer, _classPrivateFieldGet(this, _buffer).slice(_classPrivateFieldGet(this, _bodyLen)));

    _classPrivateFieldSet(this, _bodyLen, 0);

    this._parseEvent(body);

    this._parseHeaders();
  }

  _parseEvent(body) {
    let data;

    switch (_classPrivateFieldGet(this, _headers)['Content-Type']) {
      case 'text/event-json':
        {
          try {
            data = JSON.parse(body);
          } catch (e) {
            this.emit('error', e);
            return;
          }

          break;
        }

      case 'text/event-plain':
        {
          const {
            error,
            headers
          } = Parser.parsePlainBody(body);
          if (error) this.emit('error', error);
          data = headers;
          break;
        }

      case 'text/event-xml':
        {
          const {
            error,
            headers
          } = Parser.parseXmlBody(body);
          if (error) this.emit('error', error);
          data = headers;
          break;
        }
    }

    let event;
    if (data) event = new _event.default(data);else event = new _event.default(_classPrivateFieldGet(this, _headers), body);
    const reply = event.getHeader('Reply-Text');

    if (reply) {
      if (reply.startsWith('-ERR')) {
        event.addHeader('Nodesl-Reply-ERR', reply.substring(5));
      } else if (reply.startsWith('+OK')) {
        event.addHeader('success', true);
        event.addHeader('Nodesl-Reply-OK', reply.substring(4));
      }
    }

    this.emit('esl::event', event, _classPrivateFieldGet(this, _headers), body);
  }

}

exports.default = Parser;

var _buffer = new WeakMap();

var _bodyLen = new WeakMap();

var _encoding = new WeakMap();

var _headers = new WeakMap();