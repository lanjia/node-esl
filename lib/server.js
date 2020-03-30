"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _net = _interopRequireDefault(require("net"));

var _events = _interopRequireDefault(require("events"));

var _connection = _interopRequireDefault(require("./connection"));

var _uuid = require("uuid");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classPrivateFieldGet(receiver, privateMap) { var descriptor = privateMap.get(receiver); if (!descriptor) { throw new TypeError("attempted to get private field on non-instance"); } if (descriptor.get) { return descriptor.get.call(receiver); } return descriptor.value; }

function _classPrivateFieldSet(receiver, privateMap, value) { var descriptor = privateMap.get(receiver); if (!descriptor) { throw new TypeError("attempted to set private field on non-instance"); } if (descriptor.set) { descriptor.set.call(receiver, value); } else { if (!descriptor.writable) { throw new TypeError("attempted to set read only private field"); } descriptor.value = value; } return value; }

class Server extends _events.default {
  constructor(host, port, readyCb) {
    super({
      captureRejections: true
    });

    _connections.set(this, {
      writable: true,
      value: {}
    });

    _server.set(this, {
      writable: true,
      value: void 0
    });

    _host.set(this, {
      writable: true,
      value: void 0
    });

    _port.set(this, {
      writable: true,
      value: void 0
    });

    if (readyCb && typeof readyCb === 'function') {
      this.once('ready', readyCb);
    }

    _classPrivateFieldSet(this, _port, port);

    _classPrivateFieldSet(this, _host, host);

    _classPrivateFieldSet(this, _server, _net.default.createServer(conn => {
      this._onConnection(conn);
    }));

    _classPrivateFieldGet(this, _server).listen(_classPrivateFieldGet(this, _port), () => {
      this.emit('ready');
    });
  }

  close(cb) {
    _classPrivateFieldGet(this, _server).close(cb);
  }

  _onConnection(socket) {
    const conn = _connection.default.createOutbound(socket);

    const id = (0, _uuid.v4)();
    _classPrivateFieldGet(this, _connections)[id] = conn;
    this.emit('connection::open', conn);
    conn.on('esl::ready', async () => {
      this.emit('connection::ready', conn);
    });
    conn.on('esl::end', () => {
      this.emit('connection::close', conn);
      delete _classPrivateFieldGet(this, _connections)[id];
    });
  }

}

exports.default = Server;

var _connections = new WeakMap();

var _server = new WeakMap();

var _host = new WeakMap();

var _port = new WeakMap();