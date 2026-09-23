// A minimal SMTP server for tests. It accepts any login, records every
// message it receives, and delivers nothing.
const net = require('node:net')

const decodeQuotedPrintable = text => {
  const bytes = []
  const input = text.replace(/=\r?\n/g, '')
  for (let i = 0; i < input.length; i++) {
    const hex = input.slice(i + 1, i + 3)
    if (input[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(hex)) {
      bytes.push(parseInt(hex, 16))
      i += 2
    } else {
      bytes.push(input.charCodeAt(i))
    }
  }
  return Buffer.from(bytes).toString('utf8')
}

const decodeHeader = value => value
  .replace(/\r?\n[ \t]+/g, ' ')
  .replace(/=\?UTF-8\?([QB])\?([^?]*)\?=\s*/gi, (_, encoding, text) => encoding.toUpperCase() === 'B'
    ? Buffer.from(text, 'base64').toString('utf8')
    : decodeQuotedPrintable(text.replace(/_/g, ' ')))
  .trim()

// Splits a raw message into decoded headers and a decoded body.
const parseMessage = raw => {
  const split = raw.indexOf('\r\n\r\n')
  const headerBlock = raw.slice(0, split)
  const body = raw.slice(split + 4)
  const headers = {}
  for (const line of headerBlock.replace(/\r\n[ \t]+/g, ' ').split('\r\n')) {
    const colon = line.indexOf(':')
    headers[line.slice(0, colon).toLowerCase()] = decodeHeader(line.slice(colon + 1))
  }
  const encoding = (headers['content-transfer-encoding'] || '').toLowerCase()
  const text = encoding === 'base64'
    ? Buffer.from(body.replace(/\s+/g, ''), 'base64').toString('utf8')
    : encoding === 'quoted-printable' ? decodeQuotedPrintable(body) : body
  return { headers, body: text }
}

const startFakeSmtp = async () => {
  const messages = []
  const sockets = new Set()
  const server = net.createServer(socket => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
    socket.setEncoding('utf8')
    let buffer = ''
    let inData = false
    let pending = null
    let envelope = { from: null, to: [] }
    const reply = line => socket.write(`${line}\r\n`)
    reply('220 fake-smtp ESMTP ready')
    socket.on('data', chunk => {
      buffer += chunk
      for (;;) {
        if (inData) {
          const end = buffer.indexOf('\r\n.\r\n')
          if (end === -1) return
          const raw = buffer.slice(0, end).replace(/^\.\./gm, '.')
          buffer = buffer.slice(end + 5)
          inData = false
          messages.push({ ...envelope, ...parseMessage(raw) })
          envelope = { from: null, to: [] }
          reply('250 2.0.0 Accepted')
          continue
        }
        const newline = buffer.indexOf('\r\n')
        if (newline === -1) return
        const line = buffer.slice(0, newline)
        buffer = buffer.slice(newline + 2)
        if (pending === 'login-user') { pending = 'login-pass'; reply('334 UGFzc3dvcmQ6'); continue }
        if (pending === 'login-pass' || pending === 'plain') { pending = null; reply('235 2.7.0 Authentication successful'); continue }
        const upper = line.toUpperCase()
        if (upper.startsWith('EHLO')) {
          reply('250-fake-smtp')
          reply('250-AUTH PLAIN LOGIN')
          reply('250 SIZE 10485760')
        } else if (upper.startsWith('HELO')) reply('250 fake-smtp')
        else if (upper.startsWith('AUTH PLAIN')) {
          if (line.trim().split(/\s+/).length > 2) reply('235 2.7.0 Authentication successful')
          else { pending = 'plain'; reply('334 ') }
        } else if (upper.startsWith('AUTH LOGIN')) {
          if (line.trim().split(/\s+/).length > 2) { pending = 'login-pass'; reply('334 UGFzc3dvcmQ6') }
          else { pending = 'login-user'; reply('334 VXNlcm5hbWU6') }
        } else if (upper.startsWith('MAIL FROM:')) { envelope.from = line.match(/<([^>]*)>/)[1]; reply('250 2.1.0 OK') }
        else if (upper.startsWith('RCPT TO:')) { envelope.to.push(line.match(/<([^>]*)>/)[1]); reply('250 2.1.5 OK') }
        else if (upper === 'DATA') { inData = true; reply('354 End data with <CR><LF>.<CR><LF>') }
        else if (upper === 'RSET') { envelope = { from: null, to: [] }; reply('250 2.0.0 OK') }
        else if (upper === 'NOOP') reply('250 2.0.0 OK')
        else if (upper === 'QUIT') { reply('221 2.0.0 Bye'); socket.end() }
        else reply('502 5.5.2 Command not recognized')
      }
    })
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  return {
    host: '127.0.0.1',
    port: server.address().port,
    messages,
    // Waits until at least `count` messages have arrived.
    waitFor: async (count, timeoutMs = 10000) => {
      const deadline = Date.now() + timeoutMs
      while (messages.length < count) {
        if (Date.now() > deadline) throw new Error(`expected ${count} emails, got ${messages.length}`)
        await new Promise(resolve => setTimeout(resolve, 20))
      }
      return messages
    },
    stop: () => new Promise(resolve => {
      for (const socket of sockets) socket.destroy()
      server.close(resolve)
    }),
  }
}

module.exports = { startFakeSmtp, parseMessage }
