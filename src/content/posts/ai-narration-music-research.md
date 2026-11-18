---
pubDatetime: 2026-10-22T18:14:00-07:00
title: "I Researched AI Narration and Music Twice. The Second Pass Changed Two of My Conclusions."
description: "Two rounds of research into narration that sounds human and music you can legally use: API prices, local CPU models and the licence traps in between. The second round overturned two of my own conclusions."
tags: ["AI", "TTS", "Open Source", "Video"]
lang: en
ogImage: ./comic-tts-cover-wm.png
translationKey: ai-narration-music-research
---

I make videos with code and AI tools. Product promos, a music video or two, and lately a series about the history of Xianyang, the old Qin capital. Two thousand three hundred years of history in a three-minute film.

Every one of those projects ran into the same wall. The visuals I could handle. The voice kept sounding like a navigation app reading me the news.

So I went looking for narration that sounds like a person, and background music I could actually use without a lawyer. Twice, it turns out. I did a full pass over the whole market, prices, licences, local models, the works. Then I ran the research again for one specific project, my own machine, a Ryzen 7 3800X with 32GB of RAM and no GPU worth mentioning.

Most of the first pass held up. Two conclusions flipped completely. This is the whole thing in one place, including the parts where I was wrong.

## Start with the boring part, because the boring part is money

A three-minute Chinese narration is roughly 500 billable characters. The English version of the same script runs about 2,500 characters, English just takes more room to say the same thing. Hold those two numbers in your head and the pricing tables get a lot less scary.

MiniMax Speech is still my first call for Chinese. HD runs $100 per million characters, Turbo $60. It reads Chinese like it grew up speaking it, which, as models go, it basically did. Pauses and pronunciation are controllable, and it hands you word-level timing, which your subtitles will thank you for.

ElevenLabs is still the English and multilingual pick. Somewhere in the $50 to $100 per million characters range depending on the model. One cloned voice can carry across languages, which matters when your Chinese episode and your English episode are supposed to sound like the same narrator. Its Chinese is good. It just isn't home turf the way MiniMax is.

The cheap seats are better than you'd expect. Azure Speech is $16 per million with half a million free characters a month, and its word timestamps are the best I found for syncing subtitles. Google's Standard voices are $4 per million with a 4 million character monthly free tier (the fancier WaveNet voices get 1 million free, a detail I got wrong in my own notes the first time around). Alibaba's Qwen TTS Plus sits around $20 per million and topped independent rankings this year, with the catch that it lives in the Beijing and Singapore regions. Doubao, ByteDance's speech service, finally gave me a number on the second pass: ¥3 per 10,000 characters, dirt cheap if you're set up on the domestic platform. Google's Gemini TTS undercuts almost everyone on a per-minute basis too, though its sticker price is set to roughly double after 2026, so enjoy it while it lasts.

And Fish Audio taught me to read billing units before prices. $15 per million sounds like a steal until you notice it bills per UTF-8 byte. A Chinese character is three bytes. Your steal just tripled to roughly $45 per million characters.

Now the per-episode math, because this is where I laughed at myself a little. Chinese narration, English narration, one piece of music, all through paid APIs: about $0.38 an episode. Generate the narration three times because you didn't like take two, generate five music candidates and pick one: about $1.30. Twenty episodes, both languages: roughly $26 in generation fees.

Twenty-six bucks. I had spent days comparing prices that, at my volume, round to nothing. If you're a solo creator, API cost is a rounding error. Pick on pronunciation and control, not on the rate card.

**Narration API pricing compared** (USD per 1M billable characters, checked October 2026)

| Service | Price | Free tier | Notes |
|---|---|---|---|
| MiniMax Speech | HD $100 / Turbo $60 | Platform trial credits | Chinese first pick; word-level timestamps and cloning |
| Alibaba Qwen TTS Plus | ~$20 | — | Best value; Beijing/Singapore regions only |
| ElevenLabs | $50–100 | Free plan not for commercial use | Strongest English/multilingual; one voice across languages |
| Azure Speech | $16 | 500K characters/month | Best word timestamps; steadiest subtitle sync |
| Google Cloud TTS | $4 | Standard 4M chars/month; WaveNet 1M/month | Cheapest legitimate route |
| Doubao (Volcengine) | ¥3 per 10K characters | Platform trial | Low domestic pricing; easy pinyin pronunciation fixes |
| Fish Audio | Listed $15 | Small trial | ⚠️ Bills per UTF-8 byte; Chinese effectively ~$45 |
| Gemini TTS | Per minute, very low | — | Cheap backup; price roughly doubles from 2027 |

## The licence trap is where the real cost hides

This part didn't change between passes, and I'd put money on it still being true next year.

A bunch of the best-sounding open models cannot legally score a monetized video. F5-TTS, ChatTTS and XTTS-v2 all carry non-commercial weights. Fish's local models sit behind their own community and research licences. IndexTTS has a genuine contradiction floating around it: marketing pages say Apache 2.0 and free for commercial use, the model licence asks for written authorization. I am not a lawyer, and that's exactly the point. If I can't read the licence and understand it in one sitting, it doesn't go in the pipeline.

MusicGen is the one that stings. Meta's code is MIT and the model is lovely for instrumental work, but the weights are CC-BY-NC. Non-commercial. Full stop.

The second pass added new fine print instead of removing any. Stable Audio 3's local weights come under a Community License with a revenue ceiling (under $1M a year, with registration), and its CPU-optimized weights are still marked experimental. ElevenLabs Music, on the self-serve plans, restricts film and TV use. Suno still has no official public API, every "Suno API" out there is a third-party wrapper, and its download caps changed again this fall. Udio I wouldn't touch for production at all right now: downloads are disabled and posting the output to YouTube is off the table under its current terms.

Read the model card before you trust the README headline. The code licence and the weights licence are two different documents, and the weights are the ones that govern your video.

## What my own machine taught me

First pass, I tested local models on a small cloud VM. Two throttled cores, memory that ballooned up and down depending on what the host felt like doing. Pessimistic numbers, but honest ones, and I labelled them that way.

Kokoro, the tiny 82M model, read my Chinese test sentence with an RTF of 1.73 on that sad little VM. Slower than real time, but it finished, peaked at about 1.3GB of RAM, no dropped characters. Its Chinese voice bench is thin though. Eight Mandarin voices, four female and four male, against dozens in English. Piper was ten times faster (RTF 0.176, 240MB of RAM, finished before I could alt-tab) and sounded like a very competent robot from 2015. One usable Chinese voice. Flat as a pancake.

Then MusicGen-small humbled me. 407 seconds to generate 15 seconds of piano and strings. RTF 27.3, twenty-seven times slower than the audio it produced. My written verdict at the time: local music generation on CPU is impractical, use an API or a licensed library. All five big open-source video projects I checked agreed with me, by the way. MoneyPrinterTurbo, NarratoAI, Pixelle-Video, all of them default to Edge TTS for voice and plain library files for music. Generative music only showed up in those projects this year, as an optional extra.

That verdict lasted until the second pass.

## Flip number one: local music works now

Stable Audio 3 Medium, running on plain CPU, generated a complete 180-second piece of music in about 160 seconds. Two and a half gigs of RAM. The small model did 30 seconds in under 9 seconds.

Different machine (a 4-thread EPYC box, not my wheezing 2-core VM), newer model, and a diffusion architecture doing in one pass what MusicGen's autoregressive approach crawls through token by token. So the honest correction is this: "local CPU music is impractical" was a MusicGen-shaped conclusion that I stretched over the whole category. Don't do what I did. The category moved.

Caveats, because there are always caveats. The CPU weights are experimental, so pin your version and keep the installer. The Community License ceiling I mentioned applies. And nobody has blind-tested this music against a good library track with real ears yet, at least not in my research. Generated candidates are cheap now. Picking the right one is still a human job, and for quick one-off shorts, a licensed library track (Epidemic Sound, Artlist, even Pixabay's free shelf) still gets you to done faster.

If you'd rather rent than run it, the API shelf moved too. Google's Lyria 3.5 goes for about $0.08 a song, ElevenLabs Music is $0.15 a minute with proper section-level control, and both sit firmly in "just try it" territory at creator volumes.

Where generated music genuinely wins is a fixed-format series. My city films are all three minutes, same narrator, same mood arc. One generated theme, made to fit the timeline exactly, shared across the Chinese and English versions. A library track was never going to fit that neatly.

**Music options compared** (checked October 2026; local tests are CPU-only)

| Option | Cost | Tested / notes | Licence notes |
|---|---|---|---|
| Stable Audio 3 Medium (local) | No generation fee | Full 180s piece in ~160s, 2.5GB | Community License, revenue <$1M + registration; CPU weights still marked experimental |
| ElevenLabs Music (API) | $0.15/min | Strongest section-level control | Self-serve plans restrict film/TV use |
| Lyria 3.5 (API) | $0.08/song | Whole-song generation, no iterative edits | Official Google API |
| Licensed libraries | Subscription | Epidemic Sound / Artlist / Pixabay; fastest route to finished | Check Content ID and licence scope |
| MusicGen-small (local) | No generation fee | 15s took 407s, RTF 27.3 | Weights CC-BY-NC, non-commercial ⛔ |
| Suno / Udio | Subscription | Strong quality | Suno has no official API; Udio bars downloads and commercial release, not for production |

## Flip number two: the local voice ranking got a new top

My first local shortlist for Chinese was MeloTTS (MIT licence, vendor promises CPU real-time, handles Chinese and English mixed in one sentence), Kokoro for speed, GPT-SoVITS if you want to clone and train your own voice, CosyVoice for the best open Chinese quality if you can wait for batch rendering.

The second pass put a model on top that the first pass had filed under "API stuff": Qwen3-TTS, the open weights, 1.7B CustomVoice build. Apache-2.0, properly commercial-clean. Ten languages. Fixed built-in voices, and the one that matters for a history series is literally called Uncle_Fu, a calm older male voice that sounds like it has seen some things. You steer it with plain language instructions. "Measured, restrained, documentary tone" goes in as text, and the delivery follows. The 0.6B sibling can't do that trick reliably, so if you test the small one and shrug, you've tested the wrong one.

Measured on CPU, 4 threads, BF16: 23 seconds of narration in 119 seconds, 5.3GB of RAM. That's an RTF around 5, slow, and I don't care. Narration renders overnight, paragraph by paragraph. Slow and good beats fast and robotic every time I have the choice.

Runner-up is VoxCPM2, and the reason is painfully specific to my project: place names. Xianyang's history is a minefield of names that TTS loves to misread. VoxCPM2 takes pinyin input with tone numbers, character by character, and English phonemes work the same way. When the model insists on reading a two-thousand-year-old name wrong, you reach in and fix that one word. CosyVoice3 has similar pronunciation controls and stays on my bench as the backup for exactly that job.

Kokoro got demoted in the process, and I want to be fair to it. On the 4-thread box it spat out 20 seconds of audio in 9 seconds, half a gig of RAM. It's a fantastic sketching tool. Draft the whole episode with Kokoro, listen for pacing problems, then render the final take with Qwen. Fast for thinking, slow for shipping. Both jobs are real jobs.

One honest limit on all of this: the API voices have not been through a paid blind listening test in my research, and neither have the local ones. These rankings come from specs, licences, measurements and samples, ranked by someone who has been burned by benchmark tables before. Elo scores reward flashy thirty-second clips. A three-minute narration about the fall of a dynasty is a different sport.

**Local CPU narration models: features and licences** (test setups described in the text; numbers are not directly comparable across machines)

| Model | Licence (weights) | CPU performance | Role |
|---|---|---|---|
| Qwen3-TTS 1.7B | Apache-2.0 ✅ | 23s of narration in 119s, 5.3GB | Local first pick; natural-language delivery instructions (1.7B only) |
| VoxCPM2 | Apache-2.0 ✅ | Official CPU path available | Pinyin/phoneme fixes; built for place names and personal names |
| Kokoro-82M | Apache-2.0 ✅ | 20s in 9s (4 threads) | Drafting tool; only 8 Chinese voices |
| CosyVoice 3 | Apache-2.0 ✅ | Offline batch, slow | Best open Chinese quality tier; pronunciation-fix backup |
| GPT-SoVITS | MIT ✅ | RTF 0.526 (measured on Apple M4) | Clone and train your own voice |
| MeloTTS | MIT ✅ | Vendor claims CPU real-time | Great Chinese-English mixing; slower maintenance |
| Piper | Usable ✅ | RTF 0.176, only 240MB | Fallback pick; fast, flat quality, one Chinese voice |
| F5-TTS / ChatTTS / XTTS-v2 | Non-commercial ⛔ | — | Weights licence blocks monetized video |
| IndexTTS | Licence contradiction ⚠️ | GPU-first | Marketing and licence text disagree; get written permission first |

## The workflow matters more than the model

Both passes, plus every open-source video project worth copying, landed on the same production habits:

Keep narration, subtitles and music as separate tracks, generated separately, fixed separately. When a place name comes out wrong, re-render that paragraph only. Regenerate the whole episode and the voice drifts, the pacing drifts, and now you're fixing three new problems to solve one old one.

Subtitles follow the final narration, never the draft. Music gets picked after the voice is locked, mixed under it, and shared between language versions so the series sounds like one series.

MoneyPrinterTurbo's caching trick is worth stealing outright: hash each segment, and when you change only the music, the render only redoes the mix. pyvideotrans and NarratoAI do the unglamorous stuff well too, segmented dubbing, timeline alignment, loudness normalization. Unglamorous is where videos actually get finished, ngl.

## Where I've landed

For the city series: Qwen3-TTS 1.7B locally for the voice, Stable Audio 3 Medium locally for the theme, MiniMax HD as the API fallback when a deadline is breathing on me. English versions get ElevenLabs if the Qwen voice doesn't carry across well enough; that test is still on my list.

For quick shorts and client-shaped work: MiniMax or Azure for the voice, library music, done by lunch.

And the local stack runs on the machine I already own. The 3800X under my desk has been sitting there through this whole AI wave doing code compiles. Turns out it can also narrate the fall of the Qin dynasty and score it, in less time than the video takes to watch. Twenty-four years of doing this and the hardware surprises still get me.

Next step is ears. More spreadsheets won't settle this. The first Xianyang episode goes out with this stack, and I'll report back on what actually sounded human and what sounded like a very confident robot. If you make videos in two languages, I'd genuinely like to know what's reading your narration.
