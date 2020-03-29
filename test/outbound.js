const esl = require('../lib/index')

const server = new esl.Server('127.0.0.1', 9001, () => {
  console.log('esl server is up')
})

server.on('connection::ready', async (conn) => {
  console.log('connection::ready')
  // console.log(conn.getInfo())
  conn.on('esl::event::CHANNEL_ANSWER', async () => {
    console.log('CHANNEL_ANSWER')
    console.time('playback')
    await conn.execute('playback', 'voc/welcome.wav', 20000)
    console.timeEnd('playback')
  })

  conn.on('esl::end', async () => {
    console.debug('esl::end')
  })

  await conn.execute('answer')
  // console.log('answer:', res.serialize())
})

// server.on('connection::close', async () => {
//   console.debug('CONNECTION::CLOSE')
// })
