// Starts the real server (server/index.js) in isolation, for tests. It runs
// from a temp copy with a throwaway service-account key where index.js expects
// the real one, so the repo's .keys/ is never read or written. Firestore
// traffic goes to the emulator and email to a local fake SMTP server.
import crypto from 'node:crypto'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const repoRoot = path.join(import.meta.dirname, '..', '..')
const loopback = /^(127\.0\.0\.1|localhost|\[::1\]):\d+$/

// A service-account key that looks real but grants nothing anywhere.
const throwawayServiceAccount = projectId => {
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  return {
    type: 'service_account',
    project_id: projectId,
    private_key_id: 'throwaway',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    client_email: `test@${projectId}.iam.gserviceaccount.com`,
    client_id: '0',
    token_uri: 'https://oauth2.googleapis.com/token',
  }
}

const freePort = () => new Promise(resolve => {
  const probe = net.createServer().listen(0, '127.0.0.1', () => {
    const { port } = probe.address()
    probe.close(() => resolve(port))
  })
})

// With `production` ({ certPath, keyPath }), it runs like production: HTTPS,
// and mail over implicit TLS because SSL_CERT and SSL_KEY are set.
const startServer = async ({ firestoreHost, projectId, smtp, production }) => {
  if (!loopback.test(firestoreHost)) throw new Error('Firestore host must be on loopback')
  if (!/^demo-/.test(projectId)) throw new Error('project id must start with demo-')
  if (smtp.host !== '127.0.0.1') throw new Error('SMTP host must be on loopback')

  const entry = fs.readFileSync(path.join(repoRoot, 'server', 'index.js'), 'utf8')
  const keyFile = entry.match(/from '\.\.\/\.keys\/([^']+\.json)'/)[1]
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'secret-santa-server-'))
  fs.cpSync(path.join(repoRoot, 'server'), path.join(dir, 'server'), { recursive: true })
  fs.copyFileSync(path.join(repoRoot, 'package.json'), path.join(dir, 'package.json')) // "type": "module"
  fs.mkdirSync(path.join(dir, '.keys'))
  fs.writeFileSync(path.join(dir, '.keys', keyFile), JSON.stringify(throwawayServiceAccount(projectId)))
  fs.symlinkSync(path.join(repoRoot, 'node_modules'), path.join(dir, 'node_modules'), 'dir')
  const publicDir = path.join(dir, 'public')
  fs.mkdirSync(publicDir)
  fs.writeFileSync(path.join(publicDir, 'index.html'), '<!doctype html><title>Secret Santa</title><div id="root">test build</div>')

  const port = await freePort()
  // Minimal environment, run from the temp dir so no .env file is loaded.
  const child = spawn(process.execPath, [path.join(dir, 'server', 'index.js')], {
    cwd: dir,
    env: {
      PATH: process.env.PATH,
      NODE_ENV: production ? 'production' : 'development',
      ...(production && { SSL_CERT: production.certPath, SSL_KEY: production.keyPath }),
      PORT: String(port),
      DOMAIN: 'secret-santa.test',
      PUBLIC_URL: publicDir,
      SMTP_HOST: smtp.host,
      SMTP_PORT: String(smtp.port),
      SMTP_USER: 'test',
      SMTP_PWD: 'test',
      SENDER_EMAIL: 'santa@secret-santa.test',
      FIRESTORE_EMULATOR_HOST: firestoreHost,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  const onData = chunk => { output += chunk }
  child.stdout.on('data', onData)
  child.stderr.on('data', onData)
  const stop = async () => {
    if (child.exitCode === null) {
      child.kill()
      await new Promise(resolve => child.once('exit', resolve))
    }
    fs.rmSync(dir, { recursive: true, force: true })
  }
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`server did not start:\n${output}`)), 15000)
      const check = () => {
        if (output.includes(`Listening ${production ? 'https' : 'http'} on port ${port}`) && output.includes('SMTP Server ready')) {
          clearTimeout(timer)
          resolve()
        }
      }
      child.stdout.on('data', check)
      child.stderr.on('data', check)
      child.on('exit', code => { clearTimeout(timer); reject(new Error(`server exited with ${code}:\n${output}`)) })
    })
  } catch (error) {
    await stop()
    throw error
  }
  return { url: `${production ? 'https' : 'http'}://127.0.0.1:${port}`, child, output: () => output, stop }
}

export { throwawayServiceAccount, startServer }
