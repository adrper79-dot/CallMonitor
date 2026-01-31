# Simple mock renderer for CallModulations TSX component
# This script doesn't execute TSX; it simulates the component render using the initialModulations example.

def render_mock(callId, initialModulations):
    lines = []
    lines.append(f"CallModulations (callId={callId})")
    lines.append("---")
    for k, v in initialModulations.items():
        lines.append(f"- {k}: {'On' if v else 'Off'}")
    return "\n".join(lines)

if __name__ == '__main__':
    example = {
        'record': True,
        'transcribe': False,
        'translate': False,
        'survey': True,
        'synthetic_caller': False
    }
    print(render_mock('call-1234', example))
