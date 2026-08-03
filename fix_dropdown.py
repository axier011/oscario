lines = open('x:/frontend/src/components/PumpkinModal.tsx', encoding='utf-8').readlines()

# Find start/end of old dropdown block
start = next(i for i, l in enumerate(lines) if "display: 'flex', gap: 4, alignItems: 'center'" in l and 'position:' in l)
end   = next(i for i, l in enumerate(lines) if i > start and '</div>' in l and lines[i+1].strip().startswith('<button') and 'pk-close' in lines[i+1])
print(f'Replacing lines {start+1} to {end+1}')

new_block = (
    "          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>\n"
    "            <div style={{ position: 'relative' }}>\n"
    "              <button\n"
    "                ref={sliderBtnRef}\n"
    '                className="pk-close"\n'
    "                onClick={() => {\n"
    "                  if (!voiceOpen && sliderBtnRef.current) {\n"
    "                    const r = sliderBtnRef.current.getBoundingClientRect()\n"
    "                    setDropPos({ top: r.bottom + 6, right: window.innerWidth - r.right })\n"
    "                  }\n"
    "                  setVoiceOpen(o => !o)\n"
    "                }}\n"
    '                title="Cambiar voz"\n'
    "              >\n"
    '                <i className="fa-solid fa-sliders" />\n'
    "              </button>\n"
    "              {voiceOpen && dropPos && createPortal(\n"
    "                <div style={{\n"
    "                  position: 'fixed', top: dropPos.top, right: dropPos.right, zIndex: 99999,\n"
    "                  background: 'var(--bg2)', border: '1px solid var(--border)',\n"
    "                  borderRadius: 8, width: 210, boxShadow: '0 4px 20px #000c',\n"
    "                }}>\n"
    "                  <div style={{ padding: '6px 12px', fontSize: '.68rem', color: 'var(--t3)', borderBottom: '1px solid var(--border)' }}>\n"
    "                    Voz (Microsoft Neural)\n"
    "                  </div>\n"
    "                  {EDGE_VOICES.map(v => (\n"
    "                    <div\n"
    "                      key={v.name}\n"
    "                      style={{\n"
    "                        display: 'flex', alignItems: 'center', gap: 8,\n"
    "                        padding: '7px 10px', cursor: 'pointer',\n"
    "                        background: selVoice === v.name ? 'var(--bg3)' : 'transparent',\n"
    "                      }}\n"
    "                      onMouseDown={e => e.preventDefault()}\n"
    "                      onClick={() => { selVoiceRef.current = v.name; setSelVoice(v.name); setVoiceOpen(false) }}\n"
    "                    >\n"
    "                      <span style={{ flex: 1, fontSize: '.82rem' }}>\n"
    "                        {selVoice === v.name ? <strong>{v.label}</strong> : v.label}\n"
    "                        <span style={{ color: 'var(--t3)', fontSize: '.7rem', marginLeft: 6 }}>{v.desc}</span>\n"
    "                      </span>\n"
    "                      <button\n"
    "                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--teal)', padding: '2px 4px', fontSize: '.8rem', flexShrink: 0 }}\n"
    "                        onMouseDown={e => e.preventDefault()}\n"
    "                        onClick={e => { e.stopPropagation(); previewVoice(v.name) }}\n"
    '                        title="Escuchar"\n'
    "                      >\u25b6</button>\n"
    "                    </div>\n"
    "                  ))}\n"
    "                </div>,\n"
    "                document.body\n"
    "              )}\n"
    "            </div>\n"
)

lines[start:end+1] = [new_block]
open('x:/frontend/src/components/PumpkinModal.tsx', 'w', encoding='utf-8').writelines(lines)
print('Done, total lines:', len(lines))
