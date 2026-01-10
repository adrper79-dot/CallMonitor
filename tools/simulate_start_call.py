import uuid
import json
from datetime import datetime

def now():
    return datetime.utcnow().isoformat() + 'Z'

# Mock schema-backed tables
organizations = {
    'org-1': { 'id': 'org-1', 'name': 'ACME', 'plan': 'paid', 'tool_id': 'tool-1', 'created_by': 'user-1' }
}

org_members = [ { 'id':'m-1', 'organization_id':'org-1', 'user_id':'user-1', 'role':'admin' } ]

systems = [ { 'id':'sys-cpid', 'key':'system-cpid' }, { 'id':'sys-ai', 'key':'system-ai' } ]

calls = []
ai_runs = []
audit_logs = []

def write_audit(entry):
    audit_logs.append(entry)
    print('\n[AUDIT] wrote:', json.dumps(entry, indent=2))

def simulate_start_call(input, actor='user-1'):
    errors = []
    print('\n=== startCall invoked ===')
    print('input:', input)

    # 1) Auth check
    if not actor:
        err = ('AUTH_REQUIRED','Unauthenticated')
        errors.append(err)
        return {'success': False, 'errors': errors}

    org = organizations.get(input['organization_id'])
    if not org:
        errors.append(('CALL_START_ORG_NOT_FOUND','Organization not found'))
        return {'success': False, 'errors': errors}

    # membership check
    member = next((m for m in org_members if m['organization_id']==org['id'] and m['user_id']==actor), None)
    if not member:
        errors.append(('AUTH_ORG_MISMATCH','Actor not authorized for organization'))
        return {'success': False, 'errors': errors}

    # 2) Resolve systems
    system_map = { s['key']: s['id'] for s in systems }
    sys_cpid = system_map.get('system-cpid')
    sys_ai = system_map.get('system-ai')
    if not sys_cpid:
        errors.append(('CALL_START_SYS_MISSING','Control system not registered'))
        return {'success': False, 'errors': errors}

    # 3) Insert calls row (status pending)
    call_id = str(uuid.uuid4())
    call_row = {
        'id': call_id,
        'organization_id': org['id'],
        'system_id': sys_cpid,
        'status': 'pending',
        'started_at': None,
        'ended_at': None,
        'created_by': actor,
        'call_sid': None
    }
    calls.append(call_row)
    print('\n[DB] inserted calls row:', call_row)

    # 4) SignalWire call (simulate success)
    # In v1 we require SIGNALWIRE config; simulate present
    call_sid = 'SW_' + uuid.uuid4().hex[:10]
    # update call
    call_row['call_sid'] = call_sid
    call_row['status'] = 'in-progress'
    call_row['started_at'] = now()
    print('\n[PROVIDER] SignalWire accepted, call_sid=', call_sid)

    # 5) If transcribe requested -> insert ai_runs
    mods = input.get('modulations', {})
    if mods.get('transcribe'):
        if not sys_ai:
            errors.append(('AI_SYSTEM_MISSING','AI system not registered'))
        else:
            ai_id = str(uuid.uuid4())
            ai_row = { 'id': ai_id, 'call_id': call_id, 'system_id': sys_ai, 'model':'assemblyai-v1', 'status':'queued', 'started_at': None, 'completed_at': None, 'output': None }
            ai_runs.append(ai_row)
            print('\n[DB] inserted ai_runs:', ai_row)

    # 6) If record requested -> write audit intent (do NOT create recordings row per Schema rules)
    if mods.get('record'):
        intent = { 'id': str(uuid.uuid4()), 'organization_id': org['id'], 'user_id': actor, 'system_id': sys_cpid, 'resource_type':'calls', 'resource_id': call_id, 'action':'intent:recording_requested', 'before': None, 'after': { 'tool_id': org.get('tool_id'), 'requested_at': now() }, 'created_at': now() }
        write_audit(intent)

    # 7) Final create audit
    canonical = dict(call_row)
    audit = { 'id': str(uuid.uuid4()), 'organization_id': org['id'], 'user_id': actor, 'system_id': sys_cpid, 'resource_type':'calls', 'resource_id': call_id, 'action':'create', 'before': None, 'after': { **canonical, 'config': mods, 'call_sid': call_sid }, 'created_at': now() }
    write_audit(audit)

    return { 'success': True, 'call_id': call_id, 'errors': errors }


if __name__ == '__main__':
    example_input = {
        'organization_id': 'org-1',
        'phone_number': '+15555551234',
        'modulations': { 'record': True, 'transcribe': True }
    }
    result = simulate_start_call(example_input)
    print('\n=== Result ===')
    print(json.dumps(result, indent=2))
    print('\n=== Calls table ===')
    print(json.dumps(calls, indent=2))
    print('\n=== AI Runs ===')
    print(json.dumps(ai_runs, indent=2))
    print('\n=== Audit Logs ===')
    print(json.dumps(audit_logs, indent=2))
