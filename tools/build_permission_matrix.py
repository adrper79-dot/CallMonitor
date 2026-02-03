import json
import re
from pathlib import Path

TOOL_FILE = Path('ARCH_DOCS/TOOL_TABLE_ALIGNMENT')
SCHEMA_FILE = Path('ARCH_DOCS/Schema.txt')

tool = json.loads(TOOL_FILE.read_text(encoding='utf-8'))
schema_sql = SCHEMA_FILE.read_text(encoding='utf-8')

# parse schema table columns
pattern = re.compile(r"CREATE TABLE public\.([^(\s]+) \((.*?)\);", re.S)
tables = {}
for m in pattern.finditer(schema_sql):
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

# Build updated matrix
updated = {}
for tbl, perms in tool.items():
    # ensure table exists in schema
    if tbl not in tables:
        # skip unknown tables
        continue
    schema_cols = set(tables[tbl])
    updated[tbl] = {}
    for op in ['GET','POST','PUT','DELETE']:
        cols = perms.get(op, [])
        # filter only columns present in schema
        filtered = [c for c in cols if c in schema_cols]
        updated[tbl][op] = filtered
    # allowed modules: reads -> ['ui','server_actions','api_routes'], writes -> ['server_actions']
    updated[tbl]['allowed_modules'] = {
        'GET': ['ui','server_actions','api_routes'],
        'POST': ['server_actions'],
        'PUT': ['server_actions'],
        'DELETE': ['server_actions']
    }

# Ensure calls and ai_runs present; if missing, add minimal entries from schema
for required in ['calls','ai_runs']:
    if required not in updated and required in tables:
        updated[required] = {op: [] for op in ['GET','POST','PUT','DELETE']}
        # default GET: include all schema columns
        updated[required]['GET'] = tables[required].copy()
        updated[required]['allowed_modules'] = {'GET':['ui','server_actions','api_routes'],'POST':['server_actions'],'PUT':['server_actions'],'DELETE':['server_actions']}

# validation: ensure no extra columns
errors = []
for tbl, perms in updated.items():
    for op, cols in perms.items():
        if op == 'allowed_modules':
            continue
        for c in cols:
            if c not in tables.get(tbl, []):
                errors.append(f"{tbl}.{op} includes unknown column {c}")

out = {
    'matrix': updated,
    'validation': {
        'tables_in_schema': sorted(list(tables.keys())),
        'errors': errors
    }
}

print(json.dumps(out, indent=2))
