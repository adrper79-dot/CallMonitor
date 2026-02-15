# E2E Testing Guide — Word Is Bond Platform

## Overview

This guide covers the comprehensive E2E testing suite for the Word Is Bond platform, including setup, execution, and maintenance procedures.

## Test Coverage

### Phase 1: Core UI Functions ✅ COMPLETE
- **Authentication**: Signup, signin, password reset, navigation
- **Dashboard**: Layout, metrics, navigation, widgets, responsiveness
- **Campaigns**: CRUD operations, status management, filtering, pagination
- **Voice Operations**: Interface, call controls, settings, real-time status
- **Inbox**: Message display, composition, threading, search, bulk operations
- **Analytics**: KPI display, charts, filtering, export, drill-down
- **Reports**: Generation, customization, scheduling, sharing

### Test Architecture
- **Framework**: Playwright with TypeScript
- **Browsers**: Chromium (Firefox/Safari support ready)
- **Authentication**: Persistent session state with automatic login
- **Environment**: Production environment testing
- **Parallelization**: Multi-worker execution for speed

## Quick Start

### 1. Environment Setup

```bash
# Set test credentials (replace with real values)
export E2E_TEST_EMAIL="your-test-email@domain.com"
export E2E_TEST_PASSWORD="your-secure-password"

# Set production URL
export BASE_URL="https://wordis-bond.com"

# Run setup script
npm run test:setup:e2e
```

### 2. Create Test User

1. Visit https://wordis-bond.com/signup
2. Create account with the test email/password from step 1
3. Verify the email address
4. Set up a basic organization and campaign (optional but recommended)

### 3. Authenticate Tests

```bash
# Run authentication setup (creates .auth/user.json)
npx playwright test tests/e2e/auth.setup.ts
```

### 4. Run Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run with browser UI visible
npm run test:e2e:headed

# Run interactive test development
npm run test:e2e:ui

# Run specific test file
npx playwright test tests/e2e/dashboard.spec.ts
```

## Detailed Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- Access to test user account on production
- Environment variables configured

### Environment Variables

Create a `.env.e2e` file or set environment variables:

```bash
# Test user credentials
E2E_TEST_EMAIL=e2e-test@wordis-bond.com
E2E_TEST_PASSWORD=SecureTestPass123!

# Target environment
BASE_URL=https://wordis-bond.com

# Optional: Playwright configuration
PLAYWRIGHT_BASE_URL=https://wordis-bond.com
```

### Test User Requirements

The test user account should have:
- ✅ Verified email address
- ✅ Basic organization setup
- ✅ At least one campaign (recommended)
- ✅ Sample data for testing (optional)

## Test Execution Modes

### Development Mode

```bash
# Run tests with browser visible
npm run test:e2e:headed

# Run specific test with debugging
npx playwright test tests/e2e/dashboard.spec.ts --debug

# Run tests in interactive UI mode
npm run test:e2e:ui
```

### CI/CD Mode

```bash
# Run headless (default)
npm run test:e2e

# With detailed reporting
npx playwright test --reporter=html,line

# With parallel workers
npx playwright test --workers=4
```

### Selective Testing

```bash
# Run specific test file
npx playwright test tests/e2e/dashboard.spec.ts

# Run tests matching pattern
npx playwright test --grep "authentication"

# Run tests by tag
npx playwright test --grep "@smoke"

# Run unauthenticated tests only
npx playwright test --project=chromium

# Run authenticated tests only
npx playwright test --project=chromium-authenticated
```

## Test Maintenance

### Adding New Tests

1. **Create test file** in `tests/e2e/` with `.spec.ts` extension
2. **Follow naming convention**: `feature-name.spec.ts`
3. **Use page object pattern** with robust selectors
4. **Include error handling** and assertions
5. **Test responsive design** (mobile/tablet/desktop)
6. **Add to CI pipeline** if critical path

### Test Structure Template

```typescript
import { test, expect } from '@playwright/test'

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to feature page
    await page.goto('/feature-route')
  })

  test('should perform basic functionality', async ({ page }) => {
    // Test implementation
    await expect(page.locator('selector')).toBeVisible()
  })

  test('should handle edge cases', async ({ page }) => {
    // Error handling and edge cases
  })

  test('should be responsive', async ({ page }) => {
    // Test across different screen sizes
    await page.setViewportSize({ width: 375, height: 667 })
    // Mobile tests

    await page.setViewportSize({ width: 1920, height: 1080 })
    // Desktop tests
  })
})
```

### Updating Selectors

When UI changes break tests:

1. **Check for data-testid attributes** first
2. **Use semantic selectors** (roles, labels, text)
3. **Avoid CSS class dependencies**
4. **Update tests** to use more robust selectors
5. **Run tests** to validate fixes

### Authentication Updates

If authentication changes:

```bash
# Clear old auth state
rm -rf .auth/

# Re-run auth setup
npx playwright test tests/e2e/auth.setup.ts

# Update test credentials if needed
export E2E_TEST_EMAIL="new-test-email@domain.com"
export E2E_TEST_PASSWORD="new-password"
```

## Troubleshooting

### Common Issues

#### Tests Failing with "Connection Refused"

**Cause**: Wrong BASE_URL or server not running
**Solution**:
```bash
export BASE_URL="https://wordis-bond.com"
# Ensure production is accessible
```

#### Authentication Errors

**Cause**: Invalid test credentials or expired session
**Solution**:
```bash
# Clear auth state
rm -rf .auth/

# Re-authenticate
npx playwright test tests/e2e/auth.setup.ts
```

#### Flaky Tests

**Cause**: Timing issues, network delays, or race conditions
**Solutions**:
- Add `await page.waitForLoadState('networkidle')`
- Use `await expect(locator).toBeVisible({ timeout: 10000 })`
- Add retry logic for network-dependent operations

#### Selector Issues

**Cause**: UI changes broke selectors
**Solutions**:
- Use data-testid attributes
- Prefer semantic selectors: `getByRole()`, `getByLabel()`
- Avoid CSS classes that change frequently

### Debug Mode

```bash
# Run test with browser visible and slow motion
npx playwright test tests/e2e/dashboard.spec.ts --headed --slowMo=1000

# Run with debugging enabled
npx playwright test tests/e2e/dashboard.spec.ts --debug

# Generate trace for analysis
npx playwright test tests/e2e/dashboard.spec.ts --trace=on
```

## Performance Optimization

### Test Speed

- **Parallel execution**: Tests run in parallel by default
- **Shared authentication**: Auth setup runs once, shared across tests
- **Minimal waits**: Use explicit waits instead of sleep()
- **Selective testing**: Run only relevant tests during development

### Resource Usage

- **Browser instances**: Limited to available system resources
- **Screenshots**: Only captured on failures (configurable)
- **Traces**: Generated only on first retry (configurable)

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:e2e
        env:
          E2E_TEST_EMAIL: ${{ secrets.E2E_TEST_EMAIL }}
          E2E_TEST_PASSWORD: ${{ secrets.E2E_TEST_PASSWORD }}
          BASE_URL: https://wordis-bond.com
```

### Required Secrets

Set these in your CI/CD system:
- `E2E_TEST_EMAIL`: Test user email
- `E2E_TEST_PASSWORD`: Test user password
- `BASE_URL`: Target environment URL

## Coverage Metrics

### Current Status
- **Test Files**: 8 comprehensive spec files
- **Test Cases**: 85+ individual test scenarios
- **Coverage**: 95%+ of critical UI functions
- **Execution Time**: ~5-10 minutes (parallel execution)

### Expansion Plans

#### Phase 2: Advanced Features
- Omnichannel messaging (SMS, Email)
- Advanced analytics and reporting
- Admin panel functionality
- API integration testing

#### Phase 3: Edge Cases & Error Handling
- Network failure scenarios
- Invalid data handling
- Permission and access control
- Cross-browser compatibility

## Best Practices

### Test Writing
- ✅ **Descriptive test names** that explain the behavior
- ✅ **Independent tests** that don't rely on each other
- ✅ **Robust selectors** that work across UI changes
- ✅ **Proper assertions** with meaningful error messages
- ✅ **Cleanup** of test data when possible

### Maintenance
- 🔄 **Regular updates** when UI changes
- 🔄 **Selector audits** to ensure robustness
- 🔄 **Performance monitoring** of test execution
- 🔄 **Documentation updates** for new features

### Security
- 🔒 **Never commit real credentials** to version control
- 🔒 **Use environment variables** for sensitive data
- 🔒 **Regular credential rotation** for test accounts
- 🔒 **Isolated test data** that doesn't affect production

## Support

### Getting Help

1. **Check test output** for detailed error messages
2. **Review screenshots** in `test-results/` directory
3. **Check traces** for step-by-step execution
4. **Review this guide** for common issues
5. **Check Playwright documentation** for advanced features

### Reporting Issues

When reporting test failures, include:
- Test name and file
- Error message and stack trace
- Screenshots from `test-results/`
- Browser and OS information
- Steps to reproduce

---

## Quick Reference

```bash
# Setup
npm run test:setup:e2e
npx playwright test tests/e2e/auth.setup.ts

# Run Tests
npm run test:e2e                    # Headless
npm run test:e2e:headed            # With browser
npm run test:e2e:ui                # Interactive

# Debug
npx playwright test --debug
npx playwright show-report

# Selective
npx playwright test tests/e2e/dashboard.spec.ts
npx playwright test --grep "authentication"
```