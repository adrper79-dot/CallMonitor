import re
from pathlib import Path

SCHEMA_FILE = Path("ARCH_DOCS/Schema.txt")

sql = SCHEMA_FILE.read_text(encoding='utf-8')

pattern = re.compile(r"CREATE TABLE public\.([^(\s]+) \((.*?)\);", re.S)

tables = {}
for m in pattern.finditer(sql):
    name = m.group(1)
    body = m.group(2)
    lines = [l.strip() for l in body.splitlines()]
    cols = []
    pks = []
    fks = []
    for ln in lines:
        if ln.upper().startswith('CONSTRAINT'):
            # primary key
            pkm = re.search(r"PRIMARY KEY \(([^)]+)\)", ln)
            if pkm:
                pks = [c.strip() for c in pkm.group(1).split(',')]
            fkm = re.search(r"FOREIGN KEY \(([^)]+)\) REFERENCES public\.([^(\s]+)\(([^)]+)\)", ln)
            if fkm:
                fk_cols = [c.strip() for c in fkm.group(1).split(',')]
                ref_table = fkm.group(2)
                ref_cols = [c.strip() for c in fkm.group(3).split(',')]
                for a,b in zip(fk_cols, ref_cols):
                    fks.append({'col': a, 'ref_table': ref_table, 'ref_col': b})
            continue
        # column lines: name type ...
        colm = re.match(r"([a-zA-Z0-9_]+)\s+([^,]+),?", ln)
        if colm:
            col = colm.group(1)
            rest = colm.group(2).strip()
            cols.append((col, rest))
    tables[name] = {'cols': cols, 'pks': pks, 'fks': fks}

def sqltype_to_ts(sqltype: str) -> str:
    t = sqltype.lower()
    if t.startswith('uuid'):
        return 'string'
    if t.startswith('text') or t.startswith('character'):
        return 'string'
    if 'timestamp' in t:
        return 'string'
    if t.startswith('jsonb'):
        return 'any'
    if t.startswith('integer') or t.startswith('int'):
        return 'number'
    if t.startswith('bigint'):
        return 'number'
    if t.startswith('boolean'):
        return 'boolean'
    if t.startswith('numeric'):
        return 'number'
    if t.startswith('array') or 'array' in t or t.endswith('[]'):
        return 'any[]'
    if 'default' in t or 'check' in t or 'constraint' in t:
        # fallback for complex
        return 'any'
    return 'any'

req_tables = ['calls','recordings','scored_recordings','evidence_manifests','ai_runs','organizations','users','audit_logs']

out_md = []
out_ts = []

for tbl in req_tables:
    if tbl not in tables:
        raise SystemExit(f"Table {tbl} not found in schema")
    info = tables[tbl]
    out_md.append(f"### {tbl}\n")
    out_md.append("| Column | SQL Type | PK | FK |")
    out_md.append("|---|---:|:--:|:--:")
    for col, sqltype in info['cols']:
        ispk = 'YES' if col in info['pks'] else ''
        fk_info = ''
        for fk in info['fks']:
            if fk['col'] == col:
                fk_info = f"{fk['ref_table']}({fk['ref_col']})"
        out_md.append(f"| {col} | {sqltype} | {ispk} | {fk_info} |")
    out_md.append('\n')

    # typescript interface
    out_ts.append(f"export interface {tbl[0].upper() + tbl[1:]} {{")
    for col, sqltype in info['cols']:
        ts_type = sqltype_to_ts(sqltype)
        optional = ''
        # If NOT NULL not present, mark optional
        if 'not null' not in sqltype.lower():
            optional = ' | null'
        out_ts.append(f"  {col}: {ts_type}{optional};")
    out_ts.append('}\n')

# print markdown
print('# Schema Extract — Selected public tables\n')
print('\n'.join(out_md))
print('\n# TypeScript Interfaces\n')
print('\n'.join(out_ts))

# self-check: counts
print('\n# Column counts')
for tbl in req_tables:
    print(f"{tbl}: {len(tables[tbl]['cols'])}")
