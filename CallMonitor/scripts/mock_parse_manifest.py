import json
from pathlib import Path

p = Path(__file__).parent.parent / 'ARCH_DOCS' / 'evidence_manifest_sample.json'
if not p.exists():
    print('Sample manifest not found:', p)
    raise SystemExit(2)

m = json.loads(p.read_text())

# Basic shape checks
ok = True
errors = []
if not isinstance(m.get('manifest_id'), str):
    ok = False
    errors.append('manifest_id missing or not a string')

if not isinstance(m.get('created_at'), str):
    ok = False
    errors.append('created_at missing or not a string')

art = m.get('artifacts')
if not isinstance(art, list):
    ok = False
    errors.append('artifacts missing or not a list')
else:
    if len(art) == 0:
        errors.append('artifacts list is empty')
    else:
        for i,a in enumerate(art):
            if not isinstance(a.get('type'), str):
                ok = False
                errors.append(f'artifact[{i}].type missing or not string')
            if not isinstance(a.get('id'), str):
                ok = False
                errors.append(f'artifact[{i}].id missing or not string')

if not isinstance(m.get('manifest_hash'), str):
    errors.append('manifest_hash missing or not a string')

if ok:
    print('Mock parse OK: manifest looks valid')
    print('manifest_id=', m.get('manifest_id'))
    print('artifacts=', len(m.get('artifacts') or []))
else:
    print('Mock parse FAILED')
    for e in errors:
        print('-', e)
    raise SystemExit(1)
