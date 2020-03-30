const ESL = require('../lib/index')

const conn = ESL.Connection.createInbound('127.0.0.1', 8021, '56766566', async () => {
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

  let res = await conn.subscribe(['BACKGROUND_JOB', 'CHANNEL_CREATE'])
  if (!res.err) {
    console.log('subscribe res:', res.data.getHeader('success'))
  }

  res = await conn.api('json {"command" : "status", "data" : ""}', 2000)
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
