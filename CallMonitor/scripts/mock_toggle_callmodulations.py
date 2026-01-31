# Mock test for CallModulations toggle behavior

def toggle(mods, key):
    prev = mods.copy()
    mods[key] = not mods.get(key, False)
    return prev, mods

if __name__ == '__main__':
    initial = {'record': False, 'transcribe': False, 'translate': False, 'survey': False, 'synthetic_caller': False}
    prev, nxt = toggle(initial.copy(), 'record')
    assert prev['record'] == False
    assert nxt['record'] == True
    print('Mock toggle test passed')
