---
pubDatetime: 2026-11-10T11:16:00-08:00
title: "Fable 5.2 scored 49.1% at coding, but Anthropic itself held back its GPU kernel-writing skill"
description: "Anthropic released Claude Fable 5.2 and Mythos 5.2 on November 9, two names for the same model. Fable 5.2 scored 49.1% on FrontierCode 2.0 and costs 20% less, but classifiers inside it block high-risk cybersecurity and most research-biology requests and hand them to older models — and in training, Anthropic deliberately held accelerator kernel optimization and language model architecture to roughly Opus 5.5's level. The fallback meant to prevent abuse hands requests to an older model that injection breaks into more easily: 2.05% when Fable 5.2 answers itself, 5.17% when Opus 4.8 answers instead."
tags: ["ai agents", "ai safety"]
lang: en
ogImage: ./cover-fable-5-2.webp
translationKey: fable-5-2-gpu-kernel-held-back
---

Have you ever seen a line in Claude Code telling you that a different model answered you this time? On November 9, Anthropic released Fable 5.2 and Mythos 5.2, and behind the two names sits one and the same model.

On FrontierCode 2.0, Anthropic's own coding benchmark, Fable 5.2 scored 49.1%. The previous generation managed only 32.4%, and it passed Opus 5.5's 45.5% as well. The price dropped by 20% too: $8 per million input tokens and $40 per million output tokens, with output up to 30% faster.

It does more than write code. It can also go to work in swarms. Anthropic says about 1,000 Fable 5.2 agents spent about 30 hours together and turned Fermat's Last Theorem into a machine-checkable proof in Lean. Under the same setup, Opus 5.5 had completed only 26% of the proof after 18 hours.

But these two models are not open to just anyone. Fable 5.2 is open to all paying users, while Mythos 5.2 goes only to organizations that have passed the cybersecurity verification program or the life-science verification program, because the cybersecurity and biology limits on Mythos sit looser.

The same model is split into two doors, and the threshold is not the model itself, but who you are and what you can ask. Inside Fable 5.2 sit classifiers that block high-risk cybersecurity requests and most research-biology requests. A blocked cybersecurity question is answered by Opus 4.8, and a biology question is answered by Opus 5.

When a fallback happens, Claude tells you the model was switched, and the answer is labeled with the model that produced it. On the API, fallback happens only if you actively opt in; if you do not, then the request is refused outright. In the product, automatic switching is on by default, but you can turn it off in settings.

![How a request flows through Fable 5.2: you hand in a request, the classifiers judge it, and a blocked request falls back to an older model that answers instead — with a side note that training also held down accelerator kernel optimization, and a reminder that the fallback hands your request to the model that is easier to break into](./diagram-fable-5-2-en.png)

Training holds another brake, and this one is buried deeper. During training, Anthropic deliberately held down the very capabilities that most directly speed up AI research and development. One of them is accelerator kernel optimization, which in plain terms means writing the low-level code that makes chips run faster. Another is language model architecture, and both were held to roughly the level of Opus 5.5. At inference time, some of these topics fall back to Opus 5 as well.

At the same time, mistaken blocks by the classifiers are down about 55% from the previous generation, with cybersecurity down about 60% and biology down about 40%. So legitimate security research and biology requests are blocked and handed down to the older models less often as well.

But the fallback itself creates problems, and the problems land exactly on security. In the Gray Swan tests cited in the system card, after 15 attempts at indirect prompt injection, Fable 5.2's chance of being broken into was 4.09%. The previous generation's was only 1.02%, and Opus 5.5's was 0.96%.

The gap comes mainly from the fallback, because 53% of those 15 attempts were answered by Opus 4.8. When Fable 5.2 answered on its own, the break-in chance was 2.05%, but when Opus 4.8 answered instead, the chance rose to 5.17%.

In other words, the fallback that exists to prevent abuse hands the request to an older model that is easier to break into with an injection. If you have an agent read email or run code from other people's repositories, then this point concerns you directly, because the injected instructions hide in exactly the text the agent has to read.

METR's report says Anthropic's internal models have already made AI research and development about 2 times faster. So the lab enjoys that acceleration on one side, and on the other side it draws lines around the new model's abilities during training, and the lines are drawn in the open, written into the system card.

Drawing the line in the open is a good thing, but where the line is drawn and how the line is enforced are both decided by the lab itself. The public can see the line, but it cannot see the enforcement behind the line, and that is the point that leaves me uneasy.

If you write code with Claude Code every day, then you should first go into settings and check whether automatic switching is on. Leave it on, and a blocked request keeps running, but the model answering you is a weaker older model. Turn it off, and a blocked request is refused outright and no fallback happens. Do not hand sensitive tasks to a flow that can fall back; rather let the request stop than let the flow quietly swap who answers you.

If this piece helped you, consider subscribing to this blog or bookmarking it. I will keep sharing what I have checked and used myself across AI, security, and open source. And when the next model launches, we can look together at exactly which line it drew.

Source: Anthropic's official announcement, at https://x.com/claudeai/status/2119867114450268322
