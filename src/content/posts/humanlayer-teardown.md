---
pubDatetime: 2026-10-24T06:57:00-07:00
title: "I tore down HumanLayer's source code: it leashes your coding agent, but sessions move to its cloud"
description: "HumanLayer open-sourced its approval layer for coding agents. I read the source: the engineering is real, but there is a simpler path using the CLIs' own built-in doors."
tags: ["AI Agents", "Tooling", "Open Source"]
lang: en
ogImage: ./diagram-humanlayer.png
translationKey: humanlayer
xPost: https://x.com/alexlee20122022/article/2113993323904168039
featured: true
---

HumanLayer open-sourced its whole system the other day. 11.8k stars, Apache 2.0, and they say the released code is the same code their cloud runs. What it sells is something a lot of people want right now: let a coding agent work on its own, but make it stop and ask before it does anything dangerous.

The repo is about 22 megabytes of TypeScript. I read through it, then went back and checked the important files against the official docs. The engineering is real, the idea is right. It's also much heavier than it looks, and a few things won't show up in the launch post.

## What it sells

Hand Claude Code or Codex a task and it will run commands, edit files, install packages on its own. Fast, genuinely fast. The catch is you can't watch it every second, and a wrong directory deleted or a wrong command run takes about a second.

HumanLayer sells an approval layer. Every time the agent wants to do something risky, it stops and pushes the request to your web dashboard or your phone. Approve, and it continues. Deny, and it stops, and your reason for denying is shown to the model. Not at your desk? You can watch it work and approve things from wherever you are.

Sounds simple. Underneath, there are three completely different ways it connects, and which one you're using changes what you actually get.

## Way one: it drives

You create a task in its web app. A small program it installs on your machine picks the task up and starts the real Claude Code itself.

Because it started the process, it holds every gate. A handful of actions pass automatically (searching code, reading files, calling skills). Everything else first gets written to the cloud as "waiting for approval," and the program freezes on the spot until your answer comes back. Approve and it proceeds. Deny and it hands your exact words to the AI.

This one is a real gate. The steering wheel is in its hands.

## Way two: you drive, it relays

If you'd rather start Claude Code yourself in a terminal, there's a plugin. When Claude Code stops to ask you something, the plugin mirrors that question to the web app, and answering there counts. The terminal prompt and the web card race each other; whoever answers first wins.

Clever. There's a ceiling, though, and to its credit the docs are honest about it: if your Claude Code is set to "don't ask me, just do it," it never produces a question, so the plugin has nothing to relay. You keep the recording and lose the gate. The plugin also leans on a fairly new internal interface inside Claude Code, so when Anthropic changes that interface, the plugin has to chase it.

## Way three: the "Codex" in there is theirs

This is the one that stopped me while reading.

Pick "Codex" inside HumanLayer and what runs is a program HumanLayer wrote itself. It takes your ChatGPT login and calls OpenAI's API directly, the tools are its own implementations, and the conversation is stored in its own database. That line in its docs, "Codex sessions are stored by HumanLayer," is literal.

For completeness: OpenCode gets the relay treatment. The Pi plugin is relay only, no approvals at all. Its own README says it plainly: Pi doesn't ask, so Pi just runs.

## Where your data actually lives

This is the part I'd want someone to tell me before installing.

The official install is cloud-first. The program on your machine does the work, but the ledger lives in HumanLayer's cloud. Every conversation, every action the agent took, every file it changed, your task files, how much you used. All of it is written into a database on their side, then synced back out to your devices.

Credit where due: their docs state plainly that they don't proxy your model traffic. The calls to the model go direct. But the session content itself sits on their cloud.

There is a self-hosted road. Build it from source, run it yourself, and they say it sends nothing back; the telemetry switches live in configuration and stay off when unset. I believe that part. But self-hosting right now is rough: several third-party service keys are required before the thing will even start, and the official guide is still "in progress." One more small thing: their two most core packages ship without a license field in the package file. The code is public, but anyone who's maintained open source knows that detail matters.



## Now the ban risk, which almost nobody mentions

Using a subscription login inside a third-party tool to call the model: Anthropic drew that line at the start of 2026. Their docs say it isn't allowed, they blocked it technically, and accounts did get banned in a wave before some were reinstated. The logic is simple enough. A subscription is priced for the official client, and feeding it to third-party programs is not what that price was for.

Hold HumanLayer up against that. Its Claude path drives the real Claude through official tooling, which keeps it comparatively inside the lines. Its home-grown "Codex" takes your ChatGPT login and calls the API from its own program, which is exactly the pattern the vendors are tightening on. OpenAI hasn't run Anthropic's full playbook yet. The line is drawn, though. If it gets enforced one day, the account that hurts is yours.

Tools like this save you subscription money. What you put up as collateral is the account itself. Run that math before you install.

There's also the sheer size of the thing. 22 megabytes of code is a lot of surface. Open source is a point in its favor; open source is not the same as audited. Out of 11.8k stars, almost nobody has read the approval chain end to end. My old rule for trusting a tool: look at where it puts your data and where it puts the gates. The rest is marketing.

## My take: this got built heavier than it needs to be

I've done full-stack work for 24 years. Back when I led teams, one of the expensive lessons was that the heavier the system, the more of yourself you have to hand over to it.

HumanLayer's full stack (cloud ledger, real-time sync, apps on every surface, tasks, comments on diffs) is built for teams: several people collaborating, an audit trail, multiple agents working in parallel. In that world it earns its weight. If you're one developer who just wants "I can see what the agent is doing, it asks before anything dangerous, and I can approve from my phone," handing every session to a cloud for that one feature doesn't pencil out.

And the vendors left a door open, so the big detour isn't necessary.

Codex ships with a standard interface called the app-server. OpenAI's own editor extension and app talk to Codex through it. Asking the user for approval is a built-in part of that protocol, and it's open source. On the Claude Code side there's ACP, an open protocol (started by the Zed folks) that wraps it, with permission requests as a first-class citizen and ready-made adapters you can download today. Both roads run the official tools through official interfaces, and the tools' own safety limits stay in force, because the tool still stops and asks before dangerous actions on its own.

What's left to build is small. A tiny forwarder. A hook catches the "it wants to ask you" event, pushes the question to your WhatsApp or Telegram, you reply "yes" or "no" in chat, and the forwarder feeds your answer back in. Your session data never leaves your machine (the chat app itself aside). No cloud ledger. Nobody calling an API somewhere else with your subscription login. The amount of code is not in the same universe as the stack above.



Honest downsides: the forwarder road is rough. Your interface is a chat window, with no task board, no diff comments, and no multi-user features. If you run a team and need an audit trail, buy or build the heavy thing with a clear conscience. This road is for solo operators who like things light. It also has a quiet advantage: when a vendor changes its policy one day, what breaks is a small program you wrote, fixable in an afternoon. If you've bet on someone else's whole platform, migration is a different conversation.

I plan to build the little forwarder first and see how it feels. Report back when there's something to report.

Sources: the HumanLayer repo (github.com/humanlayer/humanlayer) and its bundled docs; the open-sourcing announcement at hlyr.dev/blog/open-sourcing-humanlayer. The ban-policy section reflects Anthropic's public 2026 documentation and statements.
