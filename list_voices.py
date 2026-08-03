import asyncio, edge_tts, json

async def main():
    voices = await edge_tts.list_voices()
    es = [v for v in voices if v['Locale'].startswith('es-')]
    for v in sorted(es, key=lambda x: x['Locale']):
        print(f"{v['ShortName']}  |  {v['Gender']}  |  {v['Locale']}")

asyncio.run(main())
