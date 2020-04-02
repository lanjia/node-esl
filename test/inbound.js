const ESL = require('../lib/index')

const conn = ESL.Connection.createInbound('127.0.0.1', 8021, '56766566', async () => {

  conn.on('esl::event::HEARTBEAT', (evt) => {
    // console.log('HEARTBEAT:', evt.serialize())
    /*
    {
        "Event-Name": "HEARTBEAT",
        "Core-UUID": "3760aed7-609d-47aa-a44a-1f1bc5f43bd4",
        "FreeSWITCH-Hostname": "188e0bce2eaf",
        "FreeSWITCH-Switchname": "bluecti",
        "FreeSWITCH-IPv4": "172.18.0.4",
        "FreeSWITCH-IPv6": "::1",
        "Event-Date-Local": "2020-03-30 23:12:06",
        "Event-Date-GMT": "Mon, 30 Mar 2020 15:12:06 GMT",
        "Event-Date-Timestamp": "1585581126230314",
        "Event-Calling-File": "switch_core.c",
        "Event-Calling-Function": "send_heartbeat",
        "Event-Calling-Line-Number": "80",
        "Event-Sequence": "146010",
        "Event-Info": "System Ready",
        "Up-Time": "0 years, 1 day, 11 hours, 43 minutes, 1 second, 527 milliseconds, 406 microseconds",
        "FreeSWITCH-Version": "1.8.7+git~20190702T200609Z~6047ebddfc~64bit",
        "Uptime-msec": "128581527",
        "Session-Count": "0",
        "Max-Sessions": "1000",
        "Session-Per-Sec": "30",
        "Session-Per-Sec-Last": "0",
        "Session-Per-Sec-Max": "2",
        "Session-Per-Sec-FiveMin": "0",
        "Session-Since-Startup": "95",
        "Session-Peak-Max": "3",
        "Session-Peak-FiveMin": "0",
        "Idle-CPU": "96.866667"
    }
    */
    console.log(evt.getHeader('Core-UUID'))
    console.log(evt.getHeader('FreeSWITCH-IPv4'))
    console.log(evt.getHeader('Up-Time'))
    console.log(evt.getHeader('Event-Date-Timestamp'))
    console.log(evt.getHeader('Idle-CPU'))
  })

  // conn.on('esl::event::CHANNEL_CREATE', (evt) => {
  //   console.debug('-----------CHANNEL_CREATE-----------------')
  //   console.log('CHANNEL_CREATE:', evt.serialize())
  // })

  // conn.on('esl::event::CHANNEL_DESTROY', () => {
  //   console.debug('-----------CHANNEL_DESTROY-----------------')
  // })

  // conn.on('esl::event::CHANNEL_CALLSTATE', () => {
  //   console.debug('-----------CHANNEL_CALLSTATE-----------------')
  // })

  // let err
  // let res
  // [err, res] = await conn.subscribe(['BACKGROUND_JOB', 'CHANNEL_CREATE'])
  // console.log('subscribe res:', res.getHeader('success'))
  // // let err2
  // [err, res] = await conn.api('json {"command" : "status", "data" : ""}', 2000)
  // if (!err) {
  //   console.log('api res:', res)
  // }
  console.log('-------begin---------')

  let res = await conn.subscribe(['BACKGROUND_JOB', 'CHANNEL_CREATE', 'HEARTBEAT'])
  if (!res.err) {
    console.log('subscribe res:', res.data.getHeader('success'))
  }

  // res = await conn.api('json {"command" : "status", "data" : ""}', 2000)
  // if (!res.err) {
  //   console.log('api res:', res.data)
  // }

  // res = await conn.api('json {"command": "callcenter_config", "format": "pretty", "data": {"arguments":"agent list"}}', 2000)
  // if (!res.err) {
  //   console.log('api res:', typeof res.data)
  // }

  res = await conn.api('json {"command": "callcenter_config", "format": "pretty", "data": {"arguments":"agent list"}}')
  if (!res.err) {
    console.log('api res:', res.data)
  }

  console.log('-------end---------')

  // res = await conn.api('show registrations')
  // console.log(`[${res}]`)

  // res = await conn.api('show1 registrations as json')
  // console.log(`[${res}]`)

  // res = await conn.api('callcenter_config1 agent set status 10111 Available')
  // console.log(`[${res}]`)
})
