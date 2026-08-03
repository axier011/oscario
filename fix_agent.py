lines = open('x:/main.py', encoding='utf-8').readlines()

# Find start: '# Modo local: notificar al cliente'
start = next(i for i, l in enumerate(lines) if '# Modo local: notificar al cliente' in l)

# Find end: the yield [DONE] that closes the char-by-char loop
# It's the one after 'asyncio.sleep(0.015)'
sleep_line = next(i for i, l in enumerate(lines) if 'asyncio.sleep(0.015)' in l)
end = next(i for i, l in enumerate(lines) if i > sleep_line and 'data: [DONE]' in l)

print(f"Replacing lines {start+1} to {end+1}")

replacement = (
    '\n'
    '    # LLM no disponible o falló → mensaje genérico instantáneo\n'
    "    yield f\"data: {__import__('json').dumps({'mode': 'local'})}\\n\\n\"\n"
    "    yield f\"data: {__import__('json').dumps({'token': '🤔 Sin conexión con la IA. Prueba: estado, enciende el filtro, ayuda'})}\\n\\n\"\n"
    '    yield "data: [DONE]\\n\\n"\n'
)

lines[start:end+1] = [replacement]
open('x:/main.py', 'w', encoding='utf-8').writelines(lines)
print("Done")
