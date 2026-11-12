---
pubDatetime: 2026-11-12T12:01:46-08:00
title: "A Local AWS Emulator Is Out: Agents Wrote All the Code, and the Team Reviewed Not One Line"
description: "On November 11, AWS released AWS Emulator, a local emulator of the AWS APIs covering 438 API models. All of its code was written by autonomous agents, and the team neither wrote nor reviewed a single line. I installed 1.0.322 myself, ran the four SQS steps of creating a queue, listing queues, sending a message, and receiving a message, and counted the fidelity score file that ships with the release record by record: out of 42,937 test units, only 24,243 passed, a pass rate of 56.5%. It is usable, but how many units each service actually passed is something you have to check for yourself first."
tags: ["ai agents", "open source"]
lang: en
ogImage: ./cover-aws-emulator-en.png
translationKey: aws-emulator
xPost: "https://x.com/alexlee20122022/status/2121017581809135767"
---

I installed AWS Emulator 1.0.322 on my own machine. Then I created a queue on SQS. Next I listed the queues to confirm that it had already been created. Then I sent a message into the queue. Finally, I received that message back. The whole process never connected to real AWS. And the body of the message I received back was exactly the same as the body of the message I had sent out.

On November 11, 2026, AWS released this emulator. It runs on your own machine, and the interface it exposes to the outside is the same as real AWS, so after you point your SDK's address at your own machine, you can test your own programs on your own machine.

It covers 438 AWS API models, and as of today its repository already has 30,627 commits and 5,002 stars. Matthew Goldberg, the author of the official blog post, puts it very directly. He says all of the code was written by autonomous agents. And he says the AWS team has not written a single line of code, and has not reviewed a single line of code either.

## It started as a weekend experiment

This emulator started out as a weekend experiment. Goldberg first gave Kiro, the agent responsible for writing the code, a set of requirements in three steps. He had Kiro first write tests following the behavior of the AWS CLI. Next, he had Kiro run that batch of tests on real AWS until they passed. Finally, he had Kiro write one more SQS implementation, one that runs in memory, and that SQS implementation also had to pass the same batch of tests.

15 minutes later, the first version of the SQS implementation was up and running. And because Kiro had already finished writing the remaining services by the time the weekend ended, the team started using this emulator to test their own software on Monday.

## Three teams and a merge gate

Later, the team split the work into three teams. The first team specialized in writing tests. They wrote real usage scenarios following the public Smithy API models. They first put each scenario on real AWS to validate it. Only after a scenario passed validation did they save that scenario as a fidelity test. So the fidelity tests they accumulated in the end numbered in the tens of thousands.

The second team specialized in finding problems. They ran the fidelity tests on the emulator all over again. They recorded each test that failed to pass as an issue, and then they put the issue into a directory called things-that-do-not-work. That directory sits right under the issues folder in the repository.

The third team specialized in fixing problems. Each agent claimed only one issue to fix, and after each agent finished fixing, it had to send its change into a merge gate, so no change that had not passed the merge gate could get into the mainline.

The merge gate checks four items in total. The program first has to be able to compile and pass. Then the reviewing agents check whether the way the code is written conforms to the coding standards. Next, a security check also has to be done. The agents responsible for the security check have to confirm that the change has not introduced any security problems. Finally, the system runs the fidelity tests all over again. The system has to confirm that the number passing has not gone down. The team members themselves never reviewed a single line of code. Inside the gate, the work of checking how the code is written and checking for security problems is done by agents, and the work of running the fidelity tests again is done by the system.

## I counted the fidelity scores one by one

I downloaded the fidelity score file that comes with the v1.0.322 release. Then I counted the records in that file one by one. That file contains 42,937 test units in total. Of those, 24,243 passed, so the pass rate is 56.5%. And another 18,614 units did not pass. The remaining 80 units were skipped.

Once you look at this pass rate clearly, you will find that its tests did not all pass at all. And the units that did not pass account for more than forty percent. In the score file, SQS has 1,523 units in total. Of those, 1,032 passed, so the SQS pass rate is 67.8%.

![Nobody read the code. Where does the trust sit? Three teams write the tests, find the problems, and fix the problems; every change has to pass the merge gate's four checks; every release publishes its fidelity scores; and before you use it, you check how many units the services you use passed, and how many they failed.](./diagram-aws-emulator-en.png)

Some other services have much lower pass rates still. For example, not one of CloudFront KeyValueStore's 56 units passed. And EndUserMessaging's pass rate is only around 3%. EventBridge v2's pass rate is also only around 3%.

Even if a service passed everything in this file, you still cannot directly infer that this service has no problems at all. Because fidelity tests can only cover the scenarios that the test writers have already written out. So behavior that was never written into the tests will not show up in the score file at all. Error details and edge cases are the same: if they were not written into the tests, they will not show up.

The four steps I did on SQS at the start — creating a queue, listing queues, sending a message, and receiving a message — follow the same logic. The fact that all four steps went through only proves that these four operations returned the expected results on the emulator. The other operations that were not tested still need to be checked by you separately.

## Why AWS pulled it off, and my project failed

This lines up exactly with my earlier experience of leading agents to build a game. That effort lasted two months, and the local tests kept passing the whole time. But as a whole, the game kept getting further and further away from playable. So in the end I had no choice but to tear it down and start over. I posted the full retrospective of that experience here: https://x.com/alexlee20122022/status/2120832897825529896

Looking at the two experiences together, why did I fail, while AWS was able to build something usable with multiple agents developing in coordination?

The key is that AWS Emulator is an emulator to begin with, so the boundary of its scope was determined at the very start. It has real data to compare against, and it also has real interfaces to compare against. The input and output interfaces were both already set by the real system. No matter how large the amount of code gets, and no matter how complex the internal implementation becomes, an agent has a clear acceptance standard. That standard is to align the emulator's behavior with the real system.

Inside this boundary, the problem of direction drifting on its own barely exists. What it is more likely to leave behind is another kind of problem: for example, duplicated code and duplicated logic written in large amounts, problems with internal performance, and possibly quite a few security problems as well. But at the very least, drifting direction will not drag it down to the point where it cannot run, because every result can be checked against the real system.

My project was completely different. Hanmo Xingji was developed from zero, with no ready-made real system to refer to, and no real data or real interfaces to compare against. The project's boundary was not held in place by a system that already existed, and all I had in my hand was a design document. In order to reach the design goals, the agents would drift without realizing it in the course of implementing them. Going on this way, the whole direction could end up deviating.

## Two things to deal with before you use it

There are two more things you need to deal with first before you use this emulator. The first one is telemetry. Telemetry is on by default. So when I started it up, I added --telemetry off to turn telemetry off. And you can also turn telemetry off through an environment variable. You can also turn telemetry off through a configuration file.

The second one is its use. The README states clearly that it is only for development and testing use. So do not use it to run production workloads. And do not use it to test security problems. Also, this repository does not accept PRs. So after you discover a problem, your only option is to report an issue.

## Do two concrete checks before you switch your everyday testing over

If you plan to use it in your own project, I suggest you first do two concrete checks. First, download the v1.0.322 score file. Then only check the few services that you truly use yourself. You need to see clearly how many units each service passed, and you also need to see clearly how many units each service failed.

Next, pick out the few scenarios that your project uses every day. Run those scenarios on real AWS once each. Then run the same scenarios on the emulator once each. After you have checked the responses and the errors from both sides against each other item by item, then switch your everyday testing over to the emulator.

I will keep writing about projects that I have installed and tested with my own hands, and I will lay out the numbers I measured clearly in the article. If you also write code with agents, and this article helped you read the numbers in tests a little more accurately, you are welcome to subscribe to this blog, or save it for later.
