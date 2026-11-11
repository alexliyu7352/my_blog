---
pubDatetime: 2026-11-11T00:50:00-08:00
title: "Give an AI agent a city. It gives you back a film. | A City Through Time"
description: "Give a coding agent a city and a starting era. It researches the sources, pulls building and map data, builds the whole city as a white model, and lights it up era by era, from the earliest settlement to today. What comes back is a film, an old city you can walk through, and museum pages for its buildings. Two cities are lit so far: Xianyang, 6,000 years, and Rome, 2,800."
featured: true
tags: ["open source", "ai agents", "data visualization"]
lang: en
ogImage: ./cover-a-city-through-time-en.webp
translationKey: a-city-through-time
---

Give a coding agent a city and a starting era. It researches the sources, pulls building and map data, builds the whole city as a white model, and lights it up era by era, from the earliest settlement to today. What comes back is a film, an old city you can walk through, and museum pages for its buildings.

<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;margin:1.5rem 0;">
<iframe style="position:absolute;top:0;left:0;width:100%;height:100%;" src="https://www.youtube.com/embed/ZeqlfaAadHg" title="A City Through Time — project introduction video (English)" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>
</div>

Watch the cities: [cities.go5.si](https://cities.go5.si/)
Install the skill: `npx skills add alexliyu7352/city-through-time-skill -g -y`
Source: [github.com/alexliyu7352/city-through-time](https://github.com/alexliyu7352/city-through-time)

一城春秋 · A City Through Time is an open-source skill for coding agents (Claude Code, Codex, Cursor, Gemini CLI and others). Two cities are lit so far:

- Xianyang, 4000 BCE to 2026 (12 min 30 s): [watch the film](https://www.youtube.com/watch?v=Z17apk9c2a8)
- Rome, 753 BCE to 2026 (30 min): [watch the film](https://www.youtube.com/watch?v=yca4JiR3Peg)

## In this video

- 0:00 Xianyang, 6,000 years
- 0:13 A City Through Time; Rome, 2,800 years
- 0:25 Walk the old city, then step inside five buildings
- 0:35 How a film is made, and two ways to install the skill
- 0:45 Light up your city next

## How it works

1. Research: a timeline of the city, every fact with its source and original text.
2. Data: today's buildings, rivers, roads, terrain and satellite imagery.
3. Model: the whole city to scale. The city of each era is built in code from archaeological reports and historical sources: schematic models, not reconstructions.
4. Light: one era, one layer of light. Then narration, music and a bilingual render.

The agent does the research, the code and the rendering. You set the direction and check every step in the browser.

## Make one yourself

You need Claude Code (or another agent that reads skills), Node 20 or later, uv, ffmpeg, exiftool, git, and a computer with a graphics card and Chrome.

Install the skill (recommended):

```
npx skills add alexliyu7352/city-through-time-skill -g -y
```

Or clone the repository and link its skill: [github.com/alexliyu7352/city-through-time](https://github.com/alexliyu7352/city-through-time)

Then tell the agent: "Use A City Through Time to make [your city], starting from [era]."

A finished city can join the globe on the entry page by pull request.

## About this video

The pictures are drawn by the project's own pages: the two films, the old cities you can walk, the museum pages (from one camera, first the white model, then the picture made for it) and the globe on the entry page. The coloured pictures on the museum models are AI-generated reconstructions from the sources, labelled on screen; on the museum pages each model part says whether it rests on sources or is estimated. The music is original, written in code, and the picture is cut to it (samples: VSCO 2 CE and VCSL, CC0). Edit, motion and score were made by Claude.

## Credits

- Buildings and maps: Tsinghua University CMAB (CC BY 4.0), Overture Maps Foundation (ODbL), GHSL (European Commission JRC, CC BY 4.0), © OpenStreetMap contributors (ODbL)
- Terrain and imagery: Copernicus DEM GLO-30; contains modified Copernicus Sentinel data 2025
- Globe: Natural Earth and NOAA ETOPO1 (public domain)
- Cities and buildings of the past are schematic models. Building heights and years are estimates.
- White-model projection style adapted from lemo-opuscar (MIT).
- Code: MIT with an attribution condition. Films and city data: CC BY-SA 4.0.

Made with 一城春秋 · A City Through Time — [github.com/alexliyu7352/city-through-time](https://github.com/alexliyu7352/city-through-time)
By Alex · [x.com/alexlee20122022](https://x.com/alexlee20122022)
