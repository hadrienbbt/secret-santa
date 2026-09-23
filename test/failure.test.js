// Starts the server against a Firestore stand-in that rejects every call.
// Runs in the default `npm test`: no emulator or network access is needed,
// and email goes to a local fake SMTP server.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { startFailingFirestore } from './helpers/failing-firestore.js'
import { startFakeSmtp } from './helpers/fake-smtp.js'
import { startServer } from './helpers/server.js'

let firestore
let smtp
let server

before(async () => {
  firestore = await startFailingFirestore()
  smtp = await startFakeSmtp()
  server = await startServer({ firestoreHost: firestore.host, projectId: 'demo-secret-santa', smtp })
})

after(async () => {
  await server?.stop()
  await smtp?.stop()
  await firestore?.stop()
})

const call = async (method, route, body) => {
  const response = await fetch(`${server.url}${route}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  })
  return { status: response.status, json: JSON.parse(await response.text()) }
}

test('GET / serves the web app with hardened headers', async () => {
  const response = await fetch(`${server.url}/`)
  assert.equal(response.status, 200)
  assert.match(await response.text(), /test build/)
  assert.equal(response.headers.get('x-powered-by'), null)
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
})

test('every route answers 503, and the server keeps running, when Firestore fails', { timeout: 30000 }, async () => {
  const unavailable = { code: 503, status: 'Service Unavailable', message: 'Service unavailable' }
  const requests = [
    ['GET', '/group?text=a&email=b'],
    ['POST', '/pending-group', { groupName: 'G', name: 'A', email: 'a@example.test' }],
    ['POST', '/join', { id: 'some-group', name: 'B', email: 'b@example.test' }],
    ['GET', '/dispatch?id=some-group'],
  ]
  for (let round = 1; round <= 2; round++) {
    for (const [method, route, body] of requests) {
      const response = await call(method, route, body)
      assert.equal(response.status, 503, `${method} ${route}, round ${round}`)
      assert.deepEqual(response.json, unavailable)
    }
  }
  assert.ok(firestore.calls >= requests.length * 2, 'every request must have reached the Firestore stand-in')
  assert.equal(server.child.exitCode, null, 'the server process must still be running')
  assert.equal(smtp.messages.length, 0)
})
