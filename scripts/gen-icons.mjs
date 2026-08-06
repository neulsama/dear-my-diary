// Generates the PWA app icons as PNGs with zero dependencies (raw pixels -> PNG
// via Node's zlib). Design: purple background + cream planner card with a header
// band and three note lines. Run: node scripts/gen-icons.mjs
import zlib from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(here, '../public/icons')
mkdirSync(outDir, { recursive: true })

const PURPLE = [0x74, 0x53, 0x9b]
const CREAM = [0xfb, 0xfa, 0xf6]

const crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 } return t })()
const crc32 = buf => { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0 }
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const t = Buffer.from(type, 'ascii'); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, crc]) }

function makePng(size) {
  const s = size
  const rgba = Buffer.alloc(s * s * 4)
  const rect = (x0, y0, w, h, c) => {
    const x1 = Math.round(x0), y1 = Math.round(y0), x2 = Math.round(x0 + w), y2 = Math.round(y0 + h)
    for (let y = Math.max(0, y1); y < Math.min(s, y2); y++) for (let x = Math.max(0, x1); x < Math.min(s, x2); x++) {
      const i = (y * s + x) * 4; rgba[i] = c[0]; rgba[i + 1] = c[1]; rgba[i + 2] = c[2]; rgba[i + 3] = 255
    }
  }
  rect(0, 0, s, s, PURPLE)
  const cw = s * 0.56, ch = s * 0.66, cx = (s - cw) / 2, cy = (s - ch) / 2
  rect(cx, cy, cw, ch, CREAM)
  rect(cx, cy, cw, s * 0.09, PURPLE)
  const lx = cx + cw * 0.14, lw = cw * 0.72, lh = s * 0.045
  ;[0.34, 0.52, 0.70].forEach((f, i) => rect(lx, cy + ch * f, i === 2 ? lw * 0.6 : lw, lh, PURPLE))

  const stride = 1 + s * 4
  const raw = Buffer.alloc(s * stride)
  for (let y = 0; y < s; y++) { raw[y * stride] = 0; rgba.copy(raw, y * stride + 1, y * s * 4, (y + 1) * s * 4) }
  const idat = zlib.deflateSync(raw, { level: 9 })
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(s, 0); ihdr.writeUInt32BE(s, 4); ihdr[8] = 8; ihdr[9] = 6
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

for (const size of [512, 192, 180]) {
  const file = resolve(outDir, `icon-${size}.png`)
  writeFileSync(file, makePng(size))
  console.log('wrote', file)
}
