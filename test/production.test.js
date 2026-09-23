// Runs the server the way production does: NODE_ENV=production, HTTPS, and
// mail over implicit TLS (port 465 style) because SSL_CERT and SSL_KEY are
// set. Uses a throwaway self-signed certificate made with openssl, the
// Firestore emulator and a local TLS fake SMTP server. Skipped unless
// FIRESTORE_EMULATOR_HOST is set and openssl is available.
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const https = require('node:https')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const { startFakeSmtp } = require('./helpers/fake-smtp.js')
const { startServer } = require('./helpers/server.js')

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST
const projectId = process.env.GCLOUD_PROJECT || 'demo-secret-santa'
const hasOpenssl = (() => { try { execFileSync('openssl', ['version'], { stdio: 'ignore' }); return true } catch { return false } })()
const skip = (!emulatorHost && 'FIRESTORE_EMULATOR_HOST is not set') || (!hasOpenssl && 'openssl is not available')

// fetch() cannot skip certificate checks per request, so use node:https.
const request = (url, { method = 'GET', body } = {}) => new Promise((resolve, reject) => {
  const req = https.request(url, { method, rejectUnauthorized: false, headers: { 'Content-Type': 'application/json' } }, res => {
    let text = ''
    res.setEncoding('utf8')
    res.on('data', chunk => { text += chunk })
    res.on('end', () => resolve({ status: res.statusCode, text }))
  })
  req.on('error', reject)
  req.end(body && JSON.stringify(body))
})

let dir
let smtp
let server

before(async () => {
  if (skip) return
  assert.match(emulatorHost, /^(127\.0\.0\.1|localhost|\[::1\]):\d+$/, 'the emulator must run on a loopback address')
  assert.match(projectId, /^demo-/, 'the emulator tests only run against a demo- project')
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'secret-santa-tls-'))
  const certPath = path.join(dir, 'cert.pem')
  const keyPath = path.join(dir, 'key.pem')
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', keyPath, '-out', certPath, '-days', '1', '-subj', '/CN=localhost'], { stdio: 'ignore' })
  smtp = await startFakeSmtp({ tls: { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) } })
  server = await startServer({ firestoreHost: emulatorHost, projectId, smtp, production: { certPath, keyPath } })
})

after(async () => {
  await server?.stop()
  await smtp?.stop()
  if (dir) fs.rmSync(dir, { recursive: true, force: true })
})

test('in production mode, the server answers over HTTPS and sends mail over TLS', { skip }, async () => {
  const home = await request(`${server.url}/`)
  assert.equal(home.status, 200)

  const created = await request(`${server.url}/pending-group`, { method: 'POST', body: { groupName: 'Collègues', name: 'Dana', email: 'dana@example.test' } })
  assert.equal(created.status, 200)
  assert.deepEqual(JSON.parse(created.text), { results: true })

  const [mail] = await smtp.waitFor(1)
  assert.deepEqual(mail.to, ['dana@example.test'])
  assert.match(mail.body, /Ton groupe Collègues a été créé/)
  assert.match(mail.body, /https:\/\/secret-santa\.test\/dispatch\?id=[A-Za-z0-9]{20}/)
})
