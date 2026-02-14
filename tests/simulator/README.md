# Workplace Person Simulator

**Word Is Bond Platform** — Comprehensive E2E test suite that simulates complete employee journeys from signup through productive use.

## Overview

The Workplace Person Simulator automates the complete user experience of a new employee joining Word Is Bond, testing every aspect of the platform while detecting UI/UX issues, broken flows, and performance problems.

## Features

### 🎯 Complete Journey Simulation
- **5-Step Onboarding**: signup → configure → first-data → test-call → tour → complete
- **Feature Testing**: Calls, transcription, translation, analytics, campaigns, reports
- **Realistic Data**: Generated test users, accounts, and call scenarios

### 🔍 Kink Detection
- **UI Issues**: Missing elements, broken layouts, accessibility problems
- **UX Issues**: Confusing flows, poor error messages, navigation problems
- **Performance**: Slow loading, timeouts, unresponsive interactions
- **Validation**: Missing checks, incorrect error handling, data integrity issues
- **Broken Flows**: Dead ends, infinite loops, unexpected redirects

### 📊 Comprehensive Reporting
- **Screenshots**: Step-by-step visual evidence
- **Timings**: Performance metrics and bottlenecks
- **Evidence Chain**: Complete audit trail of actions and results
- **Kink Analysis**: Categorized issues with severity and recommendations

## Architecture

```
tests/simulator/
├── workplace-simulator.spec.ts    # Main test suite
├── config.ts                      # Configuration & constants
├── helpers/                       # Utility functions
│   ├── data-generator.ts          # Test data creation
│   ├── evidence-collector.ts      # Screenshot & timing capture
│   ├── feature-testers.ts         # Individual feature tests
│   └── kink-detector.ts           # Issue detection logic
├── reports/                       # Generated reports
└── README.md                      # This file
```

## Usage

### Running Tests

```bash
# Run complete simulation
npm run test:simulator

# Run with browser UI (for debugging)
npm run test:simulator:headed

# Run multiple iterations
npm run test:simulator -- --iterations=5

# Run specific kink detection tests
npm run test:simulator:kinks
```

### CLI Execution

```bash
# Standalone execution
npx ts-node tests/simulator/workplace-simulator.spec.ts

# With options
npx ts-node tests/simulator/workplace-simulator.spec.ts --headed --iterations=3
```

## Configuration

Edit `tests/simulator/config.ts` to customize:

- **Feature Flags**: Enable/disable specific features to test
- **Thresholds**: Adjust kink detection sensitivity
- **Timeouts**: Modify wait times for async operations
- **Reporting**: Configure output formats and retention

## Test Data

The simulator generates realistic test data using Faker.js:

- **Users**: Email, password, company info, phone numbers
- **Accounts**: Customer data for collections/sales scenarios
- **Calls**: Target numbers, purposes, expected durations
- **Content**: Realistic conversation scenarios

## Evidence Collection

Every action captures:

- **Screenshots**: Full-page captures at key moments
- **Timings**: Start/end times for performance analysis
- **Metadata**: Element states, form data, API responses
- **Errors**: Exception details and stack traces

## Kink Detection Categories

### Critical (🚨)
- Application crashes
- Data loss
- Security vulnerabilities
- Complete flow failures

### High (⚠️)
- Broken user journeys
- Missing critical features
- Performance >15s
- Data validation failures

### Medium (🟡)
- UI inconsistencies
- Slow performance (5-15s)
- Poor error messages
- Missing non-critical features

### Low (ℹ️)
- Minor UI polish issues
- Performance optimizations
- Accessibility improvements

## Report Structure

```json
{
  "test_id": "simulator-1703123456789",
  "user": {
    "email": "john.doe@example.com",
    "company_name": "Acme Collections"
  },
  "journey_start": "2026-02-13T10:00:00.000Z",
  "journey_end": "2026-02-13T10:05:30.000Z",
  "total_duration_ms": 330000,
  "steps_completed": ["signup", "configure", "first-data", "test-call", "tour"],
  "evidence": [...],
  "kinks_detected": [...],
  "features_tested": [...],
  "success": true
}
```

## Integration with CI/CD

Add to your pipeline:

```yaml
- name: Run Workplace Simulator
  run: npm run test:simulator
  continue-on-error: true

- name: Upload Simulator Reports
  uses: actions/upload-artifact@v3
  with:
    name: simulator-reports
    path: test-results/simulator-reports/
```

## Extending the Simulator

### Adding New Features

1. Add feature flag to `config.ts`
2. Create test method in `FeatureTester` class
3. Add to `stepCompleteAndTestFeatures()` in main simulator
4. Update evidence collection for new actions

### Custom Kink Detection

1. Add detection logic to `EvidenceCollector.detectKinks()`
2. Define severity levels and categories
3. Include actionable recommendations

### New Test Scenarios

1. Extend `TestDataGenerator` with new data types
2. Add scenario methods to simulator class
3. Update journey flow as needed

## Troubleshooting

### Common Issues

**Timeouts**: Increase `ASYNC_TIMEOUT` in config for slow environments

**Missing Elements**: Check `data-testid` attributes match selectors in `config.ts`

**Screenshot Failures**: Ensure write permissions to `test-results/` directory

**Memory Issues**: Reduce `iterations` or run tests individually

### Debug Mode

```bash
# Run with debug logging
DEBUG=simulator:* npm run test:simulator

# Keep browser open for inspection
npm run test:simulator:headed -- --debug
```

## Standards Compliance

- **ARCH_DOCS**: Follows snake_case conventions, TypeScript standards
- **Playwright**: Uses latest best practices for E2E testing
- **Evidence**: Immutable audit trails with provenance
- **Security**: No sensitive data in test artifacts

## Contributing

1. Follow existing code patterns
2. Add comprehensive evidence capture
3. Include kink detection for new features
4. Update documentation
5. Test across different environments