import { spawn } from 'child_process'

function runTsc() {
  return new Promise<number>((resolve) => {
    const ps = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tsc', '--noEmit'], { stdio: 'inherit' })
    ps.on('close', (code) => resolve(typeof code === 'number' ? code : 1))
  })
}

;(async () => {
  const code = await runTsc()
  if (code === 0) {
    // eslint-disable-next-line no-console
    console.log('Builds clean')
    process.exit(0)
  } else {
    // eslint-disable-next-line no-console
    console.error('Type check failed (exit code', code, ')')
    process.exit(code ?? 1)
  }
})()
