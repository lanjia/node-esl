const esl = require('../lib/index')

const conn = esl.Connection.createInbound('127.0.0.1', 8021, '56766566', async () => {
  conn.on('esl::event::CHANNEL_CREATE', (evt) => {
    console.debug('-----------CHANNEL_CREATE-----------------')
    console.log('CHANNEL_CREATE:', evt.serialize())
  })

  conn.on('esl::event::CHANNEL_DESTROY', () => {
    console.debug('-----------CHANNEL_DESTROY-----------------')
  })

  conn.on('esl::event::CHANNEL_CALLSTATE', () => {
    console.debug('-----------CHANNEL_CALLSTATE-----------------')
  })

  let res = await conn.subscribe(['BACKGROUND_JOB', 'CHANNEL_CREATE'])
  console.log('subscribe res:', res.getHeader('success'))

  // res = await conn.api('json {"command" : "status", "data" : ""}')
  // console.log('api res:', res.getBody())

  res = await conn.api('show registrations')
  console.log('show registrations res:', res.getBody())

  // res = await conn.api('show registrations as json')
  // console.log('show registrations as json res:', res.getBody())
})
