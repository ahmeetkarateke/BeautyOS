// Koşul bekler: verilen host:port TCP bağlantısı kabul edene kadar dener.
// Kullanım: node bekle.cjs postgres:5432 redis:6379
const net = require('node:net')

const deadline = Date.now() + 60_000

function tryOnce(target) {
  const [host, port] = target.split(':')
  return new Promise((resolve) => {
    const s = net.connect({ host, port: Number(port) }, () => {
      s.destroy()
      resolve(true)
    })
    s.on('error', () => resolve(false))
    s.setTimeout(1000, () => {
      s.destroy()
      resolve(false)
    })
  })
}

async function waitFor(target) {
  while (Date.now() < deadline) {
    if (await tryOnce(target)) return
    await new Promise((r) => setTimeout(r, 500))
  }
  console.error(`zaman asimi: ${target}`)
  process.exit(1)
}

Promise.all(process.argv.slice(2).map(waitFor)).then(() => process.exit(0))
