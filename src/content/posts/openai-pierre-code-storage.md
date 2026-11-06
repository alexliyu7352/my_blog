---
pubDatetime: 2026-11-06T01:12:00-08:00
title: "OpenAI bought Pierre: your local git repo stays yours — what moves is where agent code lives in the cloud"
description: "OpenAI is acquiring Pierre, maker of Code Storage. Local development does not change: you or your agent still create the git repository on your machine, and the local form of Codex never touches Pierre. What moves is the cloud side — which form puts your code on a platform's servers, who Code Storage is actually for, and what that means for an individual user."
tags: ["AI", "open source", "developer tools"]
lang: en
ogImage: ./cover-pierre.webp
translationKey: openai-pierre-code-storage
---

Quick terms first. Git is the tool that records every change to a codebase, so a change that breaks things can be rolled back. A repository is one project's ledger of those changes. Hosting means keeping that ledger on a server where everyone can reach it, and GitHub is the biggest host there is. An agent is an AI program that takes a task, writes code and hands the code back. Codex is OpenAI's coding agent, and it comes in two forms: one that runs on your own computer, and one where you hand it tasks on the web and OpenAI's servers do the running. This post keeps the two apart.

On November 4, OpenAI announced it is acquiring Pierre. Pierre's main product is Code Storage, a service that stores code repositories. The price was not disclosed, the deal still needs regulatory approval, and the two companies stay independent until it closes. OpenAI said two things in its announcement: existing Code Storage customers can keep using it after the deal closes, and OpenAI will gradually fold Code Storage's features into Codex. One part is already in place: the two libraries Codex uses to browse files and review changes, Trees and Diffs, were Pierre's work all along.

Start with local development, because none of it changes. When you build a project on your own machine, you still create the repository: either you create it locally yourself, or you let the agent create it locally, or you create it on GitHub first and copy it down to your machine. The form of Codex that runs on your computer — the command-line tool, the desktop app and the editor extensions — works inside that local repository and edits files on your disk. If you never push anything out, your code never leaves your machine. Pierre has nothing to do with this layer.

So who is Code Storage for? It has no web interface for people to look at. It is an interface for programs to call. A platform company embeds it in its own product, and when the product's agents need to create a repository or store code, they call it directly. Its customers are platforms like Lovable, Bolt and Amp: a user asks an agent on a web page to generate an app, and that app's code is stored in Code Storage.

Why don't those platforms just use GitHub? Because GitHub was designed around people using it, and its sign-in flows and rate limits (a cap for each account on how often the service can be called) were made for people. A platform's workload looks different: dozens of agents writing into one repository at the same time, and repositories that can grow to 32 terabytes (a typical laptop drive holds less than one terabyte). Code Storage was built for how machines work, and after storing the code it can still sync it back to GitHub, GitLab and Bitbucket.

So when does your code end up stored in the cloud? When you stop working locally and use the cloud form instead. With Codex, you hand it a task on the web; it asks you to connect a GitHub repository first, the task runs on OpenAI's servers, your code is copied over there, changed, and the result is sent back to you. Platforms like Lovable work the same way: the app you asked for is generated on their side, and its code sits on their side first.

That is where the line between local and cloud actually runs. In the local form the code is on your disk, and where it lives and who can see it is your call. In the cloud form the code is on someone else's server from the moment it is written, and where it is stored and who can see it is the platform's call. Buying Code Storage and folding it into Codex is a move on the cloud side of that line: OpenAI said in its announcement that it wants Codex to cover the whole chain, from an agent starting to write code to that code going live. That step is not finished today, and the deal has not closed, but the direction is already on the table.

My own view is that what this means for an individual user is not about switching tools. It is about knowing which of the two forms you are using before you start. The local setup stays as it was, repositories and all. The cloud setup buys you convenience, but the code is no longer in your own hands. If that line is blurry, arguing about which agent is better misses the point.

If this was useful, consider subscribing or bookmarking — I keep writing about AI, open source, and the infrastructure agents run on.

Sources: OpenAI's announcement and reporting on the acquisition https://www.unite.ai/openai-to-acquire-pierre-computer-and-bring-code-storage-to-codex/ ; how Codex cloud tasks work is described in OpenAI's Codex documentation
