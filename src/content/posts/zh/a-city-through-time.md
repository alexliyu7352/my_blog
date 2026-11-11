---
pubDatetime: 2026-11-11T00:50:00-08:00
title: "给 AI 一座城，它还你一部电影｜一城春秋"
description: "给编程代理一座城市和一个起始年代，它会查史料、抓建筑与地图数据，把整座城做成白色模型，从最早的聚落到今天，一个时代一个时代地点亮。你拿到的是一部电影、一座可以走进去的古城，还有城里建筑的展览页。目前点亮了两座城：咸阳，六千年；罗马，两千八百年。"
featured: true
tags: ["开源", "AI", "数据可视化"]
lang: zh
ogImage: ./cover-a-city-through-time-zh.webp
translationKey: a-city-through-time
---

给编程代理一座城市和一个起始年代，它会查史料、抓建筑与地图数据，把整座城做成白色模型，从最早的聚落到今天，一个时代一个时代地点亮。你拿到的是一部电影、一座可以走进去的古城，还有城里建筑的展览页。

<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;margin:1.5rem 0;">
<iframe style="position:absolute;top:0;left:0;width:100%;height:100%;" src="https://www.youtube.com/embed/CbMU4t607tc" title="一城春秋 · 项目介绍影片（中文版）" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>
</div>

看已经点亮的城市：[cities.go5.si](https://cities.go5.si/)
安装技能：`npx skills add alexliyu7352/city-through-time-skill -g -y`
源码：[github.com/alexliyu7352/city-through-time](https://github.com/alexliyu7352/city-through-time)

一城春秋是一个开源的代理技能（skill），Claude Code、Codex、Cursor、Gemini CLI 等都能用。目前点亮了两座城：

- 咸阳，前 4000 年到 2026 年（12 分 30 秒）：[看成片](https://www.youtube.com/watch?v=Z17apk9c2a8)
- 罗马，前 753 年到 2026 年（30 分钟）：[看成片](https://www.youtube.com/watch?v=yca4JiR3Peg)

## 片中内容

- 0:00 咸阳，六千年
- 0:13 一城春秋；罗马，两千八百年
- 0:25 走进古城，再走进五座建筑
- 0:35 怎么做的，以及两种安装方式
- 0:45 下一座，点亮你的城

## 怎么做的

1. 考据：整理城市的时间线，每条史实附出处和原文。
2. 数据：今天的建筑、河流、道路、地形与卫星影像。
3. 白模：整座城按比例建模。历代城市依考古报告和史料用代码生成，是示意模型，不是复原。
4. 点亮：一个年代一层光，再配旁白和音乐，渲染成双语成片。

研究、编程、渲染都由代理完成；人定方向，并在浏览器里逐步检查。

## 自己做一部

需要 Claude Code（或其他读得懂技能的代理）、Node 20 以上、uv、ffmpeg、exiftool、git，以及一台有显卡、装了 Chrome 的电脑。

推荐：安装技能

```
npx skills add alexliyu7352/city-through-time-skill -g -y
```

或者自己 clone 仓库，再把它链接成技能：[github.com/alexliyu7352/city-through-time](https://github.com/alexliyu7352/city-through-time)

然后跟代理说：「用一城春秋做［你的城市］，从［起始年代］开始」

做好的城市可以提 PR，加到入口页的地球上。

## 关于这支片子

画面都出自项目自己的页面：两部成片、可以走进去的古城、建筑展览页（同一个机位上，先是白模，再是为它生成的复原图），以及入口页的地球。展览模型上的彩色复原图由 AI 据史料生成，画面上已标注；展览页里模型的每个部件都标明是有据还是推测。配乐为原创，以代码谱写，画面随音乐卡点（采样 VSCO 2 CE、VCSL，CC0）。剪辑、动效与配乐由 Claude 制作。

## 数据与授权

- 建筑与地图：清华大学 CMAB（CC BY 4.0）、Overture Maps Foundation（ODbL）、GHSL（欧盟委员会 JRC，CC BY 4.0）、© OpenStreetMap contributors（ODbL）
- 地形与影像：Copernicus DEM GLO-30；Contains modified Copernicus Sentinel data 2025
- 地球：Natural Earth、NOAA ETOPO1（公有领域）
- 历代城市与建筑为示意模型，建筑高度与年份为估算。
- 白模投影风格改编自 lemo-opuscar（MIT）。
- 代码：MIT（附署名条件）；成片与城市数据：CC BY-SA 4.0。

Made with 一城春秋 · A City Through Time — [github.com/alexliyu7352/city-through-time](https://github.com/alexliyu7352/city-through-time)
作者：Alex · [x.com/alexlee20122022](https://x.com/alexlee20122022)
