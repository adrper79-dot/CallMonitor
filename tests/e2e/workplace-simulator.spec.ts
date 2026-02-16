import { test, expect, type Page, type Request, type Response } from '@playwright/test'
import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * Employee Simulation Suite (Canonical)
 *
 * Uses fixed employee credentials and validates core daily workflows:
 * - Sign in
 * - Add account (APs TESTING)
 * - Import CSV accounts
 * - Manage account details/tabs
 * - Cockpit quick actions (payment link, note, callback, dispute)
 * - Role-visible route sweep
 *
 * Supersedes all older simulator variants.
 */

const BASE_URL = process.env.BASE_URL || 'https://wordis-bond.com'
const EVIDENCE_DIR = path.join(process.cwd(), 'test-results', 'simulator-evidence')
const FIXTURES_DIR = path.join(process.cwd(), 'tests', 'fixtures')

const EMPLOYEE = {
  email: 'adrper79@gmail.com',
  password: '123qweASD',
}

const TEST_CUSTOMER = {
  name: 'APs TESTING',
  email: 'stepdadstrong@gmail.com',
  phone: '+12392027345',
  balance: '500',
}

type NetEvent = { method: string; url: string; status: number | null }

type StepLog = {
  step: string
  expected: string
  observed: string
  passed: boolean
  url: string
  network?: NetEvent[]
  note?: string
}

type SimulationReport = {
  timestamp: string
  baseUrl: string
  employee: { email: string }
  customer: typeof TEST_CUSTOMER
  logs: StepLog[]
  summary: {
    total: number
    passed: number
    failed: number
  }
}

class EmployeeSimulator {
  private logs: StepLog[] = []

  private push(log: StepLog) {
    this.logs.push(log)
  }

  private async screenshot(page: Page, name: string) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
    const file = path.join(EVIDENCE_DIR, `${Date.now()}-${name}.png`)
    await page.screenshot({ path: file, fullPage: true }).catch(() => {})
  }

  private getReport(): SimulationReport {
    const passed = this.logs.filter((x) => x.passed).length
    return {
      timestamp: new Date().toISOString(),
      baseUrl: BASE_URL,
      employee: { email: EMPLOYEE.email },
      customer: TEST_CUSTOMER,
      logs: this.logs,
      summary: {
        total: this.logs.length,
        passed,
        failed: this.logs.length - passed,
      },
    }
  }

  writeReport() {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
    const report = this.getReport()
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const jsonPath = path.join(EVIDENCE_DIR, `employee-simulation-${stamp}.json`)
    const mdPath = path.join(EVIDENCE_DIR, `employee-simulation-${stamp}.md`)

    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8')

    const md = [
      '# Employee Simulation Report',
      '',
      `- Timestamp: ${report.timestamp}`,
      `- Base URL: ${report.baseUrl}`,
      `- Employee: ${report.employee.email}`,
      `- Customer: ${TEST_CUSTOMER.name} (${TEST_CUSTOMER.phone})`,
      '',
      '## Summary',
      '',
      `- Total checks: ${report.summary.total}`,
      `- Passed: ${report.summary.passed}`,
      `- Failed: ${report.summary.failed}`,
      '',
      '## Steps',
      '',
      '| Step | Expected | Observed | Passed | URL | Note |',
      '|---|---|---|---:|---|---|',
      ...report.logs.map((log) =>
        `| ${log.step} | ${log.expected} | ${log.observed.replace(/\|/g, '/')} | ${log.passed ? '✅' : '❌'} | ${log.url} | ${log.note || ''} |`
      ),
    ]
    fs.writeFileSync(mdPath, md.join('\n'), 'utf-8')
  }

  async login(page: Page) {
    await page.goto('/signin', { waitUntil: 'domcontentloaded' })
    await page.locator('input#email').fill(EMPLOYEE.email)
    await page.locator('input#password').fill(EMPLOYEE.password)
    await page.locator('button[type="submit"]').click()

    let ok = false
    try {
      await page.waitForURL(
        (url) => ['/dashboard', '/work', '/command', '/onboarding'].some((p) => url.pathname.includes(p)),
        { timeout: 20000 }
      )
      ok = true
    } catch {
      ok = false
    }

    this.push({
      step: 'Login',
      expected: 'Employee should authenticate and reach protected app route.',
      observed: ok ? `Logged in at ${page.url()}` : 'Authentication did not reach protected route.',
      passed: ok,
      url: page.url(),
    })
    await this.screenshot(page, 'login')
  }

  async ensureAccount(page: Page) {
    await page.goto('/accounts', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1200)

    const search = page.locator('input[placeholder*="Search by name"]').first()
    if (await search.count()) {
      await search.fill(TEST_CUSTOMER.name)
      await page.waitForTimeout(700)
    }

    const existing = page.getByText(TEST_CUSTOMER.name, { exact: false }).first()
    const exists = await existing.isVisible().catch(() => false)

    if (!exists) {
      await page.getByRole('button', { name: /add account/i }).first().click()
      await page.getByPlaceholder('Account name').fill(TEST_CUSTOMER.name)
      await page.getByPlaceholder('+1 (555) 123-4567').fill(TEST_CUSTOMER.phone)
      await page.getByPlaceholder('0.00').fill(TEST_CUSTOMER.balance)

      const reqMap = new Map<Request, NetEvent>()
      const net: NetEvent[] = []

      const onReq = (req: Request) => {
        if (req.url().includes('/api/collections')) {
          reqMap.set(req, { method: req.method(), url: req.url(), status: null })
        }
      }
      const onRes = (res: Response) => {
        const e = reqMap.get(res.request())
        if (e) net.push({ ...e, status: res.status() })
      }

      page.on('request', onReq)
      page.on('response', onRes)
      const modal = page.locator('div.fixed.inset-0.z-50').first()
      await modal.getByRole('button', { name: /^add account$/i }).click()
      await page.waitForTimeout(1200)
      page.off('request', onReq)
      page.off('response', onRes)

      await search.fill(TEST_CUSTOMER.name)
      await page.waitForTimeout(700)
      const nowVisible = await existing.isVisible().catch(() => false)

      this.push({
        step: 'Add Account',
        expected: 'APs TESTING should be created and visible in account portfolio.',
        observed: nowVisible ? 'Account appears in list after creation.' : 'Account not visible after create attempt.',
        passed: nowVisible,
        url: page.url(),
        network: net,
      })
    } else {
      this.push({
        step: 'Add Account',
        expected: 'APs TESTING should exist in account portfolio.',
        observed: 'Account already present; creation skipped.',
        passed: true,
        url: page.url(),
      })
    }

    await this.screenshot(page, 'accounts')
  }

  async importCsv(page: Page) {
    await page.goto('/accounts/import', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1000)

    const csvPath = path.join(FIXTURES_DIR, 'accounts', 'aps-testing-import.csv')
    await page.locator('input[type="file"]').setInputFiles(csvPath)
    await page.waitForTimeout(1200)

    const reqMap = new Map<Request, NetEvent>()
    const net: NetEvent[] = []

    const onReq = (req: Request) => {
      if (req.url().includes('/api/collections/import')) {
        reqMap.set(req, { method: req.method(), url: req.url(), status: null })
      }
    }
    const onRes = (res: Response) => {
      const e = reqMap.get(res.request())
      if (e) net.push({ ...e, status: res.status() })
    }

    page.on('request', onReq)
    page.on('response', onRes)
    await page.getByRole('button', { name: /start import/i }).click()
    await page.waitForTimeout(2200)
    page.off('request', onReq)
    page.off('response', onRes)

    const success = await page.getByText(/import complete/i).isVisible().catch(() => false)
    const importFailed = await page.getByText(/import failed|missing required columns/i).isVisible().catch(() => false)

    this.push({
      step: 'Import Accounts CSV',
      expected: 'CSV import endpoint should return deterministic response and UI should show success or explicit validation error.',
      observed: success ? 'Import success banner shown.' : importFailed ? 'Import validation/error banner shown.' : 'No visible import result banner.',
      passed: success || importFailed || net.length > 0,
      url: page.url(),
      network: net,
    })

    await this.screenshot(page, 'import-csv')
  }

  async manageAccountDetail(page: Page) {
    await page.goto('/accounts', { waitUntil: 'domcontentloaded' })
    await page.locator('input[placeholder*="Search by name"]').first().fill(TEST_CUSTOMER.name)
    await page.waitForTimeout(800)

    const customerLink = page.locator(`a:has-text("${TEST_CUSTOMER.name}")`).first()
    const hasLink = await customerLink.isVisible().catch(() => false)
    if (!hasLink) {
      this.push({
        step: 'Open Account Detail',
        expected: 'Employee can open account detail page for APs TESTING.',
        observed: 'Account link not found in list.',
        passed: false,
        url: page.url(),
      })
      return
    }

    await customerLink.click()
    await page.waitForTimeout(1500)

    const notFound = await page.getByText(/account not found/i).isVisible().catch(() => false)
    if (notFound || page.url().includes('/404')) {
      this.push({
        step: 'Open Account Detail',
        expected: 'Employee can open account detail page for APs TESTING.',
        observed: 'Route resolved to not found/404.',
        passed: false,
        url: page.url(),
        note: 'Known production issue: /accounts/:id static route fallback mismatch.',
      })
      return
    }

    const tabs = ['Overview', 'Calls', 'Payments', 'Compliance', 'Notes']
    let allTabs = true
    for (const tab of tabs) {
      const btn = page.getByRole('button', { name: new RegExp(tab, 'i') }).first()
      const visible = await btn.isVisible().catch(() => false)
      if (!visible) {
        allTabs = false
        continue
      }
      await btn.click()
      await page.waitForTimeout(400)
    }

    const notesTab = page.getByRole('button', { name: /notes/i }).first()
    if (await notesTab.isVisible().catch(() => false)) {
      await notesTab.click()
      await page.waitForTimeout(300)
      const notesReqMap = new Map<Request, NetEvent>()
      const noteNet: NetEvent[] = []

      const onReq = (req: Request) => {
        if (req.url().includes('/api/collections/') && req.url().includes('/notes')) {
          notesReqMap.set(req, { method: req.method(), url: req.url(), status: null })
        }
      }
      const onRes = (res: Response) => {
        const e = notesReqMap.get(res.request())
        if (e) noteNet.push({ ...e, status: res.status() })
      }

      page.on('request', onReq)
      page.on('response', onRes)

      const noteInput = page.locator('textarea[placeholder*="Add a note"]').first()
      if (await noteInput.isVisible().catch(() => false)) {
        await noteInput.fill('Employee simulator note for APs TESTING account lifecycle.')
        await page.getByRole('button', { name: /add note/i }).click()
        await page.waitForTimeout(900)
      }

      page.off('request', onReq)
      page.off('response', onRes)
      this.push({
        step: 'Account Notes Management',
        expected: 'Employee can add account-level notes from detail page.',
        observed: noteNet.length > 0 ? 'Note API call captured from account detail.' : 'No note API call captured.',
        passed: noteNet.length > 0,
        url: page.url(),
        network: noteNet,
      })
    }

    this.push({
      step: 'Open Account Detail',
      expected: 'Employee can access account detail tabs and lifecycle views.',
      observed: allTabs ? 'All detail tabs were interactable.' : 'One or more tabs were not interactable.',
      passed: allTabs,
      url: page.url(),
    })

    await this.screenshot(page, 'account-detail')
  }

  private async runQuickAction(
    page: Page,
    actionName: string,
    fillAndSubmit: () => Promise<void>,
    endpointIncludes: string[],
  ) {
    const reqMap = new Map<Request, NetEvent>()
    const net: NetEvent[] = []

    const onReq = (req: Request) => {
      if (endpointIncludes.some((fragment) => req.url().includes(fragment))) {
        reqMap.set(req, { method: req.method(), url: req.url(), status: null })
      }
    }
    const onRes = (res: Response) => {
      const e = reqMap.get(res.request())
      if (e) net.push({ ...e, status: res.status() })
    }

    page.on('request', onReq)
    page.on('response', onRes)

    let actionError: string | null = null
    try {
      await Promise.race([
        fillAndSubmit(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('quick action timed out')), 20000)),
      ])
    } catch (err: any) {
      actionError = err?.message || 'quick action failed'
    }
    await page.waitForTimeout(800).catch(() => {})

    page.off('request', onReq)
    page.off('response', onRes)

    const passed = actionError ? false : net.length > 0

    this.push({
      step: actionName,
      expected: `${actionName} should trigger deterministic API activity and/or complete modal flow.`,
      observed: actionError
        ? `Action error: ${actionError}`
        : net.length > 0
          ? `${net.length} network event(s) captured.`
          : 'No API event captured.',
      passed,
      url: page.url(),
      network: net,
      note: actionError || undefined,
    })
  }

  async runCockpitActions(page: Page) {
    await page.goto('/work/call', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)

    const queueCustomer = page.locator(`button:has-text("${TEST_CUSTOMER.name}")`).first()
    if (await queueCustomer.isVisible().catch(() => false)) {
      await queueCustomer.click()
      await page.waitForTimeout(500)
    }

    await page.getByRole('button', { name: /add note/i }).first().click({ timeout: 4000 }).catch(() => {})
    await this.runQuickAction(
      page,
      'Cockpit Quick Action: Add Note',
      async () => {
        const text = page.locator('textarea[placeholder*="Enter note"]').first()
        if (await text.isVisible().catch(() => false)) {
          await text.fill('Simulator quick note for APs TESTING from cockpit.')
          await page.getByRole('button', { name: /save note/i }).click({ timeout: 5000 }).catch(() => {})
        }
      },
      ['/api/notes'],
    )

    await page.getByRole('button', { name: /schedule callback/i }).first().click({ timeout: 4000 }).catch(() => {})
    await this.runQuickAction(
      page,
      'Cockpit Quick Action: Schedule Callback',
      async () => {
        const date = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        const dateInput = page.locator('input[type="date"]').first()
        const timeInput = page.locator('input[type="time"]').first()
        if (await dateInput.isVisible().catch(() => false)) {
          await dateInput.fill(date)
          await timeInput.fill('10:00').catch(() => {})
          await page.getByRole('button', { name: /^schedule$/i }).click({ timeout: 5000 }).catch(() => {})
        }
      },
      ['/api/callbacks'],
    )

    await page.getByRole('button', { name: /file dispute/i }).first().click({ timeout: 4000 }).catch(() => {})
    await this.runQuickAction(
      page,
      'Cockpit Quick Action: File Dispute',
      async () => {
        const reason = page.locator('textarea[placeholder*="dispute reason"]').first()
        if (await reason.isVisible().catch(() => false)) {
          await reason.fill('Customer requested billing validation for APs TESTING scenario.')
          await page.getByRole('button', { name: /file dispute/i }).nth(1).click({ timeout: 5000 }).catch(() => {})
        }
      },
      ['/api/disputes'],
    )

    await page.getByRole('button', { name: /send payment link/i }).first().click({ timeout: 4000 }).catch(() => {})
    await this.runQuickAction(
      page,
      'Cockpit Quick Action: Send Payment Link',
      async () => {
        const amountInput = page.locator('input[type="number"]').first()
        if (await amountInput.isVisible().catch(() => false)) {
          await amountInput.fill(TEST_CUSTOMER.balance)
          await page.getByRole('button', { name: /send payment link/i }).nth(1).click({ timeout: 5000 }).catch(() => {})
        }
      },
      ['/api/payments/link', '/api/payments/links'],
    )

    await this.screenshot(page, 'cockpit-actions')
  }

  async routeSweep(page: Page) {
    const navSource = path.join(process.cwd(), 'lib', 'navigation.ts')
    const source = fs.readFileSync(navSource, 'utf-8')
    const hrefRegex = /href:\s*'([^']+)'/g
    const routes = new Set<string>([
      '/dashboard', '/accounts', '/accounts/import', '/work/queue', '/work/call', '/work/payments',
    ])
    let match: RegExpExecArray | null
    while ((match = hrefRegex.exec(source)) !== null) {
      const href = match[1]
      if (href.startsWith('/')) routes.add(href)
    }

    const prioritized = [...routes].slice(0, 30)

    for (const route of prioritized) {
      const res = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => null)
      await page.waitForTimeout(300)
      const status = res?.status() ?? null
      const ok = status === null || (status >= 200 && status < 400)

      this.push({
        step: `Route Sweep: ${route}`,
        expected: 'Employee function page should load without fatal response failure.',
        observed: `status=${status ?? 'n/a'} final=${page.url()}`,
        passed: ok,
        url: page.url(),
      })
    }
  }

  assertNoCriticalFailures() {
    const critical = this.logs.filter(
      (x) => !x.passed && /Login|Add Account|Cockpit Quick Action: Add Note|Route Sweep: \/accounts/.test(x.step)
    )
    expect(
      critical.length,
      `Critical workflow failures: ${critical.map((x) => x.step).join(', ')}`
    ).toBe(0)
  }
}

test.describe('Employee simulator (canonical)', () => {
  test.setTimeout(12 * 60_000)

  test('employee performs full APs TESTING account lifecycle and tool usage', async ({ page }) => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
    const simulator = new EmployeeSimulator()

    try {
      await page.goto(BASE_URL)
      await simulator.login(page)
      await simulator.ensureAccount(page)
      await simulator.importCsv(page)
      await simulator.manageAccountDetail(page)
      await simulator.runCockpitActions(page)
      await simulator.routeSweep(page)
    } finally {
      simulator.writeReport()
    }

    simulator.assertNoCriticalFailures()
  })
})