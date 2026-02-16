#!/bin/bash
echo "Starting All Simulations - $(date)" > simulation-results.log

echo "=== Running Canonical Workplace Simulator ===" >> simulation-results.log
npm run test:simulator >> simulation-results.log 2>&1
echo "Canonical Workplace Simulator completed at $(date)" >> simulation-results.log

echo "=== Running Canonical Workplace Simulator (Headed) ===" >> simulation-results.log
npm run test:simulator:headed >> simulation-results.log 2>&1
echo "Canonical Workplace Simulator (Headed) completed at $(date)" >> simulation-results.log

echo "=== Running Load Tests (Smoke) ===" >> simulation-results.log
npm run test:load:smoke >> simulation-results.log 2>&1
echo "Load Tests (Smoke) completed at $(date)" >> simulation-results.log

echo "=== Running Load Tests (Baseline) ===" >> simulation-results.log
npm run test:load:baseline >> simulation-results.log 2>&1
echo "Load Tests (Baseline) completed at $(date)" >> simulation-results.log

echo "=== Running Load Tests (Spike) ===" >> simulation-results.log
npm run test:load:spike >> simulation-results.log 2>&1
echo "Load Tests (Spike) completed at $(date)" >> simulation-results.log

echo "All simulations completed at $(date)" >> simulation-results.log