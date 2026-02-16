import { test, expect, type Page, type Request, type Response } from '@playwright/test'
import * as fs from 'node:fs'
import * as path from 'node:path'

type ToggleSnapshot = {
  checked: boolean | null
  ariaChecked: string | null
  ariaPressed: string | null
  ariaExpanded: string | null
  value: string | null
  disabled: boolean
}

type NetworkEvent = {
  method: string
  urlPath: string
  status: number | null
}

type ToggleAuditResult = {
  route: string
  elementLabel: string
  selectorHint: string
  expectedResult: string
  initial: ToggleSnapshot
  afterFirstClick: ToggleSnapshot
  afterSecondClick: ToggleSnapshot
  firstClickNetwork: NetworkEvent[]
  secondClickNetwork: NetworkEvent[]
  deterministic: boolean
  passed: boolean
  note?: string
}

type RouteAuditResult = {
  route: string
  expectedResult: string
  loaded: boolean
  finalUrl: string
  statusCode: number | null
  note?: string
}

type EndpointElementResult = {
  route: string
  elementLabel: string
  href: string
  expectedResult: string
  firstStatus: number | null
  secondStatus: number | null
  deterministic: boolean
  passed: boolean
  note?: string
}

type AuditReport = {
  timestamp: string
  baseUrl: string
  authUsed: boolean
  routeResults: RouteAuditResult[]
  endpointElementResults: EndpointElementResult[]
  toggleResults: ToggleAuditResult[]
  summary: {
    routesChecked: number
    routesPassed: number
    endpointElementsChecked: number
    endpointElementsPassed: number
    togglesChecked: number
    togglesPassed: number
    deterministicToggles: number
  }
}

const OUTPUT_DIR = path.join(process.cwd(), 'test-results', 'ui-audit')

function ensureOutputDir() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
}

function getNavigationRoutesFromSource(): string[] {
  const sourcePath = path.join(process.cwd(), 'lib', 'navigation.ts')
  if (!fs.existsSync(sourcePath)) return []

  const source = fs.readFileSync(sourcePath, 'utf-8')
  const hrefRegex = /href:\s*'([^']+)'/g
  const found = new Set<string>()
  let match: RegExpExecArray | null

  while ((match = hrefRegex.exec(source)) !== null) {
    const href = match[1]
    if (href.startsWith('/')) {
      found.add(href)
    }
  }

  return [...found].sort()
}

function getAuditRoutes(): string[] {
  const navRoutes = getNavigationRoutesFromSource()
  const baseline = [
    '/',
    '/signin',
    '/signup',
    '/forgot-password',
    '/onboarding',
    '/dashboard',
  ]

  return [...new Set([...baseline, ...navRoutes])]
}

function normalizePath(rawUrl: string): string {
  try {
    const url = new URL(rawUrl)
    return `${url.pathname}${url.search}`
  } catch {
    return rawUrl
  }
}

async function snapshotToggle(page: Page, locatorIndex: number): Promise<ToggleSnapshot> {
  const locator = page.locator(TOGGLE_SELECTOR).nth(locatorIndex)
  return locator.evaluate((el) => {
    const inputEl = el as HTMLInputElement
    return {
      checked: typeof inputEl.checked === 'boolean' ? inputEl.checked : null,
      ariaChecked: el.getAttribute('aria-checked'),
      ariaPressed: el.getAttribute('aria-pressed'),
      ariaExpanded: el.getAttribute('aria-expanded'),
      value: (el as HTMLInputElement).value ?? null,
      disabled:
        (el as HTMLButtonElement | HTMLInputElement).disabled ||
        el.getAttribute('aria-disabled') === 'true',
    }
  })
}

function getExpectedResult(initial: ToggleSnapshot): string {
  if (initial.checked !== null || initial.ariaChecked !== null) {
    return 'Toggle state should invert on first click and return on second click.'
  }
  if (initial.ariaPressed !== null) {
    return 'aria-pressed should change after first click and revert on second click.'
  }
  if (initial.ariaExpanded !== null) {
    return 'aria-expanded should change after first click and revert on second click.'
  }
  return 'Element should produce deterministic UI or network response on repeated clicks.'
}

function didStateChange(before: ToggleSnapshot, after: ToggleSnapshot): boolean {
  return (
    before.checked !== after.checked ||
    before.ariaChecked !== after.ariaChecked ||
    before.ariaPressed !== after.ariaPressed ||
    before.ariaExpanded !== after.ariaExpanded ||
    before.value !== after.value
  )
}

function networkSignature(events: NetworkEvent[]): string {
  return events
    .map((event) => `${event.method} ${event.urlPath} ${event.status ?? 'n/a'}`)
    .sort()
    .join('|')
}

function isDeterministic(first: NetworkEvent[], second: NetworkEvent[]): boolean {
  if (first.length === 0 && second.length === 0) return true
  return networkSignature(first) === networkSignature(second)
}

const TOGGLE_SELECTOR = [
  'input[type="checkbox"]',
  'button[aria-pressed]',
  '[role="switch"]',
  '[aria-checked]'
].join(', ')

const MAX_TOGGLES_PER_ROUTE = 20
const MAX_ENDPOINT_ELEMENTS_PER_ROUTE = 20

async function auditEndpointElementsOnRoute(page: Page, route: string): Promise<EndpointElementResult[]> {
  const origin = new URL(page.url()).origin
  const links = page.locator('a[href^="/"]')
  const count = Math.min(await links.count(), MAX_ENDPOINT_ELEMENTS_PER_ROUTE)
  const results: EndpointElementResult[] = []

  for (let index = 0; index < count; index++) {
    const link = links.nth(index)
    if (!(await link.isVisible().catch(() => false))) continue

    const href = await link.getAttribute('href')
    if (!href || href === '/' || href.startsWith('/#')) continue

    const label =
      (await link.getAttribute('aria-label')) ||
      (await link.textContent())?.trim() ||
      `link-${index + 1}`

    const targetUrl = `${origin}${href}`

    const first = await page.request.get(targetUrl, {
      failOnStatusCode: false,
      maxRedirects: 10,
    })
    const second = await page.request.get(targetUrl, {
      failOnStatusCode: false,
      maxRedirects: 10,
    })

    const firstStatus = first.status()
    const secondStatus = second.status()
    const deterministic = firstStatus === secondStatus
    const passed = deterministic && firstStatus >= 200 && firstStatus < 400

    results.push({
      route,
      elementLabel: label,
      href,
      expectedResult: 'Link endpoint should return stable 2xx/3xx status on repeated requests.',
      firstStatus,
      secondStatus,
      deterministic,
      passed,
      note: passed ? undefined : 'Non-success or unstable status observed for linked endpoint.',
    })
  }

  return results
}

async function signInIfCredentialsExist(page: Page): Promise<boolean> {
  const email = process.env.UI_AUDIT_EMAIL || process.env.TEST_EMAIL || 'owner@sillysoft.test'
  const password = process.env.UI_AUDIT_PASSWORD || process.env.TEST_PASSWORD || 'spacem@n0'

  await page.goto('/signin', { waitUntil: 'domcontentloaded' })

  const emailInput = page.locator('input#email')
  const passwordInput = page.locator('input#password')
  const submitButton = page.locator('button[type="submit"]')

  if ((await emailInput.count()) === 0 || (await passwordInput.count()) === 0) {
    return false
  }

  await emailInput.fill(email)
  await passwordInput.fill(password)
  await submitButton.click()

  try {
    await page.waitForURL(
      (url) =>
        url.pathname.includes('/dashboard') ||
        url.pathname.includes('/work') ||
        url.pathname.includes('/onboarding') ||
        url.pathname.includes('/command'),
      { timeout: 12000 }
    )
    return true
  } catch {
    // Fallback: create a disposable account via signup to access authenticated routes
    const ts = Date.now()
    const signupEmail = `ui-audit-${ts}@test.wordis-bond.com`
    const signupPassword = process.env.UI_AUDIT_SIGNUP_PASSWORD || 'TestPassword123!'

    await page.goto('/signup', { waitUntil: 'domcontentloaded' })

    const nameInput = page.locator('input#name')
    const orgInput = page.locator('input#organizationName')
    const signupEmailInput = page.locator('input#email')
    const signupPasswordInput = page.locator('input#password')
    const signupSubmit = page.locator('button[type="submit"]')

    if (
      (await nameInput.count()) === 0 ||
      (await orgInput.count()) === 0 ||
      (await signupEmailInput.count()) === 0 ||
      (await signupPasswordInput.count()) === 0
    ) {
      return false
    }

    await nameInput.fill('UI Audit User')
    await orgInput.fill(`UI Audit Org ${ts}`)
    await signupEmailInput.fill(signupEmail)
    await signupPasswordInput.fill(signupPassword)
    await signupSubmit.click()

    try {
      await page.waitForURL(
        (url) =>
          url.pathname.includes('/onboarding') ||
          url.pathname.includes('/dashboard') ||
          url.pathname.includes('/work') ||
          url.pathname.includes('/command'),
        { timeout: 15000 }
      )
      return true
    } catch {
      return false
    }
  }
}

async function captureRouteStatus(page: Page, route: string): Promise<RouteAuditResult> {
  let mainResponse: Response | null = null
  const expectedResult = 'Route should load without fatal UI crash and return 2xx/3xx document response.'

  try {
    mainResponse = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(400)
    const finalUrl = page.url()
    const status = mainResponse?.status() ?? null
    const loaded = status === null || (status >= 200 && status < 400)

    return {
      route,
      expectedResult,
      loaded,
      finalUrl,
      statusCode: status,
      note: loaded ? undefined : 'Non-success status observed while loading route.',
    }
  } catch (error) {
    return {
      route,
      expectedResult,
      loaded: false,
      finalUrl: page.url(),
      statusCode: null,
      note: `Navigation error: ${(error as Error).message}`,
    }
  }
}

async function auditTogglesOnRoute(page: Page, route: string): Promise<ToggleAuditResult[]> {
  const results: ToggleAuditResult[] = []
  const toggleCount = Math.min(await page.locator(TOGGLE_SELECTOR).count(), MAX_TOGGLES_PER_ROUTE)

  for (let index = 0; index < toggleCount; index++) {
    const locator = page.locator(TOGGLE_SELECTOR).nth(index)

    const isVisible = await locator.isVisible().catch(() => false)
    if (!isVisible) continue

    const label =
      (await locator.getAttribute('aria-label')) ||
      (await locator.textContent())?.trim() ||
      `toggle-${index + 1}`

    const selectorHint = await locator.evaluate((el) => {
      const id = el.getAttribute('id')
      const role = el.getAttribute('role')
      const name = el.getAttribute('name')
      const tag = el.tagName.toLowerCase()
      if (id) return `${tag}#${id}`
      if (name) return `${tag}[name="${name}"]`
      if (role) return `${tag}[role="${role}"]`
      return tag
    })

    const initial = await snapshotToggle(page, index)

    if (initial.disabled) {
      results.push({
        route,
        elementLabel: label,
        selectorHint,
        expectedResult: getExpectedResult(initial),
        initial,
        afterFirstClick: initial,
        afterSecondClick: initial,
        firstClickNetwork: [],
        secondClickNetwork: [],
        deterministic: true,
        passed: true,
        note: 'Element disabled in current state; no action attempted.',
      })
      continue
    }

    const firstClickRequests = new Map<Request, NetworkEvent>()
    const firstClickNetwork: NetworkEvent[] = []
    const onFirstRequest = (request: Request) => {
      const url = request.url()
      if (url.includes('/api/')) {
        firstClickRequests.set(request, {
          method: request.method(),
          urlPath: normalizePath(url),
          status: null,
        })
      }
    }
    const onFirstResponse = (response: Response) => {
      const event = firstClickRequests.get(response.request())
      if (event) {
        firstClickNetwork.push({ ...event, status: response.status() })
      }
    }

    page.on('request', onFirstRequest)
    page.on('response', onFirstResponse)
    await locator.click({ timeout: 6000 }).catch(() => {})
    await page.waitForTimeout(700)
    page.off('request', onFirstRequest)
    page.off('response', onFirstResponse)

    const afterFirstClick = await snapshotToggle(page, index)

    const secondClickRequests = new Map<Request, NetworkEvent>()
    const secondClickNetwork: NetworkEvent[] = []
    const onSecondRequest = (request: Request) => {
      const url = request.url()
      if (url.includes('/api/')) {
        secondClickRequests.set(request, {
          method: request.method(),
          urlPath: normalizePath(url),
          status: null,
        })
      }
    }
    const onSecondResponse = (response: Response) => {
      const event = secondClickRequests.get(response.request())
      if (event) {
        secondClickNetwork.push({ ...event, status: response.status() })
      }
    }

    page.on('request', onSecondRequest)
    page.on('response', onSecondResponse)
    await locator.click({ timeout: 6000 }).catch(() => {})
    await page.waitForTimeout(700)
    page.off('request', onSecondRequest)
    page.off('response', onSecondResponse)

    const afterSecondClick = await snapshotToggle(page, index)

    const changedOnFirst = didStateChange(initial, afterFirstClick)
    const revertedOnSecond =
      initial.checked === afterSecondClick.checked &&
      initial.ariaChecked === afterSecondClick.ariaChecked &&
      initial.ariaPressed === afterSecondClick.ariaPressed &&
      initial.ariaExpanded === afterSecondClick.ariaExpanded

    const deterministic = isDeterministic(firstClickNetwork, secondClickNetwork)

    const passed =
      deterministic &&
      (changedOnFirst || firstClickNetwork.length > 0 || secondClickNetwork.length > 0) &&
      (revertedOnSecond || changedOnFirst || firstClickNetwork.length > 0)

    results.push({
      route,
      elementLabel: label,
      selectorHint,
      expectedResult: getExpectedResult(initial),
      initial,
      afterFirstClick,
      afterSecondClick,
      firstClickNetwork,
      secondClickNetwork,
      deterministic,
      passed,
      note: passed
        ? undefined
        : 'No deterministic state/network behavior confirmed for this element.',
    })
  }

  return results
}

test.describe('UI endpoint and toggle deterministic audit', () => {
  test('logs expected and observed results for routes and toggles', async ({ page, baseURL }) => {
    test.setTimeout(12 * 60_000)

    ensureOutputDir()

    const authUsed = await signInIfCredentialsExist(page)
    const routes = getAuditRoutes()

    const routeResults: RouteAuditResult[] = []
    const endpointElementResults: EndpointElementResult[] = []
    const toggleResults: ToggleAuditResult[] = []

    for (const route of routes) {
      const routeResult = await captureRouteStatus(page, route)
      routeResults.push(routeResult)

      if (!routeResult.loaded) {
        continue
      }

      const endpointElements = await auditEndpointElementsOnRoute(page, route)
      endpointElementResults.push(...endpointElements)

      const toggles = await auditTogglesOnRoute(page, route)
      toggleResults.push(...toggles)
    }

    const report: AuditReport = {
      timestamp: new Date().toISOString(),
      baseUrl: baseURL || process.env.BASE_URL || 'http://localhost:3000',
      authUsed,
      routeResults,
      endpointElementResults,
      toggleResults,
      summary: {
        routesChecked: routeResults.length,
        routesPassed: routeResults.filter((result) => result.loaded).length,
        endpointElementsChecked: endpointElementResults.length,
        endpointElementsPassed: endpointElementResults.filter((result) => result.passed).length,
        togglesChecked: toggleResults.length,
        togglesPassed: toggleResults.filter((result) => result.passed).length,
        deterministicToggles: toggleResults.filter((result) => result.deterministic).length,
      },
    }

    const timestampSafe = new Date().toISOString().replace(/[:.]/g, '-')
    const jsonPath = path.join(OUTPUT_DIR, `ui-endpoint-toggle-audit-${timestampSafe}.json`)
    const mdPath = path.join(OUTPUT_DIR, `ui-endpoint-toggle-audit-${timestampSafe}.md`)

    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8')

    const markdownLines = [
      '# UI Endpoint + Toggle Audit Report',
      '',
      `- Timestamp: ${report.timestamp}`,
      `- Base URL: ${report.baseUrl}`,
      `- Auth used: ${report.authUsed ? 'yes' : 'no'}`,
      '',
      '## Summary',
      '',
      `- Routes checked: ${report.summary.routesChecked}`,
      `- Routes passed: ${report.summary.routesPassed}`,
      `- Endpoint elements checked: ${report.summary.endpointElementsChecked}`,
      `- Endpoint elements passed: ${report.summary.endpointElementsPassed}`,
      `- Toggles checked: ${report.summary.togglesChecked}`,
      `- Toggles passed: ${report.summary.togglesPassed}`,
      `- Deterministic toggles: ${report.summary.deterministicToggles}`,
      '',
      '## Route Results',
      '',
      '| Route | Expected | Loaded | Status | Final URL | Note |',
      '|---|---|---:|---:|---|---|',
      ...report.routeResults.map(
        (result) =>
          `| ${result.route} | ${result.expectedResult} | ${result.loaded ? '✅' : '❌'} | ${result.statusCode ?? 'n/a'} | ${result.finalUrl} | ${result.note ?? ''} |`
      ),
      '',
      '## Endpoint Element Results',
      '',
      '| Route | Element | href | Expected | First | Second | Deterministic | Passed | Note |',
      '|---|---|---|---|---:|---:|---:|---:|---|',
      ...report.endpointElementResults.map(
        (result) =>
          `| ${result.route} | ${result.elementLabel.replace(/\|/g, '/')} | ${result.href} | ${result.expectedResult} | ${result.firstStatus ?? 'n/a'} | ${result.secondStatus ?? 'n/a'} | ${result.deterministic ? '✅' : '❌'} | ${result.passed ? '✅' : '❌'} | ${result.note ?? ''} |`
      ),
      '',
      '## Toggle Results',
      '',
      '| Route | Element | Expected | Deterministic | Passed | Note |',
      '|---|---|---|---:|---:|---|',
      ...report.toggleResults.map(
        (result) =>
          `| ${result.route} | ${result.elementLabel.replace(/\|/g, '/')} (${result.selectorHint}) | ${result.expectedResult} | ${result.deterministic ? '✅' : '❌'} | ${result.passed ? '✅' : '❌'} | ${result.note ?? ''} |`
      ),
    ]

    fs.writeFileSync(mdPath, markdownLines.join('\n'), 'utf-8')

    expect(report.summary.routesChecked).toBeGreaterThan(0)
  })
})
