---
pubDatetime: 2026-10-29T04:40:00-07:00
title: "Rust is replacing C by never rewriting it"
description: "C is not being beaten or rewritten. It is being retired the quiet way: the conservative projects have all adopted the same rule — old C stays untouched, and every new component gets written in Rust. The stock of C decides how long it lives; the flow of new code decides whether it is still alive."
tags: ["Rust", "C", "Open Source", "Linux"]
lang: en
ogImage: ./comic-systemd-rust-toolchain-wm.png
translationKey: rust-replacing-c
xPost: https://x.com/alexlee20122022/status/2115770890176876677
---

Rust is replacing C by never rewriting it

Two of the most conservative codebases in computing moved in the same week. On October 27, systemd merged its first program written in Rust. In the same few days, the Linux 7.4 merge window removed the C implementation of the Binder driver, some 11,470 lines, leaving the Rust version as the only Binder in the mainline kernel.

Every time this comes up, someone does the line count, and the line count says the whole idea is silly. Greg Kroah-Hartman has given the numbers himself: about 36 million lines of C in the kernel, against 113,000 lines of Rust. By that math C is immortal and the replacement talk is a rounding error looking for a headline.

![A maintainer hauling a giant crab-marked Rust toolchain up the boot stairs, to add one tiny component](./comic-systemd-rust-toolchain-wm.png)

But that is not how a language dies. A language dies when new code stops being written in it. The old code keeps running, keeps getting patched, and looks untouchable while that happens. Meanwhile every new component, every new driver, every new tool starts life in something else. The stock decides how long C keeps running. The flow decides whether it is still alive.

Look at the rules the conservative projects have written for themselves and they are the same principle everywhere: existing C is not touched, and Rust is allowed only in new code. The kernel opened the door that way in 2022, new drivers first. Last December the maintainers' summit declared the experiment over and Rust a core kernel language.

systemd's version of that principle is the strictest yet. Rust is allowed only in new leaf programs, the small standalone tools that nothing else in the system depends on, with no existing C ported, no Cargo (Rust's own package manager and build tool) in the build, no external crates, and not even the Rust standard library in the shipped binaries. The first program, systemd-keyring-setup, does one small job: enrolling certificates into kernel keyrings at boot. That small step merged on October 27.

The layer users touch every day is moving too. Ubuntu made the Rust sudo-rs its default sudo in 25.10. In 26.10, released this October, ls, cp, rm and the rest of the core utilities are all Rust implementations now, and even APT's package signature checking runs on Sequoia, which is written in Rust.

Why do maintainers sign rules like these? The math is in the vulnerability counts. Microsoft and Google have both estimated that around 70 percent of serious vulnerabilities in large C and C++ codebases are memory errors. Google's own Android numbers are blunter: memory-safety bugs were 76 percent of all Android vulnerabilities in 2019 and under 20 percent by 2025, during the years when Android's new code moved to memory-safe languages.

There is a second ledger, reviewer hours. Kroah-Hartman has said Rust code is easier for him to review: the type system settles the resource bookkeeping up front, so he can spend his attention on whether the logic is right. When your job is reading other people's patches by the thousand, that is not a matter of taste. It is staffing.

Binder shows what the next stage looks like. Google rewrote the driver in Rust, ran both versions side by side, shipped the Rust one on Android devices, and the case made for deleting the C code in 7.4 was that the Rust version had matched it on features and performance. The note from the engineer removing it starts with: "The day has finally come."

Binder is the exception, though, and it cannot be treated as the norm. Behind it sit years of Google money and people, and a component painful enough to deserve a rewrite. Most C subsystems will never get one. They will get something quieter instead: a year after which no new feature is added in C. Then the old code just sits there, running, for twenty years.

The road in has hard blockers, too. systemd's core still cannot use Rust, because its dynamic library support has genuine blockers. Arch and openSUSE builds broke this month because they enabled every feature without shipping the Rust toolchain.

Ubuntu's swap was not clean either. The audit it commissioned from Zellic covered the Rust coreutils, uutils, and turned up 113 issues, 44 of them CVEs. Three commands, cp, mv and rm, were held back by a race where a file could change between the moment it was checked and the moment it was used, and they stayed on the GNU versions until 26.10.

So the honest timescale here is a generation, not a couple of years. C will keep running on every machine for a long time yet, and people who can maintain it will stay valuable. What changes is how that value looks: from the person the new work goes to, to the only person who dares touch the old system.

Push it twenty years out and the picture looks like this. New projects do not list C among their default choices. Young engineers learn it the way they learn COBOL today, in order to work on old systems that everything still depends on. I have maintained C infrastructure for a long time, and what I actually dread is not losing the work. It is opening a document one day and finding my experience filed under "legacy."

If you write C for a living, my advice is narrow and practical. Do not panic, and do not bet on this not happening. Train for the boundary instead: read Rust fluently, review the new components, know which parts of the old C must never be touched and which parts new code should route around. That person is about to be the scarcest hire in infrastructure, because every new component has to plug into systems people like us still run.

So do not count the lines of C that remain. Watch what your next new component gets written in by default. The day the default flips, the ending is already written and only the schedule is left. What is the default on the new project in front of you right now?

https://www.phoronix.com/news/systemd-Merges-Rust-Programs
