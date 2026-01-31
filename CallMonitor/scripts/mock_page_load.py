from pathlib import Path
p = Path(__file__).parent.parent / 'app' / 'voice' / 'page.tsx'
if not p.exists():
    print('page.tsx not found', p)
    raise SystemExit(2)

s = p.read_text(encoding='utf-8')

# Assert that the page loads calls from supabase and renders CallList
if ".from('calls')" in s and 'CallList' in s and 'ActivityFeedEmbed' in s:
    print('Mock page load OK: fetch pattern & components present')
    raise SystemExit(0)
else:
    print('Mock page load FAILED: expected patterns not found')
    if ".from('calls')" not in s: print('- missing supabase calls select')
    if 'CallList' not in s: print('- missing CallList import/use')
    if 'ActivityFeedEmbed' not in s: print('- missing ActivityFeedEmbed import/use')
    raise SystemExit(1)
