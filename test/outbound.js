const ESL = require('../lib/index')

const server = new ESL.Server('127.0.0.1', 9001, () => {
  console.log('esl server is up')
})

server.on('connection::ready', async (conn) => {
  console.log('connection::ready')
  // console.log(conn.getInfo())
  conn.on('esl::event::CHANNEL_ANSWER', async (evt) => {
    console.log('CHANNEL_ANSWER')

    console.log('playback start')
    console.time('playback')
    let res = await conn.execute('playback', 'voc/welcome.wav', 20000)
    if (res.err) {
      console.log('playback err:', res.err.message)
    } else {
      console.log('playback res:', res.data.serialize())
    }
    console.timeEnd('playback')

    console.log('bridge start')
    console.time('bridge')
    res = await conn.execute('bridge', 'user/1011', 200000)
    if (res.err) {
      console.log('bridge err:', res.err.message)
    } else {
      console.log('bridge res:', res.data.serialize())
    }
    console.timeEnd('bridge')
  })

  conn.on('esl::end', async () => {
    console.debug('esl::end')
  })

  const res = await conn.execute('answer')
  if (res.err) {
    console.log('answer err:', res.err.message)
  }
})

// server.on('connection::close', async () => {
//   console.debug('CONNECTION::CLOSE')
// })
