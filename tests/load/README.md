# Load Testing Scripts (k6)

Comprehensive load testing scripts using [k6](https://k6.io/) for the Voice Operations platform.

## Prerequisites

1. Install k6:
   ```bash
   # macOS
   brew install k6

   # Windows (Chocolatey)
   choco install k6

   # Linux
   sudo gpg -k
   sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
   echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
   sudo apt-get update
   sudo apt-get install k6
   ```

2. Set up environment variables in `.env.load`:
   ```bash
   API_URL=https://wordisbond-api.adrper79.workers.dev
   SESSION_TOKEN=your-session-token-here
   FROM_NUMBER=+17062677235
   TEST_EMAIL=test@example.com
   TEST_PASSWORD=your-password-here
   ```

## Test Scripts

### 1. Voice Calls (`voice-calls.js`)

Tests voice call initiation and management under load.

**Usage:**
```bash
# Light load (10 concurrent users, 30 seconds)
k6 run --vus 10 --duration 30s voice-calls.js

# Medium load (50 users, 2 minutes)
k6 run --vus 50 --duration 2m voice-calls.js

# Heavy load (100 users, 5 minutes)
k6 run --vus 100 --duration 5m voice-calls.js
```

**What it tests:**
- Direct call initiation
- Bridge call initiation
- Call list retrieval
- Response times and error rates

**Thresholds:**
- 95% of requests < 2s
- Error rate < 1%
- Request rate > 10 RPS

### 2. Authentication (`authentication.js`)

Tests authentication and session management under load.

**Usage:**
```bash
# Light load
k6 run --vus 20 --duration 1m authentication.js

# Heavy load
k6 run --vus 100 --duration 5m authentication.js

# With environment variables
k6 run --env API_URL=$API_URL --env TEST_EMAIL=$TEST_EMAIL --env TEST_PASSWORD=$TEST_PASSWORD authentication.js
```

**What it tests:**
- Login requests
- Session validation
- Session reuse across requests
- Concurrent authentication

**Thresholds:**
- 95% of auth requests < 1s
- Error rate < 0.5%
- 95% valid sessions

### 3. Collections CRM (`collections.js`)

Tests collections management endpoints under load.

**Usage:**
```bash
# Light load
k6 run --vus 20 --duration 2m collections.js

# Heavy load
k6 run --vus 50 --duration 5m collections.js
```

**What it tests:**
- Account creation
- Account listing/search
- Payment recording
- Task management

**Thresholds:**
- 95% of requests < 1s
- Error rate < 1%

## Load Test Profiles

### Smoke Test (Quick validation)
```bash
k6 run --vus 1 --duration 10s <script>.js
```

### Load Test (Expected traffic)
```bash
k6 run --vus 20 --duration 5m <script>.js
```

### Stress Test (Peak traffic)
```bash
k6 run --vus 100 --duration 10m <script>.js
```

### Spike Test (Sudden traffic surge)
```bash
k6 run --stage 0s:0,10s:100,20s:100,30s:0 <script>.js
```

### Soak Test (Sustained load)
```bash
k6 run --vus 50 --duration 30m <script>.js
```

## Understanding Results

### Key Metrics

- **http_req_duration**: Time taken for HTTP requests
  - p(95): 95th percentile (95% of requests faster than this)
  - p(99): 99th percentile
  - avg: Average response time
  - max: Maximum response time

- **http_req_failed**: Percentage of failed requests
  - Should be < 1% for production systems

- **http_reqs**: Total number of requests
  - Rate shown as requests per second (RPS)

- **vus**: Virtual users (concurrent users)
  - Max: Peak concurrent users during test

### Example Output

```
http_req_duration..........: avg=234ms  min=89ms  med=198ms  max=1.2s  p(95)=456ms  p(99)=789ms
http_req_failed............: 0.12%  ✓ 3      ✗ 2497
http_reqs..................: 2500   41.66/s
vus........................: 50     min=0    max=50
```

### Interpreting Results

**Good Performance:**
- p(95) < 500ms
- p(99) < 1s
- http_req_failed < 1%
- Stable memory usage

**Warning Signs:**
- p(95) > 1s
- p(99) > 2s
- http_req_failed > 1%
- Increasing response times over time (memory leak)

**Critical Issues:**
- p(95) > 2s
- http_req_failed > 5%
- Errors increasing over time
- System becomes unresponsive

## Advanced Usage

### Custom Thresholds

```bash
k6 run --threshold http_req_duration=p(95)<1000,http_req_failed=rate<0.01 script.js
```

### Cloud Execution

```bash
# Run test in k6 Cloud
k6 cloud script.js

# Stream results to k6 Cloud while running locally
k6 run --out cloud script.js
```

### Output to File

```bash
# JSON output
k6 run --out json=results.json script.js

# CSV output
k6 run --out csv=results.csv script.js
```

### Parameterized Tests

```bash
k6 run --env SCENARIO=heavy --env DURATION=10m script.js
```

## Integration with CI/CD

### GitHub Actions Example

```yaml
- name: Run Load Tests
  run: |
    k6 run --vus 20 --duration 2m \
      --env API_URL=${{ secrets.API_URL }} \
      --env SESSION_TOKEN=${{ secrets.SESSION_TOKEN }} \
      --out json=results.json \
      tests/load/voice-calls.js
```

### Performance Gates

Add to your CI pipeline to fail on performance regressions:

```bash
k6 run --threshold http_req_duration=p(95)<500 voice-calls.js
```

Exit code 99 indicates threshold violation.

## Best Practices

1. **Start Small**: Begin with smoke tests before running large load tests
2. **Monitor Systems**: Watch database connections, memory usage, API rate limits
3. **Clean Up**: Remove test data after load tests
4. **Use Production-like Data**: Test with realistic payloads
5. **Test Off-Peak**: Run heavy load tests during low-traffic periods
6. **Document Baselines**: Record performance baselines for comparison
7. **Isolate Tests**: Run one load test at a time for accurate results

## Troubleshooting

### High Error Rates

- Check API rate limits
- Verify authentication tokens are valid
- Check database connection pool size
- Review server logs for errors

### Slow Response Times

- Check database query performance
- Review API endpoint implementation
- Check external service dependencies (Telnyx, AssemblyAI)
- Monitor network latency

### Test Failures

- Verify environment variables are set correctly
- Check API_URL is accessible
- Ensure SESSION_TOKEN is valid and not expired
- Review test thresholds (may be too strict)

## Cleanup

After running load tests, clean up test data:

```sql
-- Clean up test calls
UPDATE calls
SET is_deleted = true, deleted_at = NOW()
WHERE call_sid LIKE 'test-%'
AND created_at > NOW() - INTERVAL '1 hour';

-- Clean up test collection accounts
DELETE FROM collection_accounts
WHERE account_number LIKE 'LOAD-%'
AND created_at > NOW() - INTERVAL '1 hour';

-- Clean up test sessions
DELETE FROM sessions
WHERE session_token LIKE 'test-session-%';
```

## Resources

- [k6 Documentation](https://k6.io/docs/)
- [k6 Examples](https://k6.io/docs/examples/)
- [Performance Testing Best Practices](https://k6.io/docs/testing-guides/performance-testing-best-practices/)
- [k6 Cloud](https://k6.io/cloud/)
