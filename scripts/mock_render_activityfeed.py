import json
from datetime import datetime

# Mock events
events = [
    { 'id': 'e1', 'call_id': 'call_1', 'timestamp': '2026-01-09T00:00:00Z', 'type': 'call.started', 'title': 'Call started', 'status': 'info' },
    { 'id': 'e2', 'call_id': 'call_1', 'timestamp': '2026-01-09T00:00:10Z', 'type': 'recording.saved', 'title': 'Recording saved', 'status': 'success' },
    { 'id': 'e3', 'call_id': 'call_2', 'timestamp': '2026-01-09T00:01:00Z', 'type': 'transcription.completed', 'title': 'Transcription ready', 'status': 'success' },
    { 'id': 'e4', 'call_id': 'call_1', 'timestamp': '2026-01-09T00:02:00Z', 'type': 'ai.run', 'title': 'AI run started', 'status': 'info' },
]

import sys
call_id = sys.argv[1] if len(sys.argv) > 1 else None
limit = int(sys.argv[2]) if len(sys.argv) > 2 else 10

filtered = [e for e in events if (call_id is None or e.get('call_id') == call_id)]
listed = filtered[:limit]

print('Mock render ActivityFeedEmbed')
print('call_id filter =', call_id)
print('events shown =', len(listed))
for e in listed:
    ts = datetime.fromisoformat(e['timestamp'].replace('Z','+00:00')).isoformat()
    icon = '❌' if 'error' in e['type'] else ('⏺️' if 'record' in e['type'] else ('📝' if 'transcript' in e['type'] or 'transcription' in e['type'] else ('📞' if 'call.started' in e['type'] else 'ℹ️')))
    print('-', ts, icon, e['title'], f"({e.get('status')})")

if call_id and any(e['call_id'] != call_id for e in listed):
    print('ERROR: non-matching call_id in output')
    sys.exit(1)

if len(listed) == 0:
    print('Note: no events for this call')
    sys.exit(0)

print('OK')
