// Builds the web app the way the production start script does and checks
// the output the server serves. Skipped when the app's dependencies are not
// installed (run `npm ci` in app/ first).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const appDir = path.join(import.meta.dirname, '..', 'app')
const vite = path.join(appDir, 'node_modules', '.bin', 'vite')
const skip = !fs.existsSync(vite) && 'app dependencies are not installed'

test('the production build targets the configured server and keeps the public files', { skip, timeout: 120000 }, t => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'secret-santa-app-'))
  t.after(() => fs.rmSync(outDir, { recursive: true, force: true }))
  execFileSync(vite, ['build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'error'], {
    cwd: appDir,
    env: { ...process.env, NODE_ENV: 'production', REACT_APP_SERVER_DOMAIN: 'secret-santa.test' },
    stdio: 'pipe',
  })

  const html = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8')
  const script = html.match(/<script type="module" crossorigin src="\/assets\/(index-[\w-]+\.js)"><\/script>/)
  assert.ok(script, html)
  assert.match(html, /<link rel="stylesheet" crossorigin href="\/assets\/index-[\w-]+\.css">/)
  assert.doesNotMatch(html, /%PUBLIC_URL%/)

  const bundle = fs.readFileSync(path.join(outDir, 'assets', script[1]), 'utf8')
  assert.ok(bundle.includes('https://secret-santa.test'), 'the API calls must go to the configured domain over https')
  assert.doesNotMatch(bundle, /process\.env/, 'every process.env reference must be replaced at build time')
  assert.ok(bundle.includes('secret-santa-6a7a9'), 'the Firebase configuration must be bundled')

  for (const file of ['manifest.json', 'robots.txt', 'santa.ico']) {
    assert.ok(fs.existsSync(path.join(outDir, file)), `${file} must be copied from public/`)
  }
  const assets = fs.readdirSync(path.join(outDir, 'assets'))
  assert.ok(assets.some(name => name.startsWith('santa-') && name.endsWith('.png')), assets.join(', '))
  assert.ok(assets.some(name => name.startsWith('Christmas Time Personal Use-') && name.endsWith('.ttf')), assets.join(', '))
})
