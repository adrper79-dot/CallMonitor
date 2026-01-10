import re
import sys

TSX_PATH = r"c:/Users/Ultimate Warrior/My project/gemini-project/app/voice/page.tsx"
required = ['export interface Call', 'export interface Recording', 'export interface EvidenceManifest', 'getServerSession', 'supabaseAdmin']

with open(TSX_PATH, 'r', encoding='utf-8') as f:
    src = f.read()

errors = []
for r in required:
    if r not in src:
        errors.append(f"Missing required token: {r}")

# quick parse: ensure no obvious 'use client' at top
if src.lstrip().startswith('"use client"'):
    errors.append('file is still a client component (starts with "use client")')

if errors:
    print('Mock tsc result: FAIL')
    for e in errors:
        print('-', e)
    sys.exit(1)

print('Mock tsc result: OK')
sys.exit(0)
