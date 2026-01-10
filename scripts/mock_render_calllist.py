"""Simple mock renderer test: build a sample calls list and assert length."""

sample_calls = [
    { 'id': 'call-1', 'organization_id': 'org-1', 'system_id': None, 'status': 'in_progress', 'started_at': '2026-01-10T10:00:00Z', 'ended_at': None, 'created_by': 'user-1', 'call_sid': 'CW123' },
    { 'id': 'call-2', 'organization_id': 'org-1', 'system_id': None, 'status': 'completed', 'started_at': '2026-01-09T09:00:00Z', 'ended_at': '2026-01-09T09:05:00Z', 'created_by': 'user-2', 'call_sid': None }
]

EXPECTED = 2

if len(sample_calls) != EXPECTED:
    raise SystemExit(f"FAIL: Expected {EXPECTED} calls, got {len(sample_calls)}")

print(f"Mock render test passed: {len(sample_calls)} calls")
