const path = require('path')
const fs = require('fs/promises')
const { existsSync } = require('fs')
const { spawn } = require('child_process')
const ffmpegPath = require('ffmpeg-static')
const sharp = require('sharp')
const pngToIcoModule = require('png-to-ico')
const pngToIco = pngToIcoModule.default || pngToIcoModule

const ROOT = path.resolve(__dirname, '..')
const INPUT_VIDEO = path.join(ROOT, 'public', 'loading.mp4')
const OUT_PUBLIC = path.join(ROOT, 'public')
const OUT_BRANDING = path.join(OUT_PUBLIC, 'branding')

async function ensureFileExists(filePath, label) {
  if (!existsSync(filePath)) {
    throw new Error(`${label} not found: ${filePath}`)
  }
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { stdio: 'inherit' })
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`))
      }
    })
  })
}

async function writePng(buffer, outPath) {
  await fs.writeFile(outPath, buffer)
}

async function main() {
  await ensureFileExists(INPUT_VIDEO, 'Input video')
  if (!ffmpegPath) {
    throw new Error('ffmpeg-static did not resolve a binary path')
  }

  await fs.mkdir(OUT_BRANDING, { recursive: true })

  const sourceFrame = path.join(OUT_BRANDING, 'logo-master-source.png')
  const masterPng = path.join(OUT_BRANDING, 'logo-master.png')

  // Extract a single HD frame from the video (1s in) for logo sources.
  await runFfmpeg([
    '-y',
    '-ss', '00:00:01',
    '-i', INPUT_VIDEO,
    '-frames:v', '1',
    '-update', '1',
    '-q:v', '2',
    sourceFrame
  ])

  const masterImage = sharp(sourceFrame).ensureAlpha()

  // High-res source variants
  await masterImage.png().toFile(path.join(OUT_BRANDING, 'logo-master.png'))
  await masterImage.webp({ quality: 90 }).toFile(path.join(OUT_BRANDING, 'logo-master.webp'))
  await masterImage.jpeg({ quality: 92 }).toFile(path.join(OUT_BRANDING, 'logo-master.jpg'))

  const iconSizes = [16, 32, 48, 64, 128, 256]
  const iconBuffers = []

  for (const size of iconSizes) {
    const buffer = await sharp(masterPng)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .png()
      .toBuffer()
    const outPath = path.join(OUT_PUBLIC, `favicon-${size}x${size}.png`)
    await writePng(buffer, outPath)
    if (size <= 64) {
      iconBuffers.push(buffer)
    }
  }

  // Standard web icons
  await sharp(masterPng)
    .resize(180, 180, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toFile(path.join(OUT_PUBLIC, 'apple-touch-icon.png'))

  await sharp(masterPng)
    .resize(192, 192, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toFile(path.join(OUT_PUBLIC, 'android-chrome-192x192.png'))

  await sharp(masterPng)
    .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toFile(path.join(OUT_PUBLIC, 'android-chrome-512x512.png'))

  await sharp(masterPng)
    .resize(150, 150, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toFile(path.join(OUT_PUBLIC, 'mstile-150x150.png'))

  // Social share graphics
  await sharp(masterPng)
    .resize(1200, 630, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toFile(path.join(OUT_PUBLIC, 'og-image.png'))

  await sharp(masterPng)
    .resize(1200, 600, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toFile(path.join(OUT_PUBLIC, 'twitter-card.png'))

  // Larger brand assets
  await sharp(masterPng)
    .resize(1024, 1024, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toFile(path.join(OUT_BRANDING, 'logo-1024.png'))

  await sharp(masterPng)
    .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toFile(path.join(OUT_BRANDING, 'logo-512.png'))

  // Favicon ICO (multi-size)
  const icoBuffer = await pngToIco(iconBuffers)
  await fs.writeFile(path.join(OUT_PUBLIC, 'favicon.ico'), icoBuffer)

  console.log('✅ Logo assets generated in /public and /public/branding')
}

main().catch((err) => {
  console.error('❌ Failed to generate logo assets:', err.message)
  process.exit(1)
})
