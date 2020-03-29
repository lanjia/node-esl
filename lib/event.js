"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

function _classPrivateFieldGet(receiver, privateMap) { var descriptor = privateMap.get(receiver); if (!descriptor) { throw new TypeError("attempted to get private field on non-instance"); } if (descriptor.get) { return descriptor.get.call(receiver); } return descriptor.value; }

function _classPrivateFieldSet(receiver, privateMap, value) { var descriptor = privateMap.get(receiver); if (!descriptor) { throw new TypeError("attempted to set private field on non-instance"); } if (descriptor.set) { descriptor.set.call(receiver, value); } else { if (!descriptor.writable) { throw new TypeError("attempted to set read only private field"); } descriptor.value = value; } return value; }

const XML_CHAR_MAP = {
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  '"': '&quot;',
  '\'': '&apos;'
};

function encodeXml(str) {
  return str.replace(/[<>&"']/g, item => {
    return XML_CHAR_MAP[item];
  });
}

class Event {
  constructor(typeOrHeaders, subclassOrBody) {
    _headers.set(this, {
      writable: true,
      value: {}
    });

    _body.set(this, {
      writable: true,
      value: void 0
    });

    _type.set(this, {
      writable: true,
      value: void 0
    });

    _subclass.set(this, {
      writable: true,
      value: void 0
    });

    _headerIndex.set(this, {
      writable: true,
      value: -1
    });

    if (typeof typeOrHeaders === 'string') {
      _classPrivateFieldSet(this, _type, typeOrHeaders);

      _classPrivateFieldSet(this, _subclass, subclassOrBody || '');

      _classPrivateFieldSet(this, _body, '');

      this.addHeader('Event-Name', _classPrivateFieldGet(this, _type));

      if (_classPrivateFieldGet(this, _subclass)) {
        this.addHeader('Event-Subclass', _classPrivateFieldGet(this, _subclass));
      }
    } else {
      _classPrivateFieldSet(this, _type, typeOrHeaders['Event-Name'] || '');

      _classPrivateFieldSet(this, _subclass, typeOrHeaders['Event-Subclass'] || '');

      _classPrivateFieldSet(this, _body, subclassOrBody || typeOrHeaders._body || '');

      _classPrivateFieldSet(this, _headers, typeOrHeaders);

      delete _classPrivateFieldGet(this, _headers)._body;
    }

    this.delHeader('Content-Length');
  }

  get type() {
    return _classPrivateFieldGet(this, _type);
  }

  get body() {
    return _classPrivateFieldGet(this, _body);
  }

  get headers() {
    return _classPrivateFieldGet(this, _headers);
  }

  serialize(format = 'json') {
    switch (format) {
      case 'json':
        {
          const obj = Object.assign({}, _classPrivateFieldGet(this, _headers));

          if (_classPrivateFieldGet(this, _body)) {
            obj['Content-Length'] = Buffer.byteLength(_classPrivateFieldGet(this, _body), 'utf8').toString();
            obj._body = _classPrivateFieldGet(this, _body);
          } else {
            delete obj['Content-Length'];
          }

          return JSON.stringify(obj, null, 4);
        }

      case 'plain':
        {
          let output = '';
          const keys = Object.keys(_classPrivateFieldGet(this, _headers));

          for (let i = 0; i < keys.length; ++i) {
            const key = keys[i];
            if (key === 'Content-Length') continue;

            const value = _classPrivateFieldGet(this, _headers)[key];

            output += `${key}: ${value}\n`;
          }

          if (_classPrivateFieldGet(this, _body)) {
            const bodyLength = Buffer.byteLength(_classPrivateFieldGet(this, _body), 'utf8');
            output += `Content-Length: ${bodyLength}\n\n`;
            output += _classPrivateFieldGet(this, _body);
          }

          return output;
        }

      case 'xml':
        {
          let output = '';
          const keys = Object.keys(_classPrivateFieldGet(this, _headers));
          output += '<event>\n';
          output += '    <headers>\n';

          for (let i = 0; i < keys.length; ++i) {
            const key = keys[i];

            if (key === 'Content-Length') {
              continue;
            }

            const value = _classPrivateFieldGet(this, _headers)[key];

            const encodedValue = typeof value === 'string' ? encodeXml(value) : value;
            output += `        <${key}>${encodedValue}</${key}>\n`;
          }

          if (_classPrivateFieldGet(this, _body)) {
            const xmlEncodedBody = encodeXml(_classPrivateFieldGet(this, _body));
            const key = 'Content-Length';
            const value = Buffer.byteLength(xmlEncodedBody, 'utf8');
            output += `        <${key}>${value}</${key}>\n`;
            output += '    </headers>\n';
            output += `    <body>${xmlEncodedBody}</body>\n`;
          } else {
            output += '    </headers>\n';
          }

          output += '</event>';
          return output;
        }
    }

    return '';
  }

  setPriority(priority) {
    this.addHeader('priority', priority.toString());
  }

  getHeader(name) {
    var _classPrivateFieldGet2;

    return (_classPrivateFieldGet2 = _classPrivateFieldGet(this, _headers)[name]) !== null && _classPrivateFieldGet2 !== void 0 ? _classPrivateFieldGet2 : undefined;
  }

  getBody() {
    return _classPrivateFieldGet(this, _body);
  }

  getType() {
    return _classPrivateFieldGet(this, _type);
  }

  addBody(value) {
    return _classPrivateFieldSet(this, _body, _classPrivateFieldGet(this, _body) + value);
  }

  addHeader(name, value) {
    _classPrivateFieldGet(this, _headers)[name] = value;
  }

  delHeader(name) {
    delete _classPrivateFieldGet(this, _headers)[name];
  }

  firstHeader() {
    _classPrivateFieldSet(this, _headerIndex, 0);

    const keys = Object.keys(_classPrivateFieldGet(this, _headers));

    if (keys.length === 0) {
      return null;
    }

    return keys[0];
  }

  nextHeader() {
    if (_classPrivateFieldGet(this, _headerIndex) === -1) {
      return null;
    }

    const keys = Object.keys(_classPrivateFieldGet(this, _headers));

    if (_classPrivateFieldGet(this, _headerIndex) === keys.length - 1) {
      _classPrivateFieldSet(this, _headerIndex, -1);

      return null;
    }

    _classPrivateFieldSet(this, _headerIndex, +_classPrivateFieldGet(this, _headerIndex) + 1);

    return keys[_classPrivateFieldGet(this, _headerIndex)];
  }

}

exports.default = Event;

var _headers = new WeakMap();

var _body = new WeakMap();

var _type = new WeakMap();

var _subclass = new WeakMap();

var _headerIndex = new WeakMap();