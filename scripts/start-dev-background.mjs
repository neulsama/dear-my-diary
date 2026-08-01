import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const viteEntry = resolve(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js')
const address = 'http://127.0.0.1:5180'

async function isReady() {
  try {
    const response = await fetch(address, { signal: AbortSignal.timeout(700) })
    return response.ok
  } catch {
    return false
  }
}

if (await isReady()) {
  console.log(`이미 실행 중입니다: ${address}`)
  process.exit(0)
}

// PowerShell 호스트에 Path/PATH가 함께 존재해도 Windows 프로세스 생성이 실패하지 않도록 정규화한다.
const childEnvironment = {}
for (const [key, value] of Object.entries(process.env)) {
  if (value === undefined) continue
  childEnvironment[key.toLowerCase() === 'path' ? 'Path' : key] = value
}

const child = spawn(process.execPath, [viteEntry, '--host', '127.0.0.1', '--port', '5180', '--strictPort'], {
  cwd: projectRoot,
  env: childEnvironment,
  detached: true,
  windowsHide: true,
  stdio: 'ignore'
})

await new Promise((resolveSpawn, rejectSpawn) => {
  child.once('spawn', resolveSpawn)
  child.once('error', rejectSpawn)
})

let ready = false
for (let attempt = 0; attempt < 25; attempt += 1) {
  await new Promise(resolveDelay => setTimeout(resolveDelay, 200))
  if (await isReady()) { ready = true; break }
}

if (!ready) {
  child.kill()
  throw new Error('개발 서버가 5초 안에 시작되지 않았습니다.')
}

child.unref()
console.log(`백그라운드 서버를 시작했습니다: ${address} (PID ${child.pid})`)
