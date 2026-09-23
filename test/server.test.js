// End-to-end tests of the server against the Firestore emulator and a local
// fake SMTP server. They are skipped unless FIRESTORE_EMULATOR_HOST is set;
// run them with `npm run test:emulator` (needs firebase-tools and Java).
//
// They can never reach production or send real email:
// - they refuse to run unless the emulator is on a loopback address and the
//   project id starts with "demo-";
// - the server runs with a throwaway key and a loopback SMTP server;
// - data is read and reset through emulator-only REST endpoints.
const { test, before, after, beforeEach } = require('node:test')
const assert = require('node:assert/strict')

const { startFakeSmtp } = require('./helpers/fake-smtp.js')
const { startServer } = require('./helpers/server.js')

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST
const projectId = process.env.GCLOUD_PROJECT || 'demo-secret-santa'
const skip = !emulatorHost && 'FIRESTORE_EMULATOR_HOST is not set'
const documentsUrl = `http://${emulatorHost}/v1/projects/${projectId}/databases/(default)/documents`
const resetUrl = `http://${emulatorHost}/emulator/v1/projects/${projectId}/databases/(default)/documents`
const year = new Date().getFullYear()

const decodeValue = value => {
  if ('stringValue' in value) return value.stringValue
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return value.doubleValue
  if ('booleanValue' in value) return value.booleanValue
  if ('nullValue' in value) return null
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeValue)
  if ('mapValue' in value) return decodeFields(value.mapValue.fields || {})
  throw new Error(`unexpected Firestore value ${JSON.stringify(value)}`)
}
const decodeFields = fields => Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]))

// "Bearer owner" is the emulator's admin credential; it bypasses the rules.
const listCollection = async name => {
  const response = await fetch(`${documentsUrl}/${name}?pageSize=300`, { headers: { Authorization: 'Bearer owner' } })
  assert.equal(response.status, 200)
  const { documents = [] } = await response.json()
  return documents.map(doc => ({ docId: doc.name.split('/').pop(), data: decodeFields(doc.fields || {}) }))
}

const waitUntil = async (condition, message, timeoutMs = 10000) => {
  const deadline = Date.now() + timeoutMs
  while (!(await condition())) {
    if (Date.now() > deadline) throw new Error(`timed out: ${message}`)
    await new Promise(resolve => setTimeout(resolve, 50))
  }
}

let smtp
let server

const call = async (method, route, body) => {
  const response = await fetch(`${server.url}${route}`, {
    method,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  })
  const text = await response.text()
  let json
  try { json = JSON.parse(text) } catch { json = undefined }
  return { status: response.status, text, json }
}

const createGroup = async (groupName, name, email) => {
  const before = smtp.messages.length
  const response = await call('POST', '/pending-group', { groupName, name, email })
  assert.equal(response.status, 200, response.text)
  await smtp.waitFor(before + 1)
  const [pending] = (await listCollection('pendings')).filter(doc => doc.data.name === groupName)
  return pending.docId
}

const joinGroup = async (id, name, email) => {
  const before = smtp.messages.length
  const response = await call('POST', '/join', { id, name, email })
  assert.equal(response.status, 200, response.text)
  await smtp.waitFor(before + 2)
}

before(async () => {
  if (skip) return
  assert.match(emulatorHost, /^(127\.0\.0\.1|localhost|\[::1\]):\d+$/, 'the emulator must run on a loopback address')
  assert.match(projectId, /^demo-/, 'the emulator tests only run against a demo- project')
  smtp = await startFakeSmtp()
  server = await startServer({ firestoreHost: emulatorHost, projectId, smtp })
})

after(async () => {
  await server?.stop()
  await smtp?.stop()
})

beforeEach(async () => {
  if (skip) return
  const response = await fetch(resetUrl, { method: 'DELETE' }) // emulator-only reset
  assert.equal(response.status, 200)
  smtp.messages.length = 0
})

test('GET / serves the web app build', { skip }, async () => {
  const response = await call('GET', '/')
  assert.equal(response.status, 200)
  assert.match(response.text, /test build/)
})

test('POST /pending-group creates a group and emails its owner a dispatch link', { skip }, async () => {
  const response = await call('POST', '/pending-group', { groupName: 'Famille Dupont', name: 'Alice', email: 'alice@example.test' })
  assert.equal(response.status, 200)
  assert.deepEqual(response.json, { results: true })

  const pendings = await listCollection('pendings')
  assert.equal(pendings.length, 1)
  const [{ docId, data }] = pendings
  assert.deepEqual(data, { id: docId, name: 'Famille Dupont', users: [{ name: 'Alice', email: 'alice@example.test' }] })

  const [mail] = await smtp.waitFor(1)
  assert.deepEqual(mail.to, ['alice@example.test'])
  assert.equal(mail.from, 'santa@secret-santa.test')
  assert.match(mail.headers.subject, new RegExp(`Secret Santa ${year}`))
  assert.match(mail.body, /Bonjour Alice/)
  assert.match(mail.body, /Ton groupe Famille Dupont a été créé/)
  assert.ok(mail.body.includes(`https://secret-santa.test/dispatch?id=${docId}`), mail.body)
})

test('GET /group finds pending groups by name, leaving out groups the user is in', { skip }, async () => {
  const id = await createGroup('Famille Dupont', 'Alice', 'alice@example.test')

  const found = await call('GET', '/group?text=dupont&email=bob@example.test')
  assert.equal(found.status, 200)
  assert.deepEqual(found.json, {
    results: [{ id, name: 'Famille Dupont', users: [{ name: 'Alice', email: 'alice@example.test' }] }],
  })

  const member = await call('GET', '/group?text=dupont&email=alice@example.test')
  assert.deepEqual(member.json, { results: [] })

  const none = await call('GET', '/group?text=martin&email=bob@example.test')
  assert.deepEqual(none.json, { results: [] })
})

test('POST /join adds the user and emails both the owner and the new member', { skip }, async () => {
  const id = await createGroup('Famille Dupont', 'Alice', 'alice@example.test')

  const response = await call('POST', '/join', { id, name: 'Bob', email: 'bob@example.test' })
  assert.equal(response.status, 200)
  assert.deepEqual(response.json, { results: true })

  const [{ data }] = await listCollection('pendings')
  assert.deepEqual(data.users, [{ name: 'Alice', email: 'alice@example.test' }, { name: 'Bob', email: 'bob@example.test' }])

  const mails = (await smtp.waitFor(3)).slice(1)
  const toOwner = mails.find(mail => mail.to[0] === 'alice@example.test')
  const toMember = mails.find(mail => mail.to[0] === 'bob@example.test')
  assert.match(toOwner.body, /Bonjour Alice,.*Bob a bien rejoint le groupe Famille Dupont/s)
  assert.match(toMember.body, /Bonjour Bob,.*Tu as bien rejoint le groupe Famille Dupont/s)
})

test('GET /dispatch draws the exchange, stores it, removes the pending group and emails everyone', { skip }, async () => {
  const id = await createGroup('Famille Dupont', 'Alice', 'alice@example.test')
  await joinGroup(id, 'Bob', 'bob@example.test')
  await joinGroup(id, 'Carol', 'carol@example.test')
  smtp.messages.length = 0

  const response = await call('GET', `/dispatch?id=${id}`)
  assert.equal(response.status, 200)
  assert.deepEqual(response.json, { results: true })

  const groups = await listCollection('groups')
  assert.equal(groups.length, 1)
  const { dispatch } = groups[0].data
  assert.equal(dispatch.length, 3)
  const names = ['Alice', 'Bob', 'Carol']
  assert.deepEqual(dispatch.map(pair => pair.giver.name).sort(), names)
  assert.deepEqual(dispatch.map(pair => pair.receiver.name).sort(), names)
  for (const { giver, receiver } of dispatch) {
    assert.notEqual(giver.name, receiver.name)
    assert.match(giver.id, /^[A-Za-z0-9]{20}$/)
  }

  await waitUntil(async () => (await listCollection('pendings')).length === 0, 'pending group deleted')

  const mails = await smtp.waitFor(3)
  for (const { giver, receiver } of dispatch) {
    const mail = mails.find(m => m.to[0] === giver.email)
    assert.ok(mail, `no email for ${giver.email}`)
    assert.ok(mail.body.includes(`<b>${receiver.name}</b>`), mail.body)
  }
})

test('GET /dispatch with an unknown id answers with an empty object', { skip }, async () => {
  const response = await call('GET', '/dispatch?id=unknown')
  assert.equal(response.status, 200)
  assert.deepEqual(response.json, {})
  assert.equal(smtp.messages.length, 0)
})

test('POST /group draws the exchange for any list of users it is given', { skip }, async () => {
  const users = [
    { id: 'a', name: 'Alice', email: 'alice@example.test' },
    { id: 'b', name: 'Bob', email: 'bob@example.test' },
  ]
  const response = await call('POST', '/group', { users })
  assert.equal(response.status, 200)
  const mails = await smtp.waitFor(2)
  assert.deepEqual(mails.map(mail => mail.to[0]).sort(), ['alice@example.test', 'bob@example.test'])
})

test('security rules deny direct client reads and writes', { skip }, async () => {
  const id = await createGroup('Famille Dupont', 'Alice', 'alice@example.test')
  const url = `${documentsUrl}/pendings/${id}`

  // No Authorization header: the request is treated like any client on the internet.
  assert.equal((await fetch(url)).status, 403)
  assert.equal((await fetch(`${url}?updateMask.fieldPaths=name`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { name: { stringValue: 'changed' } } }),
  })).status, 403)
  assert.equal((await fetch(url, { method: 'DELETE' })).status, 403)

  const [{ data }] = await listCollection('pendings')
  assert.equal(data.name, 'Famille Dupont')
})

// Runs last: every request above must have been handled without crashing the
// server or leaving an uncaught error in its log.
test('the server survived every request', { skip }, async () => {
  assert.equal(server.child.exitCode, null, server.output())
  assert.doesNotMatch(server.output(), /TypeError|ReferenceError|Unhandled|uncaught/i, server.output())
})
