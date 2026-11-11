---
pubDatetime: 2026-11-10T13:39:00-08:00
title: "Meta's new Muse Ember costs $0.14 per task, while Haiku 5.5 costs $0.41"
description: "Meta released Muse Ember on November 9. It shares Haiku 5.5's per-token price list ($0.10 input and $0.50 output per million tokens), yet Artificial Analysis measured $0.14 per finished task for Ember against $0.41 for Haiku 5.5, because Ember writes about a third as many output tokens per task and its cached input is about 60% cheaper. The catch: a single request over 200,000 input tokens bills the whole order at 3 times the price. Judge a model by what one finished task costs, not by the price list."
tags: ["ai agents", "llm"]
lang: en
ogImage: ./cover-meta-ember.webp
translationKey: meta-ember-cost-per-task
xPost: "https://x.com/alexlee20122022/status/2120375671775973380"
---

When you choose a model for an agent, do you look first at the price list per million tokens, or do you first work out how much it costs to run one task to completion? The two questions differ only in how they are phrased, but the answer about which model is cheaper can differ severalfold.

On November 9, Meta released Muse Ember. It was distilled from Muse Wonder Full, and it is meant for the tasks that an agent runs again and again every day, such as tool calls, coding subtasks, and long-document parsing.

Ember's price list looks like this: when the input in a single request does not exceed 200,000 tokens, input costs $0.10 per million tokens and output costs $0.50 per million tokens, while cached input costs $0.004 per million tokens. But Haiku 5.5's input and output prices are exactly the same, and its input also costs $0.10 while its output also costs $0.50. So, if you look only at the price list, then the two models cost the same.

Artificial Analysis used a different way to measure them: it does not look at the price list, but instead it has each model actually run the same set of tasks, and then it records how much each task actually cost.

On its intelligence index, Ember and Haiku 5.5 both scored 36, but the price per task differed nearly threefold: Ember cost $0.14, and Haiku 5.5 cost $0.41. Muse Spark 1.3 scored a little higher, at 37, but it costs $2.39 per task, and that amount is 17 times what Ember costs.

Since the price list is the same one, why can the bill differ threefold? Because the bill is not charged according to the unit prices on the price list, but according to how many tokens you actually use, and the two models use different amounts. The difference shows up first in the output: Ember writes only about 1/3 as many tokens per task as Haiku 5.5 writes, and the unit price for output is 5 times the unit price for input, so the part of the bill that comes from what the model writes out can already differ by a large amount.

Apart from the output, the bill also differs on the cache item. Each time a repeated task runs again, it has to read the same context again, and if that context is already cached, then the reread is charged at the cached input price. The price for Ember's cached input is cheaper than the price for Haiku 5.5's cached input by about 60%, so the more times a task repeats, the more the cache saves on the bill.

![Billed per task, where the bill diverges: you run an agent on repeat tasks every day; the price list is the same at both, input 0.10 and output 0.50; Ember's usage is about one third the output tokens per task, with cache about 60% cheaper; so the bill comes to $0.14 per task for Ember, while Haiku 5.5 is $0.41. A side note gives the tier condition: a single request with input over 200,000 tokens is billed at 3 times for the whole order. Remember: to judge whether a model is expensive, look at what it costs to finish one task.](./diagram-meta-ember-en.png)

Suppose you have an agent run the same task 1,000 times every day, and then you multiply the price per task by that number of runs: Ember comes to $140 per day, Haiku 5.5 comes to $410, and Spark 1.3 comes to $2,390. This multiplication is my own arithmetic, and it is not a bill published by anyone.

Meta also cited a set of AutomationBench numbers in its launch post. This benchmark tests whether a model can run a whole set of business workflows from start to finish, and its pass@1 percentage is the share of workflows that it completed end to end: Ember completed 37.8%, while Haiku 5.5 completed only 13.9% (these are numbers that Meta cited in its launch post, and I did not re-run them myself). The two models ran the same set of workflows, and Ember completed a higher share of them, so Ember is cheaper per task not because it does less work on each task.

But this lower cost comes with a condition, and the condition is written in the tiers of the price list. Ember's context can hold 1,000,000 tokens, but the fact that it can hold that much does not mean that it stays cheap all the way. If the input in a single request exceeds 200,000 tokens, then the whole order is charged at 3 times the price instead: input costs $0.30 per million tokens, output costs $1.50 per million tokens, and cached input costs $0.012 per million tokens.

So do not put a whole code repository into a single request at once, and cut the material into smaller pieces first before you feed it in. Because once you cross the line, the whole order is charged at 3 times the price, and the first 200,000 tokens rise in price along with the rest. If you really need to feed in a long context, then you should first work out whether the request is still worth it after its price has tripled.

How you set up agents should change along with this as well: you should build the two kinds of tasks separately. You should hand the tasks that repeat every day to a model that is cheap per task, such as Ember, because those tasks are large in volume and they run many times every day, so even if you save only a little on each one, the savings add up to the main part of the bill. The really hard judgments come up only a few times a year, and when one does come up, you should leave it to a stronger model such as Wonder or Spark, because if a judgment goes wrong once, then the loss is much larger than the token money that you saved.

My advice is that you should not rush to switch yet. You should first pick one repeated task that you run every day, and then you should have Ember and the model that you use now each run it once. After both models have finished running it, you should compare how much each side cost, and you should decide whether to switch only after you have made that comparison. Because a price list can tell you only how much each token costs, while how much you actually have to pay becomes clear only after the task has finished running.

If this piece was useful to you, consider subscribing to this blog or bookmarking it. I will keep sharing things about AI, security, and open source that I have checked and used myself. When the next new model is released, I will still work out how much it costs to run a task to completion first, and only then will I look back at its price list.

Source: Meta's official launch post, at https://x.com/finkd/status/2119851180948152590
