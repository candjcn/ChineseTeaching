import asyncio
import edge_tts

chars = list("一二三十八六日月山水火土木人口大小中上下门我你他父母子去来心")

async def main():
    for ch in chars:
        tts = edge_tts.Communicate(ch, "zh-CN-XiaoxiaoNeural")
        await tts.save(f"audio/{ch}.mp3")
        print(f"Generated audio/{ch}.mp3")

asyncio.run(main())
