import re
from pathlib import Path
import json

SCHEMA_FILE = Path('ARCH_DOCS/Schema.txt')
sql = SCHEMA_FILE.read_text(encoding='utf-8')

pattern = re.compile(r"CREATE TABLE public\.([^(\s]+) \((.*?)\);", re.S)
tables = {}
for m in pattern.finditer(sql):
    name = m.group(1)
    body = m.group(2)
    lines = [l.strip() for l in body.splitlines()]
    cols = []
    for ln in lines:
        if ln.upper().startswith('CONSTRAINT'):
            continue
        colm = re.match(r"([a-zA-Z0-9_]+)\s+([^,]+),?", ln)
        if colm:
            cols.append(colm.group(1))
    tables[name] = cols

# Define API contract references
api = {
    'startCall': {
        'reads': {
            'organizations': ['id','plan','tool_id','created_by'],
            'org_members': ['id','organization_id','user_id'],
            'systems': ['id','key']
        },
        'writes': {
            'calls': ['id','organization_id','system_id','status','started_at','ended_at','created_by','call_sid'],
            'ai_runs': ['id','call_id','system_id','model','status'],
            'audit_logs': ['id','organization_id','user_id','system_id','resource_type','resource_id','action','before','after']
        }
    },
    'getCallStatus': {
        'reads': {
            'calls': ['id','organization_id','system_id','status','started_at','ended_at','created_by','call_sid'],
            'ai_runs': ['id','call_id','system_id','model','status','started_at','completed_at','output'],
            'audit_logs': ['id','action','after','created_at'],
            'recordings': ['id','recording_sid','recording_url','duration_seconds','status','created_at','tool_id'],
            'evidence_manifests': ['id','recording_id','manifest','created_at']
        },
        'writes': {
            'audit_logs': ['id','organization_id','user_id','system_id','resource_type','resource_id','action','before','after']
        }
    },
    'triggerTranscription': {
        'reads': {
            'recordings': ['id','organization_id','recording_url','status','tool_id']
        },
        'writes': {
            'ai_runs': ['id','call_id','system_id','model','status','started_at'],
            'audit_logs': ['id','organization_id','user_id','system_id','resource_type','resource_id','action','before','after']
        }
    },
    'getCallActivity': {
        'reads': {
            'audit_logs': ['id','organization_id','user_id','system_id','resource_type','resource_id','action','before','after','created_at']
        },
        'writes': {}
    }
}

errors = []
for action, ops in api.items():
    for mode in ['reads','writes']:
        for tbl, cols in ops.get(mode, {}).items():
            if tbl not in tables:
                errors.append(f"Action {action} references missing table {tbl}")
                continue
            for c in cols:
                if c not in tables[tbl]:
                    errors.append(f"Action {action} references missing column {tbl}.{c}")

result = {'valid': len(errors)==0, 'errors': errors}
print(json.dumps(result, indent=2))
