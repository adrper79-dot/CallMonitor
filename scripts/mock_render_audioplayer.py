# Mock HTML render check for AudioPlayer component file
PATH = r"c:/Users/Ultimate Warrior/My project/gemini-project/components/voice/AudioPlayer.tsx"
with open(PATH, 'r', encoding='utf-8') as f:
    src = f.read()

required_tokens = ['<audio', 'Transcript', 'Captions', 'aria-pressed', 'role="region"']
missing = [t for t in required_tokens if t not in src]
if missing:
    print('Mock render check: FAIL')
    for m in missing:
        print('-', m)
    raise SystemExit(1)
print('Mock render check: OK')
