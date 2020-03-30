"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _net = _interopRequireDefault(require("net"));

var _events = require("events");

var _uuid = require("uuid");

var _parser2 = _interopRequireDefault(require("./parser"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classPrivateFieldGet(receiver, privateMap) { var descriptor = privateMap.get(receiver); if (!descriptor) { throw new TypeError("attempted to get private field on non-instance"); } if (descriptor.get) { return descriptor.get.call(receiver); } return descriptor.value; }

function _classPrivateFieldSet(receiver, privateMap, value) { var descriptor = privateMap.get(receiver); if (!descriptor) { throw new TypeError("attempted to set private field on non-instance"); } if (descriptor.set) { descriptor.set.call(receiver, value); } else { if (!descriptor.writable) { throw new TypeError("attempted to set read only private field"); } descriptor.value = value; } return value; }

function toCommandString(command, args) {
  const commands = [];
  commands.push(command + '\n');

  if (args) {
    for (const [key, value] of Object.entries(args)) {
      commands.push(key + ': ' + value + '\n');
    }
  }

  commands.push('\n');
  return commands.join('');
}

class Connection extends _events.EventEmitter {
  constructor(socket, type, readyCallback) {
    super({
      captureRejections: true
    });

    _socket.set(this, {
      writable: true,
      value: void 0
    });

    _connecting.set(this, {
      writable: true,
      value: true
    });

    _apiCallbackQueue.set(this, {
      writable: true,
      value: []
    });

    _cmdCallbackQueue.set(this, {
      writable: true,
      value: []
    });

    _host.set(this, {
      writable: true,
      value: void 0
    });

    _port.set(this, {
      writable: true,
      value: void 0
    });

    _password.set(this, {
      writable: true,
      value: void 0
    });

    _authed.set(this, {
      writable: true,
      value: false
    });

    _execAsync.set(this, {
      writable: true,
      value: void 0
    });

    _execLock.set(this, {
      writable: true,
      value: void 0
    });

    _inbound.set(this, {
      writable: true,
      value: void 0
    });

    _channelData.set(this, {
      writable: true,
      value: void 0
    });

    _UniqueID.set(this, {
      writable: true,
      value: void 0
    });

    _parser.set(this, {
      writable: true,
      value: void 0
    });

    this.on('error', (err, title) => {
      console.log('Connection Error title:', title, ' err:', err.message);
    });

    _classPrivateFieldSet(this, _socket, socket);

    if (readyCallback && typeof readyCallback === 'function') {
      this.once('esl::ready', readyCallback);
    }

    if (type === 'inbound') {
      if (socket.connecting) {
        socket.on('connect', () => this._onConnect());
      } else {
        this._onConnect();
      }
    } else {
      this._onConnect();

      (async () => {
        let res;
        res = await this.sendRecv('connect');

        if (res.err || !res.data.getHeader('success')) {
          this.emit('error', new Error('connect fails'), 'Connection constructor');
          return false;
        }

        res = await this.sendRecv('myevents');

        if (res.err || !res.data.getHeader('success')) {
          this.emit('error', new Error('myevents fails'), 'Connection constructor');
        }

        res = await this.sendRecv('linger 1');

        if (res.err || !res.data.getHeader('success')) {
          this.emit('error', new Error('linger fails'), 'Connection constructor');
        }

        this.emit('esl::ready');
      })();
    }

    _classPrivateFieldGet(this, _socket).on('error', err => {
      this.emit('error', err, 'socket error');
    });

    _classPrivateFieldGet(this, _socket).on('end', () => {
      this.emit('esl::end');
    });
  }

  static createInbound(host, port, password, readyCallback) {
    const socket = _net.default.connect(port, host);

    const conn = new Connection(socket, 'inbound', readyCallback);
    conn.once('esl::event::auth::request', async () => {
      await conn.auth(password);
    });
    return conn;
  }

  static createOutbound(socket) {
    return new Connection(socket, 'outbound');
  }

  disconnect() {
    this.send('exit');

    _classPrivateFieldGet(this, _socket).end();
  }

  socketDescriptor() {}

  connected() {}

  getInfo() {
    return _classPrivateFieldGet(this, _channelData);
  }

  send(command, args) {
    _classPrivateFieldGet(this, _socket).write(toCommandString(command, args));
  }

  async sendRecv(command, args, timeout = 3000) {
    const fun = () => this.send(command, args);

    return await this.onceAsync(fun, command, 'esl::event::command::reply', timeout);
  }

  async api(command, timeout = 3000) {
    const jobId = (0, _uuid.v4)();
    const eventName = `esl::event::BACKGROUND_JOB::${jobId}`;

    const fun = () => this.send(`bgapi ${command}`, {
      'Job-UUID': jobId
    });

    const res = await this.onceAsync(fun, command, eventName, timeout);

    if (!res.err) {
      res.data = res.data.getBody();
    }

    return res;
  }

  async bgapi(command, timeout = 3000) {
    return await this.api(command, timeout);
  }

  async sendEvent(event, timeout = 3000) {
    return await this.sendRecv(`sendevent ${event.getHeader('Event-Name')}'\n'${event.serialize()}`, null, timeout);
  }

  async recvEvent(eventName) {
    const [value] = await (0, _events.once)(this, eventName);
    return value;
  }

  async recvEventTimed(fun, command, eventName, timeout = 3000) {
    return await this.onceAsync(fun, command, eventName, timeout);
  }

  async filter(header, value, timeout = 3000) {
    return await this.sendRecv(`filter ${header} ${value}`, null, timeout);
  }

  async filterDelete(header, value, timeout = 3000) {
    return await this.sendRecv(`filter delete ${header}${value ? ' ' + value : ''}`, null, timeout);
  }

  async events(eventType, value, timeout = 3000) {
    if (!['plain', 'xml', 'json'].includes(eventType)) {
      return false;
    }

    return await this.sendRecv(`event ${eventType} ${value.join(' ')}`, '', timeout);
  }

  async execute(app, arg, timeout = 3000) {
    const options = {};
    options['call-command'] = 'execute';
    options['execute-app-name'] = app;

    if (arg) {
      options['execute-app-arg'] = arg.toString();
    }

    options.async = 'true';
    const eventUuid = (0, _uuid.v4)();
    options['Event-UUID'] = eventUuid;
    const eventName = `esl::event::CHANNEL_EXECUTE_COMPLETE::${eventUuid}`;

    const fun = () => this.send(`sendmsg ${_classPrivateFieldGet(this, _UniqueID)}`, options);

    return await this.onceAsync(fun, app, eventName, timeout);
  }

  async executeAsync(app, arg, timeout = 3000) {
    return await this.execute(app, arg, timeout);
  }

  setAsyncExecute(value) {
    _classPrivateFieldSet(this, _execAsync, value);
  }

  setEventLock(value) {
    _classPrivateFieldSet(this, _execLock, value);
  }

  async auth(password) {
    const res = await this.sendRecv(`auth ${password}`);

    if (res.err) {
      this.emit('error', res.err, 'Connection auth');

      _classPrivateFieldSet(this, _authed, false);

      return _classPrivateFieldGet(this, _authed);
    }

    _classPrivateFieldSet(this, _authed, res.data.getHeader('Nodesl-Reply-OK') === 'accepted');

    if (_classPrivateFieldGet(this, _authed)) {
      this.emit('esl::ready');
    } else {
      this.emit('error', new Error('Authentication Failed'), 'Connection auth');
    }

    return _classPrivateFieldGet(this, _authed);
  }

  async subscribe(events, type = 'json') {
    return await this.events(type, events !== null && events !== void 0 ? events : ['all']);
  }

  _onConnect() {
    _classPrivateFieldSet(this, _parser, new _parser2.default(_classPrivateFieldGet(this, _socket)));

    _classPrivateFieldGet(this, _parser).on('esl::event', (event, headers, body) => {
      this._onEvent(event, headers, body);
    });

    _classPrivateFieldGet(this, _parser).on('error', err => this.emit('error', err, 'Connection onConnect parser error'));

    _classPrivateFieldSet(this, _connecting, false);

    this.emit('esl::connect');
  }

  _onEvent(event, headers, body) {
    const contentType = headers['Content-Type'];
    let emitName;

    switch (contentType) {
      case 'auth/request':
        emitName = 'esl::event::auth::request';
        break;

      case 'api/response':
        emitName = 'esl::event::api::response';
        break;

      case 'command/reply':
        emitName = 'esl::event::command::reply';

        if (!_classPrivateFieldGet(this, _inbound) && headers['Event-Name'] === 'CHANNEL_DATA') {
          _classPrivateFieldSet(this, _channelData, event);

          _classPrivateFieldSet(this, _UniqueID, event.getHeader('Unique-ID'));
        }

        break;

      case 'log/data':
        emitName = 'esl::event::logdata';
        break;

      case 'text/disconnect-notice':
        emitName = 'esl::event::disconnect::notice';
        break;

      case 'text/event-json':
      case 'text/event-plain':
      case 'text/event-xml':
        {
          const eventName = event.getHeader('Event-Name');

          if (eventName === 'BACKGROUND_JOB') {
            const uuid = event.getHeader('Job-UUID');

            if (uuid) {
              emitName = `esl::event::${eventName}::${uuid}`;
            }
          } else if (eventName === 'CHANNEL_EXECUTE_COMPLETE') {
            const uuid = event.getHeader('Application-UUID');

            if (uuid) {
              emitName = `esl::event::${eventName}::${uuid}`;
            }
          } else {
            emitName = `esl::event::${eventName}`;
          }
        }
        break;

      default:
        emitName = `esl::event::raw::${contentType}`;
    }

    if (emitName) {
      this.emit(emitName, event, headers, body);
    }
  }

  async onceAsync(fun, command, eventName, timeout = 3000) {
    let timeId = 0;
    const fn = new Promise((resolve, reject) => {
      this.once(eventName, evt => {
        if (timeId > 0) {
          clearTimeout(timeId);
        }

        resolve(evt);
      });

      try {
        fun();
      } catch (err) {
        if (timeId > 0) {
          clearTimeout(timeId);
        }

        this.removeAllListeners(eventName);
        reject(err);
      }
    });
    const timeoutAsync = new Promise((resolve, reject) => {
      timeId = setTimeout(() => {
        this.removeAllListeners(eventName);
        reject(new Error(`${command} TimeOut`));
      }, timeout);
    });
    return Promise.race([fn, timeoutAsync]).then(data => {
      return {
        data: data
      };
    }).catch(err => {
      return {
        err: err
      };
    });
  }

}

exports.default = Connection;

var _socket = new WeakMap();

var _connecting = new WeakMap();

var _apiCallbackQueue = new WeakMap();

var _cmdCallbackQueue = new WeakMap();

var _host = new WeakMap();

var _port = new WeakMap();

var _password = new WeakMap();

var _authed = new WeakMap();

var _execAsync = new WeakMap();

var _execLock = new WeakMap();

var _inbound = new WeakMap();

var _channelData = new WeakMap();

var _UniqueID = new WeakMap();

var _parser = new WeakMap();