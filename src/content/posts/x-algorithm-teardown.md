---
pubDatetime: 2026-10-31T16:30:00-07:00
title: "The Latest X.com Recommendation Algorithm Code, Decoded and Tested: 'Second Post at 62.5%' Is a Misreading"
description: "I checked X's public For You recommendation code line by line (baseline 5ed7963, plus October snapshots through 606b254): which viral claims — 'second post of the day drops to 62.5%', 'one author reply equals 150 likes', 'links are safe in the first reply' — have code behind them, and which are misreadings. Plus 49 open questions, the research scope, and full sources."
tags: ["X", "Recommendation Algorithm", "Open Source"]
lang: en
translationKey: x-algorithm-teardown
---

The Latest X.com Recommendation Algorithm Code, Decoded and Tested: 'Second Post at 62.5%' Is a Misreading

A quick note on length: this is the full research version — about 75,000 words, every claim checked against the code. If that's too long, start with the guide version I posted on X (the 13 practical rules: https://x.com/alexlee20122022/status/2116713031002390528), or skip straight to the ready-made skills I built from it: https://github.com/alexliyu7352/for-you-skills — the handbook's conclusions, packaged as skills you can call directly.

Start with a trap everyone steps into daily: a post carries four images. The first is your carefully designed cover (say it reads "the three findings from this test"), and only the fourth image holds the actual results table. Which image do you think the recommendation system's AI reads first?

Open the V8.2 content-understanding code (`renderer_v82.py`) in X's public algorithm repo (`xai-org/x-algorithm`), and the `_collect_post_media` function — the one that picks images — gives a blunt answer: it checks the images one by one starting from the first, and **the moment it meets the first image with usable content, it `return`s on the spot (hands back the result and stops; it never reads further down)**. In other words, when all four images open normally, this branch takes only your first cover image. If that cover carries nothing but an empty headline like "the three findings from this test," the core test data in the fourth image never gets sent in at all in this round of image selection. [1](#ref-1)

Follow the code further into posting frequency and you hit another widely circulated rule of thumb: "the second post of the day keeps only 62.5% of its weight; post at most two or three pieces a day; wait four hours and the weight recovers." The number `0.625` really can be computed from the code — but the program never counts "how many posts you published today." What it actually counts is: **inside the single batch of candidate posts pulled for one reader's one refresh, the post by the same author is the author's nth post in that batch**. The moment you mistake "rank position inside one candidate pool" for "a daily posting quota," everything derived from it — "at most two or three long pieces a day," "four hours must pass between posts for the weight to recover" — loses its basis in the code. [2](#ref-2) [3](#ref-3) [4](#ref-4)

Grasp these two things and your posting moves change right away: the first reminds us to watch the lead image's information load on multi-image posts; the second lifts a burden — no need to let a misread number dictate your posting schedule. Keep reading down through the source and you'll find a string of further truths that bear directly on day-to-day operation: how do readers' bookmarks quietly help a post pull people in during later recommendations? Why is an important correction added directly under an old post something the original readers may never scroll to on their home timeline? Which interception gates does tapping "Repost" on your own old post run into? And when an account's reach suddenly halves, which backend record did the officials leave in the code so we can look up the cause ourselves?

This piece checked X's public For You recommendation code in full. The original baseline is pinned at commit `5ed7963`, and I traced back through 20 historical parameter snapshots from October, all the way to the latest public commit `606b254` (revised on October 29, 2026). The source code can prove the system's processing conditions and boundaries; the writing and operating advice in the text is my own inference drawn from those code facts. The worked arithmetic examples in places are there to help you see the formula logic intuitively — they are not online growth experiments on real accounts. And wherever the public code hasn't disclosed something and only online logs or experiment data could settle it, I've put all of it, without holding anything back, into the list of 49 still-open questions at the end. [5](#ref-5)

## 1 Which of the claims circulating online actually have a basis?

Before checking the rumors one by one, let's sort out, in plain words, the three common posting formats on X, so nothing gets attributed to the wrong format later:
- **Long Post (Longer Post)**: still an ordinary post at bottom; membership simply raises the character limit to 25,000 characters;
- **Article**: a column piece published with the dedicated article editor, supporting multi-level headings, embedded images and video, and quoted posts; once published it lands in the Articles section of your profile;
- **Thread**: a chain of posts where you reply to yourself one after another (in this piece I call it a thread throughout; "a three-post thread" means three posts linked head to tail inside one Thread).

The three formats' underlying data structures, content-reading paths, and front-end display logic are entirely different — never force one shared "how many posts" rule onto all of them. [6](#ref-6) If you're torn over whether a finished deep-dive should go out as a "long Post" or an "Article," you can skip ahead to the ["Long post or Article?"](#post-or-article) chapter further down — there I take apart and check the body truncation, the reading timer, the 64-like image-pull threshold (`is_high_fav`: an Article's body images are only fully pulled once they reach that level of heat — details later), the V5 vs V8.2 reader differences, and the visibility rules, and I give a publishing combination you can copy directly.

Most of the viral X-algorithm guides online trace back to third-party analysis pieces by Hootsuite, the X Algorithm Playbook, Gridlok, SocialPilot, and Bangerkit. We'll first set the most widely circulated claims side by side with the source-check verdicts in two master tables and reconcile the accounts; then we'll peel open the formulas, code, and boundary conditions underneath them, layer by layer. [7](#ref-7) [8](#ref-8) [9](#ref-9) [3](#ref-3) [4](#ref-4)

| Claim in a public article | Verdict after checking the code |
| --- | --- |
| Post 2–3 items a day.<br>Hootsuite | The original text is just day-to-day operating advice for ordinary social posts; it never wrote the limiting words "at most" or "long pieces." The public recommendation path also can't prove an algorithmic cap of "at most two or three long pieces a day." |
| The second post of the day keeps only 62.5%; at most three posts; four hours apart.<br>X Algorithm Playbook | It mistook "the same author's rank position inside one refresh's candidate pool" for "the number of posts published across the whole day." The source formula governs only same-pool competition; no schedule of three posts a day or recovery after four hours follows from it. |
| Mix short posts between long ones.<br>Common operating advice | Officials do support using short teasers and article excerpts to drive traffic to a long piece; but the public same-author decay counter recognizes only the author ID — inserting a short post in between doesn't zero it or reset it. These two rationales must be kept apart. |
| Split a long piece into a three-post thread.<br>Common operating advice | There is front-end display basis: the official explanation and the conversation assembly code (`convo_marshaller.rs`) both involve the "three posts" structure. But the scoring code holds no formula that gives a three-post thread an extra bonus, or docks a fourth post. |

On engagement weights, link penalties, and small-account cold start, several more hard-to-judge rules of thumb circulate online: [7](#ref-7) [9](#ref-9) [10](#ref-10)

| Claim in a public article | Verdict after checking the code |
| --- | --- |
| The model predicts whether the reader will engage, then weights and ranks.<br>Bangerkit | **Fully holds.** The predicted probabilities are computed in real time for "this specific reader scrolling the home timeline right now" — not a site-wide piece-rate score table for engagement. |
| After the reader replies, the author replies back; one round trip is worth 150 likes.<br>Gridlok | **Wrong generation, and the concept is wrong too.** Not only did it lift the retired April 2023 weights (`75 ÷ 0.5 = 150`), it also mistook "multiplying a predicted probability" for "multiplying the actual count of engagements." |
| External links cut reach by a fixed 30–50%; putting the link in the first reply avoids it.<br>Gridlok | **False.** Searching the whole public scoring path turns up no "links cost 30–50%" formula; and the latest v2 link-review bot has deleted the "exclude replies" exemption — a link tucked into the first comment gets checked just the same. |
| A small author's new post gets an exploration chance, involving two hours, 50k followers, and 200 Home impressions.<br>Bangerkit | **The main conditions do have code basis** (`author_cold_start.rs`), but several eligibility conditions and a sampling-selection step must all hold at once; and the 200 is an internal Home-impressions ceiling threshold, not the system handing you 200 viewers as a guaranteed floor. |
| Premium gets a 4x / 2x algorithmic boost in-network / out-of-network.<br>Gridlok | The For You public path checked so far can't confirm this fixed set of multipliers. The official help page does state that subscribers get "reply ranking priority," but that is not evidence of a 4x / 2x multiplier on the main timeline. |

### 1.1 In the October updates, which claims were overstated?

The run of code updates in October 2026 really did focus on "dwell reading-time prediction (CREAD)" and "the recall training that gets good articles read to the end (the `ld` branch — ld = Long Dwell, deep-reading dwell)." But the second-hand summary posts online habitually blur together **model training targets, index inclusion conditions, ranking weight coefficients**, and **the reach finally obtained**. We take these 12 hot October rumors apart, back to the code module each belongs to, and here is the truth:

| Circulating claim | Check result and the conditions that must be kept |
| --- | --- |
| Oct 8 improved dwell prediction; Oct 13 added reading recall | Supported by the official README update notes and the Git commit history; but the README announcements were written in after the fact, and no public, reproducible online evaluation data states by what percentage the prediction improved. |
| The like coefficient is 0.66; the dwell coefficient rose 50% | Fully supported by the historical snapshots of the same parameter file (`home-mixer/params/param.rs`); but this is the public weight coefficient multiplied onto predicted values (`0.004` rising to `0.006`), not a per-view booked score, and it doesn't mean reach rose 50% in step. |
| A finished article can now win twice | The reading dwell signal really does take part in both "step one, recall pulling candidates (the `ld` branch)" and "step two, scoring and ranking (the dwell weight)"; but the front-end event definition of "read completely to the end (100% completion)" is not public, and there is no promise of doubled reach. |
| Within two hours, 200 views, under 50k followers — new posts get pushed | A small-account cold-start mechanism really exists (cold start = the stage when a post has just gone out and the system doesn't know it yet, so it gets a small batch of impressions to test the water); but "published ≤ 2 hours" and "Home impressions < 200" must hold at the same time, plus conditions like originality, not being in the bottom 3%, and Thompson sampling (a random sampling method that learns as it tries; Chapter 21 explains it through a lottery) — and what counts is the internal `view_count_on_home`, not the front-end total view count. |
| New posts are no longer cut first | The `FairShareRankingFilter`, enabled on October 22, really did switch to allocating 2,800 scoring slots in proportion to candidate sources; but what it protects is "sources like cold start entering in proportion," not a death-proof pass for every new post — posts ranked behind inside a source still get cut. |
| Only originals can reach strangers | The ordinary home timeline's out-of-network filter (`OONRetweetReplyFilter`) really does block ordinary reposts by authors you don't follow; but if a big account in your circle reposts your piece, then for that big account's followers your post is an "in-network candidate" and can still reach strangers who don't know you. |
| The 1st and 32nd likes open a new traffic pool | The `1fav` and `32fav` indexes and the powers-of-two update thresholds really exist; but writing to an index, updating it, recall from it, and final reach are four different things — and for ordinary posts, no consumer reading `32fav_1day` has yet been found in the public For You code tree. |
| Bookmarks score zero; video views score zero | A direct coefficient of 0 on one line of the main scoring table never means the whole system ignores the signal: bookmarks serve as `SimClusters` similarity-recall seeds and as positive examples for immersive (immersive = the full-screen way of browsing, tapping a video or image open full-screen) recall training; video also has an open weight, dwell prediction, and a dedicated video index pipeline. |
| A mutual-follow reply is worth 20; the second post keeps only 62% | Both numbers have exact formula sources: the first (`5 + 15 = 20`) acts only on the reply prediction for non-reply, non-repost originals in front of mutual-follow readers; the second (`0.625`) is computed from the same author's rank position inside one candidate pool — absolutely not a daily posting quota. |
| A video must pass ten seconds to make the list | Three core immersive video indexes (`1fav_video`, `video`, `nsfw_video`) really do require a duration **strictly greater than 10,000 milliseconds (> 10 seconds)**; but a 5-second video can still enter the ordinary `1fav` post index — you can't say short videos have no eligibility site-wide. |
| Any account label ends stranger reach | Designated account-level safety labels (such as `SPAM_HIGH_RECALL`, `NSFW_HIGH_PRECISION`) really do block stranger recommendation at `HomeRecommendations`; but you have to look at the label type, the audience scope, the checking entrance, and the 7-day validity — no blanket statements. |
| After two days, For You never shows it again | The ordinary candidate pipeline's `AgeFilter` really does keep only candidates ≤ 48 hours old; but it computes the age from the current candidate's own `tweet_id`, and a recent repost carries a brand-new `tweet_id` — you can't declare total site-wide expiry from the original post's age alone. |

## 2 "The algorithm changed today" — which day, and which change?

When you see an overseas creator exclaim on X that "X changed the algorithm again today!", that sentence can correspond to three entirely different situations: officials may have just added a passage to the README's update notes; the public repo may have just merged a new Git commit; or an online gradual-rollout experiment (a gradual rollout = a trial released to a small slice of users first) may have flipped a switch. To keep from being swept along, the first step is to pin "today" to a specific commit time and code line. The two core code snapshots this check uses have these exact times: [11](#ref-11)

| Public commit | UTC time | Los Angeles time (PDT, UTC−7) | Use when reading |
| --- | --- | --- | --- |
| 5ed796374ea48ee26058aab66ab10c266bea2bef | 2026-10-28 02:49:03 | 2026-10-27 19:49:03 | The main code-check baseline this report is pinned to |
| 606b254b45be798bfaecfa8c23f5a9c51bc8000c | 2026-10-29 02:57:55 | 2026-10-28 19:57:55 | Checking what the latest public snapshot added or changed in parameters and switches |

Source [11](#ref-11)

See: the `606b254` commit is already the early hours of October 29 in UTC world time, but in Los Angeles, California local time it's still 7:57 PM on October 28. So judging whether the "today" in someone's post is accurate starts with the poster's timezone and the specific change he means. More important: **a Git commit time only proves when this code snapshot was made public — it cannot by itself prove that some online experiment covered every user site-wide in that very second**. [11](#ref-11) [12](#ref-12)

Line up October's key changes from the official announcements and the public snapshots in time order, and one table shows which ones really changed code parameters and which are over-extrapolations:

| File date or public snapshot | Level of the change | What can be checked | What can't be directly inferred |
| --- | --- | --- | --- |
| Official update note: 2026-10-08 | The ranking model's dwell-time prediction | The README states the dwell-time estimate improved; the configuration that carries a formal name in the code (a "named" configuration) and the loss function show CREAD's 30-threshold logarithmic split method | Every long piece gets a fixed bonus, or site-wide long-form reach rose by some fixed percentage |
| Official update note and public snapshot: 2026-10-13 | Recall training and some Home Mixer coefficients | The two-tower recall added an `ld` branch (using dwell events as positives); on the same path, the continuous dwell coefficient rose from `0.004` to `0.006` | Every "finished reading" event equals reading 100% to the very end of the text, or `0.006` is a booked score for each actual read |
| Public snapshot: 2026-10-14 | Home Mixer default coefficients | `Favorite` rose from `0.6` to `0.66`; `Not interested` changed from `-47.52` to `-52.272` | The like has become the largest-weighted coefficient among all engagements (in fact it's far smaller than Copy link's `20` and Reply's `5`) |
| Public snapshots: 2026-10-21 / 22 | Candidate pre-screening before model scoring | The `FairShare` filter was written into the code on 10/21 but defaulted off; the 10/22 snapshot flipped its enable switch to `true` | No new post will ever be deleted, or every new post has a guaranteed traffic pool |
| Public snapshot: 2026-10-28 UTC | Page records and an optional ranking path | `5ed7963` added three public parameters — page logging, page decode, and page RL exploration — with all enable switches defaulting to `false` | Just because a new function appeared in the code files, every reader site-wide was already using it that day |
| Public snapshot: 2026-10-29 UTC | Records, the video Carousel, and named training configs | `606b254` flipped page logging to `true`; added the `open × immersive dwell` product term and the `immersive_page_rl_cread` config | Turning on logging equals changed ranking results, or the new video term has already paid a traffic dividend to all videos |

Source [11](#ref-11) [13](#ref-13) [14](#ref-14) [15](#ref-15) [16](#ref-16) [17](#ref-17)

Comparing the two snapshots, `5ed7963` of October 28 and `606b254` of October 29, confirms: the Home Mixer default weight coefficients we care most about — like (`Favorite`), reply (`Reply`), copy link (`Copy link`), continuous dwell (`ContDwellTime`), and the various negative penalties — **did not change at all** between those two days. What changed in the same period was model configuration, logging switches, and some rule restructuring. So "this set of core scoring coefficients didn't change" is accurate; but "the whole algorithm didn't change a single character" would be wrong. [15](#ref-15) [17](#ref-17)

### 2.1 The new video formula is written into the code, but the default switch isn't on yet

The most typical example: in the October 29 (`606b254`) video carousel scoring code, `video_carousel.rs`, the programmers really did add a new multiplication formula — "the predicted probability the video gets opened (`video_open_score`)" times "the dwell time predicted on the immersive path (`immersive_dwell_time`)," times a new coefficient, `VideoCarouselOpenTimesImmersiveDwellWeight`.

Sounds like an epic buff for video, right? But flip to the companion parameter file, `param.rs`, and you'll find: **in the public defaults, this new coefficient's value is `0.0`, and the video carousel's master switch `EnableVideoCarousel` is still `false` (off)!** That tells you the code merely built the formula's frame in advance — seeing a code update is no basis for declaring "from October 29, all videos receive new preferential treatment by watch time." [17](#ref-17)

```text
# Restatement of the formula, not verbatim source
carousel_score =
    video_open_weight * video_open_score
  + immersive_vqv_weight * immersive_vqv_score
  + open_times_immersive_dwell_weight
      * video_open_score * immersive_dwell_time

# 606b254 public defaults:
# EnableVideoCarousel = false
# VideoCarouselOpenTimesImmersiveDwellWeight = 0.0
```

Source: [17](#ref-17)

The same commit also added a reinforcement-learning training config named `immersive_page_rl_cread`. From the source we can pin down which training targets it uses, but a config file landing in the repo is no basis for concluding that every online user has already switched to this new model checkpoint — that would take online deployment records, traffic-bucket configuration, and experiment data. [17](#ref-17)

## 3 What steps does a post go through before it appears on the home timeline?

Many creators get dizzy from all the algorithm rumors because in their heads the recommendation algorithm is a level-clearing game: you publish a post, the system builds it a score card, someone likes it for +1, reposts it for +2, and once you've saved up enough points you level up into the next traffic pool. **The real code doesn't run anything like that!**

The real recommendation happens **inside the one request when a given reader pulls down to refresh the For You home timeline**. To make every code rule below fully clear, let's first split what happens in that one request into four core steps: [5](#ref-5) [18](#ref-18) [19](#ref-19) [20](#ref-20)

1. **Step one: fetch candidates (into the temporary basket / Retrieval)**
When reader Zhang San pulls down to refresh the home timeline, the system sends out several "buyers (candidate Sources)" at once to fetch posts he might like from different warehouses — for example, the `Thunder` buyer fetches "posts just published by people Zhang San follows (in-network)," the `Phoenix` buyer fetches "stranger posts Zhang San doesn't follow but the AI thinks he'll like, based on his recent reading history (out-of-network)," and `SimClusters` fetches "posts buzzing in communities of fellow enthusiasts, or similar to what Zhang San bookmarked." Together these buyers fetch several thousand posts and dump them all into a **temporary candidate pool (the temporary basket) prepared specially for Zhang San's one refresh**.
2. **Step two: pre-screening and eligibility filtering (Pre-scoring Filters)**
Among the several thousand posts, many can't be served straight to the table: posts Zhang San has already scrolled past before (`previously_seen_posts_filter.rs`), old candidates over 48 hours (`age_filter.rs`), authors Zhang San has blocked or muted (`author_socialgraph_filter.rs`) — all get picked out and thrown away here; if too many posts still remain (over 2,800), the ticket checker `FairShareRankingFilter` further allocates 2,800 entry tickets in proportion to the quantities the buyers delivered.
3. **Step three: compute predicted scores and seat them (Scoring & Ranking)**
Posts entering the scoring room are examined one by one by the AI models (Phoenix and the Value Model — the value model, the model in charge of estimating scores for the candidate posts and ranking them, shortened to VM Ranker below), which **predict (bet) in advance**: "If we show this post to Zhang San now, how likely is he to like it, reply, copy the link, tap in and read closely — or tap Not interested?" Multiply those predicted probabilities by their weight coefficients and sum them, then apply adjustments like the **same-author `0.625` diversity decay** and the **small-account cold-start promotion**; the resulting total is called the **ranking score**.
4. **Step four: post-selection dedup, visibility checks, and card assembly (Post-selection & Marshalling)**
After the top winners are picked by score, the system also dedups the same conversation (`DedupConversationFilter`), checks safety and visibility labels (Visibility Filtering), and finally the interface assembler (such as `convo_marshaller.rs`) assembles the chosen post together with its quoted original, at most 1 intermediate conversation ancestor, and interspersed ads into the home feed you see on screen. [5](#ref-5) [18](#ref-18) [19](#ref-19) [20](#ref-20)

Look: the **same-author `0.625` multiplier** happens in step three, "scoring and ranking"; the **three-post thread truncation** happens in step four, "interface card assembly"; and **a new reply added under an old post getting filtered** happens in step two, "already-seen checking." With this map in your head — "temporary basket → filtering → compute predicted scores → assemble cards" — when we get to post counts, threads, and supplementary updates below, you'll never again confuse which segment each one governs.

## 4 The same author's second post gets multiplied by 0.625 — what is the program actually counting?

First, the most widely spread one: "post at most 2–3 pieces a day; the second is discounted to 62.5%." Hootsuite's 2025 social media guide really does advise business accounts to post 2 to 3 items a day. But check its English original and you'll find it's talking about a day-to-day operating cadence for ordinary posts — it doesn't restrict this to "long pieces," and it never says "exceeding three posts gets algorithmically punished with a demotion." Passing someone's day-to-day operating advice down the line as "the platform's hard algorithmic cap" is pure distortion through retelling. [3](#ref-3)

Another widely cited guide, the *X Algorithm Playbook*, actually explains it correctly in its first half: multiple posts by the same author, if they meet inside **the same recommendation response (the same temporary basket)**, get sorted by score and discounted in sequence. But in its summary table near the end, the author quietly swapped the scope into "your second post within one day keeps only 62.5% of the weight," and derived "at most three posts a day, at least four hours apart" from that. SocialPilot's guide makes the identical mistake in its claims about a "daily per-author posting quota." [4](#ref-4) [8](#ref-8)

Open the source of `xai-value-model/scoring.rs`. The core code computing the "Author Diversity Multiplier" is a single line: [2](#ref-2)

```rust
(1.0 - floor) * decay_factor.powf(exponent) + floor
```

Plug in VM Ranker's public defaults, `decay_factor = 0.5` (decay rate) and `floor = 0.25` (floor value), and the math is: [21](#ref-21)

$$
m(k)=0.75\times 0.5^{k}+0.25
$$

The exponent $k$ starts counting at `0`, and it means: **inside the one temporary candidate pool (temporary basket) this reader just refreshed, where this post ranks among posts by the same author (same `author_id`) when sorted by score, highest first**:

- Your top-scoring **1st post** in this basket ($k=0$): multiplier $0.75\times 0.5^0 + 0.25 = \mathbf{1.0}$ (no discount at all);
- Your **2nd post** in this basket ($k=1$): multiplier $0.75\times 0.5^1 + 0.25 = \mathbf{0.625}$;
- Your **3rd post** in this basket ($k=2$): multiplier $0.75\times 0.5^2 + 0.25 = \mathbf{0.4375}$;
- Further down, the multiplier steps ever closer to the floor of **`0.25`**. And since seating inside the current basket is by preliminary score, highest first, even if the post you published this afternoon is newer than the one from this morning, if the afternoon post has the highest predicted score it still takes the same-author first seat and the `1.0`. [2](#ref-2)

People ask: **"Why would two of my posts, A1 and A2, land in the same reader's temporary basket at the same time? And how does the 0.625 actually move the ranking?"**
Let's run the numbers on follower Zhang San scrolling his home feed. Say you posted A1 at 10 a.m. and A2 at noon. Zhang San was busy at work all morning and never touched his phone; at 1 p.m. he opens X for the first time today and pulls to refresh. Since he has seen neither A1 nor A2, the buyers pull in your A1 (predicted score `1.0`, say) and A2 (predicted score `0.9`), plus another author's B1 (predicted score `0.8`), all into Zhang San's temporary basket. Looking only at the author-diversity multiplier step (everything else held fixed), the scores come out:

| Candidate | Score before multiplier | Author multiplier | After adjustment |
| --- | --- | --- | --- |
| Your A1 | 1.0 | 1 | 1.0 |
| Your A2 | 0.9 | 0.625 | 0.5625 |
| Someone else's B1 | 0.8 | 1 | 0.8 |

Look at that: your A2 (`0.9`) originally outscored B1 (`0.8`), but inside Zhang San's basket A2 is your second post, so it takes a `0.625` same-author decay and lands at `0.5625` — and B1 (`0.8`) overtakes it. The example shows the intuition clearly: inside one recommendation request, several of your unread posts entering the pool together really do compete with each other for position. (How much total reach A2 loses site-wide still depends on other candidates' scores and later steps; you can't treat `0.625` as "37.5% of all reach gone.")

**But here is where it turns — switch readers to Li Si, and everything changes.**
Say Li Si scrolled his phone at 11 a.m. and already saw your A1. When Li Si opens X again at 1 p.m. and refreshes, A1 is already on Li Si's "seen list (`seen_ids`)," so it gets filtered out back in step two and never enters his 1 p.m. basket at all. His basket now holds only your noon post, A2 — so for Li Si, A2 is your same-author 1st post ($k=0$), and it is computed at **`1.0`** (first post by the author, no discount).

Every time this function handles a reader's refresh request, it builds a fresh temporary author-count table (HashMap) from zero. Its only inputs are each candidate's `author_id` and current ranking score. There is no global counter anywhere in the code for "how many posts you've published today." [2](#ref-2)

Of course, firing off several posts in a tight burst does make it more likely that the same batch of not-yet-online readers will pull several of your posts into one basket on refresh. And if you dig through the repo, you can indeed find, in a file for a recall source called `PopularPosts` (`popular_posts.rs`), a line like: "by default, select at most 5 posts per author from the last 24 hours." But note carefully: **that is one single supply channel's own local selection cap**. The channels that do the heavy lifting — the following feed (`Thunder`) and the AI recommendation feed (`Phoenix`) — have no such 5-post limit, and it must not be read as a site-wide rule of five posts a day. [22](#ref-22)

So spacing two posts a few hours apart can be a reasonable operating choice for your readers' digestion rhythm. But if anyone tells you "the algorithm says a full four hours resets the cooldown timer and restores your weight," ask them to produce the timer's code — because this function in `scoring.rs` neither watches a clock nor resets at midnight. My own working rule is simple: if two drafts on my desk keep making the same point, merge them into one post and write it through. If the next post has genuinely new test data, a new question, or new progress, write it and post it the moment it's done. Retitling yesterday's leftovers changes nothing about the `author_id` over your head. [2](#ref-2)

### 4.1 Does inserting a short post between two long ones restore the weight?

Another common claim in creator circles: "Two long posts back to back lose weight, but slip a short post between them and the long posts' weight gets washed back."

We have to split two things cleanly apart. **First: does using a short post as a teaser or excerpt to drive traffic to a long post work? Yes, it works. Second: can a short post in the middle reset the same-author `0.625` counter in the algorithm? It absolutely cannot — it can even backfire.**

On the first: X's official Articles creator guide does recommend a "mix lengths" distribution play — before the long piece drops, post a short question or teaser to warm things up; after it drops,split its core conclusions or best passages into short posts or threads, with a link pulling readers back to the full text. But the official guide never demands a strict "one long, one short" alternation to serve the algorithm, and it sets no cap of two or three long posts a day, nor a mandatory three-post thread. [6](#ref-6)

On the second: the same-author decay function in the code recognizes only `author_id`. It does not care whether you posted a 20,000-character long piece or a ten-character short post. Let's run the same temporary basket with clear numbers — everything else fixed, your long post A1 scores `1.0`, your long post A2 scores `0.9`. Now you insert a short post between them, and that short post also lands in this reader's basket. We compute two cases: "the short post scores higher than A2 (say `0.95`)" and "the short post scores lower than A2 (say `0.5`)":

| Everything else fixed | A2's k | A2 multiplier | A2 adjusted score |
| --- | --- | --- | --- |
| No short post added | 1 | 0.625 | 0.5625 |
| Short post added, scoring 0.95 | 2 | 0.4375 | 0.39375 |
| Short post added, scoring 0.5 | 1 | 0.625 | 0.5625 |

The result is plain:

- If the inserted short post performs heroically (`0.95`) and seats itself ahead of long post A2 (`0.9`), then A2's position under your name drops from 2nd ($k=1$) to 3rd ($k=2$), and its multiplier falls from **`0.625` to `0.4375`**, leaving an adjusted score of just `0.39375`.
- If the short post scores low (`0.5`) and seats behind A2, or never enters this basket at all, A2 is still 2nd ($k=1$) and its multiplier is still `0.625`.

In neither case is there any logic in the code like "a short post appears, so the author counter resets to zero." (And the score changes in the table represent only this step's multiplier math; they do not translate one-to-one into final reach gains or losses.)

Take the topic "how to talk pricing with a client." Your long article can carry the full plan-comparison table, standard reply scripts, and the red-line situations where you decline the job. The companion short post can pick out the one concrete scenario readers dread most, say **"The client opens with 'the budget isn't enough' — which line items on the quote can be cut or deferred first?"** — and state the decision criteria and one real case right there in the short post, with the long piece's entry point attached at the end.

Two days later, the comments surface another new pain point: **"The client happily accepted the quote, but during delivery keeps adding endless small revisions — what now?"** That deserves its own new post, because it's a genuinely new, concrete question. By contrast, if you force out a content-free filler post purely out of superstition about "alternating lengths to wash the weight" — something like "Everyone must read today's piece, it's packed with value!" — not only does the algorithm wash away none of the decay, readers will just see spam.

### 4.2 Beyond the same author, similar content can compete in another selection round

Technically minded readers often push one level deeper: **"I hear that besides same-author decay, X has a DPP algorithm that filters similar content. Before posting, can I run my draft through an open-source model on my own machine, turn it into an embedding, check for duplicates, or swap in a few synonyms to slip past the check?"**

In `vm-ranker/scoring/dpp_model.rs` and `dpp.rs` there really is a **DPP (Determinantal Point Process) diversity-selection mechanism**. Its job, in requests where it applies (depending on DPP context, switches, and product conditions), is to weigh each post's **predicted score** together with its **multimodal content vector** and pick from the candidate pool a set that is both high-scoring and not colliding in topic. [85](#ref-85)

I built a simplified math example from the source logic: suppose the pool holds three posts with preliminary scores of `1.0`, `0.99`, and `0.8`. Posts 1 and 2 have completely overlapping content vectors (they say the same thing), while post 3's vector is fully orthogonal to both (a different, new topic). When DPP picks two, the winners are **post 1 (`1.0`) and post 3 (`0.8`)**. The code keeps the chosen posts' scores and sets the unchosen post 2's score — despite its original `0.99` — **directly to `0`**. One boundary worth adding: "zeroed" here means the score is pressed to 0 and the post goes to the back of the queue — not that the post is deleted from the system. If the whole pool lacks enough positive-score candidates to fill the slots, the later `top_k_score_selector.rs` can still fish a zero-score candidate back up as backfill. [85](#ref-85)

So why **can't you pre-embed your article on your own computer to check for duplicates**, and why won't "a few synonyms" fool it? Because the semantic representations X generates don't come from some general open-source text model you can download. They come from its internal Grox multimodal model (`grox/flows/mm_emb`), whose weights are not public, and the multimodal semantic ID is combined with a hashed author ID. (Hashing scrambles an ID into a fixed-length string of numbers — a fingerprint; the model recognizes the fingerprint, not the original name.) More to the point, a large multimodal model extracts deep semantics from the whole text and images — built exactly to defeat "same soup, different bowl." If you keep writing on one domain, rather than straining to rephrase one conclusion ten ways and swap synonyms, give each piece genuinely different test evidence, failure cases, or new use scenarios. When the content really has something new, the vectors separate on their own.

## 5 The "three-post thread" advice rests mainly on display

Why do so many creator tutorials, at home and abroad, chorus the same advice: "Write threads as exactly 3 posts"?

Start with the platform's own words. X's official help page, *How to create a thread*, states clearly: when you scroll past a thread from **an author you follow**, a thread of 2 to 3 posts usually displays connected, as one group, right on the timeline; at **4 posts or more**, the timeline truncates and folds the middle away, offering only a "Show this thread" tap target. Note that the help page describes "the ordinary display behavior for followed authors on the timeline" — not an absolute promise covering every recommendation surface. [23](#ref-23)

Then open the public algorithm repo, and in the interface-assembly module `home-mixer/util/urt/convo_marshaller.rs` we find hard code matching this "3 posts" exactly. The code defines a constant `NUM_INTERMEDIATE_ANCESTORS = 1` (keep at most 1 intermediate ancestor post), then assembles posts into home-feed conversation cards by this logic: [18](#ref-18)

```rust
const NUM_INTERMEDIATE_ANCESTORS: usize = 1;

let item_ids: Vec<u64> = root
    .into_iter()
    .chain(intermediates.iter().copied())
    .chain(std::iter::once(focal_id))
    .collect();
```

Plenty of non-coders stall at "root + 1 intermediate ancestor + the selected candidate (`focal_id`)": **"What is this for? What does it have to do with writing 3-post threads?"**

Rebuild it as the real scene of a reader scrolling a phone, and it clicks at once.
First, this code only goes to work **after scoring, ranking, and filtering are all finished**, so the scoring formula contains **no rule that bonuses a 3-post thread or penalizes a 4th post**. [18](#ref-18)
But there is a crueler truth creators routinely miss: **when your thread has several posts, the "winning post (`focal_id`)" the system finally selects to display on a reader's home feed is not necessarily among the first three — it may well be one of the last two.**
Upstream, the `Thunder` following source and the `Phoenix` reply-ancestor completion flow (`phoenix_reply_ancestors_hydrator.rs`) attach to a selected reply its "first root post (`root`)" and "the parent post it directly replies to (`parent`)." Suppose you publish one straight-line thread (1 → 2 → 3 → ...) and the final post wins the scoring and gets selected for a reader's home feed. I recomputed it locally, following `convo_marshaller.rs`, and here is how cards of different thread lengths assemble on the reader's screen: [18](#ref-18)

| Thread and the candidate selected this time | Post numbers this module assembles |
| --- | --- |
| Three posts total, post 3 selected | 1, 2, 3 |
| Four posts total, post 4 selected | 1, 3, 4 |
| Ten posts total, post 10 selected | 1, 9, 10 |

See how alarming that table is?

- If your thread has **only 3 posts**, when post 3 is selected the system takes "root (post 1) + 1 direct parent (post 2) + the selected post (post 3)" and serves the reader a card — and the reader sees the complete **`1, 2, 3`** on the home feed, setup to payoff, nothing missing.
- But if your thread runs to **10 posts**, when post 10 is selected the system still takes only "root (post 1) + 1 direct parent (post 9) + the selected post (post 10)" — and the conversation card the reader scrolls to on the home feed becomes a bizarre **`1, 9, 10`**. Every derivation and setup you labored over in posts 2 through 8 is **skipped, invisible, on the home card**. (This assumes a straight-line thread with the last post selected. Which post actually gets selected, whether ancestor data is complete, and whether anything in the middle was deleted all affect the result; a ten-post thread won't show `1, 9, 10` every single time. The core risk stands: **middle posts may, at any time, not be in the home feed's first-screen card.**)

Picture it: if post 9 opens with "So based on the analysis above, the answer is clear," a reader who only sees the `1, 9, 10` card on the home feed has no idea what "the analysis above" is. Flip it around and write post 9 as: **"When a website design quote exceeds the client's budget, step one is to shrink this delivery's page scope — build the home page now, leave the 3 inner pages to phase two"** — then even a reader who sees only `1, 9, 10` finds each post stating its problem and conclusion in full. So before publishing a thread, pull the important posts out and read them alone, and check whether a stranger can still follow them with the context stripped away.

### 5.1 Does a whole thread occupy only one author slot?

The *X Algorithm Playbook* also taught this trick: "Bundle multiple pieces into one Thread, and the whole Thread takes only 1 author slot in the algorithm, dodging the same-author `0.625` decay."

Check the source and you find there really is a `DedupConversationFilter` (`dedup_conversation_filter.rs`), a conversation dedup filter. Its job: among multiple candidates from the same conversation (same `conversation_id`), keep only the highest-scoring one, delete the lower-scoring siblings, and finally assemble the winner into one home-feed conversation card. [4](#ref-4) [19](#ref-19)

**But the devil is entirely in the order of operations.**
Open `candidate_pipeline.rs` and `phoenix_candidate_pipeline.rs` and check the execution order: the whole recommendation pipeline **first sends candidates into the scorers (Scorers, including VM Ranker) to be scored and selected (Selection), and only then runs the post-selection filters (`DedupConversationFilter` among them)**. And at the moment candidates go into VM Ranker for scoring (`vm_ranker_request.rs`), what the program passes over is still individual post IDs (`tweet_id`) and the identical author ID (`author_id`) behind them — there is no step that first bundles the whole thread into one candidate before counting authors. [19](#ref-19)

In plain words: **publish a 5-post thread, and as long as two or three of its posts clear the early filters together and land in the same reader's temporary basket, they first fight each other for slots in the scoring stage, genuinely triggering the `0.625` and `0.4375` same-author decay. Only after they have cut each other's scores down and a winner emerges does `DedupConversationFilter` come out and clean away the losing siblings from the same thread.** So a thread is a fine way to string a coherent topic together, but don't count on it to dodge same-author decay — and don't take a piece that belongs in one long Post and force-split it into a dozen fragmented threads to fight itself for weight.

### 5.2 A worked example: writing a three-post thread on one concrete problem

When you actually sit down to write a thread, beyond the "siblings fighting" and "middle floors folded away" issues above, there is a more practical threshold: **which post of your thread can a stranger who doesn't follow you (out-of-network) actually see?**

In the Phoenix recommendation candidate flow we checked, one filter handles out-of-network reposts and replies specifically: `oon_retweet_reply_filter.rs`. The switch inside it governing "whether replies from authors you don't follow may enter the recommendation feed," `EnablePhoenixOonReplies`, has a public-config default of **`false` (off)**.
Now, in a thread, apart from post 1 (the root), **every post from post 2 onward is, in data-structure terms, a "reply post" (`in_reply_to_tweet_id` has a value)**. Which means: with `EnablePhoenixOonReplies = false` as the default, posts 2, 3, 4 and beyond get intercepted right in this ordinary recommendation pipeline, and a stranger who doesn't follow you often gets the chance to see only your **post 1 (the root)**. Even if some live experiment flips that switch on, further conditions still apply — which recall source the post came from, root-node limits, and the like — flipping the switch doesn't open the floodgates. And this governs only the home-feed recommendation path: a reader who taps into the conversation page, or a follower of yours, can still see the later posts. [24](#ref-24)

Precisely because a stranger will very likely see only your post 1, if post 1 is nothing but a curiosity hook — "On how to talk pricing with clients, I'll lay it out in ten posts below, the last one is the key, keep reading 👇" — you have hidden all the real value in a back half the stranger can't reach. The stranger who sees only post 1 is baffled, and scrolls away.

If one concrete problem happens to suit a **3-post thread**, how do you write it so a stranger who sees only post 1 still takes away value, while a reader who opens the full thread gets the complete plan? Take "how freelancers handle a client who says the quote is too expensive" and write a three-post template you can apply directly:

**Post one (the root: lead with the core judgment and principle, no empty slogans)**:

> 1/3
> Client says "too expensive"? Don't rush to discount.
>
> Lay out what the quote includes: deliverables, revision rounds, and the delivery date. If the budget genuinely isn't there, then talk about which items to drop.
>
> Cutting price while still doing everything makes later add-on fees nearly impossible to negotiate.

**Post two (the middle: give a plan comparison readable at a glance, teach the concrete move)**:

> 2/3
> Take website design:
>
> Original plan: home page + 3 inner pages, 2 revision rounds.
> Reduced plan: build the home page this time; inner pages move to the next phase.
>
> Price the two plans separately, so the client sees which work the saved money corresponds to. Avoid "a bit cheaper, everything else the same."

**Post three (the last: add the boundary line, one copy-ready script, then a natural question)**:

> 3/3
> If the client insists "do everything, just lower the price," the problem is no longer the plan's size.
>
> You can reply: "At this budget, what I can offer is plan A. If neither the scope nor the timeline adjusts, I can't take it on at the original spec."
>
> When you hear "too expensive," is it usually a budget negotiation — or a demand for everything at a discount?

Look at these three: even if a stranger sees only post 1, he already has the core method — a price cut must come with a cut in delivery scope. If a follower scrolls to the `1, 2, 3` card on the timeline, post 2 shows how to split the pages, and post 3 hands over a ready-made refusal script. A single-pain-point closed loop like this fits a 3-post thread exactly. But if your content is a hardcore test report with five comparison charts and three counterexamples, honestly use one complete long Post or Article and lay all the evidence out at once; at most, publish a separate 3-post summary thread to drive traffic. Never delete key test evidence just to force the "3-post thread" shape.

One related debate online: "Do threads or single long Posts get better traffic?" Hootsuite's team ran a real controlled experiment in January 2024: one account published 3 threads and 3 single long posts in sequence. Each format produced one hit — a draw. But look at the conditions: the author had only just activated Premium during the long-post phase, the topics weren't fully matched, and the thread stats counted only the root post's impressions. Six samples make an interesting reference case; they prove neither which format is guaranteed to win in 2026, nor that "3 posts is the universal optimum." [25](#ref-25)

This "each post stands complete on its own" principle applies equally to replying under other people's posts, and to placing external links:

- **When replying under someone else's post**: if the author asked a concrete question you happen to know cold, leave the substantive answer right there in their replies. If the exchange sparks a different topic worth developing, fill in the full context and publish it as your own original post — never copy out a context-free line like "As I said just now…" from a reply thread and post it standalone, because a stranger landing on your profile has no idea who you were just talking to.
- **When a post needs an external link**: what matters is what the reader will do after clicking. If you're giving readers a ready-to-copy quote template, state in the body which core fields the template contains and how to use them. If, for tidiness, you choose to put the link in the first reply, remember that is in essence another reply post, one extra tap away for readers. As for "moving the link to the first reply dodges penalties and wins reach" — there is no basis for it anywhere in the public code. (The link chapter below takes apart the v2 rules in detail.)


## 6 "One author reply equals 150 likes" — the number comes from 2023 (and what "betting in advance" vs "booking afterward" really means)

The X growth guides online most likely to get your blood up are the multiplier tables: "after a reader replies, the author replies back — one round trip is worth 150 likes"; "a reader taps from the timeline into your profile and follows you — +4 right there"; "someone taps Copy link once — +20"; "one report cancels out 468 likes".

Interestingly, X's `xai-value-model/scoring.rs` source comments really do contain the sentence "one report offsets 468 likes" — but the programmer wrote it **as a textbook example of the wrong reading, to criticize it**. Right beside that sentence, the source comment states a clear warning: [2](#ref-2)

```rust
// watch time -- the weights do not multiply raw engagement counts.
```

In plain words: **"Note! These weight coefficients do not multiply the actual counts of interactions that happened!"**
Anyone who takes "how many likes, reposts, and link copies your post actually received" and multiplies them by the numbers in the weight table is not computing this recommendation system at all.

So where did the viral "the author drops into the replies and one reply is worth 150 likes" come from? Dig into the old Heavy Ranker documentation from Twitter's first open-sourcing on April 5, 2023, and you find these three parameter lines (the rest omitted): [26](#ref-26)

```yaml
scored_tweets_model_weight_fav: 0.5
scored_tweets_model_weight_reply: 13.5
scored_tweets_model_weight_reply_engaged_by_author: 75.0
```

See it: `75.0 ÷ 0.5 = 150`. The division itself is fine. The error sits in two fatal places:
First, these are **parameters of the old architecture, retired back in April 2023**; today's `xai-org/x-algorithm` no longer uses this coefficient set at all.
Second, even in 2023, `75.0` multiplied the **predicted probability** that "the AI predicts the current reader will leave a reply, and the author will engage with that reply" — it never decreed that "every line the author types in the replies books the original post 150 likes' worth of reach." [26](#ref-26)

In the 2026 fused scoring code (`scoring.rs`), the writing is still strictly "weight × predicted value." The like and reply terms look like this: [2](#ref-2)

```rust
apply(scores.favorite_score, weights.favorite),
apply(scores.reply_score, weights.reply_weight_for(candidate)),
```

Write the engagement-probability part of the scoring logic as a math formula and you get:

$$
S_{\mathrm{engagement}}(u,p)=\sum_i w_i\,P(a_i\mid u,p)
$$

Once you see what the letters stand for, it clicks completely: $u$ is **the specific reader (User) pulling to refresh the home feed at this very moment**, $p$ is **the candidate post (Post) waiting in the temporary basket to be scored**, $a_i$ is **some engagement action (a like, a reply, a follow, a link copy)**, and $P(a_i\mid u,p)$ is the probability the AI model computed in advance — a fortune-teller's bet placed before the post is ever shown to this reader — **that this reader, upon seeing this post, will take that action**.

Switch readers and, because reading habits and history differ, the AI's predicted probability $P(a_i\mid u,p)$ for the same post comes out completely different. (The full ranking score also adds the dwell-time predictions covered later, plus same-author decay and other adjustments; the formula above exists to make clear what engagement weights actually multiply.) [2](#ref-2) [5](#ref-5)

At this point many creators ask: **"If the ranking score is fortune-told before the reader sees the post, then when the reader actually likes, follows, or copies the link after seeing it, is all of that useless?"**

**Of course it's useful — greatly useful. It just doesn't work as "after-the-fact bookkeeping points." It works on the next wave of readers.**
In the public Home model config (`phoenix/xrex/configs/xrecsys.py`), real engagement counts (`engagement counts`) are explicitly enabled as an input feature for the upstream large AI model. (A feature is one item of data fed to the model — for example, how many likes this post has already collected, or what this reader has clicked in the past.) And the small-account cold-start sampling (Thompson sampling) covered later also reads the real like count, `fav_count`, directly.
In other words: when the first batch of readers who saw your post really do open it, read closely, copy the link, or follow through your post to your profile and follow you, those **real interaction counts** immediately become live features of this post, fed to the upstream AI model. A second later, when thousands upon thousands of similar strangers pull to refresh, the AI's predicted probabilities for them — predicted likes, predicted link copies, predicted follows — rise with the tide. So the precise distinction is: **the final fused scoring formula does not book you a dead ledger of "actual likes × 0.66," but real engagement data feeds the upstream model and other stages, and moves the next wave of readers' predicted probabilities.** [84](#ref-84)

To feel how "predicted probability × weight coefficient" breaks everyday intuition, let's compute with two real parameters from the code:
In the current public defaults, an ordinary reply (`Reply`) has weight coefficient **`5`**, while copy link (`Share via copy link`) has a weight coefficient of **`20`**. By coefficients alone, copy link is a full 4 times the reply, right?
But suppose reader Zhang San scrolls by. From his habits, the AI predicts a **2% (`0.02`)** chance he will leave a reply on your post, but only a **0.1% (`0.001`)** chance he will tap "copy link" (and assume no mutual-follow or other bonuses apply). Then, scoring for Zhang San:
- **The reply term contributes** = $5 \times 0.02 = \mathbf{0.10}$;
- **The copy-link term contributes** = $20 \times 0.001 = \mathbf{0.02}$.

Look at that. Although copy link's coefficient (`20`) dwarfs reply's (`5`), the occurrence probability differs twentyfold, so in this scoring pass the smaller-coefficient reply term earns your post five times the copy-link term's score. (Note: this is an illustrative computation to clarify the multiplication logic, not a live prediction for any specific real account.) [21](#ref-21)

## 7 The dwell coefficient rose 50% — and this time we can find both versions

The viral claim says "In October, X raised the reading-dwell weight by 50%, and the like weight hit an all-time high of 0.66." Is it true this time?

Look at a single Git snapshot and you'll spot something curious: in the `Home Mixer` service, the continuous dwell coefficient (`ContDwellTimeWeight`) defaults to **`0.006`**; in another service, `VM Ranker`, the same-named parameter defaults to **`0.004`**. Now, `0.006` is exactly 50% above `0.004` — but we absolutely cannot use a default gap between two different microservices at the same moment to prove "it rose by half this month." Proving a 50% rise over time means tracing **the Git history of the one file, `home-mixer/params/param.rs`**, backwards. [12](#ref-12) [15](#ref-15) [27](#ref-27)

So I followed the commit record of `home-mixer/params/param.rs` and checked all **20 October parameter snapshots** one by one:

- In the **October 9** snapshot, `ContDwellTimeWeight` really is still **`0.004`**;
- By the **October 13** snapshot, it has formally become **`0.006`** — a genuine increase of **50%**;
- In the same period, the like weight `FavoriteWeight` first rose on October 13 from `0.5` to `0.6`, then again on **October 14** from `0.6` to **`0.66`**; and the negative penalty for "Not interested (`NotInterestedWeight`)" grew by 10% alongside.

The code history before and after fully confirms "the continuous dwell coefficient was raised 50% in October." (Same caveat as always: the dates in the table are public code snapshot commit dates; they do not mean every live experiment bucket switched at the same second.) [15](#ref-15)

| Date first observed at a checked node (UTC) | Home Mixer parameter | Previous checked value | Value in this public snapshot |
| --- | --- | --- | --- |
| 2026-10-13 | ContDwellTimeWeight | 0.004 | 0.006; coefficient up 50% |
| 2026-10-13 | FavoriteWeight | 0.5 | 0.6 |
| 2026-10-13 | VideoOpenWeight | 0.07 | 0.02 |
| 2026-10-14 | FavoriteWeight | 0.6 | 0.66 |
| 2026-10-14 | NotInterestedWeight | −47.52 | −52.272; negative coefficient's magnitude up 10% |

Source: [15](#ref-15)

As for the viral "like weight 0.66, an all-time record," the claim needs its boundary kept: **`0.66` is indeed the highest `FavoriteWeight` among the 20 public October snapshots we checked**, but without data on every unpublished historical configuration since X's birth, nobody can guarantee it's "the highest of all time." More to the point, even at `0.66` the like is still the little brother among positive actions — ordinary replies, quote posts, and DM shares all carry coefficient **`5`**, follow author is **`4`**, and copy link and the qualifying mutual-follow original-post reply prediction reach **`20`**. [15](#ref-15) [27](#ref-27)

### 7.1 Where the two public defaults differ

So you can look up the true weight of every action in the current code at a glance, I have laid out all **24 prediction parameters** from both services, `Home Mixer` and `VM Ranker`, side by side, with a final column explaining in plain words how to read each one: [14](#ref-14) [21](#ref-21) [27](#ref-27)

| Predicted item | Home Mixer default | VM Ranker default | How to read it |
| --- | --- | --- | --- |
| Favorite | 0.66 | 0.5 | Multiplies the personalized predicted probability of a like; never 0.66 points booked per like received |
| Reply | 5 | 5 | Multiplies the predicted probability the reader leaves a reply |
| Reply prediction term for qualifying mutual-follow cases | 5 + 15 = 20 | 5 + 15 = 20 | The candidate must not be a reply, not a retweet (i.e., an original post), and reader and author must follow each other |
| Retweet | 1 | 1 | Means tapping Repost directly; computed separately from a Quote with comment |
| Quote | 5 | 5 | The prediction coefficient for a quote with comment is 5; but 5 vs. 1 does not by itself imply reach is necessarily five times a plain repost's |
| Share via DM | 5 | 5 | The coefficient multiplies the predicted probability of a DM share; not five points per DM sent |
| Share via copy link | 20 | 20 | One of the largest ordinary positive coefficients; tied at 20 with the qualifying mutual-follow reply term |
| Click | 0.3 | 0.3 | Multiplies the ordinary click prediction; not the final total score when a reader opens and instantly bounces |
| Video open | 0.02 | 0.07 | The two services' defaults differ; this is only the open-video term, not the sum of everything video does |
| VQV (video quality viewing) | 0 | 0 | This named scoring term's default coefficient is 0, but that doesn't mean all video watch time is useless in the system |
| Dwell | 0.05 | 0.05 | The binary predicted probability of a basic dwell event, computed separately from continuous dwell seconds and click dwell |
| ContDwellTime | 0.006 | 0.004 | Multiplies the model-predicted continuous dwell time value (seconds) |
| ContClickDwellTime | 0.4 | 0.4 | Predicted probability that deep dwell after opening meets the bar (threshold value 10.0); note: what unit that 10 is measured in, and how the model's output is converted into the scoring field, are not explained in the public code (see §11.3) — don't read it as "watch a full 10 seconds and 0.4 points get added" |
| Follow author | 4 | 4 | Predicts the probability the reader follows the author after reading the post; not four fixed points per existing follower you have |
| Not interested | −52.272 | −47.52 | Multiplies the current reader's negative predicted probability of "Not interested"; not a site-wide shared deduction |
| Post unexplored | 0.015 | 0.02 | A prediction term literally named Post unexplored in the code; whether it covers out-of-network candidates has further conditions; not a guaranteed exploration-reach allowance for every post |
| Share | 2 | 2 | The system share action, independent of DM share and copy link, multiplied by its predicted value |
| Open link | 0.2 | 0.2 | Multiplies the predicted probability the reader clicks open an external link; not 0.2 free points just because a post contains a URL |
| Photo expand | 0.05 | 0.05 | Multiplies the predicted probability the reader taps to expand and view the large image |
| Quoted click | 0.05 | 0.05 | Multiplies the probability of clicking the quoted original post's card inside; separate from the quote action itself and from ordinary clicks |
| Block author | −31.2 | −31.2 | Multiplies the predicted probability the current reader blocks the author |
| Mute author | −58.8 | −58.8 | Multiplies the predicted probability the current reader mutes the author |
| Report | −234 | −234 | Multiplies the predicted probability the current reader reports the post (the heaviest penalty in the table); cannot be deducted per actual report count |
| Not dwelled | −0.02 | −0.02 | Multiplies the predicted probability the reader scrolls past at a glance (no dwell); entirely different from "read it but didn't like or comment" |

Sources: [14](#ref-14) [21](#ref-21) [27](#ref-27)

You may be wondering: **"Why would one codebase keep two slightly different default parameter sets, in Home Mixer and VM Ranker? Which set is the real workhorse?"**
Follow the call chain (`home-mixer/scorers/vm_ranker.rs`) and their collaboration goes like this:

1. `Home Mixer` first computes a preliminary score with its own local parameters, and on that basis makes the **small-account cold-start** promotion decision;
2. Next, `Home Mixer` fires a remote call (RPC) asking the `VM Ranker` service to do the final scoring — the request carries the prediction probabilities (prediction heads) and asks it to compute the value model (`compute_value_model`);
3. On receiving the request, `VM Ranker` reads weight coefficients from its own `vm-ranker/params.rs` to score (if a candidate already carries a cached weighted score, `weighted_score`, shared code can also reuse it directly);
4. If the RPC succeeds, `Home Mixer` adopts the score `VM Ranker` computed; only if the RPC fails or times out does it fall back to the local score `Home Mixer` computed itself. So in analyzing a specific path, which service gets read, whether the cache is hit, and how the live feature switches are set all decide which set of numbers is finally used. [12](#ref-12)

At the same time, we should be clear-eyed about what these "public defaults" are worth. The repo's `README.md` states plainly that they use a scheduled job (cron) to automatically sync production's **main official default configurations** into the public repo, and they try to keep experiments carrying a significant share of traffic visible in the code. In the `5ed7963` snapshot, for instance, the first-line comment of `home-mixer/params/param.rs` clearly prints the last auto-sync timestamp: `2026-10-27T16:00:37Z`. That tells us the numbers in the table are no programmer's idle filler — they are genuine production-environment reference baselines. It's just that a live request still dynamically reads the configuration system, and a public snapshot cannot list every phased-rollout experiment switch each reader happens to hit at that moment. [12](#ref-12)

### 7.2 The coefficient rose by half — how much does the total score rise?

Seeing "the continuous dwell weight rose from `0.004` to `0.006`, a 50% surge," some long-form creators cheered, imagining their totals and reach would rocket 50% on the spot.

Let's do a grade-school arithmetic problem and cool everyone down:
Fix a hypothetical scene: the AI model predicts a reader will dwell and read on your post for **5 seconds**, and every other item — likes, replies, clicks — sums, raw-weighted, to **`0.20`**.
- With the old continuous dwell coefficient, **`0.004`**: the dwell term contributes $0.004 \times 5 = 0.020$, plus the other items' `0.20`, for a raw total of **`0.220`**;
- With the coefficient up 50% to **`0.006`**: the dwell term contributes $0.006 \times 5 = 0.030$, plus `0.20`, for a raw total of **`0.230`**.

Before any later score offset, same-author diversity decay, or other adjustments are applied, the overall raw total merely moves from `0.220` to `0.230` — **the actual total rose about 4.5% (not 50%)**. And that's holding every other predicted value fixed, as pure arithmetic theater. (After a real live model upgrade, the predicted seconds themselves change too.) [15](#ref-15) [27](#ref-27)

```text
Assume predicted dwell = 5 seconds; other raw weighted items total = 0.20
Old value: 0.20 + 0.004 * 5 = 0.220
New value: 0.20 + 0.006 * 5 = 0.230
The dwell term rises 50%; this hypothetical raw total rises about 4.5%
No other ranking processing applied yet; no conversion into reach.
```

Source: [15](#ref-15) [27](#ref-27)

Read the other numbers in the weight table with the same logic and you won't be fooled again:

- "Copy link `20`," "follow author `4`," "Not interested `-52.272`" — all coefficients multiplied against **predicted probabilities**, not piece-rate rewards or penalties booked per actual action;
- A reader who "opens your post, glances, and leaves" doesn't simply earn you a free "`0.3` click score" — the fused formula sums all positive and negative predicted terms together, and if he opens and bounces in a second, the model's deep-dwell probability for him will be extremely low, possibly accompanied by higher negative predictions;
- As for the tempting "mutual-follow reply prediction `5 + 15 = 20`," the code hard-requires that it acts only on the reply probability of the **original candidate post itself (`!is_reply && !is_retweet`)** — if you run under a big account's post and grab a front-row reply, your reply is `is_reply = true` and is excluded outright; you get not a cent of mutual-follow bonus. [27](#ref-27)

So what October's parameter comparison really tells us is this: **the system genuinely does value "whether a reader will stop and actually read the content" more and more, and reading signals deserve to be weighed alongside interaction signals.** But it in no way proves that "padding the opening with ten lines of filler to drag out seconds," "frantically hunting for mutual follows," or "begging everyone at the end to tap copy link" guarantees high reach. Verifying which writing style truly grows traffic still takes account test data and controlled comparisons; this piece makes no evidence-free mystical promises.

## 8 Reposts vs. just looking without interacting — is the gap really twentyfold?

Many creators of deep, substantive content stare at the weight table above and feel a pang: plain repost (`RetweetWeight`) defaults to **`1.0`**, while the basic dwell event (`DwellWeight`) defaults to only **`0.05`** — here are the two lines lifted straight from `home-mixer/params/param.rs`: [21](#ref-21)

```rust
param!(RetweetWeight, f64, "rust_home_mixer_retweet_weight", 1.0);
param!(DwellWeight, f64, "rust_home_mixer_dwell_weight", 0.05);
```

Seeing $1.0 \div 0.05 = 20$, plenty of people land on a pessimistic conclusion: "It's over! One repost weighs twenty times a silent read! Everyone reads my long posts quietly and never reposts — in the algorithm's eyes I'm losing catastrophically!"

**The truth, after checking the code and recomputing, is the exact opposite of what you feared.**
First, both terms multiply **predicted occurrence probabilities**. True, if everything else stays put, raising the predicted repost probability by one percentage point (`+0.01`) adds $1.0 \times 0.01 = 0.01$ to the raw weighted sum; raising the basic dwell probability by one point adds $0.05 \times 0.01 = 0.0005$. The "twentyfold" is merely the ratio of these two "per +1% probability" increments — it can never be converted into "in real life, 1 repost equals 20 reads." [2](#ref-2)

Why? Because in real life, **the probability that a reader stops and reads a good post is vastly higher than the probability he taps "repost."**
I ran a set of the most ordinary numbers through a locally rewritten scoring program: suppose for one reader, the AI predicts a **2% (`0.02`)** chance he reposts your piece, and a **60% (`0.60`)** chance he stops and reads it (triggering the basic dwell event). Then:
- **The plain repost term contributes** = $1.0 \times 0.02 = \mathbf{0.02}$;
- **The basic dwell event contributes** = $0.05 \times 0.60 = \mathbf{0.03}$.

See that? Comparing this single pair alone, with either Home Mixer's or VM Ranker's public defaults, **the basic dwell term, coefficient a mere `0.05`, comes out at `0.03` and beats the plain repost term, coefficient `1.0`, at `0.02`, on the spot.** (Note: a local example with fixed hypothetical probabilities; no real account's live data used.)

What's more, when a reader "only reads, doesn't like, doesn't comment, doesn't repost," in the recommendation system's code **he triggers not just that one `0.05` metric but a whole "reading-dwell family" firing in layers at once**. Set a plain repost beside the reading-related prediction terms and the picture sharpens: [21](#ref-21)

| Predicted item | Home Mixer | VM Ranker | How to read it |
| --- | --- | --- | --- |
| Plain repost (Retweet) | 1.0 | 1.0 | Multiplies the probability the reader taps plain repost |
| Dwell event (Dwell) | 0.05 | 0.05 | Multiplies the probability of the basic dwell event |
| Continuous dwell (ContDwellTime) | 0.006 | 0.004 | Multiplies the model-predicted continuous dwell seconds (e.g., reading 30 seconds is `0.006 × 30 = 0.18`) |
| Dwell after opening (ContClickDwellTime) | 0.4 | 0.4 | Multiplies the probability of deep dwell after opening the post (past threshold 10) (ordinary Click has its own `0.3`) |
| Not dwelled | −0.02 | −0.02 | Multiplies the probability the reader scrolls past at a glance (no dwell) |

Never mistake "read it through but didn't like or comment" for the last row of the table, "Not dwelled (`Not dwelled`)":

- **"Not dwelled (`Not dwelled`, weight `-0.02`)"** means the reader saw your post on the timeline, glanced, and flicked past without his finger even pausing;
- **"Silently read it through without interacting"** means the reader not only avoids the `-0.02` scroll-past penalty but simultaneously triggers **ordinary click (`Click` `0.3`) + deep dwell after opening (`ContClickDwellTime` `0.4`) + basic dwell (`Dwell` `0.05`) + continuous dwell seconds (`ContDwellTime` `0.006 × seconds`)**, and may even activate, back in step one's candidate pulling, the new **`ld` deep-reading recall branch (weight `0.75`)**. Stack those layers and a "silent" deep reader often contributes several times a plain repost's ranking score. (And no, the public view count, Views, cannot be plugged into any one term above to convert into a fixed score.) [2](#ref-2) [28](#ref-28)

One thing needs saying plainly first, so this `0.4` isn't misread: in the model, "dwell after opening" (`CLICK_DWELL_TIME`) is a yes-or-no judgment — the raw value strictly greater than the threshold `10.0` counts as meeting the bar, and what the model works out is the probability that this reader meets it (between 0 and 1), which is then multiplied by `0.4` into the total score. Two things the public code doesn't explain: first, what unit that raw value is actually measured in (common sense says seconds, but the upstream code that produces it isn't public); second, the adapter code that converts the model's probability into Home Mixer's `click_dwell_time` field isn't public either. So don't read `0.4` as "every extra second of viewing adds 0.4 points," and don't use it to work out "one repost equals how many seconds of viewing." It and the basic dwell event (`0.05`) from earlier are two separate judgments — don't mix them. [28](#ref-28)

**If silent reading scores this well, what is a plain repost's (Retweet's) true unique value?**
The answer is not in the scoring table. It's in step one's **in-network recall channel, `Thunder`**.
Suppose reader A doesn't know you at all (and doesn't follow you), but A follows B, a big account in your field. When B finds your work useful and taps "plain repost (Retweet)," what happens?
In `thunder/posts/post_store.rs`, the system writes B's repost record into B's personal activity index. When B's follower A pulls to refresh the home feed, the `Thunder` buyer shops by A's follow list and **pulls your post, reposted by B, straight into A's temporary basket as an "in-network candidate from someone A follows."** In other words, someone reposting your post is like borrowing the reposter's follower network to open an extra "cross-circle door" for you, outside AI recommendation entirely. (Once it's in A's basket, it still goes through the seen filter and scoring; there's no guarantee 100% of B's followers will see it.) [29](#ref-29)

Understand these two legs and your mindset for writing long posts steadies completely:

1. **For the silent majority of readers**: solidly provide cases, data tables, and practical steps, so they're willing to open, stop, and read to the end — let the four layers of reading-dwell signal hold up your post's ranking base.
2. **For peers and big accounts**: build one at-a-glance plan-comparison chart or pitfall checklist into the article (in a pricing tutorial, for instance, attach a full "original plan vs. reduced plan comparison table" instead of just chanting "communicating with clients matters"), so a peer thinks "this table is useful to my followers too" and taps repost, borrowing their follow feed to break you out of your circle.

Also remember: the code splits **"plain repost (`Retweet`, a direct tap, weight `1.0`)"** and **"quote with comment (`Quote`, reposting with your own comment attached, weight `5.0`)"** into two fully independent prediction terms. Quote's coefficient is five times plain repost's, but since it too multiplies its own occurrence probability, you can't mechanically declare "type a few words on a repost and get 5x reach." [21](#ref-21)

### 8.1 Whether a repost breaks out depends on whose circle it is

Earlier we saw a circulating claim: "Only original posts reach strangers; plain reposts get cut down wholesale by the out-of-network filter, so reposts can't break out at all."
The reason this sentence dizzy-spins so many people is that the speaker swallowed the subject — **"whose follow circle (in-network) are we talking about?"**

Set the three people in one repost on the table — **A (you, the original author), B (the big account who reposts you), C (a stranger who follows only B, not you)** — and check the candidate's data fields against the source of `in_network_candidate_hydrator.rs` and `oon_retweet_reply_filter.rs`: [30](#ref-30)

| Role | Relationship in this example | How the candidate record represents it | Conclusion |
| --- | --- | --- | --- |
| A: original author (you) | Reader C does not follow A | A's original post ID sits in this repost's `retweeted_tweet_id` field | A's content can absolutely ride B's repost to stranger C, who doesn't know A |
| B: reposter (peer big account) | Reader C follows B | This repost candidate's direct author, `author_id`, is **B** | When the system checks "is candidate author B on reader C's follow list," the verdict is **in-network** |
| C: reader | Follows only B, not A | `Thunder` pulls B's repost into C's candidate pool by C's follow list | It bypasses the out-of-network block and enters the pool (final position still decided by later filters and scoring) |

Source: [30](#ref-30)

See the trick in the code?
In `oon_retweet_reply_filter.rs` there really is an iron rule: **remove every plain repost (`is_retweet`) whose candidate `author_id` is not on the current reader's follow list (`!in_network`)** — and even if the reply exemption switch is opened, plain reposts are not exempted.
- If the claim is scoped to **"can B's repost be pushed, through the ordinary recommendation pipeline, to a pure passer-by D who follows neither A nor B,"** or **"can reposting your own old post yourself push it to strangers who don't follow you"** — then yes, the code cuts it down in one stroke. In both cases the reposter's `author_id` is not on the reader's follow list; it's an out-of-network repost (OON Retweet) and will be filtered. (Chapter 24 below takes apart the 5 gates of "reposting your own old post.")
- But if **someone else (B) reposted your original post**, then for B's follower C, this repost candidate's `author_id` is B (someone C follows). In the system's eyes it is a legitimate **in-network candidate** and never triggers the out-of-network filter at all. For the original author A (you), B's follower C is a complete "out-of-network stranger." So twisting "the out-of-network filter blocks non-followers' reposts" into "other people reposting you can't help you reach strangers" simply reverses the subjects — reposter and original author. [30](#ref-30)

This also reminds us again: when you write a research summary or a tool review hoping a peer big account will repost it, the body must state the research subject, the core conclusion, and the applicability boundary clearly, so the big account's followers — strangers seeing you for the first time — can grasp what you're doing at a glance. How many of the big account's followers ultimately see it is decided by each follower's own seen filter and model scoring. [30](#ref-30)

### 8.2 Whether a reply reaches strangers also depends on switches and sources

Having covered plain reposts: can a "reply post (Replies — your comments under others, and your thread's posts from #2 onward)" enter the For You candidate pool of strangers who don't follow you?
In the code, replies get a slightly wider window than plain reposts; the two can't be merged into one absolute "never."

In the current public default parameters (`home-mixer/params/param.rs`), the switch governing out-of-network replies, `EnablePhoenixOonReplies`, defaults to **`false` (off)** — if production ran on this default, the ordinary recommendation pipeline would filter out every reply from an author the reader doesn't follow.
But the programmers also wrote a **conditional pass branch**: once live configuration sets `EnablePhoenixOonReplies` to `true`, a reply escapes being killed by `oon_retweet_reply_filter.rs` as long as it meets all of these conditions: [30](#ref-30)

1. Its recall source must be a designated Phoenix recommendation source (`ForYouPhoenixRetrieval`, or the cold-start source `ForYouPhoenixRetrievalCold`);
2. If another switch, `PhoenixOonRepliesRootOnly`, is also on (public default `false`, but live experiments can adjust it any time), the reply must be a **first-level reply directly under the root post** (not a reply-to-a-reply);
3. The reply must have successfully backfilled usable conversation ancestor data (`ancestors`; missing ancestors still gets it removed). [30](#ref-30)

```text
For an OON reply to use this exception, all of these must hold:
EnablePhoenixOonReplies on
Source is a designated Phoenix home retrieval type
If root-only is on, the reply must reply directly to the root
The reply must have usable ancestors
```

Source: [30](#ref-30)

See it: even with the exception switch open, not just any reply charges into a stranger's home feed. So whether you're writing threads or comments, always put the core question and judgment in the first post (the root), and give every following reply ample context. Never bet the piece's best card on the end of a thread a stranger will very likely never see. [30](#ref-30)

### 8.3 A home-feed conversation group may carry other posts along

On reposts and replies breaking out, the code hides one more mechanism: **the single candidate post that passes screening, and the "whole conversation module" finally served onto the reader's screen, are not the same data unit.**

How to picture it? When the `Thunder` following source recalls a reply candidate, it also stores its direct parent post (`parent`) and the conversation's root post (`root`). At the final interface-assembly step (`convo_marshaller.rs`), the system stitches "root + a limited number of intermediate ancestors + the selected post" into one conversation card for display. That means: if someone the reader follows replied to a post, the root or parent attached inside that conversation card on screen did not individually re-run the same out-of-network candidate filter on its own author relationship. (All carried-along content still passes its own safety and visibility check via `vf_candidate_hydrator.rs`; violating or deleted posts still can't get out.) [30](#ref-30)

`Thunder` also strictly limits reply depth (`thunder/posts/post_store.rs`): "directly replying to an original root post" and "replying to someone's reply inside a nested thread" do not carry identical admission qualifications. Deeper replies trigger checks on the parent-root relationship, whether the person being replied to is someone the current reader follows, and so on. So we can't inflate the conversation-assembly mechanism into "borrow anyone's reply and any ancient post bypasses every site-wide limit unconditionally." [30](#ref-30)

Also, in the top-level For You home pipeline assembly (`for_you_candidate_pipeline.rs`), beside the regular scored candidate flow (`ScoredPosts`) sits a special source called `PushToHomeSource` (`push_to_home_source.rs`). It fetches post data directly from an explicitly specified `push_to_home_post_id` in the request, and doesn't squeeze through the same `PostCandidate` filter chain as ordinary candidates. That tells us the filter rules we see in the ordinary candidate pipeline are not the one master switch for every home-feed entrance (and certainly don't govern conversation pages, search, or profiles). But as for which posts qualify to be placed into `push_to_home_post_id`, the public code discloses no upstream trigger logic, and we can't treat it as a back door creators can invoke by hand. [30](#ref-30)


## 9 Why would a stranger encounter your post? (And how to choose between language versions)

With the filter rules above in place, consider the question that fascinates every creator: **for a stranger who has never followed me, how does the AI pick my post, precisely, out of the sea of posts and into his temporary basket?**

A concrete example: today you publish a solid piece titled *A client says your website design quote is too expensive — how to keep the order by shrinking the delivery scope*. Right now, stranger A has spent days reading about freelance work and client communication on X; stranger B has spent days reading Sony and Canon camera reviews.
In X's recommendation system, **there is no need to scatter your article randomly across the whole site to test the waters first** — at step one of A and B's refresh (the recall stage), the system can use each one's recent behavior sequence to grab your article precisely for A, and camera reviews for B. (Note: A and B here illustrate the personalization mechanism; they are not two real accounts measured live.) [31](#ref-31)

Open `retrieval_sequence_query_hydrator.rs` and `phoenix_source.rs` and you see the matching machinery at the bottom layer:

1. When a reader pulls to refresh, the program passes in **the current reader's ID (`query.user_id`)** and fetches the full sequence of that reader's recent behavior history (what he clicked, read, searched, bookmarked), then ships that behavior sequence to the Phoenix two-tower recall model;
2. At the other end, when your post enters the candidate store, the model (`recsys_two_tower_model.py`) combines **the post's multimodal semantic representation (Semantic ID, extracted from your text and images by the Grox multimodal model)** with the **hashed author ID** to form the candidate vector representing your post.

One side is "what this reader has been looking at lately"; the other is "what your post is about, and who you are." Match the two vectors for similarity, and even though A has never heard of you, if you wrote exactly the pain point he's been chewing on, the Phoenix buyer reaches out and lifts your post into A's temporary basket. [31](#ref-31)

Understanding this code also dispels a widespread piece of "vertical niche account-farming mysticism":
Many tutorials teach creators: "Want to be a tech blogger? Then when you scroll X yourself, only read tech posts and like tech posts — that way the algorithm will push your articles to tech readers!"
**Wrong. Whose history does the code read? It reads `query.user_id` — the history of the reader currently scrolling the home feed, not the author's browsing history.** Scroll nothing but tech for a week and like nothing but tech posts, and what you change is **"what you, as a reader, see on your own home feed."** Nowhere in this recall code is there logic like "because the author read ten tech posts yesterday, aim the author's article at tech readers today." (The author ID itself remains one of the candidate-side input features, so we can't absolutely declare the author's historical identity wholly irrelevant either.) [31](#ref-31)

What's the takeaway for everyday writing? **The biggest one: no empty, broad, mystical titles. Pin the title and the first paragraph directly onto the "concrete subject + concrete task" your target reader is working on.**
- Don't write *A Required Course for Freelancers* → write ***When a client says your website design quote is too expensive, how to shrink phase one's delivery scope***;
- Don't write *AI models take another great leap* → write ***An AI-generated meeting summary dropped the client's veto condition — how to verify it in 3 sentences***.

State your research subject and the concrete task you're solving, and the multimodal model's semantic vector (Semantic ID) lands dead-center on target; the body naturally knows what evidence to present.

By the same logic, if last week your account wrote "how to negotiate when a client says the quote is too expensive" and this week "how to guard against endless add-on revisions after a client accepts," the two pieces look like different subtopics — but they plainly serve the same group of freelance readers. There is no need to be frightened by a so-called "80% account-verticality red line," fearing that one different concrete question triggers some "account label reset" — search the public recall and scoring paths and **there is no formula anywhere for "80% same-topic purity," "a fixed number of hashtags required for verticality," or "one off-topic post resets account weight."** [31](#ref-31)

### 9.1 What happens if you publish one piece in several languages (say, Chinese and English together)?

Creators in tech, overseas business, and open source often ask me a very practical, agonizing question: **"I wrote a solid piece and want to cover both Chinese and English readers. Should I stack Chinese on top and English below inside one post, or split it into one pure-Chinese post and one pure-English post?"**

Combine what we just covered — reader history-sequence matching (`query.user_id`), the same-author `0.625` decay, V8.2's 4,000-character truncation, and the PTOS English-only safety rule coming in Chapter 28 — and we can compute exactly what each approach meets in the code:

#### 9.1.1 Approach B: split into "one pure-Chinese post" + "one pure-English post"

**The short answer first: publishing the same content as a separate pure-Chinese post and a pure-English post is completely fine — for long pieces, it is the right way to do it.** What it actually meets in the code:

1. **For single-language readers (the vast majority): the two versions travel to their own reader groups.**
Don't forget the core mechanism just covered: the Phoenix recall model reads **the current reader's own behavior history sequence (`query.user_id`)**.
- For Zhang San, who mostly scrolls the Chinese circle, his recall sequence pulls only your **pure-Chinese version** into his temporary basket; the English version never enters his pool — so by the same-author multiplier's math, the Chinese version's slot is not taken by the English version in Zhang San's basket;
- For John, a foreign reader who mostly scrolls the English circle, his recall sequence pulls only your **pure-English version** in — so by the same math, the English version's slot isn't taken by the Chinese version in John's basket either. Neither side eats the other's slot — that's inferred from the recall and counting mechanisms; whether production behaves exactly this way, there are no logs to prove. [31](#ref-31)
2. **For bilingual readers and followers who already follow you: posting back-to-back means same-pool competition.**
If you fire the pure-Chinese and pure-English versions one right after the other in the same minute, then for followers of yours (`Thunder`'s follow feed grabs both of your fresh posts by your `author_id`) and for readers who scroll both languages, the two posts land in the same temporary basket under one `author_id`. The one seated second eats the **`0.625` same-author decay** — and where the cross-language semantics overlap heavily, they may also compete inside DPP diversity selection (`dpp_model.rs`). [2](#ref-2) [85](#ref-85)

#### 9.1.2 Approach A: one post, "Chinese on top, English below," mixed together

1. **Is there a "mixed-language penalty"? No.**
Nowhere in the public code is there a rule like "detect mixed languages, deduct a fixed amount." Language identification is just one ordinary feature fed to the model. [31](#ref-31)
2. **But long mixed posts run straight into two invisible pits**:
- **Pit one: the merciless 4,000-character cut (`MAX_POST_TEXT = 4000`).**
In Chapter 17 we'll see that the V8.2 content-understanding processor (`renderer_v82.py`), when reading a post's body `post.full_text`, takes only the **first 4,000 characters** and sends them to the multimodal embedding service. Write a deep test with 3,500 characters of Chinese on top and 3,500 characters of English translation below — sorry: from character 4,000 onward, the English body is cut off entirely and never enters this content-vector generation flow. [47](#ref-47)
- **Pit two: the English-only automated review rule (`FOSNR_ABUSE_INSULTS`).**
In Chapter 28's safety rules there's a hard line of code: in the Grox PTOS auto-labeling path (Grox is X's internal AI system for understanding content; PTOS is the part of it that handles safety review and labels rule-breaking content), the classification `HateOrAbuseInsultsWithTarget` (targeted insult/attack) explicitly requires **that the post's language be recognized as English** before it auto-writes the `FOSNR_ABUSE_INSULTS` restriction label for accounts that are not high-PageRank (PageRank = a weight score the system computes for an account based on its influence — the higher the score, the more the account is treated as a big account, and many exemptions later in this piece key off it) and not gray-badge (a gray badge is the gray verification check for government and institution accounts, not the blue badge you pay for) (blocking all stranger recommendations in `HomeRecommendations`). If you're writing a sharp product review or criticism, then by this path's conditions one can infer: if a bilingual post's language gets recognized as English and the wording is aggressive, it's easier to hit this auto-labeling line. How language is actually determined, the code doesn't state for bilingual posts. [77](#ref-77)

#### 9.1.3 So how should multilingual publishing be done?

- **For technical long-form of thousands of characters, deep reviews, or tutorials**: **split into a "pure-Chinese post" and a "pure-English post" and publish separately — and space the two releases about half a day apart (the code specifies no exact interval)** (for example, post the Chinese version at Beijing noon, then the English version at Beijing midnight, during Europe and America's daytime peak) — that way each version uses its full V8.2 4,000-character semantic allowance, matches strangers in its own language, and mostly avoids bilingual followers' refresh windows, so the two long posts don't fight each other inside one temporary basket.
- **For short updates of two or three hundred characters, or short image posts** (Chinese plus English nowhere near 4,000 characters total): post them stacked in one post; it's convenient and the interaction concentrates in one place;
## 10 Reading signals are already useful while candidates are being found

Many creators of technical tutorials and data compilations feel aggrieved: "I spent three days building a test comparison table. Readers finish it, save the image, and use it; the replies are quiet, hardly anyone argues. Does the algorithm think nobody loves my post?"

Don't panic. A quiet reply section does not mean readers aren't voting for you inside the system.
In the official README update note of October 13, 2026, the X team announced something major: **the Phoenix recall model — the buyer that fetches candidate posts from the warehouse in step one — has officially begun learning to find "posts people will actually read through."** [32](#ref-32)

Follow that announcement into the two-tower recall model's config file, `phoenix/xrex/configs/xrecsys_two_tower.py`, and you'll see: beside the original `home` (ordinary engagement) and `immersive` (immersive video) branches, the code has genuinely added an independent branch named **`ld` (Long Dwell / deep reading dwell)**, and the positive training signal (Positive Actions) for this branch is written, plainly, as this line: [32](#ref-32)

```python
"ld_positive_actions": [recsys_pb2.ActionName.CLIENT_TWEET_RECAP_DWELLED],
```

And this is no slideware concept sitting in a comment — trace the model code `recsys_two_tower_model.py` and the inference entry `model_runner.py` all the way down and this `ld` branch has both a complete training-loss computation and a live role, weighted, in recall inference scoring.
That means **a reader's "reading dwell signal" now acts at two stages of the algorithm**:
1. **First, at "step one, pulling candidates (recall)"**: the `ld` branch teaches the buyer to tell which posts people are willing to stop and read into, and lifts your solid post straight out of the vast store into readers' temporary baskets;
2. **Second, at "step two, seating order (ranking)"**: once inside the basket, the `0.4` click-dwell and `0.006` continuous-dwell coefficients from earlier push your total score up again.

Of course, the evidence boundary must be held with rigor: what formula triggers the client event `CLIENT_TWEET_RECAP_DWELLED` in the mobile app's front end is not in the public repo — there is no front-end source — so we cannot blithely inflate it into "the reader must read 100%, to the very last punctuation mark," nor force the click-dwell target's "threshold 10" onto this event. [32](#ref-32)

For creators this is a huge reassurance: for tool tutorials, configuration reports, and plan comparisons — content whose normal reader response is "read quietly, screenshot it, save it, follow the steps" — there was never much to argue about in the replies anyway. **Don't let a low reply count push you, next time, into anxious, content-free rage-bait fights.** Rather than scheming to stuff "the real core point is still ahead, don't scroll away" into every paragraph's end to trick dwell, check whether the tables answer the pain point directly, whether the steps can actually be followed through, and whether the exceptions are explained. Write the substance solid, and the reading-recall branch will recognize you on its own.

### 10.1 When was reading recall added — and is it small-accounts-only?

Around this new `ld` reading-recall branch, two more rumors circulate: one, from the late-October announcement, holds that this is a brand-new feature launched October 28; two, seeing a `HOME_COLD` in the config, declares "reading recall works only for small accounts; big accounts can't enjoy it."

Pull the Git repo's commit timeline and the source configuration, and both questions can be settled in one pass: [33](#ref-33)

| Time and version | Change shown in public materials |
| --- | --- |
| October 8, 2026, `35650fb` | The two-tower recall named config at the time had only the `home` and `immersive` branches; no `ld` yet. |
| October 13, 2026, 08:05:54 UTC, `e1a0375` | The public commit formally adds `ld_positive_actions`, the `ld` branch, and branch weight `w_ld = 0.75`; the model training and inference code land in the same commit. |
| October 28, 2026, `5ed7963` | The platform backfills the update note in `README.md`, explicitly dating the "find posts people will read to the end" update to **October 13**. |

Source: [33](#ref-33)

See it: the code merged into the public repo back on **October 13**; October 28 was only a note backfilled into the README. (And as ever, a public commit time is not the second every live traffic bucket switched; if your reading volume wobbles one day, you can't pin it on this update by date alone.) [33](#ref-33)

Now the second question: **is `ld` reading recall a side dish served only to small accounts? Not at all.**
In the named config of `xrecsys_two_tower.py`, the `ld` branch stands alongside `home` and `immersive` (and the `home-only` named version keeps `home` and `ld` together too). **There is no small-account restriction checking "enable only if the author has fewer than X followers" anywhere in it.** And the datasets it reads cover `HOME`, `HOME_COLD`, and `HOME_HOT` at once — not any single one of them.

And one more misreading to clear up: **do not read meaning into names and translate `HOME_COLD` as a "small-follower account zone."**
Open the source of `phoenix/xrex/data/cold_pool_filter.py` and it's clear at a glance: `HOME_COLD` (the cold-post pool) filters on **a single post's like count (`fav_count`), view count (`view_count`), and how freshly it was posted**. That is:
- **whether the author is a mega account with millions of followers or a small account with hundreds** (author follower count),
- **whether the reader scrolling the home feed is a freshly registered new user** (reader behavior history),
- **whether this post itself is a fresh post that hasn't yet accumulated likes and views** (what `HOME_COLD` actually checks) —
are three completely independent things in the code. Even a mature account with a hundred thousand followers, the moment it publishes a new article, enters `HOME_COLD` if it meets the cold-post filter conditions. And accounts big and small alike share the `ld` reading-recall branch's training and inference machinery. [33](#ref-33) [34](#ref-34)

```text
Named combined config: head_names = ["home", "immersive", "ld"]
w_ld = 0.75
Generic model settings: w_ld = 0.0; whether ld applies still depends on the actual config.
```

Source: [33](#ref-33)

A word on `w_ld = 0.75`: this `0.75` is the `ld` branch's **vector-score combination weight** inside this named two-tower recall config — never "each completed read books the post 0.75 points." Meanwhile the base generic model class carries a default `w_ld` of `0.0`, which tells us whether a given live request uses `ld` at all, and at what weight, still depends on the concrete config file that request loads. [33](#ref-33)

Finally, remember this: in training (`recsys_two_tower_model.py`), the two-tower model simply reads the ready-made `CLIENT_TWEET_RECAP_DWELLED` 0/1 action flag from the data table. The model does not, in its training code, take a ruler and measure which paragraph a reader scrolled to. As authors, our best move is to surface the pain point in the first paragraph and honestly deliver the promised substance in the body — there is no magic switch in the code like "force the reader to scroll to 100% and trigger a second site-wide blast." [33](#ref-33)

## 11 How the model tells different dwell lengths apart

Since the system values "reading dwell" this much, how does the AI model predict whether a reader will dwell on your post for 3 seconds, 15 seconds, or 90 seconds?
As noted earlier, click dwell (`CLICK_DWELL_TIME`) is, in the code, a simple binary judgment (whether the raw value crosses threshold `10.0`). But the real heavy lifter behind the October 8, 2026 official announcement of "improved dwell-time prediction" is **CREAD (multi-threshold classification and continuous time reconstruction)** — in the `home_direct_packed` ranking model config, the AI cuts dwell time into **30 fine time-scale thresholds** and learns them simultaneously, then restores the predicted probabilities into concrete reading seconds. [11](#ref-11) [13](#ref-13) [14](#ref-14) [56](#ref-56)

### 11.1 Cutting dwell time into a set of thresholds

Why cut dwell time into 30 thresholds instead of having the AI guess one seconds number? Because readers' dwell spans are enormous (one person glances for 2 seconds and flicks away; another reads a long piece or long video for two or three minutes), and having a neural net regress a raw seconds value makes it easy for outliers to drag it off course.

Open `phoenix/xrex/configs/xrecsys.py` and the loss function `loss_recsys.py`, and CREAD's cutting method is clever:
- For the dwell prediction head of the ordinary feed (**non-Gallery**), the system cuts **30 time thresholds** across **2 seconds to 120 seconds (2 minutes)**, at **log spacing (Log-spaced)**;
- For the immersive dwell prediction head of media gallery pages (**Gallery Page**), the system runs from **2 seconds all the way to 240 seconds (4 minutes)**, cutting **30 time thresholds** at log spacing as well.

What is "log spacing"? In plain words, **"dense at the front, sparse at the back"** — in the short-dwell ranges of 2, 3, 5 seconds, thresholds are packed tight (a second or two is a new rung); out at tens of seconds and a hundred-plus, the gaps between thresholds widen. (Note: the 120 and 240 seconds here are merely these two model heads' scale ceilings. They do not mean your post's text or your video cannot exceed 2 or 4 minutes.) [13](#ref-13)

```python
# Concept restated; not verbatim source; 30 thresholds, k=0 to 29
threshold_k = 2.0 * (norm_scale / 2.0) ** (k / 29)

# Non-Gallery: norm_scale = 120.0
# Gallery Page: norm_scale = 240.0

# The next line is the label-judgment source
targets = (gt_raw[..., None] > threshold_arr).astype(jnp.float32)
```

Source: [13](#ref-13)

Look at the last line of source: when the system generates training labels from real reading duration `gt_raw`, the comparison sign is **strictly greater (`>`)** — only if the observed real dwell strictly exceeds threshold $k$ is that threshold's label recorded as `1`; otherwise `0` (landing exactly on the threshold value is also `0`). This way the AI model can separately predict, all at once: "the probability this reader dwells on your post past 2 seconds, past 5 seconds, past 30 seconds…" — and never again crudely mixes "watched 11 seconds" and "watched 100 seconds" into one result. [13](#ref-13)

### 11.2 Restoring those probabilities back into time

The AI has predicted pass probabilities for 30 thresholds. At scoring time, how do those 30 probabilities become one concrete "predicted dwell seconds (say 18.5 seconds)" to multiply by the continuous dwell weight of `0.006`?

Open the model inference code `recsys_model.py` and the decoding formula is beautiful: first pass the 30 thresholds' outputs (logits) through a `sigmoid` to get pass probabilities `phi` between 0 and 1; then **multiply each threshold's pass probability by the "time span (`deltas`)" between it and the previous threshold, and sum all 30 segments** (the first threshold's base is set at 0 seconds). Because each cell's seconds width is entirely different, you must never add the 30 probabilities directly and call it "up to 30 bonus points" or "30 valid reads." [13](#ref-13)

```text
# Formula restated; not verbatim source
phi = sigmoid(cread_logits)
deltas = [t1 - 0, t2 - t1, ..., t30 - t29]
restored_time = sum(phi_k * deltas_k)
```

Source: [13](#ref-13)

Run a simplified example with only **3 thresholds** and you'll grasp the integration-restoration idea in a second:
Suppose the 3 thresholds are **2 seconds, 5 seconds, 10 seconds**; their adjacent spans (`deltas`) are: $2-0=\mathbf{2}$ seconds, $5-2=\mathbf{3}$ seconds, $10-5=\mathbf{5}$ seconds.
Now the AI predicts that a reader of your post has a **`0.8` (80%)** probability of dwelling past 2 seconds, **`0.5` (50%)** past 5 seconds, and **`0.2` (20%)** past 10 seconds. The restored predicted dwell time is:
$$0.8 \times 2\text{ seconds} + 0.5 \times 3\text{ seconds} + 0.2 \times 5\text{ seconds} = 1.6 + 1.5 + 1.0 = \mathbf{4.1\text{ seconds}}$$
Then that restored `4.1` seconds goes on to multiply the continuous dwell weight of `0.006`. (Note: this uses 3 thresholds for arithmetic demonstration; the production `home_direct_packed` config uses 30 log thresholds.) [13](#ref-13)

And when training this model, the programmers don't just grade the AI on how accurately it answers the 30 yes-or-no questions (classification loss). The `cread_loss_compute` function also sets the **restored predicted seconds** beside the **real dwell seconds** and computes an extra error score for "how accurate the total-seconds figure is" (the restoration loss, Restoration Loss). Before the computation, real dwell time is clipped into the prediction head's range (120 or 240 seconds). The error itself is computed with **Huber Loss** (a way of measuring error that doesn't get dragged far off by extreme values; relative weight `0.5`, Huber threshold `5.0` seconds, plus a valid-sample mask and negative-example weights) — forcing the model to get the restored total seconds right too.
In the public base config of `home_direct_packed`, the CREAD loss weights for ordinary and immersive dwell (`dwell_cread_loss_weight` and `dwell_cread_immersive_loss_weight`) are both set to **`0.1`**, while the older `dwell_tweedie_loss_weight` and `dwell_mae_loss_weight` are both set to **`0`** (formally retired). Keep the distinction straight: the CREAD loss weight `0.1` governs **how the model learns accurate dwell seconds during training**; Home Mixer's `0.006` governs **how much coefficient each predicted second gets multiplied by at final seating time**. [13](#ref-13) [15](#ref-15)

### 11.3 Four easily confused "dwell" metrics

By now we've met four metrics that look alike and all concern "viewing / dwelling." Many second-hand articles mix them up; here is a comparison table to sort out, once and for all, what each one governs: [13](#ref-13) [14](#ref-14) [35](#ref-35) [36](#ref-36)

| Name or field | Stage where it lives | Definition found this time | What still cannot be inferred |
| --- | --- | --- | --- |
| `DWELL_TIME` / CREAD | Ranking model training and continuous-time decoding | 30 log-threshold classifications + time restoration (120s / 240s ranges), outputting predicted dwell seconds for `ContDwellTime` (`0.006`) to multiply | Forcibly doubling an article's word count automatically earns double the predicted dwell time or double the reach |
| `CLICK_DWELL_TIME` | The named ranking model's click-dwell binary target | Binary classification, threshold `threshold = 10.0`; outputs the probability the raw value is strictly greater than `10.0`, for `ContClickDwellTime` (`0.4`) to multiply | A reader truly watching a full 10 seconds means the system books this post 0.4 points on the spot |
| `CLIENT_TWEET_RECAP_DWELLED` / `ld` | Phoenix step-one recall positives and branch | The two-tower recall's `ld` branch lists this event as a training positive (branch weight `w_ld = 0.75`) | This front-end event definitely means reading 100% to the article's end, or directly shares the `10.0` threshold above |
| `view_count_on_home` | Small-account cold-start eligibility and exploration sampling | The internal cumulative Home-feed impression count carried on the candidate post; `< 200` is one of cold start's 5 hard conditions | It directly equals the total Views a creator sees in the front end, or is a test allowance of 200 unique readers the system gifts for free |

Sources: [13](#ref-13) [14](#ref-14) [35](#ref-35) [36](#ref-36)

One gap on row two needs stating plainly. Both ends can be traced through: on the model side (`model_runner.py`), a probability output of this kind really is returned; on the Home Mixer side, the fusion function (`scoring.rs`) really does read a prediction field named `click_dwell_time` and multiply it by `0.4`. The middle part — the adapter code that converts the model service's return value into that field — is not in the public repo.
At the same time, for the threshold-judgment line of `CLICK_DWELL_TIME` source in `loss_recsys.py`: [55](#ref-55)

```python
gt_binary = (gt_raw.astype(jnp.float32) > threshold).astype(jnp.float32)
```

I ran the original function locally on CPU with inputs `[9, 10, 10.0001, 20]`, and the output labels were `0, 0, 1, 1` in order — confirming that exactly `10` is still `0` (it must be strictly greater than `10` to be `1`). But let's be clear about what this test proved and what it didn't: it proved only the mathematical boundary — the value must be strictly greater than `10`; exactly `10` doesn't count. What unit that `10` is in, whether opening an Article counts into it, and how much reach it finally converts into — the upstream code isn't public, this test can't answer those, and we only say what the code says: "exceeding the threshold 10." [98](#ref-98)

Bringing this code logic down to everyday writing, the principle is as plain as it gets: **if you want a reader to dwell on your post a while longer, you first have to put genuinely worthwhile material in front of him — material worth twenty or thirty seconds of his time.**
- Take writing "how to talk pricing with a client": in your first sentence you promise the reader an "original plan vs. reduced plan quote comparison" — then the body must immediately produce both quotes. You promise "the failure case of how cutting price without cutting scope blew up" — then honestly write out how the client dragged things out, step by step, at the time. With real material before his eyes, the reader's dwell time rises on its own.
- Conversely, if you have only three sentences of substance and, to pander to the algorithm, forcibly water it out to ten paragraphs, inserting every two paragraphs a spinning-wheel line like "Don't rush — the third, truly decisive point is at the very end…" — that is not adding reading value; it's burning the reader's patience, and greatly raises the odds he flicks away outright (triggering the `-0.02` `Not dwelled` penalty) or even taps "Not interested (`-52.272`)."
- Images follow the same principle: if you post a plan comparison table, set the type size so a phone screen clearly shows "which items were cut on the left, how much money was saved on the right." If the image text shrinks to ant size and, even expanded (even triggering `Photo expand` `0.05`) and zoomed, it's still a blur, then the problem the reader came to solve stays unsolved — and next time your name scrolls by, he won't tap in again.

### 11.4 The time readers spend must have something to read

So in daily creation, never make "how to trick readers into a full 10 seconds at the opening" your writing goal:
- If one clear comparison table lets a reader find the parameter he urgently needs in 6 seconds, bookmark happily, and leave, those 6 seconds are high-quality, effective dwell;
- If a deep test report genuinely takes a reader 90 seconds to finish, then lay out the test samples, the comparison data, and the failure counterexamples solidly, so every screen he scrolls down delivers new information.

The platform's changelog says CREAD made dwell-time prediction "more accurate, better," and the public code lets us see this 30-threshold log-restoration design with our own eyes. But since the platform did not also publish evaluation datasets, an error-reduction percentage, or live A/B results, we can explain CREAD's working principle clearly while never fabricating "accuracy improved by X percent," "long-post traffic will now multiply," or declaring "short posts are finished for good." [11](#ref-11) [13](#ref-13)

## 12 What do the 1st like and the 32nd like actually trigger?

A viral "breakout password" circulates online: "Once a post is out, the 1st like (`1fav`) gets it into the junior recommendation pool; collect the 32nd like (`32fav`) and you unlock the advanced stranger traffic pool!"

Open the public repo and the names `1fav` and `32fav` really are written, in black and white, in the index modules — so the rumor wasn't invented from nothing. The problem is that second-hand retellers drew an equals sign between four completely different steps: **"triggering an index update," "being written into some database list," "being read by a recall buyer," and "finally being displayed on a stranger's home feed."** From an inclusion condition alone, the system has never promised anyone guaranteed reach. [37](#ref-37) [38](#ref-38) [34](#ref-34)

Follow the moment "someone likes your post" forward:
In `phoenix-rankall-strato/columns/favoriteEventProcessor.strato` sits a processor dedicated to like events, `favoriteEventProcessor`. When it receives a `Favorite` event, it must first read the current cumulative like count (`favorite count`) out of the event packet; if the count can't be read, it abandons this update request outright. (Note: non-like events, such as un-liking, are ignored inside this processor — but that must not be inflated into "the whole X system never processes un-likes.")
Next, the program checks the cache record: **has this post sent out an index update before?** Depending on "no cache record yet (first trigger)" versus "cache record exists (later triggers)," it walks two entirely different sets of check conditions: [37](#ref-37)

| Event situation | What is actually checked here | Boundary | What it cannot be stretched into |
| --- | --- | --- | --- |
| No update cache yet (first trigger) | The post hasn't aged out, and the current like count is below the system's count ceiling | Post age must be **strictly less than 49 hours**; like count less than $2^{30}$ | It's not that only `count == 1` can send the first index request (if it's already 3 likes at first processing, it passes just the same) |
| Update cache exists (later updates) | The like count reached the next power-of-two threshold; at least 1 minute has passed since the last update; neither the first update nor the post itself has aged out | **Update interval ≥ 1 minute**; **≤ 48 hours since first update**; **post age < 49 hours** | It absolutely does not refresh the index or expand distribution once per additional like |
| Count missing | `favorite count` can't be read from the event packet | Skips directly; sends no index request this time | The front end showing a like doesn't mean every internal index step in the back end has already run in sync |
| Creation time missing | When computing post age, a missing creation time defaults to `0` | In the current year (2026), subtracting `0` judges it a decades-old post (aged out, eliminated) | A missing timestamp must not be mistaken for "no age limit, valid forever" |

Source: [37](#ref-37)

```text
With cache present, all of these must hold at once:
Time since first index update <= 48 hours
Post age < 49 hours
Current like count >= nextTriggerThreshold
Current like count < 2^30
Time since most recent index update >= 1 minute
```

Source: [37](#ref-37)

Look at the inequality signs in those hard lines of code — every one of them has a point:
- "Since the first index update" uses **`<= 48 hours`** (excluded only past 48 hours);
- "The post's own publishing age" uses **`< 49 hours`** (excluded the moment it fills 49 hours);
- Between two index updates sits a **`>= 1 minute`** throttle (dense likes within 1 minute never retrigger an update).
These numbers govern only the one like-event processor, `favoriteEventProcessor`, and its decision "whether to forward an index update request." The home candidate pool's 48-hour age filter (`AgeFilter`) further down is a separate matter — never knead them into one unified "posting countdown alarm clock." [37](#ref-37) [39](#ref-39)

### 12.1 At 32 likes, the index may still not update immediately

Why does everyone keep naming the numbers `1` and `32`? Because in `favoriteEventProcessor.strato`, after each successful index update, the program sets "the like threshold for the next update trigger (`nextTriggerThreshold`)" to **the next power of two (power-of-two) above the current like count**:
- After an update at **1 like**, the next threshold is set at $2^1 = \mathbf{2}$ likes;
- Then in sequence: **4, 8, 16, 32, 64, 128…**
- If, at some event's processing, your post jumps in one breath to **33 likes**, the next threshold the program computes is likewise **64 likes** — it does not go back and rerun the skipped numbers in between. [37](#ref-37)

```text
When count > 0:
nextTriggerThreshold = 2^(floor(log2(count)) + 1)

Public special case when count == 0:
nextTriggerThreshold = 2
```

Source: [37](#ref-37)

Understand this "power-of-two threshold + 1-minute throttle" and here's a real scene fully consistent with the code logic, showing why watching the front-end "32nd like" is meaningless:
Suppose your post is popular right out of the gate, and at the moment it receives its **16th like** it has just triggered an index update (the system sets the next threshold to `32`). Then, a mere **30 seconds (half a minute)** later, your post rockets to **32 likes**.
Question: does this 32nd like trigger an index update?
**No.** Although your like count has reached `nextTriggerThreshold` (32 likes), less than 1 minute (only 30 seconds) has passed since the last update (at 16 likes), so the `time since most recent index update >= 1 minute` throttle stops it cold. Whether an update can be made up after the 1-minute mark depends on whether new like events come in afterwards, and on when processing succeeds. (Note: this example is derived strictly from the source conditions; no real account's live logs were used.) [37](#ref-37)

So when you see your post's like count stall at 31, 32, or 33, don't mystically diagnose "ah, my post is waiting for its 32nd like to unlock a new traffic pool," and definitely don't run around group chats begging friends to top you up to 32 likes. Answering readers' concrete questions in the replies and adding useful material is what's real. There is no mechanism in the code like "fill up 32 likes and a batch of stranger traffic is automatically issued." [37](#ref-37) [34](#ref-34)

### 12.2 How `1fav` and `32fav` each take content in

When a like update request passes that gate and reaches the next stop, the candidate processor `phoenixRankAllCandidateProcessor.strato`, the program does not blindly file it away. It **re-reads this post's latest details and engagement counts from the database**, then routes by event source, whether it's a Community post, whether it's a reply or repost, and safety-visibility conditions:
In the like branch (`Fav` branch) of an ordinary eligible original post, the program first builds the `1fav`, backup, and topic-related indexes, then separately judges whether the post qualifies for `32fav` and the dedicated video indexes. That is: one like event in no way means every index list takes the post in: [38](#ref-38)

| Index | Main visible inclusion conditions | Key detail | Limit on operational claims |
| --- | --- | --- | --- |
| `1fav` | Enters the `Fav` branch of an ordinary eligible post | Inside `build1FavIndex` there is no further `likes >= 1` gate; even if the re-read count is `0` likes, it just logs a race note and still sends the post into the `1fav` index | Although named `1fav`, like counts across back-end services are not necessarily synced to the millisecond when the 1st like lands |
| `32fav` | Enters the `Fav` branch of an ordinary eligible post, and the re-read `favoriteCount >= 32` | The condition is `>= 32` (greater than or equal to 32), not a fixation on the exact 32nd-like event | Being written into the `32fav` index only means stored in that data bucket; it cannot be converted directly into stranger reach |
| `search_unfiltered` | `Fav` event, non-Community post, non-plain-repost, and count `>= 1` | Built before the later reply routing and general visibility filters | Entering the search index is no evidence of clearance into the For You recommendation feed |
| `1fav_reply` / `32fav_reply` | Eligible reply posts under `Fav` events; explicitly excludes author self-replies (`self-reply`) and replies filtered at this point | `32fav_reply` additionally requires the re-read like count `>= 32`; reply posts use their own independent index names | Even with a reply-dedicated index built, it doesn't prove every home recall source online is reading it |
| `post_creation` | The `PostCreation` branch of an ordinary eligible post | This index is built at the very moment you press post (0 likes) | Iron-clad proof: **the 1st like cannot be treated as the common, sole starting point of every index in the whole recommendation system** |

Source: [38](#ref-38)

```text
build1FavIndex's count-race handling:
If the re-read favoriteCount == 0: log 1fav_uec_count_race
Then still send the index event with indexName = "1fav".
```

Source: [38](#ref-38)

See how real this source detail is: inside `build1FavIndex`, the programmer even wrote a dedicated stretch handling "the re-read like count is `0`" — when an event has fired but the other database still reports `favoriteCount` as `0`, the system logs a monitoring metric named `1fav_uec_count_race` (like-count read/write race, out of sync), then **files the post into the `indexName = "1fav"` index anyway**. This tells us once more: count synchronization in a back-end distributed system inherently carries small delays, and the like number on your phone screen must never be treated as a precision "algorithm progress bar." (This is fallback logic for read/write delay, of course — not the system deliberately stuffing every zero-like post into `1fav`.) [38](#ref-38)

Note also: this main index flow for ordinary posts skips Community posts and plain reposts (Retweet) outright, while replies (Reply) are routed to the separate `1fav_reply` branch. If a post carries visibility restrictions or NSFW marks, it is routed to specific branches too. None of these upfront qualifications can be trimmed away into "any original post, 1 like, site-wide push." [38](#ref-38)

### 12.3 The index is built — now check who reads it

Writing a post into an index is like shelving goods in a warehouse: **goods on the shelf still need the recall buyers out front to come to this shelf and take them.**

Follow the code to the data-consumption side (`phoenix-rankall/src/config/mod.rs` and `phoenix/xrex/data/retrieval_dataset.py`):
In rankall's public time-window configuration, the 24-hour and 48-hour windows for `1fav` are indeed defined, along with the 24-hour window for `32fav`, and written index events are routed into their corresponding data buckets. But when we check **"what data file the ordinary For You home feed actually reads,"** we find the biggest evidence difference: [34](#ref-34)

| Data layer | What the public code has traced |
| --- | --- |
| Production and storage of `1fav` | Eligible like events produce `1fav` index events; the storage layer has corresponding 24-hour / 48-hour windows. |
| Consumption by the ordinary Home recommendation feed | The three main datasets in `RetrievalDataset` — `HOME`, `HOME_COLD`, `HOME_HOT` — **all explicitly cite `1fav_1day.parquet` (the `1fav` 24-hour store)**. |
| Splitting the cold/hot Home pools | `HOME_COLD` and `HOME_HOT` both read from the same `HOME` (`1fav_1day.parquet`) data source, then split in two by "cold-post conditions (like count, view count, freshness)" — **it is not the case that `HOME_COLD` stands for 1 like and `HOME_HOT` for 32 likes.** |
| Production and storage of `32fav` | There genuinely is a `favoriteCount >= 32` inclusion condition, index events, and a 24-hour storage window (`32fav_1day`). |
| The consumption side of ordinary `32fav` (evidence gap) | **In this public For You code tree, from start to finish, no concrete ordinary home-feed recall service has been found reading `32fav_1day`.** (Kept strictly as an evidence gap.) |

Sources: [38](#ref-38) [34](#ref-34)

Look: in the `RetrievalDataset` enumeration, the only read item with `32Fav` in its name is `IMMERSIVE32FavVideo14To30Day`, reading the file **`32fav_video_14to30day.parquet`** — a "14-to-30-day old video store" built for the immersive video feed. It cannot be used to paper over the ordinary text-and-image post claim of "the 32nd like unlocks the For You mega traffic pool." Of course, by the same rigor: ordinary `32fav_1day` may be read by some internal service outside the public repo, or invoked by unpublished live configuration. But within what public code can prove, we can confirm only "the system produces and stores `32fav`" — never guarantee on the unknown's behalf that "hit 32 likes, get a wave of new recommendations." [34](#ref-34)

Even for `1fav_1day.parquet`, genuinely read by `HOME`: once a buyer lifts a post into the temporary basket, it still runs the gauntlet of the seen filter, follow relationships, the 48-hour age limit, model prediction scoring, and same-author decay. The impression count you see in your account Analytics is merely the final result after all of that runs. Which store a given post entered, and why it lost to someone else's post in a particular refresh — without internal server request logs, nobody can see it. Never force the few likes on a dashboard onto the machinery. [34](#ref-34)

## 13 Bookmarks have no standalone weighted term — the system still uses them

Many tutorial and checklist creators notice a pattern: their posts often have "only a dozen likes, but hundreds of Bookmarks." Then they flip to the 24-term fused scoring weight table (`xai-value-model/weights.rs` and `scoring.rs`) and their hearts sink halfway: **the main scoring table has no `bookmark` row at all. A rumor even circulates that "bookmarks score 0 in X's algorithm; they're worth nothing."**

**Don't be fooled by "not listed separately in the main scoring table."** When a reader bookmarks your template post, it usually means he intends to pull it out and follow it in a couple of days when he does the work. Track the bookmark data flow (`BookmarkMetadata`) through the codebase and you unearth the bookmark's **two hidden core uses** in the recommendation system. [2](#ref-2) [40](#ref-40)

The first hidden use lives in **personalized similar-content recall (`SimClusters`)**:
Open `explicit_engagement_signals_query_hydrator.rs` and `simclusters_source.rs` and you'll see: when a reader scrolls the home feed, the system reads not only the posts he recently liked and reposted — it specifically reads his recent **bookmark records (`BookmarkMetadata`)**. Then the `SimClusters` buyer merges the post IDs this reader recently bookmarked together with his other interaction posts, and uses them as **"seeds for finding similar good posts (Seeds)"** to trawl the whole site for new posts highly similar in topic to those bookmarked posts. (The public switches on this path default to on. Whether it actually takes effect also depends on that recall source being enabled for the request, the seed count, the seed ages, and the candidate screening limits.) [40](#ref-40)

Mind the object of the effect here: suppose reader A bookmarks your *Chinese invoice organizing and automatic reconciliation tutorial*. Your post's ID then becomes A's "interest seed." Tomorrow and the day after, when A scrolls his home feed, `SimClusters` will take your post's seed and go find A similar productivity-tool posts — what comes back might be a peer's similar work, and very plausibly **the next finance-automation post you just published**. (Later filters and scoring still apply, of course; the code does not say "as long as A bookmarked your old post, your next one is 100% guaranteed delivery.") [40](#ref-40)

### 13.1 Bookmarks also take part in recall model training

Beyond serving as similarity-recall seeds in `SimClusters`, the bookmark has a second, harder-core use: **it serves directly as a positive training example for the two-tower recall model.**

Open `phoenix/xrex/configs/xrecsys_two_tower.py`. In the two-tower recall model's immersive-branch positive list (`immersive_positive_actions`), `CLIENT_TWEET_BOOKMARK` (the client bookmark action) sits right there, shoulder to shoulder with likes, replies, reposts, video quality viewing, follow author, and shares. During training the model computes its loss directly over positive and negative examples including bookmarks — meaning: **bookmarks are not booked in the final fusion formula as "X points per bookmark," but they directly teach the upstream recall model "what kind of post is good content users love to save."** [41](#ref-41)

```text
immersive_positive_actions includes:
recsys_pb2.ActionName.CLIENT_TWEET_BOOKMARK
```

Source: [41](#ref-41)

Lay the bookmark's three positions in the whole algorithm repo side by side, and the "bookmarks score zero, they're useless" line will never mislead you again: [41](#ref-41)

| Position | How the bookmark is used here | Object of the effect | Result it cannot guarantee |
| --- | --- | --- | --- |
| Shared fusion scoring formula (`scoring.rs`) | No separately listed `bookmark` weight field | The weighted-sum computation at the final ranking stage | Never inflate "this one formula lists no field" into "the whole X algorithm ignores bookmarks" |
| `SimClusters` similar-content recall | The IDs of posts a reader bookmarks merge into the similar-content query seeds (at most the most recent 15 per class kept) | The reader who tapped bookmark, and the candidate recall on his later home-feed refreshes | It doesn't guarantee re-pushing the original post he already read, and it isn't a fixed "reach redemption coupon" stored up for the author |
| Two-tower model, `immersive` branch training | `CLIENT_TWEET_BOOKMARK` is explicitly listed among this branch's training positives (Positive Actions) | Training the recall model to recognize which candidate content deserves to be fished back | This is a model training target; it doesn't mean each extra bookmark on the ordinary home feed immediately adds a fixed score to one post |

Source: [41](#ref-41)

Let's pin down the boundary numbers on this `SimClusters` bookmark-seed path (`home-mixer/params/param.rs` and `simclusters_source.rs`):
- **Count ceiling**: in the public parameters, each class of explicit engagement signal keeps at most the reader's most recent **15** (and the `SimClusters` recall source must be enabled, the current request must not be an in-network-only request or one carrying cached posts, and usable signals must exist);
- **Two age limits (90 days vs. 48 hours)**: the bookmarked seed post itself must be no more than **90 days** old by publishing time; and the similar new candidates fished out with that seed are, by public default, limited to those published within **48 hours** (and subject to a similarity-score threshold and a return-count ceiling).

One easily confused time detail: **the 90-day seed validity checks "the original bookmarked post's own publishing time (`tweet_id` creation time)," not "the day the reader tapped the bookmark button."**
An analogy: suppose a reader today finds an old tutorial you wrote **two years ago**, loves it, and bookmarks it today. Although the bookmark action happened today, the old post's own age exceeds 90 days, so at this `SimClusters` seed-age check it still gets excluded. To be clear about the scope of that sentence: it only says the post can't serve as a seed on this one `SimClusters` path — it doesn't mean a bookmarked old article is useless in every other model feature. And what is described here are the public default switches, which are no substitute for each live request's actual configuration. [41](#ref-41)

So when we write tool templates, configuration guides, and pitfall checklists, we should clearly mark at the end **"in what scenario this table is used, what each field means, and the date it was last updated"** — then a reader who bookmarked you can come back in half a month, open the bookmarks folder, and use it immediately, and when you keep publishing depth content in the same series within 48 hours, you more easily catch the precise readers `SimClusters` fishes over along the bookmark seeds. [41](#ref-41)

### 13.2 Give the reader a reason to use it next time

How do you turn an ordinary opinion post into a practical tool post readers itch to Bookmark and copy the link of?
Take writing **"how to choose an AI meeting summary / audio transcription tool"** as the worked example: if the whole post merely ranks tools A, B, and C by personal feel ("number one is X, number two is Y"), a reader glances, memorizes the names, and scrolls away — no reason to bookmark at all.
But if your post hands over a **"3-sentence litmus comparison table" that readers can apply the next time they test any meeting tool themselves** — teaching them to check whether the AI summary drops **veto conditions**, whether it can tell **discussion proposals from final decisions**, and whether it fabricates **items awaiting confirmation** into settled decisions — and even prepares the 3 standard input lines for them:

| Check item | Usable sample input (feed it straight to the tool) | What to watch in the AI summary | Record the test result |
| --- | --- | --- | --- |
| Veto condition | "If it requires uploading the client's raw materials to an external public cloud, we do not adopt this plan." | Whether the summary fully keeps the precondition and the "do not adopt" bottom line | Pass / Missed / Reversed |
| Proposal vs. decision | "What I just said is only a suggestion to pilot it small-scale next month; today we have not agreed to a formal purchase." | Whether the summary wrongly writes "suggestion to pilot" as "decided to purchase" | Pass / Missed / Reversed |
| Item awaiting confirmation | "The exact annual budget figure will be finally confirmed after Finance checks next Wednesday." | Whether the summary freelances it into "budget approved" | Pass / Missed / Reversed |

Every time you review a new tool, feed these three sentences in, fill the last column with the measured result, and note the tool's version number, the test date, and the language it applies to. At the post's end, you don't need to plead dryly, "Everyone remember to like and bookmark!" Just write a passage like this, naturally:

> **An ending you can use:**
> "Next time your team evaluates any AI meeting summary tool, first test it with the three trap-loaded lines above, then check against the recording itself. Don't just look at whether the AI's formatting reads smoothly — watch whether it wrote 'a proposal not yet decided' as 'a decision already made.'"

See it: this ending tells the reader directly **"when to pull this table out, and how to test with it."** Any reader with an evaluation need, seeing it, reacts first by tapping "Bookmark" to store it in his toolbox, or tapping "copy link (`Share via copy link`, prediction weight a towering **`20`**)" to send it into the company's Lark / WeChat work group. Of course, for a breaking-news flash or a temporary notice, there's no need to force the tool-table shape; form always serves content.

This is also the place to pull the "private sharing" mechanism into the clear: in the main scoring table, **DM share (`Share via DM`, weight `5`)** and **copy link (`Share via copy link`, weight `20`)** carry very high independent prediction weights — a path parallel to the "bookmarks enter `SimClusters` seeds" path above. Many deep industry analyses see few public reposts on the surface, yet everyone is furiously tapping "copy link" into private groups. In the model's eyes such posts are still top-grade content. (From public code alone, we can't see in the front end how many times someone else's post was link-copied or DM-shared.) [2](#ref-2) [21](#ref-21) [40](#ref-40)

## 14 Whom does the mutual-follow bonus take effect for?

In the 24-term weight table earlier, one towering weight of **`20`** draws the eye: **"the reply prediction term for qualifying mutual-follow cases (`5 + 15 = 20`)."**
Seeing that `20`, people derive two schools of street tactics at once:
- School one: "Then I'll mutual-follow (follow back) everyone I meet, pile up thousands of mutual friends, and won't every interaction weight on anything I post quadruple?"
- School two: "I mutually follow a few big accounts; I'll camp in their reply sections daily grabbing the sofa seat, and my reply will ride a 20x weight to the top comment!"

Bring out the judgment source in `xai-value-model/inputs.rs` and `weights.rs` and confront them directly; both fantasies burst on the spot: [42](#ref-42)

```rust
!self.is_reply && !self.is_retweet && self.is_mutual_follow_author
```

Read the three `&&` in that Rust line word by word (all must hold at the same time):

1. **`!self.is_reply`**: the candidate post being scored **must absolutely not be a reply post (Reply)**;
2. **`!self.is_retweet`**: the candidate post being scored **must absolutely not be a plain repost (Retweet)**;
3. **`self.is_mutual_follow_author`**: **the reader currently scrolling the home feed** and this original post's author must be in a **two-way mutual-follow (Mutual Follow)** relationship.

Only when all three iron rules hold at once does the program raise the weight coefficient for "predicting this mutual-follow reader will leave you a reply" from the base `5`, plus the mutual-follow bonus `15`, to **`20`**.
Watch its boundary:
- It adds 15 only to the **"reply prediction"** term; it does not multiply likes, reposts, dwell, and every other interaction by 4. And the code has a dedicated "mutual-follow dwell extra bonus" parameter, set in the current public defaults to **`0`** (not a point added)!
- The bonus is **"per-reader"**! Suppose you publish an original post. When your mutual-follow friend Li Si scrolls to it, if the AI predicts a 2% (`0.02`) chance Li Si will leave a reply, then in Li Si's basket the reply term's contribution rockets from `5 × 0.02 = 0.10` to **`20 × 0.02 = 0.40`**. But at the same second, when a stranger, Wang Wu, who doesn't follow you yet, scrolls to the same post, Wang Wu doesn't mutual-follow you (`is_mutual_follow_author = false`), so in Wang Wu's basket the reply coefficient is still the ordinary **`5`**. [42](#ref-42)

| Same reply probability assumption | Coefficient used | Mutual-follow condition met | This term's contribution |
| --- | --- | --- | --- |
| Predicted reader reply 2% (non-mutual reader) | 5 | N/A | 0.10 |
| Predicted reader reply 2% (mutual-follow friend) | 5 + 15 | Applies | 0.40 |

Fix the same 2% predicted reply probability, and in front of a mutual-follow friend, this single reply term's score really does move from `0.10` to `0.40` (up 4 times). But since the total also contains twenty-plus other positive and negative predictions and later adjustments, this in no way means total site-wide reach quadrupled. [42](#ref-42)

### 14.1 Ordinary follow relationships carry another multiplier

Beyond "mutual-follow friends viewing an original post get reply weight 20," follow relationships carry another pivotal multiplier in `VM Ranker`: the **out-of-network multiplier (OON multiplier)**.

In the public defaults of `vm-ranker/params.rs`, for ordinary out-of-network candidates whose author "the reader doesn't follow yet," the system sets an OON multiplier defaulting to **`0.75`**.
Let's compute what that `0.75` means: holding every other condition fixed and comparing only this multiplier, an "out-of-network post from a stranger (× `0.75`)" must reach a raw, pre-multiplier score of **$1 \div 0.75 \approx \mathbf{1.3333}$ times (about 33.3% higher than)** an "in-network post from a followed author (× `1.0`)" for its post-multiplier final score to fight the in-network post to a draw. [86](#ref-86)

Of course, that's a math condition for competing scores inside one candidate pool; it can't be crudely translated into "strangers' reach is necessarily 25% below followers'." (Two exceptions to note here: Topic Requests use their own separate set of configuration; and the code also allows applying this multiplier setup to some in-network replies and reposts.) Read "followers in-network `1.0` vs. out-of-network `0.75`" together with the earlier "mutual-follow original-post reply coefficient `5 + 15 = 20`," and you see follow relationships doing different jobs at different stages — never a grade table like "ten thousand more followers, a fixed number of extra points for the account." [86](#ref-86)

Especially that "camp in a big account's replies grabbing the front row" move: when you post a reply under a big account's post, the thing you sent is itself a `Reply` (`is_reply = true`), kicked out at the very first gate, `!self.is_reply`. Even if you mutually follow that big account — or the readers scrolling the replies — **your comment absolutely cannot claim the `5 + 15 = 20` mutual-follow bonus**. (It can still be seen by people who open the conversation page's replies, but don't use a "mutual-follow 20x weight" to give "grabbing the top comment everywhere" a theoretical basis.) [24](#ref-24) [42](#ref-42)

### 14.2 Give people who know the problem something to answer

Now that we understand "a mutual-follow friend's reply prediction on an original post reaches `20`," how do we actually use the mechanism well?
**The answer is not zombie-fan mutual-follow groups (zombie accounts will never read your professional content; the AI's predicted probability of them replying to you is near 0, and 20 × 0 is still 0). It's to build mutual follows with real peers in your field and with long-time readers, and when writing original posts, "leave professional openings that insiders can answer."**

Two down-to-earth examples:
- If you create **small restaurant startup content**: don't post all-purpose correct filler like "Another day of hard work today, restaurant people, keep going." Instead, list two real takeout boxes' cost and soup-leak rates when delivering noodle soup, then throw out a true question peers face daily: **"When your shop delivers soupy rice noodles, do you use snap-lid bowls or sealing film? Which draws more customer complaints about leaks?"** A restaurant peer following you sees that question and his fingers itch — he replies right below with his own measured experience.
- If you create **programmer / technical development content**: hit a weird error, and don't just post "Fixed it at last." Post the error log screenshot, the environment version numbers, and the three false causes you've already ruled out, so peers who've stepped in the same pit can build on your debugging path with the edge cases they met.

When a mutual-follow peer adds a genuinely valuable counterexample or new scenario in the replies, verify it, then work it into your next original post. That turns your mutual-follow circle into a truly active "professional think tank" — every time you publish a new original post, the system computes whether this batch of mutual-follow peers will reply using the `5 + 15 = 20` coefficient — and what it multiplies is still each reader's own predicted probability. A big coefficient does not mean the post necessarily takes off; the total still depends on twenty-plus other terms.

## 15 After a reader taps into your profile, why would he follow you?

Many creators see a lot of "Profile Clicks" in their back-end data and assume that luring people into the profile makes the post's algorithm score soar.
Look straight at the public default weight table in `home-mixer/params/param.rs` and `scoring.rs`, and the two terms' treatment differs like heaven and earth: [43](#ref-43)

| Predicted item | Direct coefficient in this public default set |
| --- | --- |
| Tapping into the author's profile page (`profile_click`) | **0** |
| Following the author (`follow_author`) | **4** |

See it: **a plain "tap into the author's profile (`profile_click`)" carries a direct weight coefficient of `0` in the main fusion scoring formula. And "follow author (`follow_author`)" carries a prediction weight coefficient of a full `4` (more than 6 times the like's `0.66`).**
(Of course, the boundary applies here too: this doesn't mean each new follower books the post 4 points; and `VM Ranker` has its own profile-page dwell parameters, and a profile click is the prerequisite action that leads to a follow, so it may be used in the model's other features.) [43](#ref-43)

Not only that: in the same repo's V8.2 content-understanding code (`grox/flows/mm_emb/renderer_v82.py`), when the AI model goes to understand a post you published, beyond the post's body and lead image it also stitches the **author's display name (Display Name), username (Username / Handle), and bio (Bio, truncated at the character cap)** into the text input fed to the multimodal model. This proves: **your bio is not only for the human readers who tap into your profile — in this flow it is also input data the large AI model reads directly.** (The code merely reads the Bio in for semantic understanding; there is no cheat formula like "stuff the Bio with hot keywords for extra points.") [44](#ref-44)

### 15.1 Read the post, the bio, and the pinned post as one chain

Since "tapping into the profile itself is 0, and tapping follow after entering carries a weight of 4," we have to think one thing through: **a stranger scrolls to a good post of yours, taps curiously into your profile — in those 3 seconds, what does he see that makes him press the Follow button?**

Picture the most common crash scene:
Suppose you consistently create "AI office tool tests." Today you published a hardcore piece, *I tested a meeting summary AI: it dropped the client's veto condition*. It draws a crowd of project-management readers into your profile. And what do they find? Your bio reads eight big characters: **"Love tech, explore the future, savor life."** Below it, your pinned post is a koi-lottery repost from half a year ago, or some inscrutable mood rant.
A question mark pops in this reader's head: "Is this person a passer-by who happened to write one review, or will he keep producing tool tests like this?" Unable to tell what he'd get by following you, he closes the profile and leaves — and you've wasted a `0`-point profile click and lost a `follow_author` conversion weighted at `4`.

How to fix it? String your **single hit post, your bio, and your pinned post** into one airtight chain of evidence:

> **A bio can be rewritten into a concrete, verifiable promise like this:**
> "I test AI tools' performance in real Chinese office workflows. Every review keeps the original test samples, the failure counterexamples, and reproducible steps."

Then, at your **profile's pinned spot**, hang the most solid, evidence-complete flagship piece you've written (say, your review-methodology manifesto, or your hardest multi-tool comparison, with a clear title, checkable data, and clear applicability boundaries).
The same logic holds for a food-recipe account: don't write "Only love and food cannot be betrayed" in the bio. Write **"One-person meals, one flat pan, quick weeknight dinners; every dish lists supermarket-easy substitute ingredients,"** and pin your best-loved flat-pan recipe collection to deliver on that sentence.

After each new post, switch to the visitor's view and read your fresh post, your Bio, and your pinned post as one chain: **can the stranger who tapped in, drawn by today's post, tell within 3 seconds what value you will keep providing him?** (Making the bio concrete raises real readers' follow conversion and lets the AI identify your account's semantic positioning more clearly. But don't believe the online line that "changing a few bio words resets your account's audience pool in one tap.")

## 16 More replies — but look at who is saying what

Another dangerous play circulates in creator circles: "Since an ordinary reply (`Reply`) weighs `5` (nearly 8 times the like's `0.66`), I'll deliberately say something extreme in my post, or leave a rookie-level factual error, lure the whole internet into my replies to scold and correct me — replies explode, reach takes off, right?"

Do not play with this fire.
Open `scoring.rs`, `home-mixer/params/param.rs`, and `vm-ranker/params.rs` and look at the fusion formula's lower half: while computing positive interaction predictions, the system nails down four **veto-grade negative penalty terms**: [2](#ref-2) [45](#ref-45)

- Predicted probability the reader **blocks you (`Block author`)**: weight **`-31.2`**;
- Predicted probability the reader taps **"Not interested in this post (`Not interested`)"**: weight **`-52.272`** (VM Ranker: `-47.52`);
- Predicted probability the reader **mutes you (`Mute author`)**: weight **`-58.8`**;
- Predicted probability the reader **reports you (`Report`)**: weight **`-234.0`**.

See the magnitude of those negatives?
An ordinary reply weighs `+5`; a "Not interested" coefficient is **`-52.272`**; a "Report" is **`-234.0`**. Note: these numbers multiply predicted probabilities, and cannot be converted into "worth how many replies." All we can say is: the negative coefficients' magnitude is far larger than the positives'. When you use provocation, attacks, or cheap bait to set your reply section ablaze, the reply prediction probability does rise a little — but the negative prediction probabilities of readers who are sick of you, tapping "Not interested, Mute, Block, Report," surge right alongside. Positives and negatives cancel, and your post's total can be smashed below zero on the spot.

A more direct punishment waits behind it: once a reader, fed up with your provocation post, really taps Mute or Block on you, then in the pre-scoring filter stage of every later recommendation request, the relationship filter `author_socialgraph_filter.rs` looks up that existing block/mute relationship, and **as long as that relationship stands, your posts cannot enter that reader's candidate pool**. This is no "the model predicts he might mute you" — the road is physically blocked. [45](#ref-45)

Take a product comparison review: you can point out, objectively and sharply, "this software's officially advertised 99% recognition rate is seriously inconsistent with our measured results," and lay out your test samples and failure screenshots — that kind of on-the-merits, hardcore criticism sparks heated professional discussion just as well. There is no need, to farm replies, to spray-map insult the users of that software as "low IQ," or deliberately @ big accounts unrelated to the test to start a flame war. Replies drawn by flame wars are not the target audience you want to keep at all.

When you review two posts' reply sections, don't just count replies. Look at whether people are **adding test boundaries, asking about concrete scenarios, sharing their own pitfall cases** (all superb material for your next hit) — or purely attacking and cursing each other. However lively the latter's numbers look, once you count the negative penalty weights and mute-driven audience loss behind them, it's a losing trade. [45](#ref-45)

<a id="post-or-article"></a>

## 17 Long post or Article? (With the 64-like image-pull threshold and the V5/V8.2 measured teardown)

This is nearly every deep-content X creator's most agonized question: "I've written a solid piece of several thousand characters. Does it travel better as a **long Post (Longer Post)**, or does publishing it in the **Article editor** get it recommended more easily?"

After turning over every code file touching long Posts and Articles, my core conclusions are:

1. **In the final scoring formula (`scoring.rs`), there is no "format privilege bonus" that spots an `is_article` flag and multiplies your score by some factor**;
2. **But the two formats genuinely differ enormously in engineering: the underlying object structures, how the AI readers (V5 and V8.2) fetch text and images, the upstream "64-like threshold (`is_high_fav`)" for pulling images, and the visibility-filter rules when a draft is being edited.**

We can neither say flatly "the two formats are identical in the algorithm's eyes," nor believe the online hype that "just switch to Article and reach auto-explodes 5.7 times."

If I give the most practical conclusion first, my own publishing standard is very clear:
- **Content circling one pain point, completable in one logical line (say, within three or four thousand characters)** → publish a **long Post** directly, and hang the 1 most core results-comparison image in the ordinary image slot;
- **Heavy research that needs multiple sections, interleaved charts and code blocks, and that readers will search back through like a handbook (like this twenty-thousand-character piece you're reading)** → carry the full text in an **Article (or Articles split by question), and after publishing, be sure to post a separate "guide long Post with the core results image" to quote and promote it.**

Why is "Article + a guide long Post with images" the safest combination? Read the 6 layers of hardcore teardown in the code below and you'll understand completely.

### 17.1 What a long Post and an Article are in the system

First confirm the real identity of long Posts and Articles in X's product and code:
- **Long Post (Longer Post)**: in the product it's still an ordinary post (Premium just raises the single-post character cap to **25,000 characters**, and it can be used in ordinary posts, replies, and quotes with comment);
- **Article**: it has its own rich-text editor, supports multiple heading levels (H2/H3), and lets you embed multiple images, videos, and other posts in the body; after publishing it lands in your profile's dedicated **Articles section**. (Note: what we compare here are these two native X formats. Stuffing a link that jumps off-site to a personal blog, or splitting into a dozen-post thread, are different plays.) [6](#ref-6) [95](#ref-95)

In the back-end code the system distinguishes the two completely: the anti-abuse system BotMaker's feature extractor (`FeaturesOfTweet.java`), for instance, separately extracts `noteTweetId` (long post ID) and `articleId` (article ID); and in the Grox multimodal and safety system's `Post` data model (`data_types.py`), one post object holds both the post text `full_text` and an optional `article_metadata` (Article metadata, containing the **Article title, Article cover image, and Article body embedded media**). This proves the system's bottom layer never identifies an Article by "counting characters"; these fields mainly serve content understanding and safety checks — they are not a "format bonus card" in the scorer. [87](#ref-87)

Here is the panoramic comparison table of the 6 core layers where long Posts and Articles differ in the code; view the whole picture first, then take each layer apart:

| Comparison layer | Long Post / ordinary post text path | Article-related path | Judgment possible now |
| --- | --- | --- | --- |
| Object and content structure | `Post.full_text` holds the incoming post text; also an identity field `noteTweetId` | The same `Post` object can additionally carry `article_metadata` (title, cover image, embedded media) | The system's bottom layer fully distinguishes the two formats; it's not just counting body characters |
| V8.2 content understanding (new reader) | Takes the **first 4,000 characters** of the incoming `full_text`; takes only the 1st usable image from ordinary attachments `post.media` | Additionally reads the **Article title (first 200 characters)**; **does not traverse Article cover or embedded images** | This is the V8.2 processor's input rule, not a site-wide human reading cap |
| V5 content understanding (old reader) | Reads the post text and ordinary post media | Reads in order: **Article title → Article cover image → post text → ordinary media → Article embedded media** | The two reader generations' image-picking rules are entirely different; one shared "only the first image" line won't do |
| Reading and click behavior records | Ordinary clicks, Show more expansion, detail-page impressions, and dwell each have separate numbers | The protocol has a `PAGE_ARTICLE` page enum, but the mapping chain from opening an Article to training labels is not fully public | No guarantee can be made that "expanding a long Post" and "opening an Article" count as the same dwell event |
| Checked candidate recall and scoring | Runs the general candidate sources, the 24-term prediction fusion, and same-author `0.625` decay | **No guaranteed quota or fixed bonus multiplier found that takes effect on the `is_article` identity alone** | The code holds no explicit format bonus; implicit differences learned by upstream models from content features are not excluded |
| Visibility and safety filtering | Runs the general post safety rules and subscription audience eligibility checks | Additionally **`ArticleTweetContent` (blocks non-`Published` states)** and cover/embedded-media safety checks | These are display-qualification and risk rules, not a reach reward table |

### 17.2 Which text the 4,000 characters process — and where the Article body lives

Look at row two of the table: how does the V8.2 content-understanding reader (`grox/flows/mm_emb/renderer_v82.py`) read text?
Lift out the few core lines of code directly tied to text truncation and assembly (other unrelated fields omitted), and the truth is right there: [47](#ref-47) [83](#ref-83)

```python
MAX_POST_TEXT = 4000
MAX_ARTICLE_TITLE = 200

def _truncate(text: str, limit: int) -> str:
    text = (text or "").strip()
    if limit < 0:
        return text
    return text[:limit].rstrip()

if post.full_text:
    blocks.append(
        f"Post text: {_truncate(_strip_dangling_media_urls(post.full_text), MAX_POST_TEXT)}"
    )

article = cls._article_block(post)
if article:
    blocks.append(article)
```

Read the two key details in that Python code carefully:

1. **The two `if` checks execute in parallel, one above the other. They are not an either-or (`if ... else ...`).**
The function `_article_block(post)` reads `article_metadata.title` (the Article title, first **200 characters**). If a post carrying Article metadata also has a non-empty `post.full_text` (the outer post text carrying this Article), then **the first 4,000 characters of `post.full_text` and the first 200 characters of the Article title are both stitched into the input `blocks` together**. Online, this code gets retold as "a long Post reads the body; an Article throws the body away and reads only the title" — that's from people who didn't understand the two `if`s in the code. [83](#ref-83)
2. **`4000` is a real Python string-slice character count (`text[:4000]`).**
Whether a Chinese character, an English letter, or a punctuation mark, in a Python 3 string slice one character takes one position (it's not the token count of a model splitting by roots, and it's not the front-end editor's 25,000-character publishing cap). The truncated text and the picked image are then packaged and sent to the `embedder_v82.py` service to generate the **multimodal semantic vector (Embedding)** representing this post's topic. Note: this is for semantic understanding and audience matching, not for computing your reach by word count here. [47](#ref-47)

To verify this logic without ambiguity, I built in-memory `Post` objects locally with fields filled in, and ran the public `renderer_v82.py` processing function directly in a measured test (note: the local test examines only what this processor takes in and puts out; it does not call the live, unpublished-weight embedding model service): [88](#ref-88)

| Input, other fields fixed | V8.2's output | What this check shows |
| --- | --- | --- |
| `full_text` filled with 4,000 "字" characters; character 4,001 filled with "尾" | The output `Post text:` is exactly 4,000 "字"; the "尾" is mercilessly cut | The 4,000-character truncation boundary cuts strictly by Python character position |
| First 4,000 characters kept byte-identical; only content after character 4,000 changed | The V8.2 output text block is **unchanged, character for character** | On this V8.2 semantic-generation path, text past character 4,000 is completely invisible (other system modules are outside this test's scope) |
| Both `full_text` and a 201-character Article title filled in | The final output contains **both** `Post text:` and `Article title:` (title kept to first 200 characters) | Carrier post text and Article title fully coexist in the V8.2 output; neither excludes the other |

One thing needs an honest note here: the public code doesn't tell the whole story of how an Article's body gets into the model. What is known: in the public data mapper `grox/core/data_loaders/post_mapper.py`, the program puts the `post_metadata.text` passed in from upstream into `Post.full_text`; and when mapping `article_metadata`, it maps only the title (`title`) and media (`cover_media` / `media`) — there is no separate field holding the Article's full body. What is not known: how the real live upstream service (Strato is the collective name for X's internal back-end services — the `.strato` files mentioned throughout this piece are those back-end rule files, so when you see the word, read it as "back-end system") fills that `text` field, and whether the Article's ten-thousand-character body reaches the model through some other internal channel — that part of the implementation isn't public. So neither extreme can be claimed: you can't conclude, just because the field is named `full_text`, that every format's full body went in; and you can't declare, just because `article_metadata` lists no body field, that every model site-wide is blind to Article bodies. [87](#ref-87)

Also, in `home-mixer/models/content_features.rs`, the system extracts basic features such as the post's weighted text length (`weighted_text_len`) and line-break count (`newline_count`) for downstream use. That shows "how long the post is, how many lines it breaks into" are features the model can see — but the code likewise has no fixed formula like "more characters, more points" or "one blank line, a few points." [46](#ref-46)

Still, knowing V8.2's "first 4,000 characters of body + first 200 characters of Article title" reading rule, our drafting iron rule is already very clear: **when writing a long Post, get the research subject, the core pain point, and the main conclusion all out within the first 4,000 characters; when writing an Article, make the first 200 characters of the title and the outer carrier post's intro dense with information — never hold all the core keywords back for the last two thousand characters.**

### 17.3 Article cover and body images don't follow ordinary image-post rules (the full story on the "64-like `is_high_fav`" and the V5/V8.2 difference)

This is where most readers stall: **"What exactly is an Article's 64-like threshold (`is_high_fav`)? Why do the V5 and V8.2 readers read Article images differently? Where should I put images when I publish an Article?"**

No dry jargon. Follow **"the two steps X's back end runs, in order, after you press publish on an Article"**, in plain words, layer by layer:

#### 17.3.1 Step one: for the AI to read your image, a "porter (`MediaLoader`)" must first haul it over from the database

When you publish a piece, X's back-end Grox multimodal model reads your text and images and generates the "semantic vector" representing the content's topic, used to judge which interest circles to push it to.
But downloading and parsing high-resolution images from the server burns serious compute. So in the code of the "porter" that pulls media data (`grox/core/data_loaders/media_loader.py`), the programmers set a judgment switch named **`is_high_fav`** (literally: **"is this a high-like post?"**), and in the config file (`grox/config/config.py`) set its public default threshold to **64 likes (`deluxe_fav_count_threshold = 64`)**. [89](#ref-89)

What does that line of code actually do?
On the `MediaLoader` media-hauling path, only when the post satisfies **`is_high_fav` (that is, at least 64 likes)** — and also meets the pending-post selection, current task type, and existing-media-state conditions — does the porter enter the dedicated branch (`media_loader.py#L293-L303`) and pull the **Article's dedicated cover image (`cover_media`) and the images embedded in the Article body (`article_metadata.media`)**.
- **In plain words**: just after your Article goes out, **before it has collected 64 likes**, on this `MediaLoader` hauling path the porter, to save server compute, **may simply not pull the cover image and body illustrations you placed in the Article editor at all**.
- **And the rigor boundary must hold at the same time**: this `64` governs only the public default parameter of this specific `MediaLoader` media-pull path. **It absolutely does not mean "an Article must first earn 64 likes to qualify for the recommendation feed."** [89](#ref-89)

#### 17.3.2 Step two: even once the images are hauled over, the V5 and V8.2 "readers" pick images by completely different rules

Two generations of multimodal content readers (Renderers) coexist in the public repo: the old **V5 (`renderer.py`)** and the new **V8.2 (`renderer_v82.py`)**. Their attitudes toward Article images are worlds apart: [88](#ref-88)

1. **How the old V5 reader reads an Article**:
V5 is diligent. Its reading order is: **Article title → Article cover image → post text → ordinary post media attachments → Article body embedded media**. Of course, V5 is bound by an "image count budget (Budget)" — if a call sets the image budget to "read only 1 image," the first in line, the **Article cover image**, monopolizes that single slot, and the body's embedded illustrations don't get a turn.
2. **How the new V8.2 reader reads an Article (the biggest pit is here)**:
In text, V8.2 normally reads `post.full_text` (first 4,000 characters) and the Article title (first 200 characters). **But when it reaches the image-picking function `_collect_post_media`, it looks only in the "ordinary post media attachment slot (`post.media`)" — the source has no loop at all that goes through the Article's dedicated cover slot (`article_metadata.cover_media`) or body embedded-image slot (`article_metadata.media`).**

To verify this startling difference, I wrote a local test script, stuffing one in-memory `Post` object with three ready images at once: ① the **Article cover image**, ② an **ordinary post media attachment (`post.media`)**, ③ an **Article body embedded image**, then called the original V5 and V8.2 functions separately:
- Calling **V5**: it obediently returned all of them in the order "cover image → ordinary attachment → body embedded image" (with the image budget set to 1, it returned only the **Article cover image**);
- Calling **V8.2**: it returned only the "ordinary post media attachment (`post.media`)". Then I ran an even more decisive test — **emptied the ordinary post attachments and put images only in the Article cover and Article body (exactly the real state when you publish straight from the Article editor); calling V8.2 returned an empty image list (0 images)**. [88](#ref-88)
(Note: what this local test proves is the difference between V5 and V8.2 in which fields their code reads; the logic is identical in the two commits `5ed7963` and `606b254`. Live is another matter: whether upstream copies the Article cover into `post.media` first, and which models use V5 vectors versus V8.2 vectors, depends on internal live configuration. So no absolute conclusion like "every live Article has no image vector" can be drawn.)

#### 17.3.3 Publishing an Article: what to do (3 practical moves)

Since an ordinary multi-image post's rule is "don't hide the core data in image 4," then for an **Article**, to be compatible at once with the "pre-64-likes `MediaLoader`," the "picky V8.2 reader," and the "cover-reading V5 reader," the safest play is these three moves:

1. **Move one: the Article's "title (first 200 characters)" must be packed with core substance words. No artsy, hollow titles.**
Because before your Article collects 64 likes (and `MediaLoader` pulls the Article images), or on the V8.2 reader path (which doesn't read Article-dedicated images), what the AI can stably read, 100%, is your **Article title (first 200 characters)** and the outer carrier post's text. Title it *Some Thoughts on a Sunday Night* and, with the images unread, the AI is utterly blind — it has no idea what your Article discusses. Retitle it ***I tested two Chinese invoice OCR tools: recognition error rates on the tax-amount and date fields in blurry scans***, and even if not one image is read, the AI can precisely match you, from the title's few dozen characters, to the finance-and-tech target readers.
2. **Move two: the Article's "cover image" should not be pure scenery or an abstract meme; make it an information-clear main visual.**
Because once the V5 reader runs (with an image budget of 1), or once your Article hits 64 likes and triggers `MediaLoader`'s pull, the first in line to be read by the AI is the **Article cover image**; the body's embedded images 2, 3, 4 queue behind it.
3. **Move three (the safest combination): after publishing the Article, post a separate "guide long Post," and hang the 1 most core results-comparison image directly in that guide Post's ordinary image attachment slot.**
Why is this the safest? Because a guide Post is, in essence, an ordinary long post, and the image you hang on it belongs to "ordinary post media attachments (`post.media`)" — **it is not bound by the Article's 64-like (`is_high_fav`) pull threshold, and from like 0 onward the V8.2 reader immediately consumes its "first 4,000 characters of guide text + the 1st core data image," completely.** That's why the savvy big accounts, every time they publish a ten-thousand-character Article, immediately follow with a guide Post carrying the core results image to quote it.

### 17.4 Expanding a long Post, opening an Article, and reading to the end are different questions still to verify

Many creators also ask: "A reader tapping 'Show more' on the timeline to read a long Post, versus tapping the card to open an Article — do they count as the same click and dwell in the algorithm's back end?"

Open the protocol definition file `phoenix/python/common/xai-proto/proto/recsys.proto` and you find the code numbers these seemingly similar actions with **completely different independent numbers (Action Enums)**: [90](#ref-90)

| Action enum | Number | What the name can tell us |
| --- | --- | --- |
| `CLIENT_TWEET_CLICK` | 29 | The independent ordinary post click event |
| `CLIENT_TWEET_SHOW_MORE_EXPAND` | 45 | Tapping a long post's "Show more" — it does not share number 29 with ordinary clicks |
| `CLIENT_TWEET_DETAILS_IMPRESSION` | 72 | Impressions on entering the post detail page are recorded separately |
| `CLIENT_TWEET_DETAIL_DWELL` | 103 | Dwell on the post detail page is also recorded separately |
| `CLIENT_TWEET_RECAP_DWELLED` | 11 | The reading-dwell positive event name used specifically by the two-tower recall `ld` branch covered earlier |

See it: number `45`, `CLIENT_TWEET_SHOW_MORE_EXPAND` (show more), not only has its own number; it also appears in the historical interaction feature set (`history_id_lists.py`) and the `IsShowMoreExpanded` mapping (`constants.py`) — the system, when collecting user history features, really does recognize the "expand long post" action.
But when we check the final value scoring model (`xai-value-model/phoenix_scores.rs`), inside there is neither a field named `show_more_score` (expand bonus) nor one named `article_completion_score` (Article completion bonus). So we can neither say "a reader tapping Show more is worth nothing," nor fabricate "each Show more tap books a fixed number of points." [90](#ref-90) [94](#ref-94)

Likewise, the protocol file contains page-type enums specific to Articles: `PAGE_ARTICLE` (Article body page) and `PAGE_ARTICLE_PREVIEW` (Article preview page). But "page type (Page)" and "action type (Action)" are two different fields in the protocol. Finding the name `PAGE_ARTICLE` does not mean the public code has handed over the complete mapping chain "reader opens the Article page → which numbered action fires → how it converts into the reading-duration label in training data → which prediction head it finally feeds." [90](#ref-90)

Why can't this stretch of mapping be found? Because it sits exactly beyond the public repo's boundary:
The published training code (`recsys_batch.py`) reads behavior vectors and continuous value columns already processed upstream, and `Home Mixer` (`scoring_sequence_query_hydrator.rs`) likewise reaches out to an external behavior-aggregation service for results. As for from which second the mobile client starts timing an Article, how dwell is attributed after a reader exits the Article back to the home feed, whether sending the app to the background counts as dwell, and whether tapping a long Post's "Show more" also triggers a number-29 ordinary click alongside — the platform states plainly in `phoenix/README.md`: **production data sources and the internal telemetry aggregation pipeline are not open-sourced.** [91](#ref-91)

Finally, let's keep the two "dwell" data slots apart. The unit of continuous dwell, `DWELL_TIME`, can be verified: the public Rust utility code (`xai-recsys-engine/src/util.rs`) plainly divides it from milliseconds by 1000 into seconds, used as `predicted_dwell_sec`. But the dwell-after-click slot, `CLICK_DWELL_TIME` (threshold `10.0`), is still missing a piece: what unit its raw value is in, and whether the time a reader spends with an Article open counts into this slot, are questions the public code doesn't answer. That is exactly why the straight line "Article has more characters → readers necessarily dwell longer → Articles necessarily get more recommendation than long Posts" can't be derived from the code: the article's own character count, the seconds a reader actually watched, the seconds the AI predicted beforehand he would watch, and whether he read to the last paragraph are four different variables. [91](#ref-91) [98](#ref-98)

### 17.5 No fixed Article bonus found — and no evidence the two formats are treated identically either

To thoroughly hunt for "does publishing an Article carry a hidden traffic privilege," I searched all of `Home Mixer`'s candidate sources (`sources`), filters (`filters`), scorers (`scorers`), parameter tables (`params`), and the main candidate pipeline (`phoenix_candidate_pipeline.rs`):
- Across every public recall entrance — `Thunder`, `Phoenix`, `TweetMixer`, `SimClusters` — **not one entrance allocates a dedicated guaranteed slot by "is it an Article"** (the `FairShare` covered earlier also groups by recall-source channel, not by long Post vs. Article format); [94](#ref-94)
- In the final value scoring model's input struct, `CandidateScoringInputs` (`xai-value-model/inputs.rs`), **there is no `is_article` or `is_long_post` boolean field at all**;
- When the same-author diversity decay (`0.625`) is on, the function simply accumulates same-author candidate counts by `author_id` — that is, **if you publish a long Post in the morning and an Article at noon, and the two land in the same reader's temporary basket together, the second one eats the `0.625` decay just the same; switching to the Article format never zeroes the same-author counter.** [2](#ref-2) [94](#ref-94)

Of course, in a scientific spirit: "the published scoring functions contain no hardcoded `is_article` fixed multiplier" can only falsify the rumor that "the algorithm code directly writes Articles a fixed multiple bonus." It cannot exclude the possibility that upstream deep-learning models develop implicit preferences for different formats by learning content features, nor that unpublished live experiments split traffic.

Also, many creators confuse another matter: X's platform did once mention, in creator revenue announcements, that when computing **creator ad revenue sharing (Creator Revenue Sharing)** or running million-dollar essay contests, Articles might receive a higher **revenue allocation weight**. But that is the **weight for splitting money and paying royalties** — not a For You recommendation ranking coefficient at all. And the old ad revenue sharing plan formally ended in September 2026, switching to the new Original Content Rewards rules. Never take an old calendar's "money-splitting weight" for today's "recommendation algorithm bonus." [97](#ref-97)

### 17.6 Articles do have separate visibility handling — but look at trigger conditions and entrances first

Although there's no Article-specific bonus at scoring time, in the safety and visibility filtering system (`visibility-filtering`) Articles do have one dedicated interception rule — and it hides an **"edit-and-vanish trap"** many creators don't know about.

Open `visibility-filtering/rules/tweet_rules.rs` and there is a rule named `ArticleTweetContent`: **as long as a post is associated with an Article, and that Article's current status is not `Published`, the system executes a filter interception (Drop) directly.** The public test samples (`golden_corpus/article.rs`) explicitly test four states — draft (`Draft`), soft-deleted (`SoftDeleted`), missing status, and published (`Published`) — and only `Published` passes this check. (Note two boundaries. One: this rule hangs on a check level called `TimelineHomeHydration`; other places in `Home Mixer` use two other levels, `TimelineHome` and `TimelineHomeRecommendations`, and how the three levels chain together live depends on each request's actual configuration. Two: so it can't simply be said that every Article necessarily passes one extra gate before Phoenix scoring.) [92](#ref-92)

So why call it an **"edit-and-vanish trap"**?
Check the platform's official Articles help documentation and you find: when you click edit on an **already published** Article, the system's mechanism is to **first pull the Article down from published status (into an unpublished draft state); only when you finish editing and click republish does it return to `Published`**.
Which means: **if, after publishing an Article, you spot a few typos, pull it down, edit slowly for half an hour, and forget to click republish — or pull it down and re-edit several times in one day — then during that pulled-down editing window, your Article's status is not `Published`, and at any entrance where the `ArticleTweetContent` rule triggers, it gets intercepted and filtered as unpublished content.** So after publishing an Article, don't pull it down for major edits unless necessary, and the moment you finish, confirm at once that it's back in `Published` status. [6](#ref-6) [92](#ref-92)

In addition, an Article's cover image and body embedded media are merged into the visibility system's "contains media (`compound.rs`)" judgment (this is only for routing to the corresponding media safety rules; an ordinary article with a healthy cover image will never be auto-demoted for it). And if you set an Article to "Subscribers-only," the general filter `IneligibleSubscriptionFilter` (`ineligible_subscription_filter.rs`) checks whether the reader scrolling the home feed has a paid subscription to you (`subscription_author_id`); readers who haven't subscribed naturally can't see it. At the same time, the Article media interface (`article_client.rs`) hides media fields when there's no permission — that's normal paywall permission control, not to be misjudged as "the Article's images are lost" or "the algorithm throttled it." [92](#ref-92) [93](#ref-93)

### 17.7 Article's real data looks better — why that still can't prove the same piece wins as an Article

At this point some friend will surely produce data in rebuttal: "No way! A third-party firm, NotPeople, published a measured report in September 2026 counting August's data, and computed that Articles' median views are **5.7 times** ordinary posts'!"

This report ([the NotPeople original](https://notpeople.ai/blog/how-to-make-money-on-x-2026)) — I pulled it out and checked it table by table myself. Its main statistics table contains **42 Articles**, **843 ordinary traffic-driving posts carrying Article links**, and **64 ordinary posts without Article links**. Normalized against each author's own average post views as the baseline, those 42 Articles' normalized median views really do reach **5.7 times**. [96](#ref-96)

**But look at the proportion between those two numbers: behind 42 Articles stand a full 843 ordinary traffic-driving posts.**
The report's own author concedes in the text: in this creator sample, the vast majority of ordinary posts used as the comparison were actually short "traffic-driving promo posts," not the same several-thousand-character piece published once as a long Post and once as an Article in a same-piece comparison. And **for every 1 Article this batch of creators published, they published, on average, 6 to 28 related ordinary posts afterward (excerpts, short comments, quotes) to drive traffic to that Article, hard.**
On one side: a flagship Article written with heavy money and effort, then promoted for weeks by a dozen-plus posts like stars around the moon. On the other: casually posted daily short promo posts. The two sides' topic weight, writing investment, promotion effort, and view-accumulation time windows are not on the same starting line at all. So this sample can prove "creators using the [1 heavy Article + a dozen-plus driving posts] matrix play racked up very high views on their main Article" — but it **absolutely cannot prove "paste the same draft from a long Post into the Article editor, do no extra promotion at all, and reach automatically multiplies 5.7 times."** [96](#ref-96) (As for the Hootsuite 2024 mini-experiment mentioned earlier, it compared only Thread and long Post; it never tested Articles. [25](#ref-25))

### 17.8 Which format for the piece you're about to publish

With all the water and mysticism stripped away, when you have a new draft ready to publish, should you choose a **long Post**, an **Article**, or an **Article + guide Post**? Match yourself against this decision table:

| Material you're preparing to publish | Format I'd choose first | The concrete reason |
| --- | --- | --- |
| Circling one clear judgment, fully explainable in a few paragraphs + 1 comparison image; or needing to reply to / quote directly under a hot discussion | **Long Post** | The argument completes in one breath, and ordinary image attachments (`post.media`) can be read by V8.2 from 0 likes, with no need to force-split into sections for form's sake |
| A multi-section deep investigation, a complete operations handbook, or a tool guide, needing multiple heading levels and interleaved charts for readers to look back through later | **Article** | Multiple heading levels and embedded-material layout are excellent, and it settles permanently in the profile's Articles section for easy retrieval |
| The complete research report is very long (say, over ten thousand characters), and you also want strangers who never followed you to grasp at a glance, on the home feed, what pain point it solves | **Article (or split Articles) + 1 guide long Post with the core image** | **The safe combination**: the Article carries the rigorous full text, while a guide long Post with the core results image both bypasses the Article 64-like pull threshold and V8.2's image-missing problem, and lets readers take the substantive conclusion first |
| The same three-thousand-character draft lays out fine in both formats, and your only aim is to know which gets more natural reach on your own account | **Test alternating on your own account with comparable samples** | Neither public code nor external research holds iron proof of a "same piece always wins"; your own account's measured audience feedback is the most accurate |
| Needing to deliver deep research or exclusive material to paid subscribers on a schedule | **An Article with the appropriate subscription audience controls on** | Choose by delivery audience; but remember the paywall is a permission filter (`IneligibleSubscriptionFilter`) and adds no public-recommendation bonus |

Take the **"Chinese invoice OCR recognition tool review"** from earlier for a decisive example:
- If this test's finding is highly concentrated — say, only that **"when an invoice scan has crease blur, the tax-amount field very easily reads an 8 as a 3"** — then you need just 1 blurry original invoice image, 1 comparison table of the two tools' recognition results, and three paragraphs of text on the applicability conditions. **One long Post is enough.**
- Conversely, if this time you ran a full-range comparison — accounting for 50 invoice samples of varying image quality grouped, the two tools' API parameter settings, accuracy tables across fields like date / tax amount / buyer tax ID, typical failure cases, and second-round retest records — then put the complete report in an **Article**, and immediately **post a separate guide long Post with the core results image.**

That companion guide long Post must not be written as "I just published a deep piece on invoice OCR, everyone click the link and read the full text!" (nobody likes tapping hollow traffic-driving like that). It should be written as a **standalone substantive post from which a reader learns a move even without tapping into the Article**:

> **Sample guide long Post copy (with the 1 most core tax-amount recognition comparison image hung in the ordinary image slot):**
> To judge whether a Chinese invoice OCR tool can connect directly to a finance accounting system, never look only at the vendor-advertised "full-text total character accuracy 99%."
>
> You must split the **invoice date, tax amount, and buyer tax ID** fields out and test them separately: even if only 1 digit in a hundred-plus characters on an invoice is misread, if that digit happens to land in the "tax amount" field, this voucher's accounting entry errors out on the spot.
>
> I used the same batch of real, creased Chinese invoices to run a field-by-field blind test on two mainstream OCR tools, and organized the test originals, each field's error-rate comparison table, and the boundary conditions that must go to manual review into the complete column below. Friends doing finance-automation selection: I suggest going straight to the tax-amount comparison table inside 👇

Look at that guide copy (it's a writing sample — swap in a test you really ran yourself; don't copy it if you haven't): it has itself already delivered the core substance of "don't look at full-text accuracy; split the tax-amount field out and test it separately." The lead image hung in the ordinary image slot can be fed to the V8.2 reader directly from 0 likes. A reader with a genuine finance-selection need, after finishing the guide, naturally taps into the Article below and carries the whole table set away. The official help page's recommendation of "using an excerpt post to lead into the complete Article" is exactly this organization. (Of course, this is a scientific image-text distribution pairing, not a free traffic allowance the system hands out per guide post.) [6](#ref-6)

One layout practicality as an aside: if you plan to put a long draft full of **code blocks, math formulas, and complex Markdown tables**, like this piece, into the Article editor, check it section by section in the preview before publishing. The Article editor supports rich text, but pasting complex Markdown syntax or LaTeX formulas directly in can sometimes misalign tables or fail to render formulas. If the full report plus appendix is too long, you can split it into two Articles by "complete questions that can be answered independently," or attach a download entry for the complete Markdown / PDF at the end. Never delete the key boundary conditions that change conclusions just to force everything into one ordinary post.

### 17.9 How to compare your own results without mistaking views for people who read to the end

If you plan to test on your own account whether "long Post" or "Article" performs better, how do you test without being fooled by fake data?

1. **Step one: fix the real business metric you'll grade. Don't take the front-end public Views as "the number of people who read the full text."**
The official help doc (`View counts`) is explicit: the front-end post view count (Views) counts 1 whenever anyone scrolls past and sees it on the timeline, and **the same reader scrolling past repeatedly — even you opening it yourself — counts again**, mixed with different entrances like search and profiles. 10,000 views on the dashboard proves neither that 10,000 distinct living people opened your full text, nor that they read to the last paragraph. To test "breaking out and pulling new readers," log **profile visits and new followers**; to test "substance conversion," log **bookmarks, effective inquiry DMs, or material download clicks**. [59](#ref-59)
2. **Step two: run an "alternating comparison of same-tier topics," and account for the promotion effort honestly.**
Pick 6 to 10 original substantive pieces of similar topic difficulty, target audience, and writing investment; odd-numbered ones go out as long Posts, even-numbered ones as Articles, all published in the same active time slot:
- Round one: **both sides publish only the main post, no extra traffic-driving posts**, and purely observe the two formats' own natural reach and bookmark conversion differences;
- Round two: pit "1 Article + 2 guide Posts with images" against "1 long Post alone" — and remember, the former published 3 pieces of content in total and spent twice the promotion effort. In the ledger, record the whole group's input and each piece's performance separately, and never simply add the guide Posts' views and the Article's views together as a "deduplicated total readership."
3. **Step three: look at 24-hour and 7-day medians, and never treat "publishing the same draft twice" as a strict A/B test.**
For each piece, uniformly record the core data at 24 hours and 7 days after publishing (noting whether a big account reposted it, a hot event hit, or paid promotion ran in the window), and compare the **median** across samples — don't let one accidental hit skew the average. Take special care: **never publish the same draft as a long Post in the morning and, unchanged, as an Article in the afternoon, and call that a "strictly controlled A/B test."** Your core old followers who already saw the long Post in the morning won't tap the identical Article a second time in the afternoon. And if the two pieces land in some readers' candidate pools together, they directly trigger the same-author `0.625` decay and DPP similar-content zeroing.

## 18 The lead image should state the piece's finding (and what happens when a long piece carries one comic image)

Many friends who make image-text reviews or tutorials habitually copy WeChat Official Account or Xiaohongshu layout aesthetics: a post with 4 images, where **image 1 is a flashy pure-title poster or a funny cover**, image 2 starts the background, and images 3 and 4 finally carry the real core test-results tables.

Whether a human reader has the patience to swipe right to image 4 still depends on how attractive your cover is. But in the recommendation algorithm's V8.2 content-understanding flow (`grox/flows/mm_emb/renderer_v82.py`), which image the AI reads is written dead in the source.
Open the `_collect_post_media` function: it loops from your first media attachment onward — if it first meets a usable video, it extracts a set of video frames and returns immediately; **if it first meets the first static image with usable image data, it immediately executes this line and returns (`return`)**: [1](#ref-1)

```python
return "Post image:", [medium.convo_image.content]
```

See it clearly? For a pure image post carrying 4 static images, **this function doesn't take all 4 images at all — it grabs the first normally readable image and clocks out.** (The media this post selects is then merged with the quoted post's media, bound by the total image budget cap, and sent by `embedder_v82.py` to the multimodal vector service. And rigorously: this is the practice of the V8.2 content-understanding main path; it can't be inflated into "every model on X forever looks only at image 1" — the older V5 `renderer.py` in the same repo, for instance, processes images one by one within budget.) [1](#ref-1)

### 18.1 A long piece with one comic image — what happens? Is the weight counted as image or as long text?

At this point, many creators who like illustrating long pieces ask a very concrete question: **"I wrote a deep long piece of several thousand characters and, for layout, added 1 funny comic or hand-drawn illustration. Will the recommendation system judge my post an 'image post' and swallow my long text's own reading-dwell weight?"**

Check the scoring formula in `scoring.rs` against the multimodal code in `renderer_v82.py`, and here's your reassurance — plus one big pit you must avoid:

1. **At the scoring stage (`scoring.rs`): it is absolutely not "text or image, pick one." It's "long-text reading score + image expansion score," all stacked.**
The system's fusion scoring formula treats every candidate post identically: you wrote a deep long piece, and the **4 great reading-dwell bonus terms** from earlier (ordinary click `Click` `0.3`, deep dwell after opening `ContClickDwellTime` `0.4`, basic dwell `Dwell` `0.05`, continuous dwell per second `ContDwellTime` `0.006`) all get computed as they should. And the formula already contains an image-expansion prediction term (`Photo expand`, coefficient `0.05`, multiplying the predicted probability this reader will tap to view the image). So illustrating a long piece with a comic does not swallow the long text's dwell terms — and don't read 0.05 as points handed out for attaching an image. [2](#ref-2) [21](#ref-21)
2. **What is really affected is "how the AI multimodal model understands your post's topic" (`grox/flows/mm_emb`)**:
In the V8.2 processor, the program packages two things together to generate the post's semantic vector (Semantic ID): **the first 4,000 characters of body text (`Post text:`) + the 1st usable image picked (`Post image:`)**. Two cases:
- **Case A (the whole long piece carries only this 1 comic)**: as long as your long piece's first 4,000 characters state the core research subject and conclusion clearly, a topic-fitting comic illustration is completely fine (and the formula's image-expansion prediction applies as usual — coefficient `0.05`, multiplied by the probability that a reader opens the image; it is not points handed out for attaching a picture). The one taboo: the body's first two hundred characters are still lyrical and foggy, while the comic is a funny cat meme unrelated to the body — image and text semantics misaligned, the multimodal vector's precision suffers.
- **Case B (1 decorative comic plus 2 measured data tables — the big pit 90% of creators step into)**: remember that `return "Post image:"` line of source. If your long piece carries 3 images, with the funny decorative comic placed at **image 1**, and the real core measured-data comparison tables at **images 2 and 3** — disaster. V8.2's `_collect_post_media` sees image 1's comic load fine, lifts the comic, and `return`s, job done. The hardcore test data in your images 2 and 3 is thoroughly ignored on this multimodal understanding flow. [1](#ref-1)

### 18.2 How to reorder four review images

With the bottom logic of "V8.2 takes only the 1st usable image" understood, how should we arrange image order on a 4-image review post or an illustrated long piece?
Take "testing two OCR tools recognizing Chinese invoices" again:
- **Wrong order (traditional poster flow)**: image 1 is a suspense headline poster, *Shocking! After testing these two OCRs I fell silent* (or a funny comic); image 2 is the test-environment notes; image 3 is the accuracy table; image 4 is the blurry-invoice error case. Ordered this way, neither the timeline reader flicking past nor the V8.2 flow that takes only image 1 catches this installment's core substance.
- **Right order (conclusion lead-image flow)**:
  - **Image 1 (the lead image)**: make it directly a clear, readable **"core results comparison card"** — write the two tested tools' names and the task right on the image, put up the most telling "blurry invoice tax-amount recognition, one right, one wrong" comparison, and mark the core conclusion in eye-catching type: "When a scan has creases, tool A's tax-amount field needs manual review";
  - **Image 2**: state the 50 invoices' sample grouping and test parameter settings;
  - **Image 3**: the complete summary data table for the remaining fields (date, buyer tax ID);
  - **Image 4 (or a decorative comic)**: applicability boundaries, extreme failure cases, or a mood-lightening illustration.

Of course, making the lead image a "core results card" never means cramming a whole paper's thousands of tiny characters into one image (type too small for anyone to read). The lead image needs to focus on **the 1 most core finding**, with the tool names, comparison conditions, and conclusion's subject marked clearly. If a conclusion needs twenty disclaimer footnotes to stand, the issue was cut too coarsely for the lead image.
At the same time, the body's first paragraphs should state the lead image's core finding in text as well — that way, if a reader's network stalls and the image doesn't load, the text alone tells him what you measured; once the image loads, text and image corroborate each other. Never again hide the piece's most valuable treasure in image 4, which the algorithm never went and read.

## 19 The several "ten seconds" of video govern different things

Video creators have certainly heard an iron rule: "Video posted to X must exceed 10 seconds, or the algorithm won't push it."
Open the public repo and the number "10 seconds (`10000` milliseconds)" appears in several different places at once — but they govern entirely different things. One governs **video quality viewing (VQV) scoring eligibility**, one governs **three core immersive video indexes' inclusion life-or-death line**, and one governs **the cut segment in long-video safety review**.Take these "10 seconds" apart and you'll know how long to cut your video.

First, the first "10 seconds": **video quality viewing (VQV) eligibility**.
In `home-mixer/util/candidates_util.rs` and the parameter file `param.rs`, when the system judges whether a video candidate qualifies to compute a VQV score, it first checks whether the video's own length exceeds the set threshold; the public default really is **`10000` milliseconds (10 seconds)**. (Note: this is a total-video-length condition labeled in milliseconds, and it is not the click-dwell threshold `10.0` from earlier.) [48](#ref-48)

But does meeting this VQV eligibility earn you more points on the scoring table?
It cannot. The reason is very concrete: in the current public version, in both `Home Mixer` and `VM Ranker`, **`VqvWeight` (the video quality viewing weight) defaults to `0` across the board.** (The public default coefficients of some continued-viewing terms are also `0`; only "Video open `VideoOpenWeight`" keeps a non-zero weight of `0.02` / `0.07`.) Of course, a direct weight of `0` somewhere never means video viewing behavior is useless, because in the two-tower recall model's immersive branch (`immersive_positive_actions`), video quality viewing is still listed as a core training positive. [48](#ref-48)

At the same time, in the V8.2 multimodal understanding flow (`renderer_v82.py`), the AI reads the extracted video frames (Frames) and the speech transcript text (Transcript) to understand what your video says. But nowhere in the code is there a formula like "added subtitles, get a fixed bonus" or "1080P full-HD quality, get a fixed reward," and the V8.2 extracted-frame cap must not be twisted into "the whole recommendation system sees only four instants of the video." [1](#ref-1) [44](#ref-44) [48](#ref-48)

### 19.1 Three video index types really do require length over ten seconds

`VqvWeight` on the scoring table defaults to `0`, but **the second "10 seconds" is a genuine life-or-death line clamped on video inclusion**.
In `phoenix-rankall-strato/lib/eventProcessing.strato`, which builds the recommendation index stores, the programmers hard-wrote these two length-check lines: [49](#ref-49)

```text
minLongVideoDurationMillis = 10 * 1000
videoInfo.durationMillis > minLongVideoDurationMillis
```

Source: [49](#ref-49)

Put the magnifier on the greater-than sign **`>` (strictly greater)** in the middle of line two.
The program checks whether the video file's own total duration, `videoInfo.durationMillis`, is **strictly greater than `10000` milliseconds (10 seconds)**.
What does that mean? It means if, stopwatch in hand in your editing software, you cut the video to **exactly `10.000` seconds (`10000` milliseconds)** — sorry, `10000 > 10000` is false, **fail, outright**. You need at least **`10001` milliseconds (10.001 seconds; in practice, to guard against transcoding frame drops, cut everything to 11 seconds or more)** to cross this threshold. (Note: what's checked here is the video file's own total duration, not how many seconds a reader watched.) [49](#ref-49)

Worse is still coming — the function that actually invokes this 10-second check is called **`hasValidImmersiveVideo`**, and its code logic hides a **"mixed text-image layout pit"** that has tripped countless people:
The function first requires at least one acceptable video medium in the post; immediately after, it applies a **`forall` (all must satisfy) check to every media attachment on this post (each media entity)** — requiring every medium to be of `TweetVideo` or `AmplifyVideo` type, to carry `VideoInfo`, and to have a duration strictly greater than 10 seconds, all of them.
That means two extremely important practical iron rules: [49](#ref-49)

1. **When posting multiple videos together**: if one post carries 2 videos, one 30 seconds and the other only 8 seconds, because the 8-second one fails the bar, the `forall` check collapses entirely.
2. **Never mix "1 video + 1 static image" in one post.** If one post holds a 20-second substantive video and you casually stuff in 1 static screenshot alongside, because a static image is not a video type and cannot pass the `forall` check, **the whole post, because of that static image, directly loses eligibility to enter the three core video indexes below.**

Which three core video indexes call `hasValidImmersiveVideo`? Their call chains are in the table: [49](#ref-49)

| Index name | Builder function called directly | This path's trigger situation | The ten-second condition's status |
| --- | --- | --- | --- |
| `1fav_video` | `build1FavVideoIndex` | The like (`Fav`) branch of an ordinary eligible post | Calls `hasValidImmersiveVideo` directly; duration `> 10 seconds` is one of inclusion's hard qualifications |
| `video` | `buildVideoIndex` | The like (`Fav`) or post-creation (`PostCreation`) branch of an ordinary eligible post | Also calls `hasValidImmersiveVideo` (note: it can trigger at post creation; you don't have to wait for likes to build the store) |
| `nsfw_video` | `buildNsfwVideoIndex` | The like (`Fav`) branch of a specific adult video (the builder additionally checks adult marks) | Also requires `hasValidImmersiveVideo`; all other source and content conditions must hold as well |

Source: [49](#ref-49)

See it: the three great video indexes — `1fav_video`, `video`, `nsfw_video` — have builders all clamped dead on `hasValidImmersiveVideo`. As long as your video doesn't exceed 10 seconds, or is mixed with a static image, you'll be turned away at these three video indexes' doors. (After entering the store, of course, recall and scoring still follow.) [49](#ref-49)

### 19.2 Two things both named Evergreen may not read the same data

Once inside the video index store, the system also slices by publishing days into different time windows (`phoenix-rankall/src/config/mod.rs`): `1fav_video`, for instance, has windows of 2 days, 2 to 4 days, 4 to 14 days, 4 to 30 days; `video` and `nsfw_video` have their own day windows. (These day counts are the database's retention or selection spans — a different matter from the video length of 10 seconds.) [50](#ref-50)

And in the two-tower recall dataset config (`retrieval_dataset.py`) sit a few names that easily fool the eye — especially items with **`EVERGREEN`** in the name: [50](#ref-50)

| Recall dataset name | File actually read | Index it belongs to | Visible ten-second chain |
| --- | --- | --- | --- |
| `IMMERSIVE2Day` | `video_2day.parquet` | `video` | Traceable along the `video` builder directly to **strictly greater than 10 seconds** |
| `IMMERSIVE4Day` | `video_4day.parquet` | `video` | Same as above, strictly greater than 10 seconds |
| `EVERGREEN` | `video_4to14day.parquet` | `video` | Although the enum name is `EVERGREEN`, what it actually reads is still the `video` index's 4–14 day window — **likewise bound by > 10 seconds** |
| `IMMERSIVENSFW` | `nsfw_video_2day.parquet` | `nsfw_video` | Traceable along the `nsfw_video` builder to strictly greater than 10 seconds |
| `IMMERSIVE32FavVideo14To30Day` | `32fav_video_14to30day.parquet` | Another independent dataset name | The complete upstream production chain is not traced through in the public tree; don't imagine conditions from the name alone |

Source: [50](#ref-50)

See row three: the recall dataset's enum is named `EVERGREEN`, but the file it reads at the bottom is `video_4to14day.parquet` (the `video` index's 4-to-14-day old-video window), so it is likewise bound by the strict `> 10000 milliseconds` limit.
But in the same index processor there are two other indexes genuinely named `evergreen_video` and `evergreen_nsfw_video` — they run on a separate `EvergreenVideo` event branch and call only `hasImmersiveVideo` (which checks only whether it's a video type — **no `durationMillis > 10000` check**). That shows the code does not slap the 10-second threshold onto every branch with one knife. (How the upstream evergreen event list is generated is not open-sourced, so we can't conversely guarantee short videos definitely enter evergreen.)
Likewise, the Grok-generated AI video index `buildImagineIndex` checks `isImaginePost` (Grok metadata in the media), and also doesn't call `hasValidImmersiveVideo`. Laying these branches out is to help everyone distinguish precisely "which three video stores clamp at 10 seconds" and "which branches have their own rules." [50](#ref-50)

### 19.3 A five-second video can still enter the general post index

So the question comes: **if I have a software-operation GIF video of only 5 seconds, is publishing it a total "dead post" on the For You home feed, seen by no stranger at all?**

**It does not die completely.**
Follow the like (`Fav`) branch of an ordinary eligible post (`phoenixRankAllCandidateProcessor.strato#L506-L524`) downward: when a 5-second video post receives a like, the program **first executes the ordinary post's `build1FavIndex` (building the ordinary `1fav` index), the topic index, and the `32fav` index, and only then attempts to build the video-dedicated indexes**.
And inside the ordinary post's `build1FavIndex` function, **there is no video duration check at all**.
That means: this 5-second short video of yours, although too short to enter the dedicated video stores `video` and `1fav_video`, **can perfectly normally enter the ordinary post's `1fav` index store (`1fav_1day.parquet`)**. And we proved earlier that the ordinary For You home feed's three main datasets (`HOME`, `HOME_COLD`, `HOME_HOT`) read exactly `1fav_1day.parquet`. (Note: this is a program-condition statement derived from source branches, not a live reach experiment on 5-second videos.) [38](#ref-38) [34](#ref-34) [50](#ref-50)

So the practical conclusion on video length is very clear:
- If you're demonstrating a minimal trick readable at a glance in 5 to 8 seconds, keep the short, sharp 5-second version; it can still reach the home feed through the ordinary post's `1fav` channel, and there's no need to stuff 5 seconds of black screen or meaningless empty shots at the tail to pad the length (padding empty shots drags the completion experience down instead);
- But if you want the video to **also enter dedicated immersive video traffic channels like `video` and `1fav_video` (including the `IMMERSIVE2Day`, `IMMERSIVE4Day`, and 4–14-day `EVERGREEN` windows)**, then develop the before/after comparison, the operating steps, or the applicability boundaries and **cut the video to a solid 11 seconds or more (strictly greater than 10,000 milliseconds) — and never mix a static image into the same post.** [49](#ref-49) [50](#ref-50)

### 19.4 Another ten-second judgment, its full call path not yet found

For completeness of the code check, one stretch of "orphan code" in the public tree is recorded here: in `eventProcessing.strato` there is another function named `isMediaEligible`, which also writes a `> 10000` millisecond judgment and requires the media be non-NSFW; it is then assembled by `getTweetypieResponse` into `hasEligibleMedia` (plus an author non-NSFW condition). But across the whole public code tree, only the definition and export of `getTweetypieResponse` can be found — no downstream module calls it. So we honestly list it as "a visible condition whose downstream hasn't been traced," and whenever we prove the video 10-second iron rule, we rely throughout on the fully traced `hasValidImmersiveVideo` call chain above. [49](#ref-49)

## 20 64 likes and 512 likes correspond to different video safety tasks

The rumor online: "A video post reaching 64 likes triggers the first round of traffic assistance; reaching 512 likes triggers a second, super round of mega distribution!"
Search the source for `64` and `512` and those two like thresholds really are written, word for word, under the `grox/flows/ptos` directory — but the laughable part: **they are not "traffic reward pool thresholds" at all. They are the activation thresholds of the video safety and violation-review bots (PTOS).** [51](#ref-51) [52](#ref-52) [53](#ref-53)

See the table below: in three review pipelines specialized in catching violating videos, 64 likes and 512 likes each play very specific review roles:

| Safety review task name | Role of 64 likes | Role of 512 likes | Other preconditions to check |
| --- | --- | --- | --- |
| `SpecialVideo` (special dynamic-frame video review) | **Default minimum like threshold** triggering this review | No 512-like switch in this task | Must have video, and must hit the `motion_reveal` dynamic-flash screening |
| `MediaInjected` (injected adult / infrared spam video detection) | **Default minimum like threshold** triggering this review | At 512 likes, **deep reasoning (`use_reasoning`) is enabled** | Not previously judged NSFW, video frames successfully extracted, and the violating reference video library loadable |
| `AdultContentLeadingFrames` (adult-content review of a long video's first 10 seconds) | This filter does not use the 64-like threshold | Past 512 likes, **a prior `AdultContent` classification is no longer required** | Video duration `>= 30 seconds` (or a livestream), prior PTOS results exist, and not yet labeled NSFW |

Sources: [51](#ref-51) [52](#ref-52) [53](#ref-53)

### 20.1 64 likes is the minimum qualification for some tasks

Why does safety review clamp at 64 likes? The reasoning matches the Article image porter from earlier: scanning video frame by frame with a large model burns GPU compute, so the system focuses its watch on videos that have begun to gather volume.
In the first task, `SpecialVideo` (`task_safety_ptos_special_video_filter.py`), the filter first checks: author information obtainable, video present in the post (this post or a quoted post), and **the current post's like count `post.get_fav_count()` is no lower than `deluxe_fav_count_threshold` (public default `64`)**.
Past the 64-like threshold, the program enables `motion_reveal` for the video (dynamic-frame mutation detection, built to catch the trick of "normal for the first seconds, then one violating frame flashes in the middle"), pulls the video data, and passes it through a `task_special_video_screen.py` preliminary screen: only if a `motion_reveal_frames` signal is genuinely detected does it proceed to content classification, violation policy judgment, and cross-validation. So "reaching 64 likes" merely triggers this dynamic security check's entry condition; it in no way means every 64-like video runs the full model suite to the bottom, and still less that it will be judged violating. [51](#ref-51)

### 20.2 512 likes, in this flow, enables reasoning

Now the second task, `MediaInjectedAdultInfraredVideoSpamDetection` (built to catch cheat videos that maliciously inject adult frames, infrared see-through, or spam watermarks into normal video):
Its filter likewise requires an author, video in this post or a quoted post, **at least 64 likes**, and that prior review hasn't already labeled it NSFW. When the large-model inference actually executes (`task_safety_ptos_media_injected_adult_infrared_video_spam_detection.py`), it must confirm video frames have been extracted, and load the "confirmed-violating blacklist reference video library" for comparison (if no frames are captured or the reference library fails to load, the comparison cannot complete).
So what does **512 likes** do here?
When the video's like count reaches **`512`**, the program sets the **`use_reasoning` (enable the large model's chain-of-thought deep reasoning)** switch to `true`, switching the prompt and output mode so the AI writes out its reasoning process before making the violation comparison. Once judged violating, it generates a `SpamManipulatedMedia` (manipulated-media spam) classification and sends it to the public write pool (going through the ordinary Spam branch's author qualification judgment; it does not directly trigger the "3 of 5 and you're banned" rule covered later). [52](#ref-52) [54](#ref-54)

### 20.3 Checking the opening frames also requires length and prior-result conditions

The third task, `AdultContentLeadingFrames` (adult-content check of a long video's head), strings together the three numbers **30 seconds, 10 seconds, 512 likes**:
1. It first requires author information, and a **long video of at least 30 seconds (`>= 30 seconds`)** in this post or a quoted post (or a livestream `broadcast` with a usable identifier), and also requires that this post already has a prior PTOS preliminary result (without a prior PTOS result, even 10,000 likes gets it skipped at this filter), and that it has not yet been formally labeled NSFW;
2. With those premises met, meeting **either one** of the two conditions below formally starts the head deep-check:
   - a prior annotation once showed an `AdultContent` (adult content) suspicion classification;
   - **or the current post's like count has reached at least `512` likes**;
3. Once inside the check, the program sets this long video (or livestream) to **specially cut the first 10 seconds of opening frames**, and sends them for content classification, policy judgment, and **dual-model cross-validation (Cross-validation)** with another independent `sex-and-nudity` vision model (if the two models' conclusions disagree, an arbitration flow decides; some special video tasks that don't support direct hard blocking switch to a lighter "soft handling" when cross-validation doesn't pass; labels are finally written by the retained policy classification). [53](#ref-53)

### 20.4 Crossing a like threshold does not mean the check completes at that moment

Note also that these three video security pipelines are triggered by different Kafka message queues (Kafka is the internal queue channel that passes task messages between services — picture a conveyor belt running behind the scenes), and all carry a **60-second dedup rate-limit cache (`task_rate_limit.py`)**. The public code shows how the consuming end filters and reviews after receiving a task; it does not guarantee that at the very millisecond a video's front-end count jumps to the 64th or 512th like, upstream will fire a message over in real time. [51](#ref-51) [52](#ref-52) [53](#ref-53)

But after these three stretches of code, you at least see one thing thoroughly clearly: **a video's 64 likes and 512 likes are entirely the safety review system's "security-check upgrade lines," with not a cent's relation to "unlocking the next traffic reward pool."** When you post video day-to-day, watch not only your own cover and first 10 seconds — also check whether other people's video material you casually repost-quote (Quote) is clean, because all three security lines sweep in **this post's video and the quoted post's video (Quoted Video)** alike. [51](#ref-51) [52](#ref-52) [53](#ref-53)


## 21 What exactly is the small account's 200 Home impressions threshold?

This section is the one mid-tier creators and brand-new accounts care about most: **"I heard the X algorithm opened a green channel for small accounts with under 50,000 followers — a new post gets 200 impressions of cold-start support in its first 2 hours. How does it actually work? As a small account, how do I catch this traffic?"**

In earlier versions, listing a pile of parameter names left everyone in a fog. Let's rebuild this cold-start mechanism in plain words as a vivid scene: **"the small-account express elevator in the scoring room (`author_cold_start.rs`)."**

First look at how the famous `200` is written in the source (`home-mixer/scorers/author_cold_start.rs`): [57](#ref-57)

```rust
&& c.view_count_on_home
    .is_some_and(|imp| imp < params.impression_threshold)
```

In the public defaults, `impression_threshold` really equals **`200`**, and the comparison symbol is **`<` (strictly less than 200)**. When I rewrote this function locally for boundary verification, holding everything else fixed, passing `199` returned pass (`true`) and passing `200` returned fail (`false`) on the spot.
But note two utterly pivotal truths:
1. **This is not a distribution pipeline of "every new post first gets a guaranteed 200 readers shown to it, tested, then promoted or not."** It's the opposite: **"when your new post is already in some reader's temporary basket, as long as its accumulated For You home-feed impressions site-wide are still under 200, it qualifies to enter this express elevator's draw."**
2. **The field the code checks is named `view_count_on_home` (pure For You home-feed recommendation impressions), not the public total Views you see under your post.**
The front-end Views you see include visits to your profile, search views, external-link arrivals, and even your own repeated openings of your own post. So when the front end shows 210 Views, how large the back-end's pure `view_count_on_home` is, outsiders can't see — it's not the same thing as the front-end number, and you can't judge from the front-end number whether cold start is still alive. Never stare at the front-end count, panic as it passes 200, and tell yourself "the 200-impression cold-start test failed, this piece is done for." [57](#ref-57) [58](#ref-58) [59](#ref-59)

### 21.1 Under two hours and Home impressions under 200 — both at once

To ride this "small-account express elevator," your candidate post must **satisfy all of the following hard conditions at once** (the code chains them all with `&&`; missing one fails, and this exact rule set was already in the public snapshot of October 9): [35](#ref-35) [60](#ref-60)

```text
# Conditional restatement, not verbatim source; public defaults read, substituted
cold_start_base_eligible(candidate, follower_cap)
    && cold_start_corpus_eligible(viewer_arm, author_corpus)
    && age.is_some_and(|age| age <= max_post_age)
    && position_among_nonzero < floor(0.97 * nonzero_count)
    && view_count_on_home.is_some_and(|imp| imp < 200)
```

Source: [35](#ref-35) [60](#ref-60)

Translate those 5 lines into **5 entry tickets** you can check one by one:
1. **Ticket one (author size and originality)**: the author's follower count must be known and **no more than 50,000 (`<= 50000`; exactly 50,000 followers counts as eligible)**; and the post **must absolutely not be a reply (`!is_reply`), and absolutely not a plain repost (`!is_retweet`)**. (Note: the code here checks only for the absence of a reply ID and a plain-repost ID; **it does not exclude a Quote with comment, `quoted_tweet_id`** — that is, an original post or a Quote post both earn this ticket.)
2. **Ticket two (the experiment groups line up)**: when the system runs experiments it divides readers and authors into groups — the group this home-feed reader belongs to (`viewer_arm`) has to line up with the content pool the author belongs to (`author_corpus`); the cold-start master switch is also on, and the current request is not a Topic Request.
3. **Ticket three (2-hour window)**: the post's age since publishing must be **no more than 7,200 seconds (`<= 2 hours`)**.
4. **Ticket four (not a rock-bottom terrible post)**: among all non-zero-score candidates in this temporary basket, this post's preliminary score rank must be within the **top `floor(0.97 × total non-zero candidates)`** (that is, the bottom roughly 3% by score are cut).
5. **Ticket five (Home impressions under 200)**: the post's currently accumulated internal home-feed impressions, `view_count_on_home`, must be **strictly less than 200 (`< 200`)**. (Also, this express elevator can only lift candidates already fished into the current temporary basket by the recall buyers, and that have passed the seen and block filters.) [35](#ref-35) [61](#ref-61)

To make how these tickets block people clear at a glance, here's a measured judgment table of 6 common situations: [35](#ref-35)

| Assuming other qualifications hold | Value to check | This gate's result | Reason |
| --- | --- | --- | --- |
| Post published 1 hour ago | Internal Home impressions `199` | **Qualifies!** | `199 < 200` and age `≤ 7200 seconds` (whether it finally wins the draw is the next step's sampling) |
| Post published only 10 minutes ago | Internal Home impressions just hit `200` | **Out, directly!** | The code says `< 200` (strictly less); at 200 it graduates and gets off the elevator at once |
| Post published 3 hours ago | Internal Home impressions a pitiful `10` | **Out, directly!** | Few impressions can't offset an age over 2 hours (`&&` must all hold) |
| Author followers exactly at 50,000 | `followers = 50000` | **Passes the follower condition!** | The code cap uses `<= 50000`, which includes 50,000 itself |
| Front-end public Views show `180` | Internal `view_count_on_home` unknown | **Cannot be judged from the front-end number** | The code reads an internal, dedicated Home-feed impression field; front-end Views are no substitute |
| This is a reply posted under someone else's post | `in_reply_to_tweet_id` has a value | **Out, directly!** | The first gate, `!is_reply`, blocks it dead; however early or low-impression, no cold-start eligibility |

Source: [35](#ref-35)

One technical detail as an aside: in `engagement_counts_hydrator.rs`, when the system pulls the general `view_count` and the dedicated `view_count_on_home`, it pulls them as two independent fields, with a **60-second-TTL (TTL = 60s) count cache**. That shows the back-end count itself refreshes with up to 60 seconds of cache lag — one more proof there's no need to fixate on the second the front-end number jumps to 200. [35](#ref-35)

### 21.2 After qualifying, one post is still picked from the candidates

Fine. Suppose reader Zhang San now pulls to refresh his home feed, and his temporary basket holds several new posts from different small authors, all holding all 5 tickets at once. **But the express elevator can carry at most 1 post up per trip. Which one does the system pick?**

Open `author_cold_start.rs#L236-L333` and there's a very classic reinforcement-learning exploration algorithm — **Thompson Sampling (probability sampling based on the Beta distribution)** — picking the final lucky one in two steps: [36](#ref-36)

```text
# Formula restatement, not verbatim source; prior defaults read, substituted
n = impression_scale * view_count_on_home
x = min(max(fav_count, 0), n)
alpha = 0.75 + x
beta = 49.25 + max(n - x, 0)
sampled_reward = sample(Beta(alpha, beta))

# Default: first keep the top 2 by sampled value
# then, of those 2, pick the one with the highest ranking score for the current viewer
```

Source: [36](#ref-36)

Don't let `Beta(alpha, beta)` scare you. In plain words, here's what those lines do:
1. **Step one: draw by "historical home-feed like rate" and keep the top 2 (`top_k = 2`)**
The program reads each eligible new post's current real **like count (`fav_count`)** and **internal home-feed impressions (`view_count_on_home`)** directly. (Note: real like counts genuinely are used here.)
With zero impressions so far (`n = 0, x = 0`), the system sets default prior parameters for every new post (a prior = a starting value assumed before any real data has been seen): `alpha0 = 0.75`, `beta0 = 49.25`. Compute the prior mean: $0.75 \div (0.75 + 49.25) = 0.75 \div 50 = \mathbf{1.5\%}$.
In other words: **the system's default baseline expectation for a small author's new post is roughly "per 100 home-feed impressions, about 1.5 likes (a 1.5% home-feed like rate)."** (Note: this is the Beta distribution's prior mean, not a guaranteed 1.5% traffic floor.)
As your new post is scrolled past by dozens of people on the home feed, if your actual home-feed like rate exceeds 1.5%, your `alpha` grows and your chance of drawing a high number rises sharply. But because it's random sampling (exploration uncertainty is kept), a brand-new post with 0 impressions also has a chance to draw a high number. After the draw, the system first keeps the **top 2 by sampled value (default `top_k = 2`)**. [36](#ref-36)
2. **Step two: of those top 2, pick the 1 with "the current reader's highest interest (highest predicted `score`)"**
This second step is designed brilliantly: 2 new posts drew into the final round; who actually rides the elevator? The system no longer looks at whose like rate is higher. It compares head-to-head **"for the reader Zhang San scrolling the home feed right now, which one's model-predicted ranking score (`ranking score`) is higher,"** and promotes the higher one, exactly **1** post, upstairs. (If this basket holds at most 2 eligible new posts to begin with, `top_k = 2` keeps them all and picks the highest by the current reader's model-predicted score.) [36](#ref-36)

Understand this "draw 2 by home-feed like rate, then pick 1 by the current reader's predicted score" mechanism and you'll see why **"gathering a WeChat group to tap into your profile and mutual-like" is nearly useless for cold start**:
- First, likes from group friends who followed a link or tapped into your profile do raise `fav_count` by 1, but those friends didn't scroll to you on the For You home feed (the denominator `view_count_on_home` follows different rules), and the friends you recruited in a group match your target stranger readers' profile not at all;
- Second, even if farmed likes sneak you into the 2-post final, the head-to-head is still **stranger Zhang San's AI model predicted score**. If your content itself doesn't match Zhang San's reading history, you're eliminated in the final just the same. [35](#ref-35) [36](#ref-36)

### 21.3 How the program's sixteenth place becomes a target score

So the one lucky new post selected — how high does "riding the express elevator" actually carry it?
Open the parameter file `home-mixer/params/param.rs` and `author_cold_start.rs`: in the public defaults, `ColdStartSlotMin = 15`, `ColdStartSlotMax = 16`. When the program draws the target position, it calls the half-open-interval random function `random_range(15..16)` (upper bound `16` not included) — that is, under the public default configuration, the **only locked target position is `index 15` counting from 0, the 16th place on the current candidate leaderboard**. (If the whole non-zero-score pool holds fewer than 16 posts, no promotion happens.) [35](#ref-35) [60](#ref-60)

Immediately after, the program takes the score of the post currently at rank 16 as the "target score (Target Score)," and rewrites your selected small-account new post's score to **`max(your original score, the 16th place's target score)`**.
That is: if you could already rank in the top 15, the system leaves your high score alone; if you originally ranked 500th, the system forcibly raises your score to the 16th place's level. (Also, ticket four from earlier: `position_among_nonzero < floor(0.97 * nonzero_count)` — with 100 non-zero posts in the pool it excludes the last 3, with 20 it rounds and excludes the last 1; "excludes roughly the bottom 3%" is its intuitive phrasing.) [35](#ref-35) [36](#ref-36) [60](#ref-60)

But note: after cold start raises your score to the 16th place's level, the shared `VM Ranker` flow still applies the same-author `0.625` diversity decay and the `0.75` out-of-network OON multiplier after it, and finally passes visibility filtering and blends with ads and conversation cards (`blender_selector.rs`). So this amounts to a "powerful booster" into the front-row field of view — not welding you into the 16th slot of every phone screen. [12](#ref-12) [60](#ref-60)

So for creators under 50,000 followers, **the first 2 hours after publishing (7,200 seconds) are the cold-start window**: publish original substantive posts (or high-quality Quote posts) in your target audience's most active time slot; in the first two hours, if someone in the replies points out a missing condition, add it promptly. But there's absolutely no need to spam replies endlessly in the comment section like a robot, and still less to panic-delete and repost because the front-end view count didn't move in the first ten minutes. [35](#ref-35) [36](#ref-36)

### 21.4 Here, NewUser means the new reader

Before closing the cold-start section, one rumor that has tortured countless beginners must be debunked: **"A newly registered X account must never post directly. First pretend to be an ordinary reader — scroll, like, comment every day to 'warm the account' for 7 days, or you'll fail the `NewUserMinEngagementFilter` (new user minimum engagement filter)."**

Open the source of `home-mixer/filters/new_user_min_engagement_filter.rs` and look, and you'll find the rumor-mongers didn't even read the subject right:
1. The variable this filter checks is named **`query.user_id`** — and throughout the `Home Mixer` code, `query.user_id` always means **"the reader (Viewer) pulling to refresh the home feed right now,"** never the post's author (`candidate.author_id`).
2. What's more, in the public parameter config (`param.rs#L832-L860`), this filter's enable switch defaults to **`false` (off)**.

Taking a filter that is "off by default, and built to check new readers scrolling the home feed" and using it to scare new authors with "no posting for the first seven days, go like other people's posts to warm the account" is pure misdirection. If you just registered a new account, get your avatar and a concrete, clear Bio done on day one, publish your carefully prepared first original substantive post and pin it. A new post under 50,000 followers has the cold-start eligibility window in its first 2 hours; use your prepared substance on the very first post. [57](#ref-57) [58](#ref-58) [62](#ref-62)

## 22 "New posts aren't cut first anymore" — what actually changed is source slot allocation

In the late-October algorithm update, besides the "express elevator in the scoring room (`author_cold_start.rs`)" above, the officials also added, at the **"ticket gate before the scoring room,"** a protection mechanism very friendly to new posts and small accounts — the rumored "after the late-October update, new posts are no longer cut before model scoring (`FairShareRankingFilter`)."

First check its exact birth date: in the commit history of `home-mixer/filters/fair_share_ranking_filter.rs`, this filter was first written into the code on **October 21, 2026 (commit `7f2ca2b`)**, with the default switch `false` (off) that day. The very next day — **October 22, 2026 (commit `989fb91`)** — the public default switch `EnableFairShareRanking` was formally changed to **`true` (on)**, and the model scoring budget `PhoenixScoresResultSize` defaulted to **`2800`**. [16](#ref-16) [61](#ref-61)

| Public commit | UTC time | Los Angeles time (PDT) | Public default |
| --- | --- | --- | --- |
| `7f2ca2b914cadac591ea7fceec0c477e473d3dee` | 2026-10-21 00:52:08 | 2026-10-20 17:52:08 | New `FairShare` filter; switch `false`; scoring budget `2800` |
| `989fb91254d461bf4b9df53fb12d5c9a61c2b354` | 2026-10-22 06:49:38 | 2026-10-21 23:49:38 | `FairShare` switch formally `true`; scoring budget still `2800` |

Source: [16](#ref-16)

### 22.1 Group by source, then allocate slots

Many friends never understood what `FairShareRankingFilter` does. One sentence explains it:
On each home-feed refresh, the candidate posts the buyers fetch into the temporary basket — following feed `Thunder`, regular recommendation flow `Phoenix`, cold-start flow `ForYouPhoenixRetrievalCold`, zero-like flow `ZeroFav`, and more — can total **3,000-plus posts**. But the AI model doing the fine scoring (Phoenix Scorer) has limited compute and will look at at most **`2800`** posts per request (`PHOENIX_CLIENT_MAX_CANDIDATES = 2800`).
- **How were people cut before October 22?** The ticket checker laid every channel's posts flat in one list, **kept only the first 2,800, and cut everything from 2,801 onward with one knife.** The result: the small-author new posts sent by channels at the list's tail — "cold-start channel (`ForYouPhoenixRetrievalCold`)" or "zero-like new-post channel (`ZeroFav`)" — never even got to face the AI judge; they were wiped out at the door.
- **How does the ticket check work after `FairShare` was enabled on October 22?** The checker first splits all candidates into groups by their origin channel (`served_type`), then **strictly by each channel's share of the total (plus the largest remainder method), fairly divides those 2,800 scoring entry tickets among every channel.** [61](#ref-61)

```text
# Flow restatement, not verbatim source
total = sum(source_counts)
if total <= budget:
    keep every candidate
else:
    allocation_i = floor(source_count_i * budget / total)
    distribute remaining slots by largest remainders
    keep the first allocation_i candidates within each source group
```

Source: [61](#ref-61)

Run one concrete numeric example and you'll fully grasp its power and its boundary:
Suppose one refresh brings **3,000** candidates into the temporary basket (over the 2,800 scoring budget, so 200 must be cut). Main channel A sent 1,200, main channel B sent 1,200, and the **cold-start channel C (`Cold`)**, at the very end of the list, sent 600:

| Assumed source | Candidates entering preliminary screening | Old result (hard cut by list) | Now: 2800 slots allocated proportionally (FairShare) | Still removed at this step |
| --- | --- | --- | --- | --- |
| Main source A | 1200 | Kept 1200 | **1120** | 80 |
| Main source B | 1200 | Kept 1200 | **1120** | 80 |
| **Cold-start source C (at the list's tail)** | **600** | **Only 400 left (200 cut!)** | **560 (kept 560!)** | **40** |
| **Total** | **3000** | **2800** | **2800** | **200** |

Source: [61](#ref-61)

Look at that table:
- Under the old one-knife cut by list order, the tail-end cold-start channel C swallowed all 200 layoff slots alone: of its 600 new posts, 200 were cut outright, leaving 400 to enter;
- With `FairShare` allocating proportionally, main channels A and B each yield 80 slots, and **cold-start channel C successfully keeps 560 scoring-entry slots (40% more entry chances than before)**.
At the same time, you see the rigorous boundary: the last **40** candidates in cold-start channel C still get cut at this step (within a group, the first `allocation_i` in the original order are kept; there's no re-ranking within the group by post age or like rate). So the most accurate statement is: **`FairShare` protects weak channels like cold start and zero-like posts' fair, proportional chance to enter and face the judge — it is not a death-proof golden ticket issued to every new post site-wide.** (If one basket's total candidates don't exceed 2,800 to begin with, nothing is cut and everything enters.) [61](#ref-61)

### 22.2 The 2800 candidate slots have nothing to do with 200 Home impressions

Here, disentangle a few easily colliding numbers in the code once and for all:
- **`2800` (`PhoenixScoresResultSize` / `PHOENIX_CLIENT_MAX_CANDIDATES`)**: the **candidate post count cap** sent into the Phoenix scoring model on one reader's single home-feed refresh;
- **The first `200` (`PhoenixColdStartMaxResults = 200`)**: a request parameter for how many cold candidate posts at most to fetch back per request when asking the Phoenix recall service for goods;
- **The second `200` (`ColdStartImpressionThreshold = 200`)**: the **cold-start eligibility cap** from the previous section — how many times your own new post has accumulated being scrolled to on the site-wide For You home feed.
These three numbers govern entirely different stages. Never believe marketing accounts' fabrication that "a new post first enters a 200-person cold-start pool, passes, then rises into a 2,800-person intermediate traffic pool" — treating "the single-scoring candidate pool holds 2,800 posts" as "your post gets pushed to 2,800 viewers" confuses even "post count" with "viewer count." [16](#ref-16) [35](#ref-35) [61](#ref-61)

## 23 If an important correction is only added under the old post, the original readers may never scroll to it

Day to day, after publishing a technical review or tutorial, we suddenly discover the next day that a number was computed wrong, or an important premise was missed. Most people's first reaction is: **"Quick, under yesterday's original post, I'll reply to myself and add a correction note."**

Careful. If you only add the important correction in the old post's comment section, **the thousands of old readers who already saw that old post yesterday will, on their For You home feeds, very likely never scroll to your new correction at all.**
Why? Open the source files responsible for filtering "already seen posts," `home-mixer/util/candidates_util.rs` and `previously_seen_posts_filter.rs`, and the answer is in these three lines: [20](#ref-20)

```rust
std::iter::once(candidate.tweet_id)
    .chain(candidate.retweeted_tweet_id)
    .chain(candidate.in_reply_to_tweet_id)
```

See how those three lines check the "seen record"?
When the system checks whether a candidate should be stopped by the "already seen filter (`PreviouslySeenPostsFilter`)," it checks not only the candidate's own ID (`candidate.tweet_id`) but also, along the chain (`.chain`), its **reposted original's ID (`retweeted_tweet_id`)** and the **ID of the parent post it directly replies to (`in_reply_to_tweet_id`)**. If **any one** of those three IDs hits this reader's seen record brought into this request (including the explicit `seen_ids` list or an approximate Bloom filter — a quick "looks like you've seen this" list that occasionally gets it wrong; `previously_served_posts_filter.rs` also uses the same logic to check IDs already served this session), **the whole candidate is filtered out on the spot as "already-seen old news."** [20](#ref-20)

Walk one concrete scene through those three lines:
Suppose yesterday you published *Database Performance Stress Test Report A*, and it did well — 10,000 readers scrolled to and saw post A on the home feed (at that point, post A's ID is written into those 10,000 readers' `seen_ids` records).
This morning, you suddenly find yesterday's stress test missed the key condition "cold cache after restart (Cold Cache)," and the conclusion flips completely. So under yesterday's post A, you tap "Reply" and post an important correction note B.
Question: when those 10,000 old readers who saw A refresh their home feeds today, can they scroll to your new correction B?
**They cannot.** Because new correction B directly replies to A, B's **`in_reply_to_tweet_id` field holds exactly yesterday's old post A's ID.** When B enters those 10,000 old readers' candidate pools and passes security, `previously_seen_posts_filter.rs` checks and finds: "Hmm? B's parent post A is already on the reader's seen list." One chop, and your brand-new correction B is filtered out. [20](#ref-20)

### 23.1 Ordinary additions stay in the conversation; conclusion-changing results go out separately

With those three lines understood, you'll know how to handle additions and corrections by case:
1. **If it's a local small question a reader asked in the comments** (say, "What's the launch command for your test script?" or "Is line three of the config missing a semicolon?"): replying to him in the original post's comments is enough, convenient for later readers who tap into the comments and read down the thread.
2. **If it's a major correction that changes the original's core conclusion, a retest reversal, or a new version release**: **never add it only in the old post's comments. Do two things at once: ① leave a short correction signpost link under the old post; ② publish a brand-new standalone original post (or publish it as a Quote of the original post with comment).**
(Why aren't a standalone new post or a Quote of the original blocked? Because those three lines check only `tweet_id`, `retweeted_tweet_id`, and `in_reply_to_tweet_id` — **they do not check `quoted_tweet_id`.**)

When you publish a standalone update post, don't write an opening with no head or tail. Let both "new readers who never saw yesterday's old post" and "old readers who did" understand at a glance:

> **Sample opening for a standalone correction post:**
> "Correction note: yesterday's database performance stress test missed a key condition — the cold cache (Cold Cache) after restart.
>
> After completing the cold-cache test today, the original conclusion about 'first-query response time' needs revision. This post lists the newest test conditions, the corrected comparison table, and the parts of the original report that still hold, in full, below, for everyone to check."

That way, old readers who saw old post A yesterday can scroll normally to this standalone new post on the home feed, avoiding being misled by the wrong conclusion; and new readers who scroll to you today get the most complete, most accurate, newest test data directly. [20](#ref-20)


## 24 Old content can be reintroduced, but the seen record doesn't vanish with a repost (the 5 gates of Reposting your own old post, fully unpacked, and the Quote breakout method)

Many creators see "ordinary candidates over 48 hours get eliminated by the AgeFilter" and hear "a Repost (Retweet) generates a new `tweet_id`," and an ingenious idea pops up at once:
**"Then every two days, I'll just tap 'Repost (Retweet)' on my own old substantive posts, topping them up — won't my old posts revive infinitely and keep flowing to strangers site-wide?"**

In earlier discussions, many friends specifically asked me to unpack completely **"what actually happens in the code when you directly Repost your own old post."**
Today we'll follow the source and watch with our own eyes: when you press "Repost" on your own 5-day-old post, which **5 gates** that repost crashes through in the recommendation pipeline, and why **"use Repost for cross-time-zone catch-up; to break out to strangers you must use Quote (with comment)."** [63](#ref-63)

### 24.1 Directly Reposting your own old post: which 5 gates does it pass in the code?

1. **Gate one (the 48-hour age gate, `AgeFilter`): it really does pass smoothly.**
In `home-mixer/filters/age_filter.rs`, `AgeFilter` keeps only candidates published no more than 48 hours ago (`MAX_POST_AGE = 48 * 60 * 60 seconds`). But what it checks is **the current candidate's own `tweet_id`** (with `thunder_source.rs` filling the brand-new ID generated by your repost today into `tweet_id`, and storing the 5-day-old original's ID in `retweeted_tweet_id`). Because your repost today owns a `tweet_id` born today, it really does slip past the 48-hour age limit and won't be chopped by `AgeFilter` on the spot. [39](#ref-39) [63](#ref-63)
2. **Gate two (the stranger breakout gate, `OONRetweetReplyFilter`): cut down with one knife — it never reaches strangers at all.**
**This is the single most pivotal step smashing the fantasy of "breaking out by Reposting my own old posts."**
Remember the out-of-network filter `oon_retweet_reply_filter.rs` from Chapter 8? It has a no-negotiation iron rule: **directly remove every plain repost (`is_retweet`) whose "candidate author (`author_id`) is not on the current reader's follow list."**
Someone else (peer big account Yi) reposting your old post can help you break out because, to Yi's follower Bing, the reposter Yi is someone Bing follows (in-network), so this filter doesn't stop it. But when **you Repost your own old post yourself**, the reposter is still you. To every stranger site-wide who doesn't follow you yet, you remain "out-of-network," so **your own plain repost is 100% intercepted in the ordinary recommendation candidate pipeline and can never be pushed to strangers who don't follow you.** [30](#ref-30)
3. **Gate three (your own old followers' seen gate, `previously_seen_posts_filter.rs`): followers who saw it absolutely never see it a second time.**
Since it can't reach strangers, push it to my own followers, then? Strictly, followers split into two groups:
- **Followers who scrolled to that old post 5 days ago**: we just read the source in the previous section — the seen filter checks the new repost's `tweet_id` together with **the old original's `retweeted_tweet_id`**. If this follower scrolled to your original 5 days ago, his seen record (`seen_ids`) already holds your old post's original ID, and today's new repost is stopped on the spot — **he absolutely never scrolls to it a second time on the home feed.**
- **Old followers who happened to be offline 5 days ago and missed it, or new followers from the last two days**: they follow you (in-network `Thunder` channel, not stopped at gate two), and their seen records don't yet hold that old post's ID (not stopped at gate three) — **only this group, "missed-it old followers + new followers," will scroll to your plain repost of your own old post on the home feed.** [20](#ref-20) [39](#ref-39)
4. **Gate four (same-pool deduplication and the `0.625` weight-fight gate): it fights your own new post from today.**
If today you published a brand-new original post and also casually Reposted your own old post, both actions carry your own `author_id` on top. For followers who haven't seen your old post, both land in his temporary basket at once, and at VM Ranker scoring they directly trigger the **`0.625` same-author decay** (the old-post repost steals your new post's full-score slot, or the new post presses the old-post repost down to `0.625`).
Also, if the original was published less than 48 hours ago when you Repost it, `RetweetDeduplicationFilter` (`retweet_deduplication_filter.rs`) will merge and deduplicate the original and the repost by original ID — never letting you hold two slots in one basket. And both the small-account cold-start 200-impression support (`author_cold_start.rs`) and the mutual-follow friend 20x reply bonus (`inputs.rs`) covered earlier explicitly write `!self.is_retweet`; plain reposts get neither. [2](#ref-2) [35](#ref-35) [42](#ref-42) [63](#ref-63)
5. **Gate five (the safety-label guilt-by-association gate): if the old post carries a sensitive label, the repost detonates the mine today.**
Chapter 28 covers in detail the rule "among the most recent 5 posts, 3 carrying the `NSFW_HIGH_PRECISION` label earn the account an account-level label" (`safetyLabelToUserLevelAggregationV2Processor.strato`). In that code, when scanning your timeline and meeting a plain repost, the program calls `originalTweetForRetweet` to look up **the safety labels on that old original**, but uses **today's new repost ID** to compute the 60-day validity window. That is: if you carelessly Repost an old post from a month or two ago that once got a sensitive label, it directly occupies a counting slot among your current most recent 5 posts, and may even complete the 3 needed to trigger the account-level label on the spot. [79](#ref-79) [80](#ref-80)

### 24.2 This reintroduction: give it a present use (the correct Repost vs. Quote division)

With those 5 gates read through, the most scientific practical answer to **"how do I make quality old substance shine again"** is already calling out:
1. **When do you tap "plain Repost (Retweet)" directly? — Only once, for "cross-time-zone catch-up."**
Say you published a heavyweight long piece at noon Beijing time and your domestic daytime followers finished it. At 11 p.m. Beijing time (when Chinese readers in North American and European time zones are just getting up and scrolling), you can casually tap "Repost" once, feeding this substance specifically to the overseas-time-zone old followers who were offline in the daytime and missed it, and to the new followers who followed today. (After posting, don't collide with your next new original post in the same minute.)
2. **Want a three-month-old piece of substance to break out again and reach "strangers site-wide who don't follow you"? — Never tap plain Repost; you must use "Quote Post (with comment)."**
Why does **Quote (with comment)** perfectly dodge every one of plain reposting's death traps?
Because at the code's bottom layer, a Quote post has its own independent body and a brand-new `tweet_id`, and its **`is_retweet` field is `false`** (the old post's ID lives in the `quoted_tweet_id` field). That means:
- **① Passes the stranger breakout gate perfectly**: it is not `is_retweet` (nor `is_reply`), so **it is never intercepted by `OONRetweetReplyFilter`**, and can be pushed normally, like a brand-new original post, to strangers site-wide who don't follow you.
- **② Passes the seen-filter gate perfectly**: the three lines in `previously_seen_posts_filter.rs` from earlier check only `tweet_id`, `retweeted_tweet_id`, and `in_reply_to_tweet_id` — **they never check `quoted_tweet_id`.** So even old readers who saw the original can scroll to your Quote post with its new comment on the home feed.
- **③ Enjoys cold start and high weight at full strength**: it is not excluded by `author_cold_start.rs`'s `!is_retweet`; a small account's Quote post can still take the first-2-hours, 200-Home-impressions express-elevator support. And Quote's own interaction prediction weight is a full **`5.0`** (5 times the plain repost's `1.0`). [20](#ref-20) [21](#ref-21) [30](#ref-30) [35](#ref-35)

Of course, when you use Quote to reintroduce a three-month-old post, never just type four words like "revisiting an old piece," or robotically repeat "this is important" every day — **you must combine it with the reader's current new scenario and give the old substance a "use it today" new reason.**
For instance, three months ago you wrote a *Rental Move-Out Handover Checklist*. Come graduation moving season, you Quote that old post with the caption: **"It's peak move-out season now, and move-out disputes most often break out in these three corners. Before handing back the keys, be sure to photograph each item on this checklist as evidence; I've added the water and electricity meter reading checks based on this year's common dispute points 👇"** (if the original checklist has outdated content, update it first and mark the revision date). Published that way, algorithm and human readers alike see a full-strength new piece solving today's urgent problem.

A word on the rule for "directly clicking Edit to modify a published post": in the visibility system `visibility-filtering/models/tweet.rs` and `tweet_rules.rs`, there is a rule filtering specifically "old versions of posts superseded by a newer edited version (stale edited version)" — its only job is to guarantee readers scroll to your latest edited version, not the old remnant with the typo uncorrected. Online, some people retell it as "once you click edit and change one typo, the algorithm demotes and voids the whole post" — pure self-scaring. (Of course, clicking edit won't reset the post's 48-hour age to 0 seconds either; finding a hard error that affects conclusions, fixing it at once so readers see the correct content is what matters most.) [64](#ref-64)

### 24.3 One day, two days, and 49 hours each limit something different

Reading this far, you've met **24 hours (1 day), 48 hours (2 days), and 49 hours** — several post-lifetime time numbers. To keep you from mixing them into one "site-wide unified post death countdown," here they are in a table, each governing its own territory in the source: [37](#ref-37) [34](#ref-34) [39](#ref-39)

| Code location | Specific object checked | Condition in the public code | What this condition does not answer (no wild inference) |
| --- | --- | --- | --- |
| The ordinary candidate pipeline's `AgeFilter` | The creation time corresponding to the current candidate's own `tweet_id` | Keeps `age <= 48 hours`; excludes only when strictly over 48 hours | **It does not directly compare the age of `retweeted_tweet_id` (the reposted old original)** |
| The ordinary `HOME` recall dataset | The specified Parquet index data file | `HOME` / `HOME_COLD` / `HOME_HOT` reference `1fav_1day.parquet` (24-hour window) | This one enum can't reverse-prove that every live request and other recall source (like `Thunder`) fetches only content within 24 hours |
| `rankall` index storage windows | Each Index's data retention range | `1fav` has 24 / 48-hour windows; `32fav` has 24-hour and other windows | One data bucket's storage window is not one piece of content's total exposure lifetime across all site entrances |
| The `Favorite` like-event updater | The post's own age, and the time since its first index update | Post age `< 49 hours`; with an existing cache, time since first update `<= 48 hours`, update interval `>= 1 minute` | This governs only "whether the index still updates after likes arrive"; it can't substitute for whether a candidate finally passes `AgeFilter` |

Sources: [37](#ref-37) [34](#ref-34) [39](#ref-39)

```text
AgeFilter actually uses:
is_within_age(candidate.tweet_id)
Keep condition: age <= MAX_POST_AGE
MAX_POST_AGE = 48 * 60 * 60 seconds
```

Source: [39](#ref-39)

Look at `AgeFilter`'s source: it uses `age <= 48 * 60 * 60 seconds` (kept at or under 48 hours, removed only when over). Laying out this detail is to describe the code boundary accurately — not to have you game some mystical operation at 47 hours 59 minutes 59 seconds. [20](#ref-20) [39](#ref-39)

### 24.4 Other entrances have their own qualifications too

Finally, remember: the ordinary candidate pipeline's 48-hour `AgeFilter` governs only the conventional candidate flow, `ScoredPosts`. Earlier we mentioned that in the For You top-level pipeline, standing side by side, `PushToHomeSource` (pushing by specified post ID), and the immersive video datasets' video windows of **4 days, 14 days, even 14 to 30 days** (`video_4day`, `video_4to14day`, `32fav_video_14to30day`), all have their own independent time windows and admission rules. So never use a video's 14-day window to prove an ordinary image-text post escapes the 48-hour limit, and never assume a two-day-old long piece has vanished site-wide because ordinary candidates have a 48-hour limit. Learning to reactivate settled old substance a second time with **Quote (with comment) + a current new pain point** is the right path of long-term operation. [30](#ref-30) [50](#ref-50) [39](#ref-39)

## 25 Reply quality has another evaluation system

Earlier we discussed "whether a reply post can enter strangers' home-feed candidate pools" and "how the main scoring table scores the probability someone replies to you." But in the algorithm repo's `grox/flows/reply_spam` directory hides another system dedicated to **"the quality and spam evaluation of reply content itself in the comment section"** — the two systems must never be conflated. [65](#ref-65)

In `classifier_reply_ranking.py` and `task_write.py`, the program packages the whole conversation context, interaction signals, and author follower information and sends them to the Grox large model, which gives the reply a **reply quality score (`ReplyRankingScore`)**; some low-quality results also trigger conditional risk labeling. (The large-model prompt used to judge good from bad, `prompts.py`, is not open-sourced, so we can confirm the comment section has a separate large-model quality evaluation, but we cannot fabricate "over so many characters, or using such-and-such a fixed sentence pattern, means certain death.") [65](#ref-65)

Even without the unpublished prompt, set the two most common replies in a comment section side by side and the ranking is instant:
- Suppose a peer posts a screenshot of a "file format conversion error," and below it you reply with an all-purpose correct piece of filler: **"Written superbly! Very inspiring, thank you for the selfless sharing, blogger!"** (or twenty synonymous compliments batch-generated by AI) — this reply adds zero information to the original post's discussion;
- Conversely, if your reply points straight out: **"This error code is because the input filename contains Chinese parentheses, at step 3 of the corresponding conversion script; I reproduced it on macOS 15 + v2.4 — do one round of quote escaping on the path first and it runs"** — your reply directly adds verifiable troubleshooting material to the whole conversation thread. If you use AI to help write comments, likewise have the AI first extract the original post's pain points, existing conclusions, and missing conditions, then fill in your own first-hand measured details yourself — don't use AI as a repeater spraying everywhere.

### 25.1 Replying to yourself in a row under someone else's post: what score may be written to zero

Many people doing comment-section traffic plays like one routine: rush to a big account's hot post, grab a front-row comment, then, to place their own promo link or long essay, **"reply to themselves" in a row under that comment, building three or four floors**.
The rumor online: "Replying to yourself in a row under a big account gets you judged a spam account, and your account weight or the big account's original post score gets zeroed directly."

Open the source of `grox/flows/reply_spam/task_multi_step_reply_spam.py` and `classifier_multi_step_reply_spam.py` and first clarify "whose what score gets zeroed": **once this rule judges it "multi-step self-reply spam promotion (Multi-Step Reply Spam)," the program writes `0.0` for those spam-judged reply posts' own `ReplyRankingScore` (comment-section ranking score). It neither deducts the big account's original post score, nor zeroes your whole account's home-feed recommendation score.** [66](#ref-66) [67](#ref-67)

### 25.2 The order of conversation-structure checks and model judgment

This filter built to catch "building floors by replying to yourself under others" is called **`TaskMultiStepReplySpamFilter`** (`task_multi_step_reply_spam.py`). Replying to yourself once in a comment section doesn't immediately trigger large-model review; it must first pass a very specific **"conversation structure threshold"**: [66](#ref-66)
1. **Complete ancestor chain, official AI excluded**: the current reply must have a complete conversation ancestor chain (no missing items); author profiles must be fetchable for the current post, the direct parent post, and the topmost root post; and the `@grok` and `@gork` accounts are excluded;
2. **Key exemption — the "root post author's own thread" is excluded**: if the current reply's author **is the topmost root post's (Root Post's) author himself**, skip the check entirely. This proves: **replying to yourself in a row under your own main post to write a thread (Thread) absolutely never triggers this self-reply spam rule.**
3. **Three-floor structure + direct parent same author**: the whole conversation must have **at least 2 ancestor posts** (that is, at least the three-floor structure "someone else's root post → your first-floor reply → your second-floor reply to yourself"), and **the direct parent post's author must be the same person as the current reply's author (you replying to yourself)**.
4. **The root post author's follower threshold is 1,000 followers**: the topmost root post's author must have **at least 1,000 followers (`>= 1000`)** (the code writes the explicit number `1000`, not some fuzzy "super big account"); also, if the current replier himself holds high PageRank V2 or a grey-badge verification (government / institution grey badge), this filter exempts and skips him directly. [66](#ref-66)

Draw that structure-condition set as a table and you'll understand what "building floors by replying to yourself under a big account" means: [66](#ref-66)

| Floor of the same example conversation | Post author | Role in `TaskMultiStepReplySpamFilter` | Judged spam on structure alone? |
| --- | --- | --- | --- |
| Floor 1: topmost root post (Root) | Another blogger with `>= 1000` followers | Someone else's main post providing the discussion's start | **No** (strictly protected by the system) |
| Floor 2: first-level comment reply | **You yourself** | The current reply's direct parent post (Direct Parent) | **No** |
| Floor 3: replying to yourself under your own comment | **Still you yourself** | The to-be-checked reply satisfying "at least two ancestors + parent-child same author" | **No! Structure qualifying only sends it to the large model for content judgment** |

Source: [66](#ref-66)

See the table's last column: **satisfying the structure of "replying to yourself under a thousand-follower blogger" only means you've triggered eligibility for large-model review — it in no way means automatic spam judgment.** For instance, someone posts a technical problem; your first reply posts troubleshooting steps, and your second reply to yourself adds compatibility differences across system versions — the structure is identical, but as long as the large model reads the content and judges it normal supplementary discussion, you won't be ruled in violation. (Since the classifier's specific Prompt is unpublished, we won't fabricate false formulas like "reply in a row so many times and you surely die" or "keep it under so many characters and you're absolutely safe.") [66](#ref-66)

### 25.3 Posts the model circles still pass through one more screening

Even after the large model reads the whole conversation and circles a batch of floors it thinks look like spam promotion (the Flagged set), before the program actually writes the `0.0` score it sets three tight anti-false-positive sieves in `classifier_multi_step_reply_spam.py`: [67](#ref-67)
1. **Must include this newest reply**: if the large model circles only your older floors and doesn't include the newest reply currently being evaluated, the program judges it doesn't constitute sustained multi-step spam and **discards the whole result set — not one is punished**.
2. **Remove innocent passers-by, and keep at least 2**: the program first removes all posts by other authors in the conversation (keeping only your own replies); if after removal only a lonely **1** remains, it doesn't meet the "multi-step (Multi-step)" definition, and again **the whole set is discarded unpunished**.
3. **Ironclad root-post protection**: when feeding the conversation to the large model, the program not only marks floor 0 explicitly as `root post` in the text, warning the model not to flag it; when parsing the model's returned results it also hard-codes **accepting only floors with `index > 0`**, physically eliminating any chance of falsely flagging the thousand-follower blogger's original post (Root Post). [67](#ref-67)
(One model field-of-view limit as an aside: if the whole conversation's ancestor floors exceed 10, this classifier takes only **the first 5 floors + the last 5 floors + the current newest reply**, and reads at most 2 media attachments per post. It samples head and tail; it doesn't read a hundred-floor tower word for word.) [67](#ref-67)

### 25.4 What gets written to zero is the spam-judged reply records

Only the few spam reply IDs of yours that survive all those sieves get processed by the writer (`task_multi_step_reply_spam.py#L151-L198`), which first tries to tag each with a `RiskyHighVizReply` risk label (a “high-visibility risky reply” tag), then publishes the instruction zeroing the comment ranking score below (executed only in the formal `production` environment): [67](#ref-67)

```python
ReplyRankingScore(
    score=0.0,
    reasoning=reasoning[-500:]
)
```

Source: [67](#ref-67)

Note that here "tagging `RiskyHighVizReply`" and "writing `ReplyRankingScore` as `0.0`" are two sequential actions in the code: the helper function doing the tagging (`task_write.py`) internally re-checks high PageRank / credit score, grey badge, and test account exemptions; even if the label isn't applied due to an exemption, the outer function still proceeds and publishes the `score=0.0` score to the cache, Kafka, and the Strato database. (In the public code we can trace this `0.0` score's generation and publication, but how each downstream comment-section ranking entrance consumes it isn't fully public, so we strictly call it, per the source, "zeroing that spam reply's `ReplyRankingScore`" — not inflating it into an account ban.) [66](#ref-66) [67](#ref-67)

For us creators the principle is dead simple: when commenting in someone else's section, if you have new data, steps, or counterexamples to add, write the background out plainly and generously. If it's to hang a dog-meat sign on a sheep's head under someone else's hot post — replying to yourself floor after floor with course-selling ads or traffic QR codes — that is exactly the live target `TaskMultiStepReplySpamFilter` aims at.

## 26 Quoting someone else's original also meets visibility conditions

Many bloggers doing industry commentary, hot-topic analysis, or debunking use one favorite move: **"Quote Post (with comment)"** on someone else's post. Everyone tends to think: "As long as my own comment doesn't violate the rules, this is a proper original Quote post (weight `5.0`) — the traffic is rock steady."

But you may well have missed a **"guilt-by-association rule for attached content"** hidden in `home-mixer/candidate_hydrators/vf_candidate_hydrator.rs` and `ancillary_vf_filter.rs`:
When your candidate is about to go onto a reader's home feed, the visibility system checks not only the post itself but also **all the ancillary content (Ancillary Tweets) attached to it** — including **the original post you quoted (Quoted Tweet)**, the reposted original, and conversation ancestor posts.
If the original post you quoted is later deleted by its own author, or judged removed by the platform for a violation (the code explicitly checks `Drop`, `Tombstone`, or `NotEvaluated` (not yet evaluated); note: ordinary collapse-warning soft dispositions are not in this list), **`ancillary_vf_filter.rs` directly removes your Quote post (the whole candidate) from the recommendation candidate pool along with it.** [68](#ref-68)

Imagine how unjust this scene is:
Suppose you see someone post a hole-riddled rumor post online, and indignantly tap "Quote," typing one line on top: **"This person is talking pure nonsense! The real data is nothing like that, everyone mustn't believe it!"**
Two hours later, the rumor-monger guiltily deletes the original, or the original gets banned by the platform into a tombstone (`Tombstone`):
1. **At the algorithm recommendation level**: because the quoted original triggered `Drop` / `Tombstone`, your debunking Quote post is buried alongside it at the `ancillary_vf_filter.rs` gate, vanishing from strangers' recommendation candidate pools;
2. **At the human reader level**: even if a follower taps into your profile and sees this post, the quoted original's card below has become a grey "this post is unavailable," and your body says only "this person is talking pure nonsense" — the reader has no idea whom you're refuting, what the other side said, or what the real data is.

So every time you prepare to Quote someone's post to comment on or refute it, **be sure to state fully in your own body "what the other side's original core claim was, why it's wrong, and what your real evidence and original sources are"** (you can even summarize the core dispute points objectively in your lead image). If it's a very important debunking topic where the other side may delete and run at any moment, simply **publish a pure standalone original post with no quote card attached at all** — then your heart's work will never be dragged down by someone else's deletion or violation. [68](#ref-68)

## 27 Before posting an external link, confirm where it finally takes the reader

On posting external links (External URLs — your independent blog, GitHub repo, Substack newsletter, or Notion template download page) on X, two of the most headache-inducing rumors circulate online:
- Rumor one: "As long as a post carries an external link, the algorithm fixes a 30%–50% exposure deduction."
- Rumor two: "As long as you move the external link from the main post's body into the first comment (first reply), you perfectly fool the algorithm and escape the external-link penalty."

Pull every external-link-related module out of the public repo and confront them: **neither rumor holds in the public code. What really decides whether posting an external link gets you in trouble is not at all "body vs. comment section" — it's the "URL Reputation" on your link's redirect chain, and whether you've hung a bad link on your profile's pinned post.** [69](#ref-69) [70](#ref-70)

First look at the scoring table: in `home-mixer/models/content_features.rs`, the system does extract a boolean feature named `has_url` (whether a link is included) and pass it downstream. But in the final scoring formula (`scoring.rs`), **there is no penalty code "if `has_url == true`, multiply by 0.5 or deduct 30%."** Quite the opposite: in the 24-term weight table, **"predicted reader clicks open the external link (`Open link`)" carries a positive bonus weight of `+0.2`.** [21](#ref-21) [69](#ref-69)

### 27.1 Check your newsletter, portfolio, and download entrances

Since a normal external link costs no points, why do some people's traffic genuinely crater after posting one?
Because their links hit the anti-spam system (BotMaker)'s review bot specialized in catching **low-quality / malicious redirect links**.
Before posting an external link day-to-day (say, your newsletter, portfolio, or material download entrance), build one life-saving habit: **personally click the link you plan to post, from a draft or test post, once; watch the browser address bar — how many redirects it passes through, which domain it finally lands on, and check whether the landing page's content matches exactly what you promised in the body.**
Say your body promises readers an Excel quote template, but the short link first jumps through two inexplicable ad-statistics domains, or the old portfolio domain you bought three years ago expired long ago and was snatched and altered by a gambling site — a dead redirect chain or a domain that changed owners is the number-one culprit triggering external-link risk control. (Of course, eyeball checks help us rule out dead links and hijacked domains, but X's internal URL reputation library's specific rating value for a domain is not visible from a web page's appearance.)

At the same time, state plainly in the body "what you'll see when you open this link" (for instance, "Click the GitHub link below to download directly the CSV test sample containing 3 fields, corresponding to version v2.1"). If, for body layout cleanliness, you choose to put the link in the first-floor comment, signpost it at the main post's end so readers can find it — but never count on "moving it to the first-floor comment dodges the low-quality link review." Why? Read the v1 and v2 bot source comparison below and you'll understand.

### 27.2 A problem link in the pinned post may tag the whole account

A more dangerous mine hides in your **profile's pinned post (Pinned Post)**:
In `botmaker-rules/scarecrow/bot/PinnedLowQualityOrBadUrl.bot` there is an account-level rule aimed specifically at "changing the pinned post." Once you set a post carrying a `BAD`- or `LOW_QUALITY`-rated link as your profile pin (and the author conditions hold), the system doesn't punish only that pinned post — it **directly tags your whole account with a 7-day `SPAM_HIGH_RECALL` account-level throttling label**.
Once you carry this account-level label, for the entire 7 days, every new post you publish (even without a single character of external link) is directly intercepted at the stranger recommendation entrance (`HomeRecommendations`). So if you suddenly find several of your new posts' stranger reach cliff-diving to zero, the first thing to do is look back and check: **did I change my profile's pinned post recently? Has the old link in the pinned post gone bad?** (Together with the official [Under the Hood](https://x.com/i/jf/under_the_hood) tool taught later, you can directly check whether you carried this label in the reporting period.) [71](#ref-71) [72](#ref-72)

### 27.3 The "non-follower" condition in the filename: v2 no longer requires it

Why does "put the external link in the first reply (comment section) and you escape punishment" circulate online?
Because the people writing those guides are reading the ancient **v1 old rules**, unaware the repo long ago upgraded to the **v2 new rules**.
Put the old `LQ_Tweets_With_LQ_URL_Verdict_At_Mention_To_NonFollower.bot` (v1) and the newest `..._v2.bot` (v2) from the `botmaker-rules/scarecrow/bot/` directory side by side, and the truth comes out: [73](#ref-73)

| Check condition | Old v1 rule | Newest v2 rule | Real meaning for creators |
| --- | --- | --- | --- |
| The post `@`-mentions (Mention) a stranger who doesn't follow you | Required `@`-mentioning at least one non-follower | **Condition deleted entirely!** | Although the v2 filename keeps the historical name, the code no longer checks for `@`-ing a stranger at all |
| Reply post (`isReply`) / repost (`isRetweet`) exemption | **Explicitly excluded replies and reposts (putting it in a reply really wasn't checked)** | **Exclusion condition deleted entirely (replies and reposts are checked just the same)!** | **"Stuffing a low-quality external link into the first comment escapes punishment" is completely dead in v2!** |
| URL redirect chain quality judgment (`redirectionChain`) | The whole redirect chain's rating matches `LOW_QUALITY` | **Any single hop in the redirect chain contains `LOW_QUALITY`, and the final hop is not `GOOD` or `WHITELIST`** | Even if the final landing page is normal, if the short-link redirect service used in the middle is judged `LOW_QUALITY`, you're still hit |
| Penalty label written on a hit | Post-level `SPAM_HIGH_RECALL` | Post-level `SPAM_HIGH_RECALL` | At the `HomeRecommendations` recommendation entrance, this post is directly removed (Drop) |

Source: [73](#ref-73)

Look at rows two and three of that table:
1. In the old v1 era, the code really did exclude `isReply` and `isRetweet`, so stuffing an external link into the comments genuinely exploited a loophole back then. But in the newest **v2** (which judges on just three inputs — the post author's ID, the post ID, and a non-empty redirect-chain record — and excludes test accounts, high PageRank, the temporary exemption list, and grey-badge accounts), **the programmers have deleted the "exclude replies and reposts" and "must `@` a stranger" conditions clean away.** As long as you used a short link or redirect domain labeled `LOW_QUALITY` (and the final landing page isn't on the whitelist or `GOOD` list), **whether you put it in the main post's body or secretly stuff it into the first-floor comment, the v2 bot catches it just the same**, tagging that post `SPAM_HIGH_RECALL` on the spot.
2. Conversely, if you post a clean, reputable regular URL (say, directly GitHub, mainstream media, or a normally registered high-reputation site), even placed directly in the main post's body, it never hits this rule at all. (Normal short URLs, UTM tracking parameters, or regular affiliate links likewise won't be punished for no reason as long as the domain's reputation hasn't gone black.) [73](#ref-73)

### 27.4 Seven days counts from when the label is written

Now dig out the trigger details of that dangerous **"pinned-post bad-link bomb (`PinnedLowQualityOrBadUrl.bot`)"**:
This bot listens to user profile modification events (`user_modification`). Only when your pinned post ID list (`pinnedTweetIds`) changes (the modified `after` value exists, is non-empty, and differs from the `before` value) does it fetch all the expanded links (`expanded URLs`) in the new pinned post you swapped in, and parse their real landing destinations and URL reputation. If any one link contains `BAD` or `LOW_QUALITY` (and the author is not a test account, high PageRank, on the `AutoExpiringTempSkipList` temporary exemption list, or a government-agency **grey badge — note: an ordinary paid blue-badge Premium is absolutely not this grey badge; there's no death-proof golden ticket**), it immediately writes the **`SPAM_HIGH_RECALL`** label to the whole account. [74](#ref-74)

Two time details here concern your vital interests:
1. **From which second does the 7-day ban run?**
The code writes `CurrentTimeMs() + 7 days (one week)` — that is, **a full 7 days counted from the very second you swapped in the problem pinned post and triggered the bot to write the label** (unrelated to when that old post itself was published, and unrelated to which day you opened the back end and saw the report).
2. **If I notice something's wrong and immediately Unpin the post, does the 7-day throttling label vanish at once?**
**It does not vanish automatically at once.** The `PinnedLowQualityOrBadUrl.bot` rule file writes only the logic "add a 7-day label when a problem pinned post is swapped in" — **there is no corresponding branch "once unpinned, delete the account label immediately."** (Of course, we can't exclude other back-end appeal or manual-correction services intervening early. And after the 7-day label expires and vanishes on its own, new posts still pass recall, seen, and scoring flows normally; the code promises no automatic doubled compensation traffic on the morning of day 8.) So before you press the "Pin to profile" button, spending 5 seconds to click the links inside and confirm they open normally can save you a full 7 days of undeserved disaster. [74](#ref-74) [75](#ref-75)


## 28 The same safety label is handled differently at different entrances

Many creators, the moment they hear "my post or account got a safety label (Safety Label)," react with: "It's over — am I blacklisted site-wide? Even my old followers who follow me can't see me?"
Others find a die-hard follower friend and ask: "Bro, tap into my profile or scroll your following feed — can you see the post I just published?" The friend glances and says: "I can see it!" And he relaxes, assuming he wasn't throttled at all.

**Both ideas are entirely wrong.**
In X's architecture, "the safety system tags a post or account (Safety Labeling)" and "the visibility filtering system decides how to intercept (Visibility Filtering)" are two separate upstream-downstream systems. **The same safety label receives completely different treatment at "the home feed old followers scroll (`TimelineHome`)," "the entrance pushing to strangers (`HomeRecommendations`)," and "tapping into details or a profile (`HomeHydration`)."** [76](#ref-76) [77](#ref-77) [75](#ref-75)

Before unfolding the specific labels, let me clear up a version question, so nobody takes a code change and spreads a throttling rumor: I compared the safety and visibility code of the two versions `5ed7963` (October 28) and `606b254` (October 29), and the auto-labeling, 5-post aggregation, and video and reply review covered next are unchanged in rules and structure. The `visibility-filtering` directory did go through one refactor — duplicated rules were extracted into reusable lists, and scattered client boolean switches were rewritten into a unified `ClientSwitch` set — but I expanded all 14 rule-list groups before and after the refactor and checked them item by item: **every entrance's filtering rules and execution order are identical** (a conclusion from structural checking, not a byte-for-byte comparison). So don't take programmers' normal code tidying and retell it as "another site-wide throttling wave on October 29." [76](#ref-76)

### 28.1 Which readers and entrances the insult label restricts

First take a most typical post-level label — **`FOSNR_ABUSE_INSULTS` (the insults and personal attacks label; FOSNR's full expansion is not given in the public code)** — and see its real treatment at three different check entrances:

Why does this label's applicable audience, as written in the code rules, read `NonAuthors` (everyone except the author himself), yet in actual effect become "old followers can still see it, only strangers can't scroll to it at all"?
The secret is in `Home Mixer`'s splitting logic (`vf_candidate_hydrator.rs`).
When `Home Mixer` sends a candidate for safety checking, it first looks at whether this reader follows you:
- If the reader **already follows you (`in_network = true`)**, your post is sent to the **`TimelineHome`** safety level for checking — and in `TimelineHome`'s rule table, **there is no rule configured at all for "on meeting `FOSNR_ABUSE_INSULTS`, remove directly."** So your old followers still scroll to it on the home feed.
- If the reader **doesn't follow you yet (`in_network = false`, an out-of-network stranger)**, your post is sent to the **`TimelineHomeRecommendations`** safety level for checking — and at this stranger recommendation entrance, it's written in black and white: for everyone except the author himself (`NonAuthors`), **remove the candidate directly (Drop)**. [77](#ref-77) [75](#ref-75)

Tabulate `FOSNR_ABUSE_INSULTS`'s treatment at each check entrance and you'll understand this label's differing treatment: [77](#ref-77)

| Safety check entrance | Current reader identity or client condition | Disposition of the `FOSNR_ABUSE_INSULTS` label | What this step shows |
| --- | --- | --- | --- |
| `TimelineHome` (in-network following-feed entrance) | Considering only this one label | **No removal (Drop) rule configured for this label** | Old followers through this entrance aren't stopped by this rule (but other violating labels or a block still stop them under other rules) |
| `HomeRecommendations` (out-of-network stranger recommendation entrance) | Everyone except the author himself (`NonAuthors`) | **Remove the candidate directly (Drop)!** | **This is the culprit behind "stranger recommendation traffic drops utterly to zero"!** |
| `HomeHydration` (data hydration layer) | A stranger who doesn't follow you (and the client supports FOSNR rules) | **Remove directly (Drop)** | Controlled by a client switch (`FosnrRules`, on by default) |
| `HomeHydration` (data hydration layer) | A follower who follows you (and the client supports FOSNR rules) | **Soft intervention notice** | Followers can see it, but a notice layer may attach |
| `HomeHydration` (data hydration layer) | **The author himself** (and the client supports FOSNR rules) | **Show an appealable disposition notice** | You viewing your own post is completely normal, even with an appeal entrance (old clients triggering `FosnrFallbackDrops` remove it for everyone, but that fallback is off by default) |

Source: [76](#ref-76) [77](#ref-77)

At the same time, automatically applying this `FOSNR_ABUSE_INSULTS` label, on the Grox PTOS write path (`task_write_safety_post_annotations_result_sink.py`), has three explicit preconditions:
① the model must judge the post to be `HateOrAbuseInsultsWithTarget` (hate or insult attacks against a specific target);
② **the post's language must be recognized as English**;
③ the author is not a high PageRank or grey-badge account (test accounts are excluded earlier).
(Of course, this only shows this one automatic write branch requires English; it in no way means cursing in Chinese escapes other automatic rules or human reports.) So when writing sharp reviews or technical rebuttals day-to-day, aim at the matter, not the person — lay out data and logic, and don't add personal-attack vocabulary for a quick tongue. Once this label hangs on a post, old followers can still interact with you in the comments, but the post's stranger breakout channel is shut completely. [77](#ref-77)

### 28.2 `LOW_QUALITY` and MISINFO: who sees the warning, which actions get restricted

Another rumor circulates online: "As long as a post is tagged `LOW_QUALITY` or `MISINFO`, the system pops a warning mask for all non-followers and directly locks the like and repost-share buttons."

Check the source of `visibility-filtering/rules/tweet_rules.rs`, `rule_spec.rs`, and `verdict.rs`, and the warning mask (Interstitial) and interaction-button locking (Limited Engagements) really do exist — but the rumor gets the applicable audience and trigger conditions wrong in three places: [78](#ref-78)
1. **The applicable audience is everyone (`Everyone`), not just non-followers.**
This rule, named `PUBLIC_INTEREST_LABEL_INTERSTITIAL`, targets posts published after April 1, 2019 carrying a post-level `LOW_QUALITY` label, or carrying one of four misinformation labels (`MISINFO_CIVIC` civic elections, `MISINFO_GENERIC` general misinformation, `MISINFO_MEDICAL` medical health, `MISINFO_CRISIS` crisis events) — its display audience is written as **`Everyone` (everyone; followers see the warning too)**.
2. **Exactly which interaction buttons get locked depends on the label's source (`source`) and policy configuration.**
- If it's a `LOW_QUALITY` label, the program directly selects **`NonCompliant`** as the interaction restriction level — and in the public test expectations (`limited_actions_policy.rs`), `NonCompliant` really is the harshest "whole-family lock": **reply, plain repost, like, emoji reaction (React), DM sending, adding to bookmarks, adding to Moments, pinning, viewing post data, system share, and copy link — all forbidden.**
- But if it's one of the four `MISINFO` labels, the program first reads the label's `source` (source field): for instance, when `source` is `limited_replies`, it selects only `ConversationControl` (conversation control), which in the test expectations **restricts only "Reply" — likes and repost shares aren't locked at all**.
- **But there is one easily missed fallback trap**: if a `MISINFO` label has no `source` field filled in at all, although the first step (generating the warning) leaves the restriction items empty, at the second step, when `LabelInterstitial` assembles the final interaction restriction reasons (`verdict.rs#L77-L83`), **the code automatically falls back (Fallback) to the harshest `NonCompliant` whole-family lock.** So never assume "no source filled means no interaction buttons get locked." (Separately: the code counts plain repost, quote, DM, system share, and copy link as several different independent Actions; exactly which buttons are locked live is decided by a real-time configuration (`limited_actions_policy_limited_actions`) — what the public code shows is the test expectation.) [78](#ref-78)
3. **Distinguish the two things both named `LOW_QUALITY`.**
The `LOW_QUALITY` triggering the full button lock here is a **post safety label** stuck on a post. The `LOW_QUALITY` from the external-links section is the **URL rating** the URL reputation library gives a domain (a URL-rating hit writes the post a `SPAM_HIGH_RECALL` label). Never, because the names match, imagine that casually posting a short, ordinarily written daily post gets you tagged `LOW_QUALITY` and locks your like button. [78](#ref-78) [73](#ref-73)

### 28.3 Account labels affect many posts, but look at the specific name

Far more lethal than a single post's label are **account-level safety labels (Account Labels)** stuck directly on your account — because at the stranger recommendation entrance, once your account carries one of the labels on the list, every candidate post under your name is blocked at that entrance as a batch, with no need to review your new posts one by one (how followers are treated is different — see below).
Open `visibility-filtering/rules/levels.rs` and `author_rules.rs`: at the stranger recommendation entrance **`HomeRecommendations`**, the system lists a long string of account-level labels that directly remove (Drop) all of that author's candidate posts: [75](#ref-75)
- **Adult and sensitive class**: author self-flagged sensitive account (NSFW self-flagged), admin-marked NSFW state, and account labels like `NSFW_HIGH_RECALL` (high-recall NSFW), `NSFW_HIGH_PRECISION` (high-precision NSFW), NSFW avatar (Avatar), NSFW banner (Banner), near-certain NSFW (Near-certain), and more;
- **Spam and violation class**: **`SpamHighRecall` (high-recall spam account)**, `Compromised` (account stolen / security risk), `ReadOnly` (read-only ban state), `ImpersonationHighPrecision` (high-precision impersonation), `AbusiveHighRecall` (high-recall insult abuse), and **`DoNotAmplify` (no algorithmic amplification)**.

But even carrying those frightening account labels, the online line "any account label utterly cuts off all non-follower reach" is still too absolute:
every rule in the code explicitly specifies its audience (some `NonAuthors`, some `NonFollowers`), and the `TimelineHome` old followers scroll does not copy this whole interception list wholesale. As the official Under the Hood report accurately defines several of these labels — their effect is **"do not recommend posts from this account to non-followers"** — not physically erasing you from every site entrance: search box, direct profile visits, conversation detail pages, or direct links. [75](#ref-75)

### 28.4 "Three of the most recent five" — what exactly is being counted

Of all account-level labels, the one that makes creators' hearts pound is this "five-three ban iron rule": the rumor says "as long as 3 of your most recent 5 images are NSFW (or 3 of your most recent 5 image/video posts), the whole account gets its recommendation banned for 7 days."

Bring up the public default JSON rule source in `safety-label-user-agg/postToUserLabelRules.strato` and see how the program actually counts: [79](#ref-79)

```json
"windowSize": 5,
"minimumMatchingPosts": 3,
"maxPostAgeDays": 60,
"mediaOnly": false,
"postLabels": {"anyOf": ["NSFW_HIGH_PRECISION"], "allOf": []}
```

Source: [79](#ref-79)

Pin your eyes to line four: **`"mediaOnly": false` (count media posts only = no)**.
That line of code punctures two major online misconceptions at once:
1. **The unit counted is "posts," not "images," and not only posts carrying images/videos.**
The processor (`safetyLabelToUserLevelAggregationV2Processor.strato`) takes your most recent posts from your personal timeline interface (`userTimeline`) in reverse time order, first takes the frontmost **5 posts (`windowSize: 5`)**, then counts how many of those 5 posts are within 60 days and carry the **`NSFW_HIGH_PRECISION`** safety label.
A worked 5-post timeline ledger table makes the bookkeeping clear at a glance: [79](#ref-79) [80](#ref-80)

| Your timeline's reverse-order position | Post form | `NSFW_HIGH_PRECISION` label on it | How many counts does this rule book? |
| --- | --- | --- | --- |
| Newest #1 | A video post | **Yes** | **Counts 1** |
| #2 | **A pure-text daily rant (no image or video at all)** | No | **Counts 0 (but it occupies 1 slot in the top-5 window!)** |
| #3 | **One post stuffing 4 sensitive images at once** | **Yes** | **Counts only 1! (4 images in 1 post count as 1 post)** |
| #4 | An ordinary image-text update | No | Counts 0 |
| #5 | Another single-image post | **Yes** | **Counts 1 (cumulative 3 — triggers the account-level label)** |

Source: [79](#ref-79)

See the trick in that table?
- Post #3, even stuffed with **4** sensitive images, is one post, so in this rule it **counts only 1** (it won't complete the 3 and ban the account on the spot just because one post holds 4 images);
- Post #2, even a **pure-text post**, because `mediaOnly` defaults to `false`, still occupies 1 slot in the "most recent 5" window. If you publish two normal pure-text posts in a row, the old sensitive posts originally at positions 4 and 5 get squeezed out of the top-5 check window — this is a statement of how the counting method works, not an evasion method: triggering looks at label events, so don't use the window as a recipe. (Note: the table demonstrates only the code's counting logic; no real account's live data was used.)
2. **Second detail: you don't have to wait until 5 posts are published for the check to start.**
The code uses `take(5)` (take at most the first 5), then directly judges whether the match count is `>= 3` (`minimumMatchingPosts: 3`). Even if a new account has published only 3 posts total, if all 3 carry `NSFW_HIGH_PRECISION`, it completes 3 and triggers on the spot. It's absolutely not "the check starts only at the 5th post," and it's not computed as a 60% percentage. [79](#ref-79)

### 28.5 Sixty days, seven days, ten minutes — don't mix them into one countdown

Around this "3 of 5" rule, the code also holds **60 days, 7 days, and 10 minutes** — three time parameters — plus the **"reposting an old post detonates the mine"** mechanism from earlier:
1. **When the check triggers (the 60-day window)**
Not every ordinary post you publish runs this check; it is triggered by an **`Applied` event (a post newly receiving a safety label)**. The public default requires the triggering event's post to be within the most recent **60 days**, and the newly applied label to be exactly `NSFW_HIGH_PRECISION`. Once triggered, the program first takes the frontmost 5 posts of your `userTimeline`, then counts how many simultaneously satisfy "age ≤ 60 days" and "carries the `NSFW_HIGH_PRECISION` label." [79](#ref-79) [80](#ref-80)
2. **How a Repost (Retweet) gets checked**
Exactly as we warned in Chapter 24: when scanning your top 5 timeline posts and meeting a **plain repost (Retweet)**, the processor calls `originalTweetForRetweet` to read **the safety labels on the reposted original**, but the post ID used to compute "within 60 days" is **this new repost's `postId` on your timeline**. So never carelessly repost anyone's (or your own old) sensitive post carrying `NSFW_HIGH_PRECISION` — you'd be carrying someone else's mine straight into your own most-recent-5 counting window. [80](#ref-80)
3. **No high PageRank or grey-badge exemption.**
In this 3/5 aggregation rule's default configuration, accounts with `nsfwAdmin = true` and accounts already carrying the `NSFW_HIGH_PRECISION` account label are excluded, but **the `nsfwUser` exclusion switch (users who self-flagged sensitive content) is set to `false`, and the `highPageRankOrGreyBadge` exclusion switch (high-weight or grey-badge big accounts) is also set to `false`.** That is: before this rule, even if you're a grey-badge big account, or you've checked "my media contains sensitive content" in settings, if the front 5 complete 3 `NSFW_HIGH_PRECISION`, the account-level label is applied to your whole account just the same. The public TTL this write path carries in the public code is 7 days, counted from the moment of writing — that's this path's own setting, not the same thing as the pinned path's 7 days (see item 31 for the distinction). (Also, the event forwarder `safetyLabelToUserLevelAggregationV2Forwarder.strato` sets a **10-minute delay (`delay`)** and a 20-minute maximum-lag target (`maxLag`), so aggregation onto the account happens asynchronously about 10 minutes after the 3rd post is labeled — not a sky-change in the first second the 3rd post goes out.) [79](#ref-79) [80](#ref-80)

### 28.6 The default three-hit rule can also be overridden by configuration

Of course, we must keep configuration-level rigor: the "3 of the front 5, `mediaOnly: false`" above comes from the code's `defaultRulesJson` (public default configuration), while at runtime the program reads `configuredRulesJson` through a feature switch, which can dynamically override this default at any time (for instance, switching some experiment group to `mediaOnly: true`).
The same file even writes another rule named `possibly_nsfw_account`: its `enabled` switch is `true`, but its parameters read **"in a 10-post window (`windowSize: 10`), require at least 11 matches (`minimumMatchingPosts: 11`)"** — finding 11 in 10 is mathematically forever impossible (an unreachable default); the programmers most likely soft-disabled this rule in the default configuration by modifying the threshold (it can be activated live via configuration override). [79](#ref-79)

In addition, under `botmaker-rules/scarecrow/` there is another, earlier NSFW media event aggregation path (`NsfwTweetMediaProcessor.bot` and `ApplyNsfwUserLabel.df`), which puts media events into an HLL counter (HLL = a counter that only counts roughly how many distinct items there are) by post ID, checks **whether more than 2 counts occur within 1 day**, then sends it for labeling or human review. That shows the system's adult-content defenses are more than one line — never treat "interleaving two text posts to squeeze sensitive posts out of the front 5" as a death-proof golden ticket that never gets you banned. [75](#ref-75) [79](#ref-79) [80](#ref-80)

## 29 What can be found on duplicate content, engagement bait, and hashtags

### 29.1 The `COPYPASTA_SPAM` write can be found; the complete similarity threshold cannot

Friends running account matrices, or habituated to reposting the same copy again and again, care most: "How does the X algorithm catch copy-paste (Copypasta) duplicate content? We write Chinese without English-style space tokenization — does Chinese duplication escape it?"

**Never count on luck. The bot specialized in catching Chinese (CJK characters) duplication is written plainly in the repo.**
Open `botmaker-rules/scarecrow/bot/BBQDuplicateTextProd.bot` and `BBQDuplicateTextRepliesProd.bot`, dedicated to the comment section, and you'll see these two bots receive duplicate-post clusters (`tweetIdCluster`) produced by an upstream scheduled job — and the upstream job's names clearly list two: [81](#ref-81)
- `duplicate_text_unigrams` (duplicate text detection tokenized by word, for English and the like);
- **`duplicate_text_characters_cjk` (duplicate text detection tokenized by character, specifically for Chinese, Japanese, and Korean)**.
And the comment-section replies have their own corresponding job. Once hit and past the eligibility checks (excluding already-processed or already-labeled posts, checking specific promotion cards, excluding test accounts / high PageRank / temporary exemptions and grey badges, and subject to a write rate limit), the bot directly tags the post **`COPYPASTA_SPAM` (copy-paste spam)**. [81](#ref-81)

Here we must honestly hold two code boundaries:
1. **"How many repeated characters, or what similarity percentage, counts as a violation" cannot be found**: the two public `.bot` files start from "receiving the upstream already-clustered `tweetIdCluster`" and go down from there. What threshold the upstream offline job uses, across how many hours, and how many repetitions before posts are packaged into a Cluster, the code does not put in the public repo. So quoting the same famous line or the same technical term in normal articles in no way equals certain labeling, and we fabricate no false formulas like "repeat 15 characters and you surely die" or "change the period to an exclamation mark to beat duplicate checking." [81](#ref-81)
2. **The `COPYPASTA_SPAM` downstream consumption gap**: in this release's public `Home Mixer`, `VM Ranker`, and `visibility-filtering` code trees, we can confirm the bot genuinely writes the `COPYPASTA_SPAM` label, but we have not yet found downstream code that directly reads this label name and executes a deduction or Drop (it may be consumed by unpublished rules or services). We lay out both facts — "a CJK duplicate-labeling bot really exists" and "the specific downstream deduction ratio is unpublished" — exactly as they are. Either way, copy-pasting the same traffic script under a dozen unrelated posts to flood the screen both invites this label easily and invites real human reports (the `Report` coefficient is `-234.0`, multiplying a predicted probability). [76](#ref-76) [81](#ref-81)

### 29.2 Three classes of engagement bait get no high-PageRank / grey-badge exemption here

Scrolling X, you often see engagement-farming posts like: "Type 1 if you agree, 2 if you don't," or "Repost this koi, leave your wish in the comments, I'll draw ten people and give..."
In the Grox PTOS safety write code (`task_write_safety_post_annotations_result_sink.py#L233-L248`), the programmers singled out **three classes of engagement-bait behavior** into a "severe crackdown channel": [54](#ref-54)
- **`SpamEngagementBaiting` (engagement bait / fishing for interactions)**;
- **`SpamEngagementFarming` (engagement farm / farming likes and comments to grow accounts)**;
- **`SpamCardManipulation` (maliciously manipulating external-link preview cards to cheat clicks)**.

How harshly are these three violations treated in the code?
For other ordinary Spam categories, before labeling, the program glances at whether the author is a "high PageRank big account" or a "grey-badge verified account," and if so, lets it pass unlabelled. **Only when the large model judges your post to belong to one of these three classes (`Baiting`, `Farming`, `CardManipulation`) does the program set `should_label_for_spam` directly to `true`, skipping the high PageRank and grey-badge exemption checks on the spot — even a high-weight account gets tagged `SpamHighRecall` just the same** (removed directly from the stranger recommendation flow). [54](#ref-54)

Of course, the premise for triggering this crackdown is that the PTOS large model, in formal production mode, first classifies your post into one of these three classes (the specific judgment Prompt is unpublished, so normally writing one line at a substantive long post's end — "Have you met this in real projects? Come chat in the comments" — does not get you judged in violation). What does a high-quality interaction question look like? Say, after testing two pieces of software, you ask readers: **"Of the three test conditions above, which one differs from your company's real deployment environment? Post your version number and error case; I'll pick typical scenarios for the next retest."** This kind of question has a concrete anchor and serves the content itself — an entirely different matter from hollow "type 1 to claim materials." [54](#ref-54)

### 29.3 Hashtag features and an abuse classification exist; no universal best count

Finally, unpack another question creators ask constantly: **"Do `#` hashtags (Hashtags) on a post help algorithmic recommendation, or get treated as spam and demoted? How many `#` tags per post is best?"**

Against three solid pieces of evidence in the source, the truth about `#` tags is: [54](#ref-54)
1. **Are `#` tags useful? Yes — but not as a direct bonus.**
Nowhere in the main scoring table is there a formula like "each `#` tag added, a few points." But the Phoenix model's user historical behavior feature list (`history_id_lists.py` and `id_list_features.py`) explicitly includes a feature named **`CLICK_HASHTAG` (the history of `#` tags a user has clicked)**. That proves the system, when doing personalized recall and ranking for a reader, really does reference the behavioral signal of which `#` tags the user likes to click. It can never be said `#` tags are worth zero.
2. **The hard cap in the code is 4 (`MaxHashtagsPerTweet = 4`).**
In `SimClusters`' post entity extractor (`simclusters_v2/summingbird/common/TweetEntityExtractor.scala`), the programmers explicitly define a constant: **`MaxHashtagsPerTweet = 4`** — when it extracts hashtag entities from your post text to build interest-community associations, **it keeps at most the first 4 `#` tags; from the 5th `#` tag onward, on this path they're discarded and ignored directly.** (Note: this `4` is that extractor's read cap — not "filling all 4 necessarily beats 1 for traffic," and not "the 5th starts deducting points.")
3. **Stuffing unrelated hot tags triggers the `SpamHashTagAbuse` punishment.**
In the PTOS violation classification enums (`grox/flows/ptos/state.py`) there is a charge named **`SpamHashTagAbuse` (hashtag abuse)**. If you write a post selling tea or discussing development, then stuff a dozen of the day's hottest entertainment stars, sports events, or crypto hot `#` tags at the end to ride the traffic, once the large model judges it `SpamHashTagAbuse` (with no high PageRank / grey-badge exemption), it writes the post a **`SpamHighRecall`** spam label directly, killing you utterly in the stranger recommendation flow. [54](#ref-54)

So the rule for `#` tags day-to-day is simple: **ordinary daily posts need no forced tags at all. Only when your article genuinely revolves around a clear proper noun, an open-source project name, a specific product, or an industry event should you naturally place 1 to 2 (this extraction path reads at most the first 4; from the 5th it stops reading) highly relevant `#` tags. Never pile a string of trending words utterly unrelated to the body at the end.**

## 30 When reach looks abnormal, how to investigate with the materials at hand

After all the bonus items and risk-control minefields, suppose one day you carefully write a substantive piece, publish it, and see only a few dozen views, muttering: "Did I fail to enter the recall pool, lose the scoring to peers, hit the seen filter, or accidentally step on a mine and get a safety throttling label?"
Staring at those few dozen views and guessing is meaningless, because different causes need entirely different evidence. [5](#ref-5) [59](#ref-59) [20](#ref-20) [72](#ref-72)

The good news: in this public algorithm repo's `README.md` and `under-the-hood` directory, X officially published a transparency back end dedicated to letting creators check themselves whether "they've been tagged with safety and throttling labels" — **[Under the Hood (click to visit directly: x.com/i/jf/under_the_hood)](https://x.com/i/jf/under_the_hood)**.
This is the official account X-ray tool currently in pilot. Log into your X account, open this link, and you can directly check, within the reporting period, whether your **account (Account)** and **posts (Posts)** were tagged by the system with visibility-affecting restriction labels. [72](#ref-72)

### 30.1 Reporting period and availability

When using this official self-check back end, first note two rules written in the code (`underTheHoodReport.User.strato`): [72](#ref-72) [82](#ref-82)
1. **Look at the statistical month in the top-right corner (`Period`) first**: the page shows by default last month's monthly summary statistics (if last month's data isn't generated yet, the service automatically falls back to an earlier period). So after opening the page, the first thing is to see clearly which month `Period` says, and the generation time — never take a September old summary report to explain why the post you published this morning has no traffic.
2. **If it won't open or says no report yet, don't panic — it doesn't mean your account is banned.**
The source is clear: this tool is currently in a pilot stage (controlled by a service switch), with an explicit **report generation eligibility threshold** — it usually requires your **account registration age to be around 1 year, and at least 10 eligible posts published in the statistical month**, for the system to generate your monthly report. If you're a new account registered two months ago, or published only 3 posts last month, seeing no report merely means you haven't reached the report-generation statistical threshold — nothing to do with whether your account has recommendation eligibility. [82](#ref-82)

### 30.2 Distinguish post labels from account labels

Open the Under the Hood report and you'll see two core statistical blocks — **`Post labels`** and **`Account labels`** — whose units of measure in the source (`report.tsx`) are completely different: [72](#ref-72)

| Report item | What the numbers and percentages inside actually mean |
| --- | --- |
| **`Post labels`** | Of all the eligible posts you published in that statistical month, **how many posts** were tagged with this label, and their percentage of the month's total posts |
| **`Account labels`** | In that statistical month, **how many days** your whole account carried this label, and their percentage of the month's total days |

Two concrete numbers teach you to read this table:
- Suppose in `Post labels` you see a label showing "3 posts (7.5%)": that means of the 40 posts you published last month, **3 posts** were once tagged with it (7.5% of posts) — **it absolutely does not mean your whole account was docked 7.5% of its traffic.**
- Suppose in `Account labels` you see a label showing "5 days (16.1%)": that means in 31 days, your account carried this account-level label for **5 days** — but it also **doesn't mean you vanished from every page site-wide in those 5 days**. [72](#ref-72)

How to see its real effect on traffic? Look directly at the two official explanation columns right next to the label name in the report: **`What it means` (what cause this label represents)** and **`Effect on visibility` (its concrete effect on visibility)**.
In the `underTheHoodLabels.strato` source, the officials write each label's concrete disposition plainly: some labels say **"do not recommend this post / this account to non-followers who don't follow you,"** some say **"attach a content warning mask,"** some say **"restricted in specific countries or regions."**
This explains again what we said earlier: **never ask a follower friend "can you see my post" to test whether you're throttled.** Because the vast majority of throttling labels intercept only "recommendation to non-follower strangers (`HomeRecommendations`)"; your old followers, in the following feed or tapping into your profile, naturally see you. Only against the report's `Effect on visibility` can you know exactly which door was blocked. [72](#ref-72)

### 30.3 A report listing no labels still can't explain every ranking

If the report shows a label, save a screenshot of the report month, the label's original English name, and the official explanation, and recall whether in those days you swapped in a dead pinned external link, published sensitive-image posts in a row, or spammed duplicate content in the comments; if it's genuinely a misjudgment and the interface offers an appeal entrance, appeal through the process.
Conversely, if your report is clean — showing **no restriction labels at all (0%)** — your account and posts are completely healthy at the safety-compliance level. (Note: the code marks this report as `best effort` statistics, and monthly reports lag in time.) Since the safety level didn't intercept you with a label, a given post's low views come down to **candidate recall match, the lead image and first 4,000 characters' information extraction, or the dwell and interaction predictions at scoring and ranking** — and then we can confidently return to the content itself for single-variable optimization. [82](#ref-82)

### 30.4 When comparing the next piece, change one main factor first

With the safety-label suspicion cleared, how do you raise the account's natural recommendation traffic step by step?
First, against the code iron rules from earlier, give the draft in hand a "five-step physical":
1. **The title and first two hundred characters** — do they state the concrete research subject and the task solved directly (no hollow artsy slogans)?
2. **Image 1 (the lead image)** — is it the core results comparison table (not a funny comic or pure-text poster at image 1, hiding the substance in image 4)?
3. **The material the opening's first paragraph promises the reader** — is it delivered immediately in the body (no water-padding setups farming 10 seconds of dwell)?
4. **If it's a ten-thousand-character Article** — does the first-200-character title pack the keywords? After publishing, is there a separate guide long Post carrying an ordinary results image?
5. **If it's a major correction or an old-post refresh** — did you publish a standalone new original post or use a Quote (not just replying under an old post 10,000 people already saw, and not just plain-Reposting the old post)?

In optimization experiments, the greatest taboo is "changing topic, format, image style, posting time, and audience direction all at once" — five variables changed together, and even if the next piece's reads triple, you'll have no idea which move worked.
**Change only 1 core variable each time**: say, this week publish two AI tool reviews of similar difficulty and audience, changing only image 1 from a "title headline poster" to a "core results comparison table," keeping the publishing slot and promotion actions identical, and compare records directly with the account's own back-end analytics data (Analytics). (Never invent a folk points formula like "likes × 0.5 + reposts × 1" to compute a total score.) [59](#ref-59)

| Field worth recording | How to use it in review |
| --- | --- |
| Post link, concrete topic, publishing format (long Post / Article / Thread), publishing time, whether Quote, external link position | Group task-similar posts together for comparison; avoid hard-comparing a "breaking-news gossip post" against a "hardcore code tutorial" on total views |
| Back-end visible data at 24 hours and 48 hours after publishing | Lock a uniform observation window (one post's 24h and 48h are sequential tracking records, not two independent samples) |
| The granular metrics the back end actually provides: shares, replies, profile clicks, new followers, bookmarks | Record strictly by back-end field definitions (internal dwell seconds you can't get: leave blank — never fill in 0) |
| Effective inquiry DMs, material download clicks, or actual business conversions it brought | Some professional substance has flat total reach, but everyone it attracts is a precise customer or a die-hard follower (weight `4`) — worth more than generic traffic |
| Whether it rode an industry hot topic in the window, whether the draft was edited, and known Under the Hood label records | Record external interference factors; avoid wrongly crediting a big industry hot topic's natural surge to a layout micro-tweak |

When comparing multiple posts, look more at the **median and the overall distribution**; don't let one accidental hit, reposted by a big account, skew the average. If you're just building your publishing rhythm, try this steady **"four-week practical iteration method"**:
- **Week one (lay the foundation)**: fix the concrete, clear Bio with the earlier method; check and swap in your hardest, dead-link-free flagship piece as the pinned post; count the medians of your past ten posts' metrics as your Baseline;
- **Week two (steady output)**: with substance quality unwatered, output steadily at a rhythm you can sustain long-term (say, 1 post a day; if energy is short, rather 3 to 5 high-quality originals a week than forcing filler posts);
- **Week three (single-variable comparison)**: fix topic difficulty, pick only 1 core action for a before-after comparison (say, specifically comparing "lead image = results comparison table vs. lead image = title cover," or comparing "long Post vs. Article + illustrated guide");
- **Week four (cut the weak, keep the strong)**: look back over the month — which topic class and which lead-image layout genuinely brought you the highest **bookmark counts, copy-link shares, and profile follow conversions** — and settle it into your account's exclusive standard template.


## 31 Putting these findings to work in your next tool test

To show how all the code rules above work together to guide one concrete article from 0 to 1, let's run one complete practical sandbox: suppose tomorrow you plan to publish ***Using the same batch of real Chinese invoices, a head-to-head review of OCR tools A and B*** (A and B are placeholders; what follows demonstrates how to arrange an article's structure from the algorithm code — it presumes neither tool wins):

### 31.1 What the reader plans to do with this piece

Before writing the first line, think through what the target reader who scrolls to your post (say, a finance lead or a corporate development engineer) actually wants to do with it.
They're either selecting and procuring an OCR interface for the company, or already using one of the two and suffering over which fields keep erroring and need manual review arranged.
So your **opening first paragraph (which directly decides the first 4,000 characters' semantic vector, and whether the reader swipes away in the first 3 seconds and triggers the `-0.02` penalty)** must absolutely not read like "In recent years AI vision large models have developed rapidly; today let's discuss how strong OCR recognition really is" — that kind of filler. Cut straight to the concrete fields and pain points:

> **Practical draft of the opening first paragraph:**
> "This test stares dead at the three fields most prone to accidents on Chinese VAT invoices: **invoice date, tax amount, buyer tax ID**.
>
> I took the same batch of real invoice originals with creases and stamp occlusion, and ran a blind comparison of tool A and tool B. The original error cases and parameter settings are all below. If you're preparing to connect OCR recognition results directly to a finance automatic accounting system, I suggest first checking which fields still require manual review."

Immediately in paragraph two, list the test sample count, the two tools' concrete version numbers, the test date, the invoice image resolution, and the standard for judging right from wrong (invoice types not tested: say so plainly; never claim universal conclusions).
Then look at **image and format choices**:
- **Image 1 (the lead image, the first thing V8.2's `_collect_post_media` grabs and returns)**: place directly a most intuitive **"stamp-occluded invoice original + A/B tools' tax-amount recognition results, one right, one wrong, in one frame comparison card."** If the error occurs only when "a red stamp covers the amount digits," put the six big words "red-stamp occlusion scenario" right on the lead image, so readers and AI who see only image 1 grasp the core finding at a glance. Images 2 and 3 then carry the complete statistics table and the boundary counterexamples in order.
- **Format choice**: if this test covers only the one concrete finding "red-stamp occlusion breaks tax-amount recognition," publish it directly as a **long Post**. If it's a deep report covering 5 invoice types and 30 pages of data, publish it as an **Article (first 200 characters of the title packed with core words)**, and separately publish a **guide long Post carrying that lead image** (or a refined summary thread of at most 3 posts: #1 gives the core conclusion, #2 the comparison table, #3 the applicability boundaries and the full-text entrance — ensuring each post reads independently without context, unafraid of `convo_marshaller.rs`'s `1, 9, 10` truncation). [18](#ref-18)

Midway through writing, look back: is any paragraph repeating the title in circles, or writing "the key part is later, don't leave"? Delete such water sentences on sight and swap in concrete counterexample data (for instance: "When the image is compressed below 72 DPI, tool B's tax-ID recognition error rate rockets from 2% to 18%"). Give the reader solid substance to read at every CREAD time tick.

### 31.2 Make the complete materials findable and checkable later

If at the end you provide a test script or a complete Excel comparison table for readers to download and reproduce:
1. Clearly mark the filename, test date, and field explanations in the table and body, giving readers ample reason to tap **"Bookmark (into the `SimClusters` seeds and the immersive training positives)"** and **"copy link (`Share via copy link`, coefficient `20`, multiplying a predicted probability) and send it to colleagues"**;
2. Before attaching the external download link, click it open yourself and check the redirect chain once, confirming it lands directly on a GitHub or reputable cloud-drive page, with no dead or low-quality intermediary domains (if downloading requires registration or payment, say so honestly in the body in advance). If this test later becomes your flagship piece and you plan to set it as your **profile pin (Pin)**, check regularly whether its links have expired or gone bad, strictly guarding against triggering the `PinnedLowQualityOrBadUrl.bot` account label (labels written by this path carry a 7-day validity);
3. Pick the active time slot when your target readers (finance and technical people) genuinely scroll their phones, and publish — the cold-start exploration chance exists only in the first 2 hours after publishing, while internal home-feed impressions (`view_count_on_home`) are still under 200. The right slot is what makes it usable.

### 31.3 After publishing, add and correct by question type

After the post goes out:
- If a peer asks in the comments: "On that blurry invoice you tested, did you enable tool A's automatic tilt-correction parameter?" — go check the test log promptly; if it's only a local detail addition, reply carefully right under his comment, and make the discussion area a high-quality exchange field for insiders;
- If checking makes you suck in a cold breath: "Oh no! During the test I really did forget to switch on tool A's tilt correction; with it on and retested, tool A's error rate dropped by more than half — the original post's core conclusion is reversed!" — remember the `previously_seen_posts_filter.rs` parent-post seen filter rule. **Don't sneak so major a correction into the old post's comments only. Leave a correction signpost under the old post at once, and separately publish a brand-new original post (or Quote the old post) presenting the corrected conclusion from the retest.**
- Even if you've already published two posts this morning, as long as this afternoon's third post is a solid retest discovery, ignore fake formulas like "at most two or three posts a day, wait four hours for weight recovery" — publish whenever it's ready.

I hold myself to this more strictly than I advise others. My rule: a published X post is never edited in place — an edited post's exposure data zeroes out. If I really find an error, I'd rather publish another post stating plainly what changed. I actually did this once in late October 2026: on a post's first publication I put the source link in the body, violating my own rule. I deleted it and reposted, without clicking edit. The blog is different — the blog is the master copy; an error gets fixed right there, and then I post a correction on X pointing to the fixed version.

Finally, take the next piece's lead image and opening out and look at them alone. The standard I set myself is one line: a reader who doesn't know you and won't open the whole thread, seeing only these two things, can tell what you found and why it concerns him. If it doesn't reach that, fix it before publishing.

I'll keep tracking the algorithm repo, and whenever it updates I'll revise this handbook and update the skills repo (https://github.com/alexliyu7352/for-you-skills) in sync, so what you've bookmarked stays current. This blog doesn't chase hot topics; it holds only things I've taken apart and verified with my own hands, across the three lines of AI, security, and open source. If this piece helped you, feel free to subscribe or bookmark it — you'll see the next update the moment it lands.

## Open Questions (Plain-Language Full Explanation of the 49 Items: "Truths the Code Confirms vs. Blind Spots Still to Check Online")

What gives many friends the biggest headache reading technical reports is this: the report ends with a pile of "questions to confirm," full of sky-script abbreviations (TTL, CREAD, ld, adapter, OON, HLL), with no explanation of what the word means, what it does, or how it affects traffic — and no clarity on which half is real and which half is hype.

So that even jumping straight to any one of these **49 questions** you can fully understand the ins and outs within 30 seconds, I've rewritten all 49 core questions. Each one follows these four steps, in plain words:
1. **Plain language first (what is this asking, what does it do, what's the impact)**: translate the engineering terms in the title into plain words first, telling you what this mechanism is for and its actual effect on your post's reach;
2. **Truth the code confirms (known)**: what rule is written dead in the public source, 100% inescapable;
3. **Blind spots the code can't show (to check)**: which part of the data is unguaranteeable by anyone because the officials haven't published live server logs or front-end code;
4. **Practical conclusion for creators (judgment)**: with the known and the blind spots understood, how should we actually publish day-to-day, and which rumor must we never believe.

### 01 The "X changed the algorithm again today" overseas creators shout about — which update does it actually mean?

- **Plain language first (what this asks, what's the impact)**:
  On X we often see overseas big accounts post in alarm: "X updated the algorithm just today — everyone change your posting methods fast!" Many creators panic at the sight, imagining a site-wide rules reshuffle today. In fact, "algorithm update" can mean three entirely different things: ① a programmer uploaded new code to the GitHub public repo (a Commit); ② the officials added an update notice to the documentation (README); ③ X's back-end servers genuinely switched the new rule on for all users site-wide. Without knowing which "today" the other side means, you're easily led by the rhythm into changing your posting habits at random.
- **Truth the code confirms (known)**:
  The two core code snapshots we checked have exact public upload (Commit) times: the first baseline snapshot `5ed7963` was uploaded at Coordinated Universal Time (UTC) `2026-10-28 02:49:03` (which is **October 27, 19:49:03** in Los Angeles, California time); the second, newest snapshot `606b254` was uploaded at UTC `2026-10-29 02:57:55` (**October 28, 19:57:55** Los Angeles time). Meanwhile, the officials' `README.md` changelog separately marks two feature update dates, **October 8** and **October 13**. [11](#ref-11)
- **Blind spots the code can't show (to check)**:
  Which time zone the overseas creator shouting "today" was in when he posted, the exact hour and minute, and whether his "updated today" meant he saw the GitHub code commit, saw the added notice, or some internal phased-rollout experiment — outsiders can't know from static code.
- **Practical conclusion for creators (judgment)**:
  Because of time zones (the early hours of October 29 UTC are actually the evening of October 28 in California), we list both times for checking. The more important iron rule: **the time code is uploaded to GitHub represents only "the time it was made public for you to see" — it never equals "hundreds of millions of users worldwide all switched to this new rule in the same second today."** Never throw your own footing into disorder at one line of "the algorithm changed today."

### 02 Are the "public default weights" written in the repo the configuration actually in use at this moment, for every reader scrolling the home feed?

- **Plain language first (what this asks, what's the impact)**:
  In the body we listed a long string of "public default parameters (Default Params)": like `0.66`, reply `5`, copy link `20`, continuous dwell `0.006`, and more. These parameters' job, when computing a candidate post's total score, is to decide how much weight each predicted behavior carries. Everyone naturally asks: are these default numbers written in the code files the numbers 100% running live, for every reader scrolling right now?
- **Truth the code confirms (known)**:
  First, the officials state explicitly in the `README.md`: they use an automatic scheduled task (cron) to sync the **main formal default configuration** from the live production environment into the public repo (the `Home Mixer` parameter file's first line, for instance, prints the sync timestamp `2026-10-27T16:00:37Z`), so these numbers are the genuine formal environment baseline. Second, within the same code version, the two microservices `Home Mixer` (orchestrating assembly and cold start) and `VM Ranker` (calling the value model to score) do have slight differences in same-named default parameters (for instance, like is `0.66` in one and `0.5` in the other), and the code has different branches: remote calls (RPC), direct use of cached scores, and falling back to local scoring on call failure (fallback). [12](#ref-12) [27](#ref-27)
- **Blind spots the code can't show (to check)**:
  X live has a real-time configuration center (Feature Switches / Configuration System) that can at any time split some portion of readers into different phased-rollout test buckets (A/B Tests) to trial fine-tuned parameters, and dynamically switch different AI model weight files (Checkpoints) — these per-user real-time experiment switches are invisible in the public repo.
- **Practical conclusion for creators (judgment)**:
  The "public default parameters" in the code are fully usable as our **authoritative baseline reference** for judging behaviors' relative urgency (for instance, copy link `20`, reply `5`, like `0.66` — the magnitude gaps are obvious; but a coefficient still multiplies its own predicted probability, so you can't conclude which behavior is necessarily worth more from coefficient size alone). They are absolutely not fake numbers programmers filled in casually. But understand at the same time that live phased-rollout experiments exist — don't take a calculator and obsess over the fourth decimal place, imagining every reader worldwide runs a scoring formula identical to the last hair.

### 03 Will the October "dwell weight coefficient up 50%" make long pieces' totals and reach also surge 50%?

- **Plain language first (what this asks, what's the impact)**:
  In the scoring formula there's a parameter named `ContDwellTimeWeight` (continuous dwell time weight coefficient). Its job: **the AI predicts how many seconds a reader will dwell reading your post; those seconds get multiplied by this coefficient and added into the post's total score.** In mid-October this coefficient rose from `0.004` to `0.006` — an increase of exactly 50%. Many bloggers cheered on this basis: "Long pieces' algorithm totals and reach are about to surge 50% directly!" Is that true?
- **Truth the code confirms (known)**:
  Checking the modification history of the same parameter file, `home-mixer/params/param.rs`, confirms 100%: in the October 9 snapshot the coefficient really was `0.004`; by the October 13 snapshot it had formally risen to `0.006` — **this single coefficient's increase really is 50%**. But in `scoring.rs`'s total formula, a post's total is computed by adding **24 prediction terms** together (then passing score translation, the same-author `0.625` decay, and same-pool opponent competition). Suppose the AI predicts a reader watches your post for 5 seconds and the other interaction terms' weighted sum is `0.20`: raising the coefficient from `0.004` to `0.006` moves only the dwell term, from `0.020` to `0.030` — **the whole post's raw total moves only from `0.220` to `0.230`, up about 4.5%**. [15](#ref-15) [27](#ref-27) [60](#ref-60)
- **Blind spots the code can't show (to check)**:
  In the real live environment, after raising this coefficient 50%, by what percentage site-wide long and short posts' real reach each rose or fell requires the officials' internal live A/B experiment statistical reports — and that operations report is not public.
- **Practical conclusion for creators (judgment)**:
  A 50% coefficient rise is a clear positive signal, proving the system values "whether readers will stop and read the content in" more. But because the total is a sum of many terms, **a single coefficient up 50% never equals the total up 50%, and still less reach or ad revenue up 50% directly**. Writing solid substance to attract real reading is right; dragging time out with ten lines of filler at the opening is meaningless.

### 04 Did the like weight rising to 0.66 set X's all-time "highest weight on the field"?

- **Plain language first (what this asks, what's the impact)**:
  `FavoriteWeight` (the like weight coefficient) governs how many times "the AI-predicted probability a reader will like you" counts in the total. In October it rose all the way from `0.5` to `0.66`. Online, someone immediately said: "The like weight has hit its historical peak — it's a like-is-king era again!"
- **Truth the code confirms (known)**:
  We checked all 20 of October's `Home Mixer` parameter history snapshots one by one. In the month of October, `0.66` really is the highest value `FavoriteWeight` ever showed (`10/9`: `0.5` → `10/13`: `0.6` → `10/14`: `0.66`). **But horizontally against the other positive behaviors in the same table, the like's `0.66` still ranks far behind**: copy link is `20`, a mutual-follow friend's reply to an original post is `20`, an ordinary reply is `5`, a Quote with comment is `5`, DM share is `5`, follow author is `4`, system share is `2`, plain repost is `1`. [15](#ref-15) [27](#ref-27)
- **Blind spots the code can't show (to check)**:
  Across Twitter / X's unpublished history over the past decade-plus — all historical code versions and internal test branches — whether likes were ever set a higher number can't be verified without a complete historical archive.
- **Practical conclusion for creators (judgment)**:
  The accurate phrasing is "the highest like coefficient value in October's public snapshots." Never let the four words "all-time highest" fool you into farming likes: in the algorithm's eyes, a post that makes a reader follow you (`4`), write a comment discussing (`5`), or copy the link and share it with colleagues (`20`) still leaves the plain like (`0.66`) far behind on weight coefficient.

### 05 How do the `CLICK_DWELL_TIME` 10-second threshold and the 0.4 weight connect in the code?

- **Plain language first (what this asks, what's the impact)**:
  When a reader taps your post open on the home feed (say, opens a long piece or taps into the details) and stops to read, the system has a dedicated bonus term named `ContClickDwellTime` (deep dwell after click), with a weight coefficient of **`0.4`** (an ordinary click is `0.3`; the coefficient multiplies a predicted probability and cannot be converted into how many likes it's worth). What everyone cares about most: after tapping open, how many seconds must the reader watch to qualify? And once qualified, does the post immediately get `0.4` points added?
- **Truth the code confirms (known)**:
  In the public repo we can trace iron proof at both ends: ① in the upstream AI ranking model's training config (`xrecsys.py`) and loss function (`loss_recsys.py`) there's a binary prediction target named `CLICK_DWELL_TIME`, whose judgment standard is "the raw label value is **strictly greater than the threshold `10.0`**" (exactly 10 doesn't count; it must be `> 10.0`); at inference the model outputs a **qualification predicted probability** between 0 and 1, returned by the inference service (`model_runner.py`); ② in the downstream `Home Mixer` total fusion formula (`scoring.rs`), the program reads the candidate's `click_dwell_time` prediction field and multiplies it by the **`0.4`** weight into the total. [14](#ref-14)
- **Blind spots the code can't show (to check)**:
  Two small stretches of code in the middle were not placed in the public repo by the officials: ① when the upstream data pipeline generates the `CLICK_DWELL_TIME` raw label, whether its physical unit is pure seconds, and whether opening an Article column counts in; ② the middle conversion code (Adapter) assigning the model service's returned prediction to `Home Mixer`'s `click_dwell_time` field is not public. [98](#ref-98)
- **Practical conclusion for creators (judgment)**:
  First, what gets multiplied by `0.4` is still the AI's advance prediction of "this reader's probability of crossing the `10.0` threshold after tapping open" — not a bookkeeping addition of `0.4` points after the fact for every 10 seconds watched. Second, although the middle conversion layer isn't open-sourced, the high `0.4` weight tells us plainly: **"fooling a reader into tapping open, then disappointing him into exiting in 2 seconds" earns none of this big score — having real substance after the open, that he reads in, is the key.**

### 06 How does the CREAD dwell-prediction technology, launched October 8, compute reading time? Can it double long pieces' traffic?

- **Plain language first (what this asks, what's the impact)**:
  The algorithm's dwell prediction used to be cruder. On October 8 the officials announced the **CREAD** model to improve dwell time prediction. Its job: **precisely estimate how many seconds this reader will dwell on your post (say, 4.1 seconds or 45 seconds)**, then multiply those predicted seconds by the `0.006` continuous dwell weight. Many ask: how does this new model compute seconds? And after its launch, do longer articles reliably beat short posts?
- **Truth the code confirms (known)**:
  From the source of `xrecsys.py`, `loss_recsys.py`, and `recsys_model.py`, we fully restored CREAD's computation process: it slices dwell time into **30 threshold ticks** at logarithmic intervals, dense in front and sparse behind (the ordinary feed from **2 seconds to 120 seconds**, the gallery immersive feed from **2 seconds to 240 seconds**). The AI first predicts the percentage probability of the reader's dwell crossing each of the 30 thresholds (`sigmoid`), then multiplies each cell's passing probability by the adjacent thresholds' second-width (`deltas`) and sums them, restoring one concrete predicted dwell-second count (in training, a Huber time-reconstruction loss also calibrates the total seconds). [11](#ref-11) [13](#ref-13)
- **Blind spots the code can't show (to check)**:
  The officials haven't published CREAD's internal evaluation datasets from before and after launch, by how many percent the prediction error concretely fell, or an A/B test report of how much traffic moved between site-wide long and short posts as a result.
- **Practical conclusion for creators (judgment)**:
  CREAD's 30-tick design shows the system can now distinguish exquisitely between "a 2-second glance swiped away," "10 seconds of short substance," and "90 seconds of deep long reading." But note: **the AI predicts "how many seconds this reader is actually willing to watch," not "how many characters this article of yours totals."** If a three-thousand-character water piece gets swiped away in 3 seconds, CREAD still predicts two or three low seconds. Only with high-density substance in every paragraph does CREAD's predicted dwell run high.

### 07 Does the `ld` deep-reading recall branch, added October 13, require the reader to scroll 100% to the article's last line to count?

- **Plain language first (what this asks, what's the impact)**:
  As said earlier, recommendation runs in two steps: step one, the buyers fish candidate posts from the warehouse (recall); step two, the judge scores and seats them (ranking). On October 13, X added, in step one's "two-tower recall model," a branch named **`ld` (Long Dwell, deep reading dwell)**, with weight set to `0.75`. Its job: **even if a deep substantive post has few likes and comments, as long as it's the kind of good article "readers who scroll to it will settle down and read in," the buyer, at step one, fishes it into more people's candidate pools first.** Someone online spun a rumor from this: "You must make the reader scroll 100% to the article's very end to trigger this `ld` reward!"
- **Truth the code confirms (known)**:
  In `xrecsys_two_tower.py` and `recsys_two_tower_model.py`, the positive signal used to train the `ld` branch (`ld_positive_actions`) is explicitly designated as a client event named **`CLIENT_TWEET_RECAP_DWELLED`**. This branch has complete code paths in both training and real-time inference recall. The official README, introducing this update, uses the plain description "find the posts people will read to the end." [11](#ref-11) [14](#ref-14)
- **Blind spots the code can't show (to check)**:
  The `CLIENT_TWEET_RECAP_DWELLED` event is reported to the server by the X App on your phone (the client front end), and the phone App's front-end source is not open-sourced. So whether the phone side sends this event mark by "dwelled how many seconds" or by "the screen scrolled to which paragraph" is invisible in the back-end algorithm repo.
- **Practical conclusion for creators (judgment)**:
  No need for crooked tricks like "hiding a code word at the article's very bottom to force readers to scroll to the end." As long as your article's opening cuts straight to the pain point and its body's tables and cases make readers willing to stop and read carefully, this reading dwell positive triggers naturally, playing a role once in step-one recall and once in step-two ranking.

### 08 My post's Views just jumped to 200 — does that mean the small-account cold-start support has ended?

- **Plain language first (what this asks, what's the impact)**:
  For small accounts with no more than 50,000 followers, the system has a cold-start support mechanism (`author_cold_start.rs`) of "the first 2 hours, within 200 impressions," which can send your new post straight to slot 16 of a reader's candidate pool. Many small creators, after publishing, stare dead at the public view count (Views) under the post; the moment the number jumps to `200`, they sigh: "Done for — the 200 cold-start quota is used up!"
- **Truth the code confirms (known)**:
  In `author_cold_start.rs` and the data hydrator `engagement_counts_hydrator.rs`, the `< 200` field the code checks is named **`view_count_on_home` (pure For You home-feed recommendation impressions)**, while the public total views you see under the post correspond to another field, `view_count`. And the service pulling these two counts carries a **60-second-TTL (TTL = 60s) cache**. [35](#ref-35)
- **Blind spots the code can't show (to check)**:
  For one specific post of yours, how many profile clicks, search views, external-link clicks, and author self-refreshes are mixed into the front-end `view_count` (total views) — only the back-end internal database holds the per-entry detail.
- **Practical conclusion for creators (judgment)**:
  **The front-end total views (Views) reaching 200 does not equal the back end's real home-feed recommendation impressions (`view_count_on_home`) also reaching 200 — outsiders can't see the latter, and the two are not one number.** Add the 60-second count cache delay, and in the first 2 hours after publishing, never fixate anxiously on the front-end 200, and never imagine that at 200 you fall out of favor at once and delete-and-repost.

### 09 When several small-account new posts all meet the cold-start conditions, which one does the system promote to slot 16? Does the highest like rate necessarily win?

- **Plain language first (what this asks, what's the impact)**:
  When a reader pulls to refresh the home feed, his temporary basket may hold 10 new posts from different small authors at once, all meeting the cold-start conditions "followers ≤ 50,000, published ≤ 2 hours, home-feed impressions < 200." But this "express elevator," per refresh, **can promote at most 1 post** to slot 16. Many assume: "Whoever's like rate is highest, the system surely picks — so I rush to find group friends to farm a few likes and win for sure."
- **Truth the code confirms (known)**:
  Open the source of `author_cold_start.rs` and the selection process actually runs in **two rounds**: ① **Round one (lottery preselection of 2)**: the system reads each new post's current like count (`fav_count`) and home-feed impressions (`view_count_on_home`), and, benchmarked on a `1.5%` default home-feed like rate (`alpha0=0.75, beta0=49.25`), runs one **Thompson Sampling (Beta distribution random probability sampling)**, drawing the **top 2 by sampled value (default `top_k = 2`)**; ② **Round two (pick one by reader interest)**: of the 2 new posts remaining, the system no longer looks at whose like rate is higher — it directly compares **"for the reader scrolling the home feed right now, which one's model predicted score (`ranking score`) is higher,"** and promotes the **1** with the highest predicted score to slot 16. [35](#ref-35) [36](#ref-36) [60](#ref-60)
- **Blind spots the code can't show (to check)**:
  How many eligible new posts were in one live reader's basket at a refresh, what random numbers the draw produced that time, and the real-time score the model computed for this reader are single-request dynamic runtime data.
- **Practical conclusion for creators (judgment)**:
  Here is a code counterexample that punctures the "farming likes always wins" theory directly: if one basket holds only 2 eligible new posts to begin with, round one's `top_k = 2` keeps both, and round two **100% picks the one with the higher predicted score for the current reader — not the one with the higher surface like rate**. So don't run WeChat group mutual-likes (group friends tapping in from a link count neither as home-feed impressions, nor do their profiles match stranger readers). Write content precisely hitting the target audience's pain points to truly win round two's one-of-two.

### 10 Does the FairShare proportional allocation, enabled October 22, guarantee new posts will never be cut before scoring again?

- **Plain language first (what this asks, what's the impact)**:
  On each home-feed refresh, the posts the various intake channels fetch into the temporary basket can exceed 3,000, but the AI model doing fine scoring looks at at most **2,800** per request. Before, cutting by list order with one knife, the "cold-start new-post channel" at the list's tail often got chopped clean before ever facing the judge. On October 22 the system enabled by default **`FairShareRankingFilter` (the fair-share preliminary filter)**, switching to allocating those 2,800 slots by each channel's delivery share. Someone online reads this as: "New posts now have a death-proof golden ticket — 100% never truncated early!"
- **Truth the code confirms (known)**:
  From the commit history of `fair_share_ranking_filter.rs` and `param.rs`: the feature was added on `10/21` (`7f2ca2b`), default off, and on `10/22` (`989fb91`) the public default was changed to on (`true`), with budget `2800`. It allocates the 2,800 slots by candidate source channel (`served_type` — the cold-start channel `ForYouPhoenixRetrievalCold` and the zero-like channel `ZeroFav` are independent groups) proportionally, with the largest remainder method. But **within each channel group, the program still simply keeps the first N in the original list order — posts at that group's tail get cut just the same.** [16](#ref-16) [61](#ref-61)
- **Blind spots the code can't show (to check)**:
  In real live requests, how many posts each channel delivers each time, in what order a group's posts originally stand, and by what percentage site-wide small-account new posts' overall reach rose before and after `FairShare` was enabled requires internal A/B test logs.
- **Practical conclusion for creators (judgment)**:
  Just like the example computed in the body (3,000 in, 2,800 slots; the cold-start channel rose from keeping 400 to keeping 560 — but 40 were still cut), `FairShare` genuinely and greatly raises small authors' new posts' fair chance to "enter the scoring room and face the judge." It can't be deified into "every new post is 100% never eliminated, or guaranteed baseline traffic."

### 11 "Mutual-follow friends' reply prediction weight reaches 20" — does that mean frantically mutual-following (follow back) makes traffic take off?

- **Plain language first (what this asks, what's the impact)**:
  On the scoring table, an ordinary reader's predicted reply to you weighs `5`. But if the reader who scrolls to your post **mutually follows (Mutual Follow)** you, and you published an **original post**, the system adds an extra `15` mutual-follow bonus on top of `5`, making **`20`**. Many see it and think: "Quadrupled! I'll rush to a mutual-follow hall and mutual-follow everyone I meet, gather thousands of mutual friends — won't traffic quadruple?"
- **Truth the code confirms (known)**:
  In `xai-value-model/inputs.rs` and `weights.rs`, the conditions for receiving this `+15` bonus are written extremely strictly: **`!self.is_reply && !self.is_retweet && self.is_mutual_follow_author`** must all hold at once (that is: ① the candidate itself cannot be a reply post; ② cannot be a plain repost; ③ the current home-feed reader and the author mutually follow two-way). And it weights only "the predicted probability this mutual-follow reader will leave a reply" — likes, reposts, dwell (the mutual-follow dwell bonus is `0`), and every other term get not a cent more. [27](#ref-27)
- **Blind spots the code can't show (to check)**:
  If an account indiscriminately adds mutual follows with no shared interests, to what degree the upstream model's author audience profile gets led astray has no public controlled experiment data.
- **Practical conclusion for creators (judgment)**:
  Never run brainless mutual-follow groups. Because `20` multiplies **"the AI-predicted probability this mutual-follow friend, seeing this post of yours, will write a comment"** — if you mutually follow three thousand zombie or unrelated accounts who can't understand your professional content at all, the AI-predicted probability of them replying to your substantive post is near `0`, and `20 × 0` is still `0`. What's more, if you rush to grab the sofa comment under a big account, the comment you post is itself `is_reply = true` — disqualified on the spot. **The genuinely useful practice is to mutual-follow only real creators in your field and core readers, and to throw out, in original posts, professional questions only insiders can answer.**

### 12 Has the "video carousel dwell formula" added in the October 29 newest code already started handing all videos a traffic dividend?

- **Plain language first (what this asks, what's the impact)**:
  In the newest code commit of October 29 (`606b254`), someone found a new formula line in the video carousel's scoring file, `video_carousel.rs`: multiply "the probability the video is opened" by "immersive viewing dwell duration," then by a new weight coefficient. Online, someone immediately posted a flash: "From October 29, videos with long watch times get a brand-new carousel bonus!"
- **Truth the code confirms (known)**:
  The formula really is written into `video_carousel.rs`. But open the companion parameter file `home-mixer/params/param.rs` (`#L1191-L1269`) at the same time and you'll see: **this new term's public default weight coefficient, `VideoCarouselOpenTimesImmersiveDwellWeight`, is written as `0.0` (multiplying by 0 adds nothing), and the whole video carousel's master switch, `EnableVideoCarousel`, also defaults to `false` (off).** The `immersive_page_rl_cread` training config added in the same commit likewise only places a configuration file into the repo. [17](#ref-17)
- **Blind spots the code can't show (to check)**:
  Whether live, a 1% or 5% small-traffic test bucket sets this switch to `true` with a non-zero coefficient for experiments, and how the experiment performs, is invisible in static code.
- **Practical conclusion for creators (judgment)**:
  This is the classic "the troops haven't moved, the code goes first" — engineers push the formula code up first, with the default switch off or 0, awaiting later phased-rollout experiments. Reading code, always read the formula and the parameter switch together; never, at the sight of a new formula name, declare "all videos site-wide received new preferential treatment today."

### 13 How is the `CLIENT_TWEET_RECAP_DWELLED` event in two-tower recall used in model training?

- **Plain language first (what this asks, what's the impact)**:
  Item 07 above mentioned the `ld` (deep reading) recall branch added October 13. Some technically curious readers ask: in the two-tower recall model's training code, does the model compute itself how many characters the reader read and what percentage he scrolled to — or does it read a ready-made mark directly?
- **Truth the code confirms (known)**:
  Open `phoenix/xrex/models/recsys_two_tower_model.py` (`#L621-L647` and `#L2711-L2739`) and you'll see: in training, the model doesn't compute character counts or scroll percentages in the model code at all. It reads the ready-made action mark in the training data table directly — whenever an impression record carries the `CLIENT_TWEET_RECAP_DWELLED` action mark, it's taken as the `ld` branch's positive sample (Positive Action) for computing the training loss. [33](#ref-33)
- **Blind spots the code can't show (to check)**:
  Under what exact conditions the upstream client and log pipeline stamp an impression record with the `CLIENT_TWEET_RECAP_DWELLED` mark (how visible area, character count, expand actions, and seconds combine) — that upstream rule is not in the public repo.
- **Practical conclusion for creators (judgment)**:
  Knowing clearly that "the model recognizes the dwell-reading positive mark," we write articles focused on making readers stop and read the substance in — no need to believe folk remedies like "you must pad to a certain character count" or "you must force the reader to scroll to the last line."

### 14 Is the new `ld` reading recall branch a "small-account exclusive benefit"? What does `HOME_COLD` in the code mean?

- **Plain language first (what this asks, what's the impact)**:
  Someone online saw a dataset named `HOME_COLD` (cold pool) in the two-tower recall config, and saw the officials say a new `ld` reading recall branch was added, and stitched the two together into a rumor: "October's reading recall upgrade works only for small-follower accounts (cold accounts); big accounts don't get it!"
- **Truth the code confirms (known)**:
  First, in the named configurations published on `10/13` (`e1a0375`) (`combined` and `home-only`), the `ld` branch covers the three datasets `HOME`, `HOME_COLD`, and `HOME_HOT` at once, and the code holds **no condition checking "enable `ld` only when the author's followers are below some number"**. Second, open the source of `phoenix/xrex/data/cold_pool_filter.py` and it's plain: **`HOME_COLD` (the cold post pool), when filtering, checks "the single post's own like count (`fav_count`), view count (`view_count`), and publishing freshness" — it never checks "how many followers the author has."** [33](#ref-33) [34](#ref-34)
- **Blind spots the code can't show (to check)**:
  Which named configuration each live cluster loads (because the base generic model class also keeps a `w_ld = 0.0` default option), and when full switching happens, has no public live deployment table.
- **Practical conclusion for creators (judgment)**:
  **Whether a few-hundred-follower small account or a several-hundred-thousand-follower big account, a new post just published, not yet accumulated enough likes and views, enters `HOME_COLD`.** In the named configurations `ld` doesn't pick by account size, but which configuration each live reader group actually loads, and whether `ld` is used, the public code cannot settle — it can't be said everyone already enjoys it. Never mistake "cold post (a just-published new post)" for "small-follower account."

### 15 Why does "accumulate the 32nd like (`32fav`) to unlock the For You mega traffic pool" lack a key link in the public code?

- **Plain language first (what this asks, what's the impact)**:
  Nearly every X operations tutorial tells you: "After publishing, the 1st like enters the `1fav` starter pool, the 32nd like enters the `32fav` advanced pool — once you hit 32 likes, the For You home feed pours you a big wave of stranger traffic!" How much of this is true, how much false?
- **Truth the code confirms (known)**:
  Split it in two: ① **the first half, "stored into a data bucket," is true**: in `phoenixRankAllCandidateProcessor.strato`, when an eligible ordinary post's received like count reaches `>= 32`, the program really does generate an index event with `indexName = "32fav"`, and the storage layer has a 24-hour window (`32fav_1day`); ② **but the second half, "who reads this bucket," had an accident**: checking the two-tower recall dataset definition `retrieval_dataset.py`, the three main datasets responsible for ordinary For You home-feed recommendation — `HOME`, `HOME_COLD`, `HOME_HOT` — **all read `1fav_1day.parquet` (the 1-like store)**. [38](#ref-38) [34](#ref-34)
- **Blind spots the code can't show (to check)**:
  Across the whole public For You code tree, apart from one `IMMERSIVE32FavVideo14To30Day` dedicated to 14–30-day-old videos (reading `32fav_video_14to30day.parquet`), **no ordinary image-text home-feed recall service can be found reading the `32fav_1day` data bucket**. (Unknown whether some unpublished internal live service reads it, or the current public configuration simply doesn't enable it.)
- **Practical conclusion for creators (judgment)**:
  Earning the 1st like and entering `1fav_1day` really is a key step into the ordinary home feed's main recall store. But for ordinary image-text posts, **never be superstitious that "filling up 32 likes automatically opens a new world's gate," and still less run around finding people to mutual-like just to scrape together 32 likes** — because in the public code, not even a shadow of who reads ordinary posts' `32fav` can be seen.

### 16 Why, when the 1st or 32nd like has just popped up on the front end, may the back-end index store not yet have updated in sync?

- **Plain language first (what this asks, what's the impact)**:
  Some creators, after publishing, stare dead at the like count, assuming that in the very second someone taps the 1st or 32nd like, the back end's `1fav` or `32fav` index store refreshes in the same second and distribution starts at once.
- **Truth the code confirms (known)**:
  In the like event processors `favoriteEventProcessor.strato` and `eventProcessing.strato` sit several throttle valves and boundary conditions: ① **the 1-minute throttle valve**: if the post already has an update cache, the next index update is allowed only once **a full 1 minute (`>= 1 minute`)** has passed since the last one. Say your index updated at the 16th like, and only 30 seconds later you rush to 32 likes — that 32nd like gets stopped by the unmet 1 minute, no update. ② **The 48/49-hour lifetime lines**: time since first update must be `<= 48 hours`, and post age `< 49 hours`. ③ **The read-write out-of-sync race**: in `build1FavIndex` there's even a dedicated `1fav_uec_count_race` log entry — when the like event arrives but re-reading the count from the database still returns `0`, it logs the race and still sends the `1fav` event. [37](#ref-37) [38](#ref-38)
- **Blind spots the code can't show (to check)**:
  How many milliseconds of cross-service sync delay one specific post of yours met live, and which like event happened to hit the 1-minute throttle valve, can't be seen without back-end server logs.
- **Practical conclusion for creators (judgment)**:
  The back end is a huge distributed system, with a 1-minute throttle valve, power-of-two jump thresholds (1, 2, 4, 8, 16, 32, 64…), and count sync delays. **Don't treat the phone front-end's like count as a millisecond-synced "distribution switch."** Focus on content and comment-section interaction.

### 17 Once a post is successfully written into the `1fav` recommendation index, is it guaranteed to be scrolled to by stranger readers?

- **Plain language first (what this asks, what's the impact)**:
  What is "written into the index (Indexing)"? Picture X's recommendation system as a giant supermarket: "written into the `1fav` index store" means that after your post earns its 1st like, the warehouse manager **puts your post on the supermarket's back-room shelf**. Many tutorials hype this step into: "Get 1 like into the `1fav` store and the system guarantees pushing you to thousands upon thousands of strangers!" Does sitting on the shelf really equal already being bought home by a customer (exposed on a reader's phone screen)?
- **Truth the code confirms (known)**:
  In the public source, from "on the shelf" to "on the reader's screen" there are a full five life-or-death gates: ① **index inclusion** (`phoenixRankAllCandidateProcessor.strato` writes the post into `1fav`); ② **dataset loading** (`retrieval_dataset.py` reads `1fav_1day.parquet`); ③ **step-one two-tower personalized recall** (`phoenix_source.rs`, from the current reader's reading history, picks from hundreds of thousands of posts the few hundred matching this reader's interests into his temporary basket — if there's no match, you're never taken off the shelf at all); ④ **preliminary filtering** (cutting the already-seen, the over-48-hours, the blocked, and candidates beyond `FairShare`'s 2,800 slots); ⑤ **model scoring and seating** (computing the 24 prediction probabilities' weighted total; only the top few dozen by score truly appear on the reader's screen). [37](#ref-37) [38](#ref-38) [34](#ref-34)
- **Blind spots the code can't show (to check)**:
  While one specific post of yours sits on the shelf, how many readers' "recall buyers" picked it today, and in how many readers' baskets it sank and was eliminated for an insufficient score — this internal funnel data is invisible in the creator back end.

- **Practical conclusion for creators (judgment)**:
  **"Into the index" earns only an "entry qualification certificate" for the competition — never a "guaranteed exposure promise."** Earning the 1st like puts you on the shelf, but to be grabbed by the buyer and ranked up front takes a clear topic semantics (the first 4,000 characters + the lead image) and substance quality that makes readers stop and read carefully.

### 18 After a reader taps "Bookmark," does the system guarantee pushing my next new post to him?

- **Plain language first (what this asks, what's the impact)**:
  In the body we covered that although the main scoring table has no separate "bookmarks add so many points," bookmarks have two hidden great uses in the back end: one, as an "interest seed" for `SimClusters` similar-content recommendation; two, as a "training positive" for the immersive recall model. Some creators ask after hearing this: "Since a bookmark becomes a seed, if reader Zhang San bookmarks a post of mine today, does that mean when I publish a new post tomorrow the system 100% guarantees pushing my new post to Zhang San?"
- **Truth the code confirms (known)**:
  Open `explicit_engagement_signals_query_hydrator.rs` and `simclusters_source.rs` and you'll see: when Zhang San scrolls the home feed, the system really does take out up to the **15** posts Zhang San most recently bookmarked (requiring the original posts' publishing age to be within **90 days**), mix them with posts Zhang San recently liked and reposted into an "interest seed package," then search site-wide for candidate new posts published within **48 hours** whose content similarity meets the bar. And in `xrecsys_two_tower.py`, the bookmark (`CLIENT_TWEET_BOOKMARK`) is also listed as a training positive of the `immersive` recall branch. [41](#ref-41)
- **Blind spots the code can't show (to check)**:
  When `SimClusters` takes the ID of your post Zhang San bookmarked to find "similar new posts," how many of the returned list are your just-published new posts and how many are peers' same-topic good posts, and whose score runs higher once they're in the basket, depends on that request's real-time computation.
- **Practical conclusion for creators (judgment)**:
  A reader's bookmark essentially tells the algorithm **"I am extremely interested in this class of concrete problem (say, Chinese invoice OCR or AI meeting summary reviews)."** If you keep publishing high-quality new posts around the same audience's pain points, you really are very easily fished into his basket by `SimClusters` along the bookmark seeds. But this is no "bookmark once and the next post is forcibly bound and pushed" contract of sale — continuously outputting coherent substance in the same field is the key to catching bookmark traffic.

### 19 Why does "whether a reply post can be scrolled to by strangers who don't follow you" depend on how the live switch is set?

- **Plain language first (what this asks, what's the impact)**:
  What is an "out-of-network reply (OON Reply)"? As long as what you publish is a **reply post** (including comments you write under others' posts, and every installment from the 2nd onward when you write a thread), for **stranger readers who don't follow you yet**, that reply is an out-of-network reply. Whether it can appear in strangers' For You home-feed recommendations directly decides "whether a divine comment under a big account can be scrolled to by passers-by" and "whether the back half of a thread can break out directly."
- **Truth the code confirms (known)**:
  In `oon_retweet_reply_filter.rs` and the parameter file `param.rs`, the programmers wrote two-handed logic: ① in the public default configuration, the master switch controlling whether out-of-network replies pass, `EnablePhoenixOonReplies`, is set to **`false` (off)** — run at this default, every reply post by an unfollowed author gets filtered out at this gate; ② but the programmers kept a "conditional-pass back door" in the code: once live sets `EnablePhoenixOonReplies` to `true`, as long as the reply comes from a designated Phoenix recommendation channel (`ForYouPhoenixRetrieval` or `Cold`), has its conversation ancestor data completed, and — with `PhoenixOonRepliesRootOnly` on — is a "first-level reply" directly replying to the main post, it can pass the gate. [30](#ref-30)
- **Blind spots the code can't show (to check)**:
  What proportion of readers, across regions and experiment buckets, live currently has the `EnablePhoenixOonReplies` switch turned on for is real-time data of the live dynamic configuration center.
- **Practical conclusion for creators (judgment)**:
  Since the public default switch is `false` (off), in content planning we must design on the safest baseline: **never hide the whole piece's most important substantive conclusion in a thread's 5th or 10th post — put it in the 1st (the root post, Root Post).** Because the 1st root post is a genuine original post, not restricted by this reply filter — what it blocks is reply posts; whether the root post itself gets scrolled to by strangers still depends on recall and scoring.

### 20 Two things in the code both carry "Evergreen (long-life video)" in the name — why does one clamp at 10 seconds and the other write no 10-second check?

- **Plain language first (what this asks, what's the impact)**:
  What is "Evergreen (the evergreen video store)"? Ordinary posts published over 48 hours ago rarely enter the regular recommendation pool, but for quality video the system built a special "evergreen video store," keeping good videos published **4 to 14 days** ago in continued circulation to readers. Many video friends ask: "To enter this evergreen video store, must one also obey the iron rule that video length be strictly greater than 10 seconds (10,000 milliseconds)?"
- **Truth the code confirms (known)**:
  Dig through the code and you'll find two places where the word `Evergreen` appears, but they are not the same thing at all: ① in the dataset list the step-one recall model reads (`retrieval_dataset.py`) there's an uppercase enum named **`EVERGREEN`** — look at the file path it reads at the bottom and it's actually **`video_4to14day.parquet`** (the `video` core video index's 4-to-14-day window). And to be written into the `video` index store, in `phoenixRankAllCandidateProcessor.strato` one must first pass the `hasValidImmersiveVideo` function, **100% strictly requiring video duration `> 10000 milliseconds` (over 10 seconds)**. ② But in the same file there are two other lowercase-named indexes, `evergreen_video` and `evergreen_nsfw_video`, which run on a separate `EvergreenVideo` event branch, where only `hasImmersiveVideo` is called (checking only whether it's a video format, without writing the `> 10000 milliseconds` judgment again). [49](#ref-49) [50](#ref-50)
- **Blind spots the code can't show (to check)**:
  Under what conditions the upstream system generates the second kind of `EvergreenVideo` event (whether upstream already screened duration once) — that upstream generation code is not public.
- **Practical conclusion for creators (judgment)**:
  Since the main recall dataset `EVERGREEN` plainly reads `video_4to14day.parquet` (strictly bound by `> 10 seconds`), if you want your substantive video to enjoy a long-tail recommendation life of 4 to 14 days, **cut the video to 11 seconds or more (strictly greater than 10,000 milliseconds), and never mix a static image into the same post.**

### 21 How is the video recall store's `32fav_video_14to30day` (the 14–30-day old video store at 32 likes) produced?

- **Plain language first (what this asks, what's the impact)**:
  Checking the data files, we found the immersive video flow has another store with an even more exaggerated shelf life — named `IMMERSIVE32FavVideo14To30Day`, reading the file `32fav_video_14to30day.parquet`. The name looks like a store kept for videos between 14 and 30 days, with the 32fav characters attached; but what conditions actually produce it, the public code hasn't traced through, and its inclusion threshold can't be settled from the name alone. Everyone naturally wonders: what conditions must my video meet to enter this pension store that lives a whole month?
- **Truth the code confirms (known)**:
  In the two-tower recall dataset configuration file `phoenix/xrex/data/retrieval_dataset.py` (`#L247-L282`), `IMMERSIVE32FavVideo14To30Day` really is defined in black and white, pointing at the file `32fav_video_14to30day.parquet`. [34](#ref-34) [50](#ref-50)
- **Blind spots the code can't show (to check)**:
  In the currently public `phoenix-rankall-strato` code tree we can see `1fav_video`'s various day windows, but we have not yet found the complete upstream builder function (Producer) directly responsible for generating the specific file `32fav_video_14to30day.parquet`.
- **Practical conclusion for creators (judgment)**:
  First, this proves quality video's recommendation life on X is far more than 48 hours — there is even a 14-to-30-day long-tail recall pool. Second, note this is a **dedicated video dataset** — never use it as evidence for "ordinary image-text posts unlock a new traffic pool at 32 likes."

### 22 What is the other "video over 10 seconds" check function in the code, named `isMediaEligible`, actually for?

- **Plain language first (what this asks, what's the impact)**:
  While digging through the code, besides finding `hasValidImmersiveVideo` clamped on the three great video index stores (requiring video `> 10 seconds`), we found in the same file another similar-looking function named `isMediaEligible`, which also writes "video duration must exceed 10,000 milliseconds and be non-adult." What's the relationship between these two functions?
- **Truth the code confirms (known)**:
  In `phoenix-rankall-strato/lib/eventProcessing.strato` (`#L125-L204`), `isMediaEligible` explicitly checks `VideoInfo.durationMillis > 10000` and that the media carries no NSFW mark; another function, `getTweetypieResponse`, then calls it (assembling `hasEligibleMedia` and requiring the author be non-NSFW). [49](#ref-49)
- **Blind spots the code can't show (to check)**:
  In the currently public code tree, only `getTweetypieResponse`'s definition and export (Export) can be seen; searching the whole repo finds no downstream file calling it (it may be called by an un-open-sourced external Strato column).
- **Practical conclusion for creators (judgment)**:
  The `hasValidImmersiveVideo` whose call chain we traced through writes its threshold as **`> 10000` milliseconds (strictly greater than 10 seconds)**. This spare `isMediaEligible` shows the same 10-second formulation, but who uses it downstream hasn't been traced — it can only show the same threshold appearing once more in the code, not a site-wide standard raised on top of it.

### 23 Since a 5-second short video can also enter the ordinary post's `1fav` store, are its reach chances the same as an 11-second-plus video's?

- **Plain language first (what this asks, what's the impact)**:
  In Chapter 19 we debunked a rumor: if you publish a video of only 5 seconds, it is not completely shut out of the recommendation stores — it can't enter the dedicated video stores (`video` / `1fav_video`), but it can still normally enter the ordinary post's `1fav` index store (read by the ordinary home feed `HOME`). Someone then asks: "Since a 5-second video can also enter the ordinary home-feed store, are the reach chances of publishing 5-second and 11-second videos completely identical from now on?"
- **Truth the code confirms (known)**:
  From the code branches of `phoenixRankAllCandidateProcessor.strato` it's confirmable: a 5-second short video, in the ordinary `Fav` branch, passes `build1FavIndex` smoothly (because that function doesn't check video duration) and enters `1fav_1day.parquet`. But continuing down to `build1FavVideoIndex` and `buildVideoIndex`, it's stopped outside the dedicated video stores for failing `> 10000 milliseconds`. [38](#ref-38) [34](#ref-34) [49](#ref-49) [50](#ref-50)
- **Blind spots the code can't show (to check)**:
  Missing the two dedicated video stores `video` and `1fav_video` (and the corresponding `IMMERSIVE2Day`, `IMMERSIVE4Day`, and `EVERGREEN` 4–14-day long-tail video channels) — by what percentage a video's final live reach falls short requires live controlled experiment data.
- **Practical conclusion for creators (judgment)**:
  **A 5-second video is "walking on one leg (only the ordinary post's 24/48-hour channel)," while an 11-second-plus video is "walking on two legs (the ordinary post channel, plus the dedicated immersive video flow and the 4–14-day evergreen video store)."** So as long as the content holds up, cutting a substantive video to 11 seconds or more (and not mixing in static images) gets a clearly wider set of recommendation entrances and a longer life.

### 24 If I directly tap "plain Repost" on an old post over 48 hours old, can the old post regain recommendation?

- **Plain language first (what this asks, what's the impact)**:
  Because an ordinary post published over 48 hours ago gets blocked outside the candidate pool by the age filter (`AgeFilter`), many creators think: if I directly tap "plain Repost (Retweet)" on an old post I wrote three days ago or last month, can that new repost push the old post to readers site-wide again?
- **Truth the code confirms (known)**:
  In Chapter 24 of the body we fully restored, with code, the **5 gates** this repost crashes into: ① **it passes the age gate (`AgeFilter`)**: because `age_filter.rs` checks this new repost's own `tweet_id` (generated today, under 48 hours), and won't chop it for the old original's (stored in `retweeted_tweet_id`) over-age; ② **but it fails the stranger breakout gate (`OONRetweetReplyFilter`)**: `oon_retweet_reply_filter.rs` unconditionally removes every plain repost (`is_retweet`) whose "reposter is not on the reader's follow list," so in the ordinary recommendation pipeline, Reposting your own old post yourself cannot enter the candidate pools of strangers who don't follow you; ③ **it also fails the seen old-follower gate (`previously_seen_posts_filter.rs`)**: the seen filter checks `tweet_id` and `retweeted_tweet_id` together — old followers who saw your original before will have today's repost stopped directly; **only old followers who missed it last time, or new followers who just followed you, can scroll to it** (it also fights your new post from today for the `0.625` same-author weight, and gets no cold-start support). [39](#ref-39)
- **Blind spots the code can't show (to check)**:
  What percentage of your followers missed that old post last time, and how many missed impressions one Repost today concretely recovers, depends on your account's follower online-overlap.
- **Practical conclusion for creators (judgment)**:
  **Directly tapping "plain Repost" on your own old post suits only "cross-time-zone catch-up"** (say, substance published at noon; Repost once at midnight to feed overseas-time-zone followers who haven't seen it and the followers you gained today). **If you want old substance to break the 48-hour limit and reach "strangers site-wide who don't follow you" again, never tap plain Repost — you must use "Quote Post (with comment, adding a current new use scenario)."** Because a Quote post, in the code, has `is_retweet = false`, and can be pushed to strangers site-wide, unimpeded, like a brand-new original post.

### 25 Can the `PushToHomeSource` or long video windows in the code be used by us as a back door for ordinary image-text posts to bypass the 48-hour limit?

- **Plain language first (what this asks, what's the impact)**:
  Some people who've carefully flipped through the code directory found that at the very top-level For You pipeline there's a special channel named `PushToHomeSource` which doesn't pass the ordinary candidates' 48-hour `AgeFilter` age check at all. And the video stores from earlier have 14-day and even 30-day windows. So someone asks: "Can we creators use some code phrase or operation to stuff our ordinary old articles into `PushToHomeSource` and forcibly bypass the 48-hour limit onto the home feed?"
- **Truth the code confirms (known)**:
  In `for_you_candidate_pipeline.rs` and `push_to_home_source.rs`, `PushToHomeSource` really does stand side by side with the regular scoring flow `ScoredPosts`. It fetches a specified post by the `push_to_home_post_id` parameter specially passed in the server-side request, and doesn't run the ordinary candidates' `AgeFilter`. And the long-period windows (4 days, 14 days, 30 days) are explicitly bound to video index datasets. [30](#ref-30) [50](#ref-50) [39](#ref-39)
- **Blind spots the code can't show (to check)**:
  Under what conditions X's internal systems stuff some post's ID into `push_to_home_post_id` (say, system-level featured pushes or specific notification linkages) — the upstream trigger code is not public.
- **Practical conclusion for creators (judgment)**:
  `PushToHomeSource` is an internal server-side parameter channel; **ordinary creators have no button or trick in the posting interface to manually insert themselves**. The video 14-day window can't save a pure image-text post either. To put old image-text back on the home feed, the only right path 100% in your own control is the previous item's **Quote Post (with-comment refresh)**.

### 26 Are the "public default rules" written in the safety and risk-control modules the sole iron law every account executes every second live?

- **Plain language first (what this asks, what's the impact)**:
  In the safety and anti-throttling chapters we found many concrete numbers: for instance, "3 of the most recent 5 posts NSFW earns the account a label," "a video at 64 and 512 likes triggers dedicated security checks." Everyone asks: are these numbers the sole standard written dead live, or can the back end secretly change them at any time?
- **Truth the code confirms (known)**:
  First, we fully compared the two newest snapshots, `5ed7963` (October 28) and `606b254` (October 29): the safety labeling, 5-post aggregation, external-link bot, and video / reply review code shows no change in the rules and structure checked between the two snapshots; the visibility filtering module did extract rules into lists and switch to a `ClientSwitch` set for expression, but after expanding and checking all 14 rule-list groups, the interception logic and execution order are identical (a conclusion from expanding the rule groups and comparing them, not a character-by-character comparison). Second, the `README.md` and code comments also state explicitly: rules like the 5-post aggregation in `postToUserLabelRules.strato`, besides the default JSON in the code (`defaultRulesJson`), support dynamic override via a configuration switch reading `configuredRulesJson`; and some core anti-spam bot rules and large-model prompts (Prompts) are not open-sourced. [76](#ref-76) [79](#ref-79) [51](#ref-51) [54](#ref-54)
- **Blind spots the code can't show (to check)**:
  Whether the live configuration center currently has, for specific high-risk regions or specific account groups, dynamically modified `configuredRulesJson`, and what the un-open-sourced part of the bot rules looks like, outsiders cannot see from the public repo.
- **Practical conclusion for creators (judgment)**:
  The safety rules in the public code (3 of 5 posts NSFW, a pinned bad link banned 7 days, external-link v2 checking the comment section, CJK Chinese duplicate detection) are the **real defense-line cards** we can see with our own eyes — step on them and trouble is highly likely. But never take these default numbers and "precisely hug the line" (for instance, imagining that interleaving 3 filler posts after every 2 sensitive posts means you'll absolutely never be banned), because live can override the window size with dynamic configuration at any time.

### 27 Once a post or account is tagged with an "insult label" or an "account throttling label," can passers-by who don't follow me not see me even tapping into my profile?

- **Plain language first (what this asks, what's the impact)**:
  What is a "safety label (Safety Label)"? It's the "violation seal" the system sticks on a post or account upon finding insults in a post (say, `FOSNR_ABUSE_INSULTS`) or spam / NSFW from an account (say, `SPAM_HIGH_RECALL`, `NSFW_HIGH_PRECISION`). Many people, hearing they've been labeled, assume: "It's over — every stranger who doesn't follow me, whether searching me in the search box, tapping a link someone else reposted, or tapping straight into my profile, can't see my posts at all!" Is it really that absolute?
- **Truth the code confirms (known)**:
  In `visibility-filtering/rules/levels.rs` and `vf_candidate_hydrator.rs`, X splits safety interception into many completely different "doors (check entrances)":
  - **The first door is named `TimelineHome` (the door old followers who follow you use to scroll the home feed)**: this door, for many labels (say, the `FOSNR_ABUSE_INSULTS` insult label, and several account-level throttling labels), **has no direct removal (Drop) rule configured at all**. So your old followers still see you when scrolling the home feed;
  - **The second door is named `HomeRecommendations` (the For You recommendation gate that pushes your posts to "strangers who don't follow you yet")**: at this door, once the labels above are detected, the system **directly executes removal (Drop)** for everyone except the author himself (`NonAuthors` or `NonFollowers`).
  And in the official transparency back end's code (`underTheHoodLabels.strato`), the official effect description for these labels reads: **"do not recommend this post / this account to non-followers who don't follow you (Do not recommend... to non-followers)."** [77](#ref-77) [75](#ref-75)
- **Blind spots the code can't show (to check)**:
  As for other pages — search results pages, someone tapping straight into your profile (Profile Timeline), conversation detail pages, or directly opening a post link — which safety level each mounts and how they display across client versions, the public repo doesn't provide a complete call graph for every page site-wide.
- **Practical conclusion for creators (judgment)**:
  Understand the difference between these two doors and you'll grasp two big things:
  First, these common labels' real killing move is **"cutting off the For You home feed's faucet recommending you to strangers (keeping freedom of speech, giving no breakout recommendation traffic)"** — not erasing your account from the earth;
  Second, **when you suspect you're throttled, never ask an old follower who follows you "can you still see my posts"** — because old followers walk through the `TimelineHome` door; his seeing you proves nothing about whether you were chopped at the stranger recommendation door (`HomeRecommendations`). To check, use the official [Under the Hood](https://x.com/i/jf/under_the_hood) tool.

### 28 When writing a post criticizing someone, what sentences or language get automatically tagged `FOSNR_ABUSE_INSULTS` (the insult throttling label)?

- **Plain language first (what this asks, what's the impact)**:
  The previous item just said: once a post is tagged `FOSNR_ABUSE_INSULTS` (the insults and personal attacks label), that post is directly intercepted and removed in the stranger recommendation flow (`HomeRecommendations`), losing breakout traffic utterly. So when writing sharp reviews, industry criticism, or rebuttals, what situations trigger this label? Is Chinese treated the same as English?
- **Truth the code confirms (known)**:
  Open the Grox PTOS safety label auto-write code, `grox/flows/ptos/task_write_safety_post_annotations_result_sink.py` (`#L175-L268`): in this auto-labeling pipeline, writing `FOSNR_ABUSE_INSULTS` requires **three hard conditions simultaneously**: ① the PTOS large model first judges the post `HateOrAbuseInsultsWithTarget` (hate or insult attacks against a specific target); ② **the post's language must be recognized as English**; ③ the author is not a high PageRank big account or a grey-badge verified account (and not a test account). [76](#ref-76) [77](#ref-77)
- **Blind spots the code can't show (to check)**:
  First, the prompt (Prompt) inside the PTOS large model distinguishing "normal sharp criticism" from "personal-attack insults" is not open-sourced. Second, besides this English-requiring PTOS automatic branch, whether the back end has other unpublished multilingual automatic rules or human-report review channels that write the same label is invisible in the public repo.
- **Practical conclusion for creators (judgment)**:
  If you often post in **English** (or post **Chinese-English mixed posts** the system recognizes as English), take extra care with wording when writing product sharp reviews or rebutting others — **fire only at test data, product defects, and logic holes; never carry personal profanity or character-insult vocabulary**. At the same time, although this specific automatic branch writes an English condition, posting in Chinese likewise permits no personal attacks: once readers turn around and hit Report (the `Report` coefficient is `-234.0`, a magnitude far beyond the positive terms) or other risk controls trigger, it's still not worth it.

### 29 If a post gets tagged `LOW_QUALITY` or `MISINFO`, are its like and repost buttons really locked dead?

- **Plain language first (what this asks, what's the impact)**:
  Sometimes on X we see certain posts covered by a translucent warning mask (Interstitial); tap in and the like, repost, and comment buttons underneath are all grey — unclickable. The rumor online: "As long as a post is tagged `LOW_QUALITY` or `MISINFO`, a warning pops for all non-followers and the like and all share buttons are locked dead!"
- **Truth the code confirms (known)**:
  Open `visibility-filtering/rules/tweet_rules.rs`, `rule_spec.rs`, `verdict.rs`, and `limited_actions_policy.rs` and check, and the truth is:
  1. **Who sees the warning mask? Everyone (`Everyone`).** This rule targets posts published after April 1, 2019 carrying a post-level `LOW_QUALITY` or one of four misinformation labels (`MISINFO_CIVIC`, `MISINFO_GENERIC`, `MISINFO_MEDICAL`, `MISINFO_CRISIS`); the audience is explicitly written as `Everyone` (followers who follow you see the warning mask too, not only non-followers);
  2. **Exactly which buttons get locked dead? It depends on the label type and source (`source`).**
     - If it's a post-level `LOW_QUALITY` label, the harshest **`NonCompliant`** restriction policy engages directly — in the test configuration, it locks **all 11 interaction buttons: reply, plain repost, like, emoji reaction, DM sending, bookmark, pin, system share, copy link, and more**;
     - If it's one of the four `MISINFO` labels, the program first reads the label's `source` field: for instance, when `source` is `limited_replies`, only `ConversationControl` engages (locking only the "Reply" button dead; likes and reposts work as usual); **but if the `MISINFO` label is missing its `source` field, at the final assembly stage (`verdict.rs#L77-L83`) the code automatically falls back (Fallback) to the harshest `NonCompliant`, locking the full set of 11 buttons dead.** [78](#ref-78)
- **Blind spots the code can't show (to check)**:
  What `source` one specific labeled post live actually carries, and which buttons the live real-time configuration checks for each restriction level, depends on server-side dynamically delivered policy.
- **Practical conclusion for creators (judgment)**:
  The point everyone most needs to relax about here: **never confuse the "post safety label `LOW_QUALITY`" that triggers the full button lock with the "URL domain reputation rating `LOW_QUALITY`" from the external-links section.** Day-to-day, a short, ordinarily written daily post of yours will absolutely never be tagged with this public-interest safety label of the same grade as rumor-mongering (`MISINFO`).

### 30 How exactly is the "3 of the most recent 5 are NSFW (the 3/5 rule)" that triggers the account-level `NSFW_HIGH_PRECISION` label counted? How do a pure-text post and a post with 4 images count?

- **Plain language first (what this asks, what's the impact)**:
  What is the "3/5 account aggregation rule"? Normally, if you occasionally publish one post with a sensitive image, the system at most tags **that one post** with an adult label. But if you publish sensitive content in succession and trip this "3 of 5" red line, the system directly tags your **whole account** with the **`NSFW_HIGH_PRECISION` (high-precision adult account)** label. At the stranger recommendation entrance (`HomeRecommendations`) this label intercepts your posts — it governs this one entrance and this one reader class, not a site-wide seal-off. And how its own validity is computed is a different matter from the pinned bad link path's 7 days (see items 31 and 32) — they can't be merged into one line, "whole account throttled 7 days."
  Many creators never figured out: this "3 of the most recent 5" — does it count my 5 most recently uploaded images? Or only my 5 most recent posts carrying images / videos?
- **Truth the code confirms (known)**:
  Open `safety-label-user-agg/postToUserLabelRules.strato` (`#L395-L425`) and `safetyLabelToUserLevelAggregationV2Processor.strato`, and the public default configuration is crystal clear: `windowSize: 5` (window size 5), `minimumMatchingPosts: 3` (minimum matching posts 3), `maxPostAgeDays: 60` (within 60 days), **`mediaOnly: false` (count media posts only = no)**.
  This code's actual counting method: in reverse time order, take **the frontmost at most 5 posts** from your personal timeline (`userTimeline`), then count how many of those 5 posts carry the `NSFW_HIGH_PRECISION` label. That means three certain facts:
  1. **Counted by "posts," not by "images"**: if in **one post** you place 4 sensitive images at once, in this rule it **counts as only 1 post** (it won't count as 4 and trigger an account ban on the spot for 4 images);
  2. **Pure-text posts also occupy slots in the 5-post window**: because `mediaOnly` defaults to `false`, if in between you published two pure-text posts with no images, they likewise occupy 2 positions in the front-5 window;
  3. **Reposting (Retweet) an old post also counts in**: if the front 5 include a plain repost you just tapped, the program calls `originalTweetForRetweet` to check **the safety labels on the reposted original**, and uses this new repost's time for the 60-day window. And the code uses `take(5)` (take at most 5) — even if a new account has published only 3 posts total and all carry the label, it completes 3 and triggers on the spot, without waiting to gather the 5th. [79](#ref-79) [80](#ref-80)
- **Blind spots the code can't show (to check)**:
  The upstream `userTimeline` interface's real-time return details when meeting deletions and pagination, and whether live dynamically switched `mediaOnly` to `true` for specific accounts via `configuredRulesJson`, are invisible in static code.
- **Practical conclusion for creators (judgment)**:
  First, if one installment's content genuinely includes sensitive images, combining the same batch of sensitive images into 1 multi-image post occupies only 1 slot in the window; splitting them into 3 single-image posts in a row may complete 3/5 and trigger the account label. This explains the counting method — it's not teaching rule evasion: triggering looks at the label events themselves, and probing the window as a recipe flips the car the moment live configuration changes. Second, **never carelessly Repost someone else's, or your own old, post that was once tagged with a sensitive label** — because a repost brings the original's sensitive label straight into your current front-5 counting window.

### 31 What is an "account throttling label"? What are the "10-minute delay" and the "7-day TTL validity"? Does traffic automatically recover on day 8?

- **Plain language first (thoroughly explain the four concepts "label, validity, effect, impact")**:
  String these four words together and walk the whole process in plain words:
  1. **What is a "label (account-level safety label, Account Label)"?**
     Like a parking violation earning a ticket: when your account trips a system red line — say, item 30's **"3 of the most recent 5 posts are NSFW (triggering the account-level `NSFW_HIGH_PRECISION` label),"** or item 39's **"setting a post with a low-quality / dead external link as the profile pin (triggering the account-level `SPAM_HIGH_RECALL` spam label)"** — the system, in the back-end database, sticks an invisible "violation seal" directly onto your **account ID**. That's an account-level label.
  2. **What does this label concretely do? What's its effect on your traffic?**
     Once this seal is on your account, during its effective period, **when the recommendation system prepares to send your new post into the "home-feed recommendation pool of strangers who don't follow you (`HomeRecommendations`)," the security gate sees the seal on your account and intercepts the post at this entrance (Drop).**
     The phenomenon before your eyes: old followers who follow you can still see you in the following feed, but **your stranger recommendation traffic (For You breakout reach) drops sharply**.
  3. **What is the "10-minute delay"?**
     Suppose today you carelessly publish the 3rd sensitive-image post in a row, completing the "3 of 5" trigger line. Is the account seal stuck on you in the 1st second that 3rd post goes out? No. The transport pipeline (Forwarder) responsible for aggregating "single-post labels" up into "whole-account labels" deliberately sets a **10-minute queue delay (`delay = 10 minutes`)**. That is, from your 3rd post being labeled to the whole account genuinely carrying the seal and throttling, at least this queue delay sits in between. The system also has a 20-minute `maxLag` service target governing "at most how far behind"; but exactly which second it truly writes to the account has no per-entry actual record, so this stretch mustn't be used as a 10-to-20-minute countdown.
  4. **What is the "7-day TTL validity (7-day Time-To-Live)"?**
     `TTL` is a programmer term; in plain words it's **"this seal's automatic expiry lifespan."** The seal isn't lifelong: labels written by the pinned bad link path have code explicitly writing expiry 7 days from the writing second; the 3/5 aggregation path's recorded public TTL is likewise 7 days. But the two paths' trigger events, counting methods, and author conditions all differ — item 32 covers this specially — so they can't be merged into one "site-wide universal 7-day window."
- **Truth the code confirms (known)**:
  Open `safetyLabelToUserLevelAggregationV2Forwarder.strato`, `safetyLabelToUserLevelAggregationV2Processor.strato`, and `PinnedLowQualityOrBadUrl.bot` and confirm:
  - **Delay parameters**: the aggregation forwarder explicitly sets a **`10-minute delay`** and a **`20-minute maxLag` (maximum delay service target)**;
  - **The 7-day countdown's start**: on the pinned external-link spam label path, the expiry formula at writing is explicit — **`CurrentTimeMs() + 7 days`** (from the second the system truly writes the label into your account database, add 7 days). On the 3/5 NSFW aggregation path, the recorded public TTL is also 7 days, but that's its own setting; the two paths are not one unified formula;
  - **No infinite re-stacking**: in the 3/5 NSFW aggregation rule (`postToUserLabelRules.strato`), authors "currently already carrying the `NSFW_HIGH_PRECISION` account label" are excluded by default (that is, during the 7-day penalty period, the same rule running again won't infinitely extend it another 7 days each time). [79](#ref-79) [80](#ref-80) [74](#ref-74)
- **Blind spots the code can't show (to check)**:
  First, the 10-minute delay and 20-minute max lag are system-set target values; when live servers are busy, exactly which second a label is written and which second expired labels are cleaned has no public real-time monitoring log. Second, after the 7 days run out and the seal expires and is removed, to what fraction of the original your day-8 real reach recovers has no historical comparison data in the public code.
- **Practical conclusion for creators (judgment)**:
  With this whole "stick the seal → block stranger recommendation → 7 days auto-expire" mechanism understood, traffic anomalies give you two clear action guides:
  1. **If you carelessly trip an account label**: while the label is on, your new posts get intercepted at the stranger recommendation entrance, and a heavyweight long piece's breakout effect is discounted. First tidy the account — clean the problem pinned link or violating post. Whether to delay a long piece because of it depends on the content's own timeliness; there's no need to schedule around the label's expiry date — expiry and recovery are not the same thing (see point 2);
  2. **After the label expires**: your account merely regains the qualification "allowed to re-enter the stranger recommendation pool." **The system has no code for "automatic traffic compensation on expiry"** — old posts published before expiry, having passed the 48-hour age line (`AgeFilter`), won't revive. New posts walk the normal recall and recommendation again.

### 32 Besides "3 of the most recent 5," are there other channels that tag an account with an adult throttling label?

- **Plain language first (what this asks, what's the impact)**:
  Some creators in edgy or art-photography content, after reading item 30's 3/5 rule, start small calculations: "Since it checks only the most recent 5, if after every 2 edgy image posts I immediately publish 3 proper good-morning pure-text posts to flush the front-5 window away, will I never be tagged with an account-level adult label?"
- **Truth the code confirms (known)**:
  Dig through the repo and you'll find the "3 of 5" **is not the system's only defense line catching adult accounts at all**:
  1. In the same `postToUserLabelRules.strato` file there's actually another rule named `possibly_nsfw_account` (although in the public default JSON it's set to the mathematically unreachable soft-disabled state of "in a 10-post window require 11 matches," live can at any time, via `configuredRulesJson`, dynamically change it back — say, 4 matches in 10 — and activate it);
  2. More importantly, under `botmaker-rules/scarecrow/` there lives **another completely independent auto-labeling channel** (`NsfwTweetMediaProcessor.bot`, `ApplyNsfwUserLabel.df`, and `ApplyNsfwUserLabelOrCreateReport.df`): this channel ignores any "most recent 5 posts window" and directly stuffs media NSFW events, by post ID, into a counter called HLL, checking specifically **"whether more than 2 counts occur within 1 day (24 hours)."** Once exceeded, with model score and author conditions met, it likewise sends the account straight to an adult label or human review. [76](#ref-76) [79](#ref-79) [80](#ref-80)
- **Blind spots the code can't show (to check)**:
  Besides the rules visible in the public code, how many un-open-sourced automatic rules and human inspection standards X holds internally, and each rule's live trigger proportion, are not all public.
- **Practical conclusion for creators (judgment)**:
  Never play the clever game of "2 sensitive image posts + 3 filler posts to hug the window": you may dodge `postToUserLabelRules`' 5-post window, but you can't dodge `ApplyNsfwUserLabel.df`'s "more than 2 counts within 24 hours." Creators doing normal, non-adult content should also restrain even reposting others' edgy content, avoiding triggering media NSFW events multiple times within one day.

### 33 In the very second a video post earns its 64th and 512th like, does the system necessarily start a big safety check?

- **Plain language first (what this asks, what's the impact)**:
  In Chapter 20 of the body we revealed a truth: the hyped "a video earning 64 and 512 likes triggers two rounds of traffic reward pools" is, in the code, actually the **activation thresholds of three video violation safety review tasks (`SpecialVideo` dynamic-flash review, `MediaInjected` injected-violation-frame review, `AdultContentLeadingFrames` adult review of a long video's first 10 seconds)**. So does every video, in the very second it reaches the 64th or 512th like, get a 100% guaranteed security-bot run?
- **Truth the code confirms (known)**:
  Under `grox/flows/ptos/` we can see these three video security pipelines each listening to different Kafka message queue entrances (`generators.py`), all carrying a **60-second dedup rate-limit cache (`task_rate_limit.py`)**. When a task arrives:
  - `SpecialVideo` and `MediaInjected` require the video post's current like count to be `>= 64` (the `deluxe_fav_count_threshold` default);
  - When the like count is `>= 512`, `MediaInjected` enables the large model's chain-of-thought deep reasoning (`use_reasoning = true`), while `AdultContentLeadingFrames`, which cuts the first 10 seconds of a 30-second-plus long video, waives the prerequisite "a prior `AdultContent` suspicion classification must have appeared" at 512 likes. [51](#ref-51) [52](#ref-52) [53](#ref-53)
- **Blind spots the code can't show (to check)**:
  The public code shows "how the security-check consuming end judges by 64 and 512 likes after receiving a task." At what frequency, and at which like nodes, the upstream Producer sending check requests into the Kafka queue triggers sends — that upstream production code is not public.
- **Practical conclusion for creators (judgment)**:
  Whether upstream sends for inspection punctually at the 64th/512th like or samples every few minutes, for us creators the core cognition is one line: **64 likes and 512 likes are "deep violation security-check lines after a video catches fire" — absolutely not "traffic reward unlock lines."** As long as your video (and others' videos you Quote) is clean — no edgy content in the first 10 seconds, no violating QR code or pornographic frame flashed in a few middle frames — passing security checks at several hundred likes is nothing to fear.


### 34 How does video safety review actually catch "hidden violating frames"? Can hiding a violating frame at second 11 dodge it?

- **Plain language first (what this asks, what's the impact)**:
  Some people in grey industries or edgy traffic plays hear the system has a rule — "cut the first 10 seconds of a 30-second-plus long video for adult review (`AdultContentLeadingFrames`)" — and think they've found a loophole: "I'll make the first 10 seconds proper scenery, hide an edgy or violating traffic QR code flashing at second 15 — won't that fool the AI security check perfectly?" And if caught, what happens?
- **Truth the code confirms (known)**:
  Open the source under `grox/flows/ptos/` and the system's violating-video catching is not one move ("cut the first 10 seconds") at all — it lays three dragnets:
  1. **Dynamic mutation frame capture (`SpecialVideo`)**: the `motion_reveal` algorithm scans the whole video for "the frames where the picture suddenly changes violently (`motion_reveal_frames`)" — even if you flash a violating frame or QR code for only 0.5 seconds mid-video, it's precisely hauled out for review;
  2. **Blacklist reference library comparison (`MediaInjected`)**: extracted video frames are compared in depth against the officials' confirmed "violating / infrared / spam video reference library" (at 512 likes, the large model's chain-of-thought reasoning also engages); a hit qualifies it as `SpamManipulatedMedia` (maliciously manipulated media) and sends it into the public write pool, where the general Spam branch's author conditions decide which labels get written — this task does not directly stick a named label on the account itself.
  3. **Dual-model cross-hearing (Cross-validation)**: for adult content, the system runs the PTOS large model and another independent `sex-and-nudity` vision model simultaneously for cross-validation, finally writing adult or spam labels by the confirmed violation category. [76](#ref-76) [51](#ref-51) [52](#ref-52) [53](#ref-53)
- **Blind spots the code can't show (to check)**:
  Which samples X's internal blacklist violating-video reference library stores, the vision large model's specific prompts (Prompt), and the cross-validation judgment score lines are the platform's confidential anti-cheating assets, not public.
- **Practical conclusion for creators (judgment)**:
  Never believe any nonsense like "scenery for the first 10 seconds, violating content at second 11, and you pass." Because `motion_reveal` catches exactly mid-video mutation frames. Normal creators need only guarantee their own video (and any video they Quote) carries no violating inserted frames throughout, and can publish with peace of mind.

### 35 I commented under someone else's hot post, then replied to myself twice more — will I be treated as a "floor-building spam account" and have my comment score zeroed?

- **Plain language first (what this asks, what's the impact)**:
  What is "multi-step self-reply spam filtering (`TaskMultiStepReplySpamFilter`)"? Many course-sellers and promoters like to grab the first-floor comment under a big account's hot post, then reply to themselves under that comment, building three or four floors (floor 1 leaves a hook, floor 2 a screenshot, floor 3 a traffic WeChat ID). To strike this behavior, the system wrote a dedicated filter: once it judges you're maliciously building floors with spam ads under someone else, it writes those replies' **comment-section ranking score (`ReplyRankingScore`) directly to `0.0` (sunk to the comment section's valley floor, visible to no one)**.
  So if we ordinary creators discuss a technical question normally under a big account's post, one sentence unfinished, replying to ourselves once more with a supplement — will we be falsely zeroed?
- **Truth the code confirms (known)**:
  Open the source of `task_multi_step_reply_spam.py` and `classifier_multi_step_reply_spam.py` and the system separates **"step one: check the floor structure"** from **"step two: the large model reads content and characterizes"** cleanly:
  1. **Which situations never even enter review (direct exemption)?**
     - If you're replying to yourself in a row under **your own main post (Root Post)** to write a thread, 100% direct exemption, no check;
     - If the original post's author you're replying to has **fewer than 1,000 followers**, no check;
     - If you replied to someone else only once (without replying to yourself again under your own comment to form three floors), no check.
  2. **Even inside review, three anti-false-positive protections remain**:
     Only when you "reply to yourself" under "someone else's post whose author has `>= 1000` followers" is the conversation sent to the Grox large model (if the conversation exceeds 10 floors, it samples only the first 5 floors + the last 5 floors + the current reply, at most 2 images per post). After reading, the large model must explicitly judge you to be posting spam promotion, must include your newest reply in the circle, and, after removing others, at least 2 of your own spam replies must remain — only then does the program actually punish you. [66](#ref-66) [67](#ref-67)
- **Blind spots the code can't show (to check)**:
  The specific prompt (Prompt) inside the large model distinguishing "normally supplementing technical details across two floors" from "posting spam traffic ads across two floors" is not public.
- **Practical conclusion for creators (judgment)**:
  Writing a thread under your own post is 100% safe. Discussing a question normally under a thousand-follower big account — even supplementing real data and error logs across two floors — the large model can tell you're communicating normally; no fear at all. The one habit to quit is replying to yourself floor after floor in someone else's hot comment section with course-selling ads or traffic name cards.

### 36 Once a comment is judged floor-building spam and its `ReplyRankingScore` is written to `0.0`, does it drag down my whole account or the big account's original post?

- **Plain language first (what this asks, what's the impact)**:
  Right after the previous item: if someone really does build floors with promotion under a thousand-follower big account's comments and gets caught, how destructive is the `ReplyRankingScore = 0.0` (comment ranking score zeroed) the system writes? Will it wreck the big account's original post's heat? Or zero my own whole account's weight for future main-feed posts?
- **Truth the code confirms (known)**:
  In `classifier_multi_step_reply_spam.py` (`#L157-L175`) and `task_multi_step_reply_spam.py` (`#L151-L198`), the code is written very restrainedly: ① when parsing the large model's results, the program hard-codes accepting only floors with `index > 0`, physically **100% protecting floor 0 (the big account's original post, Root Post) from ever being falsely hit**, and removes all other innocent passers-by's comments in the conversation; ② what finally gets `ReplyRankingScore(score=0.0)` written, plus an attempted `RiskyHighVizReply` (high-visibility-risk reply) tag, is **only those few spam reply IDs of yours the model circled**. [67](#ref-67)
- **Blind spots the code can't show (to check)**:
  After the downstream service rendering the post detail page's comment section reads `ReplyRankingScore = 0.0`, whether it folds it straight into "show more replies that may contain spam" or simply ranks it last — the downstream comment-section display code is not fully listed in the public repo.
- **Practical conclusion for creators (judgment)**:
  This punishment is a precise "surgical strike" — **it presses only those few violating floor-building comments to the water's bottom (0 points), dragging down neither the innocent original post's blogger nor your whole account's For You home-feed score for original posts**.

### 37 If a reply wasn't tagged `RiskyHighVizReply`, does that mean its comment score (`ReplyRankingScore`) wasn't zeroed either?

- **Plain language first (what this asks, what's the impact)**:
  In the previous item's code, when the system catches a floor-building spam reply, it does two things in sequence: first, it tries to tag the reply `RiskyHighVizReply`; second, it writes its `ReplyRankingScore` (comment ranking score) to `0.0` and sends it out. Some big-account bloggers ask: "If I'm a high-weight account and exempted from the first risk label, did I also dodge the second 0-point punishment?"
- **Truth the code confirms (known)**:
  Open `task_write.py` (`#L39-L79`) and `task_multi_step_reply_spam.py` (`#L151-L198`) and compare execution order: **"tagging `RiskyHighVizReply`" and "writing the comment score to `0.0`" are two mutually independent steps in the code.** The helper function responsible for tagging does additionally check high PageRank / credit score, grey badge, and test account exemptions internally. But even if that helper returns without tagging due to an exemption, the outer main function still proceeds and **publishes `ReplyRankingScore(score=0.0)` to the cache, Kafka, and the Strato database just the same**. (Of course, a genuine high PageRank V2 or grey-badge account was already skipped at the earlier `TaskMultiStepReplySpamFilter` entrance; this is the independent logic for the middle credit-score boundary.) [66](#ref-66) [67](#ref-67)
- **Blind spots the code can't show (to check)**:
  A single concrete reply's label state and internal `ReplyRankingScore` value in the live database can't be seen directly by ordinary users on the front-end interface.
- **Practical conclusion for creators (judgment)**:
  Not seeing a post risk label in the official [Under the Hood](https://x.com/i/jf/under_the_hood) report does not equal "the replies you flood-posted in others' comment sections weren't written `0.0` and sunk." Writing valuable comments honestly is the only way not to sink.

### 38 When posting an external link, can I tell from what the URL looks like (say, whether it's a short link) whether X will judge it `LOW_QUALITY`?

- **Plain language first (what this asks, what's the impact)**:
  What are the external link `LOW_QUALITY` or `BAD` ratings? X's back end holds a huge "URL reputation blacklist library (URL Reputation)." When you publish a post with an external link, the review bot (`LQ_Tweets_With_LQ_URL_Verdict_At_Mention_To_NonFollower_v2.bot`) follows your link's redirect chain (`redirectionChain`) all the way: if any hop's URL is marked `LOW_QUALITY` in the reputation library, and the final landing page is not in `GOOD` or `WHITELIST`, the bot directly tags your post **`SPAM_HIGH_RECALL` (high-recall spam post)** — **even if you hide the external link in the first-floor comment, the newest v2 bot catches it just the same, removing the post from the stranger recommendation flow directly.**
  So can we creators, before posting a link, eyeball which URL X will judge `LOW_QUALITY`?
- **Truth the code confirms (known)**:
  From the source of the v1 and v2 external-link bots and the pinned external-link bot (`botmaker-rules/scarecrow/bot/`): the bot itself doesn't look at URL string length at all — it reads the rating enum the internal URL reputation service returns (`BAD`, `LOW_QUALITY`, `GOOD`, `WHITELIST`) directly. And the newest **v2 has entirely deleted the old v1's exemption conditions "exclude reply posts (`isReply`), exclude reposts (`isRetweet`), and must `@` a stranger."** [76](#ref-76) [73](#ref-73) [74](#ref-74)
- **Blind spots the code can't show (to check)**:
  Which domains worldwide X's internal URL reputation library has marked `LOW_QUALITY` or `WHITELIST`, and how often the list updates — that internal domain list is not public.
- **Practical conclusion for creators (judgment)**:
  Although we can't see the internal domain list, three iron rules help us dodge 99% of external-link minefields:
  1. **Abandon the fantasy "stuffing the external link into the first-floor comment dodges review" completely** (in the v2 era, the comment section is reviewed exactly like the body);
  2. **Connect directly to high-reputation big platforms or regular main domains wherever possible** (GitHub, Substack, YouTube, regularly registered official sites), and **use obscure no-name free short-link services for secondary redirects as little as possible** (because once that free short-link domain is abused by black industries and marked `LOW_QUALITY`, even if your final landing page is a regular blog, as long as the final page hasn't entered X's top whitelist, that middle hop drags you to death);
  3. Before posting, click the link open yourself and test it once, ensuring it doesn't jump to a dead, hijacked domain.

### 39 If I carelessly set a post with a bad link as my profile pin, triggering the account label with a 7-day validity, can Unpinning immediately unseal me?

- **Plain language first (what this asks, what's the impact)**:
  In Chapter 27 of the body we covered an extremely dangerous bot named `PinnedLowQualityOrBadUrl.bot` (the pinned low-quality link review bot): when you set a post as your profile pin (Pin), if a link it carries is found to be `BAD` or `LOW_QUALITY` (say, you pinned a two-year-old post whose personal-site domain expired long ago and was snatched by a gambling site), the system directly tags your **whole account** with the **`SPAM_HIGH_RECALL` (high-recall spam account)** seal, so **every new post you publish in the next 7 days can't enter the stranger recommendation flow**.
  Many creators ask: "If I take the hit and, the moment traffic looks wrong, immediately Unpin or delete that pinned post, does the 7-day seal on my account vanish automatically at once?"
- **Truth the code confirms (known)**:
  Open the source of `botmaker-rules/scarecrow/bot/PinnedLowQualityOrBadUrl.bot` (`#L2-L44`) and read it head to tail: the logic inside is a single one-way line. When it detects the user modified the pinned post (the modified `after` value of `pinnedTweetIds` exists and differs from the `before` value), and parses out that the new pinned post's links contain `BAD` or `LOW_QUALITY`, it directly calls `SetUserLabel` to write the `SPAM_HIGH_RECALL` account label with a validity of **7 days (`CurrentTimeMs() + 7 days`)**. **In this rule file there is no code branch at all for "when the user unpins the problem post, synchronously delete the account label."** [74](#ref-74)
- **Blind spots the code can't show (to check)**:
  Whether X's back end has other un-open-sourced scheduled recheck tasks, or whether an appeal through human customer service can remove this label early, is invisible in the public repo.
- **Practical conclusion for creators (judgment)**:
  **"Easy to invite the god in, hard to send him away." The code holds only the automatic "stick a 7-day seal on" code for swapping in a bad-link pin — no automatic "tear the seal off" code for unpinning.** So if you truly take the hit, you must of course take the problem pinned post down at once to prevent re-triggering after 7 days, but those 7 days will mostly have to be waited out — the public code has no automatic-removal branch, and whether early release is possible, public materials can't answer. The best method: **before every press of the "Pin" button, spend 5 seconds clicking the post's links open and checking them.**

### 40 How many repeated Chinese characters, or how many copy-paste rounds, land a post on the `COPYPASTA_SPAM` (copy-paste spam) list?

- **Plain language first (what this asks, what's the impact)**:
  What is `COPYPASTA_SPAM`? "Copypasta" in English internet slang is exactly "copy-pasted screen-flooding copy." If, to save effort, you copy-paste the same promotion copy, or the same comment, and post it many times, the system's dedicated duplicate-text bot tags you `COPYPASTA_SPAM`. Many ask: "Chinese doesn't tokenize by spaces like English — can the system even catch Chinese duplication? Exactly how many repeated Chinese characters, posted how many times, counts as a violation?"
- **Truth the code confirms (known)**:
  Open `botmaker-rules/scarecrow/bot/BBQDuplicateTextProd.bot` (governing main posts) and `BBQDuplicateTextRepliesProd.bot` (governing comment-section replies), and the code plainly lists detection job names dedicated to **Chinese, Japanese, and Korean characters (CJK)**: **`duplicate_text_characters_cjk`** and **`duplicate_text_characters_cjk_replies`**. As long as the upstream scheduled job packages a batch of highly identical posts into a "duplicate post cluster (`tweetIdCluster`)" and sends it over, and the author is not a test account, high PageRank, or grey badge, the bot writes all those posts the `COPYPASTA_SPAM` label. [81](#ref-81)
- **Blind spots the code can't show (to check)**:
  These two `.bot` files execute from "receiving the upstream already-packaged duplicate post cluster (`tweetIdCluster`)." As for the upstream `duplicate_text_characters_cjk` scheduled job's internal rule — "20 consecutive identical Chinese characters" or "cosine similarity over 85%," and "repeat 3 times or 5 times" before packaging for review — that upstream SQL / offline query code is not open-sourced.
- **Practical conclusion for creators (judgment)**:
  Never imagine writing Chinese without spaces escapes copy-paste detection. But normal creators need no panic either: using the same industry term, or a fixed personal signature format, across different articles is absolutely not screen-flooding. Quit the habit of "taking one script template and batch copy-pasting it for traffic under a dozen posts" and you'll never walk into this muzzle.

### 41 Once a post is tagged `COPYPASTA_SPAM`, how many points does it lose in the recommendation flow — or is it blocked directly?

- **Plain language first (what this asks, what's the impact)**:
  Right after the previous item: suppose a post really is tagged `COPYPASTA_SPAM` by the bot above for batch copy-pasting. How does that label then act in the recommendation system? Does it deduct 50% of the score, or chop it dead in the stranger recommendation flow like `SPAM_HIGH_RECALL`?
- **Truth the code confirms (known)**:
  In the public `botmaker-rules` directory we can 100% see the code action of the bot writing the `COPYPASTA_SPAM` label into the database. But when we take the name `COPYPASTA_SPAM` and search the public `Home Mixer`, `VM Ranker`, and `visibility-filtering` (the visibility filtering rule library), we don't see, in the public lists, the line of code directly reading `COPYPASTA_SPAM`. [76](#ref-76) [81](#ref-81)
- **Blind spots the code can't show (to check)**:
  Why does upstream apply this label so aggressively while downstream public code never shows its name? As the officials specifically declare in the `README.md` (`#L440-L447`): **to prevent black industries from targetedly bypassing risk control, the public repo does not include all anti-spam rules and downstream consumption services.** This label is very likely consumed directly by an un-open-sourced external recall filtering layer or credit-score deduction service.
- **Practical conclusion for creators (judgment)**:
  Engineers would never, out of sheer idleness, write two production-environment bots (`Prod.bot`) specialized in catching Chinese and English duplicate posts and leave them as decoration. Although the specific downstream deduction is unpublished, the existence of `BBQDuplicateTextProd.bot` is enough to sever every notion of "growing followers by batch copy-pasting copy with group-control scripts."

### 42 Why does "engagement bait" get no exemption even for high-weight accounts and grey-badge big accounts? How should an end-of-post question be written to be safe?

- **Plain language first (what this asks, what's the impact)**:
  What is "engagement baiting / farming"? A post with no substance of its own, purely using scripts to hook readers into farming likes, comments, and reposts to cheat algorithm weight (say, "like within 3 seconds of seeing this image and you'll surely strike it rich this year," or "type 888 in the comments if you want it and I'll DM you"). Many big accounts assume: "My account weight is high (high PageRank); the system usually lets my small edgy posts and small ads slide — a little 'type 1 to claim materials' should be fine, right?"
- **Truth the code confirms (known)**:
  Open the Grox PTOS safety label write code, `task_write_safety_post_annotations_result_sink.py` (`#L233-L248`), and you'll see a passage that's an "imperial sword" aimed at big accounts:
  For other ordinary spam violation categories, the code does first check `if not is_high_pagerank_or_grey_badge` (only issuing the ticket if not a high PageRank big account or grey badge). **Only when the large model judges your post to belong to one of the three interaction-cheating charges — ① `SpamEngagementBaiting` (engagement bait), ② `SpamEngagementFarming` (engagement farm volume-farming), ③ `SpamCardManipulation` (maliciously manipulating preview cards to cheat clicks) — does the code set `should_label_for_spam` directly to `true`, completely ignoring your high PageRank and grey-badge identity, and tags you `SpamHighRecall` on the spot just the same (removed directly from the stranger recommendation flow).** [54](#ref-54)
- **Blind spots the code can't show (to check)**:
  Which specific prompt sentences (Prompt) the PTOS large model uses in the back end to draw the line between "normally calling readers to discuss" and "malicious engagement bait" — that file (`prompts.py`) is not open-sourced.
- **Practical conclusion for creators (judgment)**:
  However many followers or however high your account weight, before "cheating likes and comments (Engagement Bait)" there is no death-proof golden ticket.
  Then how do you guide readers to comment at the end of a substantive piece, both safely and using the reply term well? The practice is **"ask concrete scenarios; don't demand mechanical passcodes"**:
  - ❌ **High-risk writing (mechanical passcode)**: "Want this OCR test script? Like and follow first, then type '666' in the comments; at 100 people I'll send it all at once!"
  - ✅ **Safe and high-weight writing (professional scenario discussion)**: "When your company processes Chinese invoices for automatic accounting, which errors more often — the tax-amount field or the buyer tax ID? If you've met stranger stamp-occlusion cases, post them in the comments; I'll pick representative samples into the next retest round."

### 43 Is carrying `#` hashtags on a post good or bad? Why at most no more than 4?

- **Plain language first (what this asks, what's the impact)**:
  Many creators arriving from Instagram, Xiaohongshu, or Douyin habitually stuff a dozen `#AI #tech #startup #side-hustle #substance-sharing` hashtags at the end of every post, feeling more tags means a bigger chance of being searched and recommended. The opposing old-hand camp warns: "The X algorithm hates `#` tags most — carry 1 tag and you're judged a spam account and demoted!" Whom to believe?
- **Truth the code confirms (known)**:
  In the public source we found three puzzle pieces about `#` tags that together give exactly the complete truth:
  1. **Carrying tags is absolutely not "zero value or certain demotion"**: in the Phoenix recommendation model's user historical behavior feature list (`history_id_lists.py` and `id_list_features.py`) there's a dedicated item named **`CLICK_HASHTAG` (the history of hashtags a user has clicked)** — showing the system, when computing a reader's interests, really does look at which `#` tags he usually clicks;
  2. **The code's hard cap for extracting tags is 4 (`MaxHashtagsPerTweet = 4`)**: in the `SimClusters` interest community's entity extractor, `TweetEntityExtractor.scala`, the constant **`MaxHashtagsPerTweet = 4`** is written dead — when extracting your post's tags, it **takes at most the first 4; from the 5th tag onward it discards them unread**;
  3. **Randomly stuffing tags really does have its own charge (`SpamHashTagAbuse`)**: in the PTOS safety review violation classifications (`state.py`) there's a dedicated item, **`SpamHashTagAbuse` (hashtag abuse)** — once the model judges you stuffed unrelated tags to ride heat, you're tagged `SpamHighRecall`, severing stranger recommendation traffic. [54](#ref-54)
- **Blind spots the code can't show (to check)**:
  The main scoring table holds no direct formula of "one tag added, a few points." As for the subtle traffic differences, across live recall channels, between carrying 1 precise tag and carrying none, there's no public live comparison report.
- **Practical conclusion for creators (judgment)**:
  These three code pieces together make our practical iron rule crystal clear: **an ordinary opinion or tutorial post can carry zero `#` tags at all (relying on the body's first 4,000 characters and the lead image, the Grox multimodal model fully understands what you're discussing). Only when your post genuinely belongs to a clear industry conference, open-source project, or a specific fixed column should you naturally place 1 to 2 (this extraction path reads at most the first 4; from the 5th it stops reading) precisely relevant `#` tags. Never pile a row of unrelated trending words at the end.**

### 44 When we publish a "long Post" or an "Article," which part of our text does the AI actually read?

- **Plain language first (what this asks, what's the impact)**:
  When you write an 8,000-character deep long piece (whether published as an ordinary long Post or in the Article column editor), the back-end Grox multimodal large model (`mm_emb`) must first understand what your article discusses to generate the "semantic vector (Semantic ID)" that matches you to interested stranger readers. What everyone cares about most: does the AI read my 8,000 characters head to tail, not a character dropped — or only the front section?
- **Truth the code confirms (known)**:
  In the public `grox/` directory source we verified three certain things:
  1. In the data mapper `post_mapper.py`, the program assigns the upstream-passed `post_metadata.text` to the post object's `full_text` field; if it's an Article, `article_metadata` additionally loads the **Article title (`title`)**, the cover image, and body embedded media (note: in the public `article_metadata` data structure, no separate field named `article_body` for the full body text is listed);
  2. In the new **V8.2 reader (`renderer_v82.py`)**, the program performs a strict Python character slice on `post.full_text` — **taking only the first `4000` characters (`MAX_POST_TEXT = 4000`)**; if Article metadata is present, it additionally **appends, in parallel, the Article title's first `200` characters (`MAX_ARTICLE_TITLE = 200`)**;
  3. We ran 10 function measured-verification items locally with in-memory objects: in V8.2, text changes beyond character 4,000 don't change the output text at all; the old **V5 reader (`renderer.py`)** has no such 4,000-character cut written. [87](#ref-87) [88](#ref-88)
- **Blind spots the code can't show (to check)**:
  In the live production environment, when the upstream Strato service faces a ten-thousand-character Article, does it stuff the Article's body into `post_metadata.text` and pass it over, or read the Article's full text through other unpublished internal channels? And which live models use V8.2 and which V5 — that upstream code is not open-sourced.
- **Practical conclusion for creators (judgment)**:
  To ensure that on any reader path the AI grasps your article's topic 100%, hold two writing iron rules dead: **① when writing a long Post, bring out the research subject, the core conclusion, and the key professional terms all within the first 4,000 characters; ② when writing an Article, make the first 200 characters of the Article title and the outer intro dense with substance — never title it something like *A Few Late-Night Thoughts*, an artsy hollow title that leaves the AI utterly baffled.**

### 45 A reader tapping a long Post's "Show more" on the timeline, versus tapping the card to open an "Article" — do they count as the same kind of reading in the algorithm's eyes?

- **Plain language first (what this asks, what's the impact)**:
  Many creators agonize over long Post vs. Article out of worry: "Reading a long Post takes one tap on 'Show more' to keep sliding down the timeline; reading an Article takes tapping the card into another reading page. These two open-and-read actions — when the algorithm computes that `0.4`-weight 'deep dwell after click (`CLICK_DWELL_TIME`)' and the `0.006` 'continuous dwell seconds (`DWELL_TIME`),' are they treated the same?"
- **Truth the code confirms (known)**:
  Open the communication protocol definition file `recsys.proto` and the feature mapping file `constants.py` and you'll see the system splits these actions very finely at the protocol layer: an ordinary post click is number `29` (`CLIENT_TWEET_CLICK`); tapping a long post's "Show more" is the independent number `45` (`CLIENT_TWEET_SHOW_MORE_EXPAND`); entering the detail page impression is `72`; detail-page dwell is `103`. And page types separately define `PAGE_ARTICLE` (Article body page) and `PAGE_ARTICLE_PREVIEW` (preview page). Additionally, in the server-side Rust utility code (`util.rs`) you can clearly see code converting continuous dwell time `DWELL_TIME` from milliseconds divided by 1000 into seconds. [90](#ref-90) [91](#ref-91) [98](#ref-98)
- **Blind spots the code can't show (to check)**:
  From the mobile client capturing a reader "opening the Article page" or "tapping Show more," to the upstream log aggregation service computing duration into the two training data slots `DWELL_TIME` and `CLICK_DWELL_TIME` (threshold `10.0`) — the client timing start-stop rules and upstream aggregation code in between are not in the public repo (the officials state in `phoenix/README.md` that production data sources and internal telemetry are not open-sourced).
- **Practical conclusion for creators (judgment)**:
  Although how the client layer attributes timing isn't open-sourced, in the final value scoring model (`phoenix_scores.rs`) there's neither a privilege score set separately for "Show more" nor one for "opening an Article" — what it uniformly recognizes in the end is the predicted reading dwell and interaction probabilities. So we don't gamble on "which button has the timer advantage"; we choose the format by content structure.

### 46 Can converting the same three-thousand-character piece from a "long Post" to an "Article" multiply reach 5.7 times by the format itself alone?

- **Plain language first (what this asks, what's the impact)**:
  A very hot chart circulated online earlier, claiming "in 2026, Articles published on X have a median view count **5.7 times** ordinary posts'!" So many creators, long or short — even a thousand characters — force everything into the Article editor, imagining that donning the Article shell earns an automatic 5.7x traffic bonus from the algorithm.
- **Truth the code confirms (known)**:
  First, we searched **103 source files** in `Home Mixer` and `VM Ranker` touching candidate recall, preliminary filtering, and final scoring. In the final scoring input `CandidateScoringInputs` (`inputs.rs`) and the weighting function (`scoring.rs`), **there is no `is_article` field at all — no code anywhere for "if it's an Article, multiply by 5.7 or add bonus points."** Second, we checked the "5.7 times" data's original source (the third-party firm NotPeople's August sample report) and found that behind the 42 Articles it counted, **each Article was accompanied, on average, by 6 to 28 ordinary posts (843 traffic-driving posts in total) doing excerpt promotion and traffic-driving for it** — and the comparison baseline used was exactly those brief daily traffic-driving posts. [94](#ref-94) [96](#ref-96)
- **Blind spots the code can't show (to check)**:
  Whether the live deep-learning model, after reading content features, develops a subtle implicit prediction preference for candidates with Article title structure, or whether unpublished small-traffic live experiments exist, cannot be fully excluded from static code alone.
- **Practical conclusion for creators (judgment)**:
  The so-called "5.7x reach" is in essence the combined operations result hammered out by **"1 carefully polished flagship Article + a matrix of a dozen-plus illustrated short posts driving traffic in succession"** — absolutely not a 5.7x format multiplier written dead in the algorithm code. A single question completable in one breath within three or four thousand characters: publish a **long Post** directly. A multi-chapter handbook of ten thousand characters: publish an **Article — and be sure to imitate those masters, separately publishing one or more guide Posts with core results images to quote and promote it.**

### 47 What is the Article's "64-like image-pull threshold (`is_high_fav`)"? Why do the V5 and V8.2 readers read images differently?

- **Plain language first (what this asks, what's the impact)**:
  In Chapter 17 of the body we unpacked a truth that dawned on countless Article creators: when you publish an image-rich column article directly in the Article editor, why does it sometimes feel the AI never understood your Article's cover image and body illustrations at all? How do the "porter 64-like threshold (`is_high_fav`)" and the "V5 / V8.2 reader image-picking difference" behind it work together?
- **Truth the code confirms (known)**:
  In the `grox/` directory source, an image entering the AI large model passes two gates:
  1. **Gate one (the porter `MediaLoader`'s 64-like threshold)**: in `grox/core/data_loaders/media_loader.py` (`#L130-L170` and `#L293-L303`), the porter pulling image data from the database, to save compute, sets a judgment condition named **`is_high_fav` (high-like post judgment)**, whose public default threshold in `config.py` is **64 likes (`deluxe_fav_count_threshold = 64`)**. On this hauling path, only when the post satisfies `is_high_fav` (64 likes) and the other conditions does the program enter the branch dedicated to pulling the **Article cover image (`cover_media`) and Article body embedded images (`article_metadata.media`)**. (Note: this governs only this media-pull path; it never means an Article needs 64 likes to qualify for recommendation.)
  2. **Gate two (the two reader generations' image-picking difference)**: we called both generations' original functions locally for a measured test — the old **V5 (`renderer.py`)** reads images in the order "Article cover image → ordinary post attachments → Article embedded images" (with the budget set to 1 image, it takes only the Article cover image); the new **V8.2 (`renderer_v82.py`)**'s image-picking function `_collect_post_media` **looks only in the "ordinary post image attachment slot (`post.media`)" — it writes no code at all to read the Article's dedicated cover or embedded images.** If images live only in the Article editor, the image list the V8.2 function returns is directly **empty (0 images)**. [88](#ref-88) [89](#ref-89)
- **Blind spots the code can't show (to check)**:
  In the live production environment, whether the upstream data service, before calling V8.2, copies the Article cover image into the `post.media` field, and the concrete proportions in which live downstream models consume V5 vectors vs. V8.2 vectors, are not disclosed in the public repo.
- **Practical conclusion for creators (judgment)**:
  Whether or not live upstream does extra copying, with these **3 practical moves** we control everything controllable:
  ① **Pack the Article's title (first 200 characters) with core keywords** (ensuring that before 64 likes, or when V8.2 reads no image, the AI matches the audience precisely from the title alone);
  ② **Make the Article's cover image a core information image** (ensuring the first in line read, on the V5 path or after 64 likes, is the substance);
  ③ **After publishing the Article, immediately publish a separate "guide long Post," hanging the 1 most core results-comparison image directly on that guide Post as an "ordinary image attachment (`post.media`)"** — so from like 0 onward you bypass the 64-like threshold, and V8.2 consumes your guide's first 4,000 characters and lead image completely clean.

### 48 Why must you never frequently pull an Article down for edits after publishing? What does the `ArticleTweetContent` rule intercept?

- **Plain language first (what this asks, what's the impact)**:
  Many perfectionist creators, after publishing a long Article, spot a punctuation mark or an awkward phrase and tap into the editor to fix it. But in X's product design, editing an already-published Article first pulls the Article down from "published (`Published`)" into an unpublished draft state; only after you finish editing and click publish again does it recover. In the tens of minutes of that pulled-down editing, what happens at the recommendation system's security gates?
- **Truth the code confirms (known)**:
  In the visibility filtering system `visibility-filtering/rules/tweet_rules.rs` (`#L247-L252`) and `levels.rs` there's a hard rule dedicated to Articles named **`ArticleTweetContent`**: as long as a post is associated with an Article whose current status is **not `Published` (say, in `Draft`, `SoftDeleted`, or missing status)**, at the `TimelineHomeHydration` safety level it **directly executes filter removal (Drop)**. Additionally, for a paywalled Article set to subscribers-only, the general filter `IneligibleSubscriptionFilter` intercepts unpaid non-subscriber readers, and the media interface (`article_client.rs`) also hides images from those without permission. [92](#ref-92) [93](#ref-93)
- **Blind spots the code can't show (to check)**:
  At the second you click "Republish" live, how many seconds or minutes the distributed cache nodes need to sync the status fully back to `Published` depends on live cache configuration.
- **Practical conclusion for creators (judgment)**:
  **Never frequently pull an Article down for slow edits during its post-publication recommendation window.** Because in that "unpublished gap window" while you edit, once the `ArticleTweetContent` rule triggers, your post is intercepted and hidden as an unpublished draft. Preview and check code blocks, formulas, and typos carefully in the draft box before one formal publication; if you must edit, the moment you finish, confirm at once that it's back in `Published` status.

### 49 Can the "Views" creators see in the back end judge how many people truly read my long piece or Article to the end?

- **Plain language first (what this asks, what's the impact)**:
  After publishing a long Post or Article, everyone loves staring at the "view count (Views — say, 50,000 views)" in the post's bottom-right corner. Many assume: "50,000 Views displayed means 50,000 readers tapped into my long piece and read it to the end!" If you use this number for content review, what pit do you fall into?
- **Truth the code confirms (known)**:
  By the definition in X's official help documentation (`View counts`) and the field distinctions in the source (`engagement_counts_hydrator.rs` and `recsys_batch.py`): the front-end publicly displayed `Views` (corresponding to the general `view_count`) is an extremely broad exposure count — **a reader merely swiping hastily past your post on the timeline (without even tapping "Show more," gone in 1 second) still counts 1 View; the same reader scrolling past twice, morning and evening, counts 2 Views; others tapping into your profile, finding it in search, even you opening your own post — all repeatedly accumulate into these Views.** It is neither a "deduplicated distinct reader count," nor the internal `view_count_on_home` (pure home-feed recommendation impressions) the cold-start check uses, nor the `DWELL_TIME` (reading dwell seconds) or `CLIENT_TWEET_RECAP_DWELLED` (deep reading mark) used inside model training. [59](#ref-59) [91](#ref-91)
- **Blind spots the code can't show (to check)**:
  X's creator back end (Analytics) does not currently open internal model training metrics like "one long piece's average reading seconds," "scroll-to-bottom completion percentage," or "`CLICK_DWELL_TIME` qualifier counts" to ordinary creators.
- **Practical conclusion for creators (judgment)**:
  In day-to-day content review and format comparison, **never take the superficially inflated total view count (Views) as "the number of people who read the article."** To judge whether a deep long piece was truly read in and moved its target audience, watch three more concrete metrics instead: **① the bookmark count (Bookmarks — readers found it useful and stored it for repeated checking); ② the copy-link count (readers copied the link away to send to others — this term's coefficient is the table's largest, but the coefficient multiplies a predicted probability and can't be converted into points); ③ net new followers after profile visits**. Watch these three numbers because they show readers truly used it, stored it, and endorsed you. As for how far the content can be pushed, the code promises nothing.

## Research Scope and Verification Record

This handbook's final revision date is **October 29, 2026 (Los Angeles time)**. The full text integrates the public algorithm repo source teardown, a 23-page technical verification report, and the 7th revision draft:
- **Core code baseline**: the main report's baseline is fixed at Git commit `5ed796374ea48ee26058aab66ab10c266bea2bef` (2026-10-28 UTC), and October's parameter and architecture changes are traced and checked through to the newest public commit `606b254b45be798bfaecfa8c23f5a9c51bc8000c` (2026-10-29 UTC). Key cross-day commits in the text mark both UTC time and Los Angeles local time (PDT); official update-note dates are kept strictly as in the `README.md` original.
- **Historical parameter snapshot checks**: for October's weight changes, we compared, along the same file `home-mixer/params/param.rs`, **20 historical commit snapshots** one by one, presenting the sameness and differences of `Home Mixer`'s and `VM Ranker`'s defaults under the same commit side by side. For `606b254`'s visibility rule refactor, we expanded all **14 rule-list and field groups** before and after the refactor for a consistency check, confirming entrance rules and execution order are fully identical.
- **Local code rewrites and function measured verification**:
  1. The original technical research equivalently rewrote the ranking and filtering core logic in Python for verification, passing **143 assertion tests (Assertions)** in total, covering consistency checks across **26 source files**;
  2. In the writing stage, for same-author candidate counting, long/short post interleaving, conversation card assembly (`convo_marshaller.rs`), and post-hoc conversation deduplication, an additional **22 local assertion tests** were completed (checking 8 source files); for repost and dwell weighting computations, **14 weighted assertion tests** were completed (checking 4 source files);
  3. For CREAD dwell time reconstruction and the `CLICK_DWELL_TIME` binary threshold (inputs `9, 10, 10.0001, 20`), the original Python / JAX pure functions were called directly on a local CPU to verify the boundaries;
  4. For the **long Post vs. Article special topic**, a bounded search covering **103 files** was run over `Home Mixer`'s `sources`, `filters`, `scorers`, `params`, `candidate_pipeline`, and the visibility and behavior protocol interfaces; and for the **V5 and V8.2 content-understanding processors**, lightweight in-memory object tests were written, calling the original functions directly to complete **10 input-output measured checks** (all passed — verifying the 4,000-character truncation, the 200-character Article title's coexistence, and the V5/V8.2 difference in fetching Article covers and embedded images; comparing the 14 content-path files between the two commits, 12 files' binary blobs are fully identical, and the other 2 only add an institutional badge field).
- **Rigor statement**: the local assertions and function checks above are all used to 100% confirm the public source's mathematical logic and branch conditions. We never simply add up local assertion counts from different stages and inflate them into an "official live integrated test," and, lacking live feature switches, un-open-sourced front-end telemetry, and unpublished model weights, we fabricate no so-called "official recommendation total score" or "guaranteed reach multiple" for any single post. The invoice communication, meeting-tool tests, Chinese invoice OCR reviews, and rental handover checklist in the text are all illustrative scenarios and worked examples to aid understanding — not records of the author's own measured experience.


## References

Code links are pinned to the commits used in the text; third-party articles are the objects being checked, and technical conclusions rest on the corresponding source code and official materials.

<a id="ref-1"></a>

**[1] V8.2's first usable media and video frames.**

- [Media selection returns directly](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/mm_emb/renderer_v82.py#L285-L314)
- [Merging main-post and quoted media](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/mm_emb/renderer_v82.py#L140-L178)
- [Actually sent to the embedding service](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/mm_emb/embedder_v82.py#L68-L92)
- [The registered processing plan](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/mm_emb/plan_post_embedding_v82.py#L14-L31)
- [Other renderers process image by image](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/mm_emb/renderer.py#L76-L92)

<a id="ref-2"></a>

**[2] The new weighted scoring and author diversity.**

- [Weight-misreading notes and fusion scoring](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/xai-value-model/scoring.rs#L28-L139)
- [Author counting and multipliers](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/xai-value-model/scoring.rs#L183-L237)

<a id="ref-3"></a>

**[3] Hootsuite's general post frequency advice, April 18, 2025.**

- [The original context of two or three posts a day](https://blog.hootsuite.com/how-often-to-post-on-social-media/)

<a id="ref-4"></a>

**[4] The X Algorithm Playbook frequency reading, as checked.**

- [A single reply turned into daily post counts and thread slot claims](https://tang-vu.github.io/x-algorithm-playbook/rules/04-timing-frequency.html)

<a id="ref-5"></a>

**[5] Model inputs and the recommendation flow.**

- [Overall flow](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/README.md)
- [Phoenix model documentation](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/README.md)

<a id="ref-6"></a>

**[6] X's official Longer Post and Articles definitions and distribution advice.**

- [Longer posts](https://help.x.com/en/using-x/types-of-posts)
- [Articles: short previews, excerpts, and thread distribution](https://help.x.com/en/using-x/articles)

<a id="ref-7"></a>

**[7] The Gridlok original, as checked, April 3, 2026.**

- [The 150x, external link, and Premium claims](https://gridlok.co/blog/x-open-sourced-its-algorithm-what-the-phoenix-source-code-actually-says/)

<a id="ref-8"></a>

**[8] The SocialPilot original, as checked, page marked September 2026.**

- [Daily author quota and external link claims](https://www.socialpilot.co/blog/twitter-algorithm)

<a id="ref-9"></a>

**[9] The Bangerkit original, as checked, October 8, 2026.**

- [Personalized weighting and cold-start conditions](https://bangerkit.io/guides/x-algorithm-2026)

<a id="ref-10"></a>

**[10] X's official Premium documentation.**

- [Reply ranking priority across plans](https://help.x.com/en/using-x/x-premium)

<a id="ref-11"></a>

**[11] Public update dates, pinned commits, and time zones.**

- [The public commit of October 28 UTC](https://github.com/xai-org/x-algorithm/commit/5ed796374ea48ee26058aab66ab10c266bea2bef)
- [The public commit of October 29 UTC](https://github.com/xai-org/x-algorithm/commit/606b254b45be798bfaecfa8c23f5a9c51bc8000c)
- [The October 8 and October 13 updates listed officially](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/README.md#L32-L44)

<a id="ref-12"></a>

**[12] How public defaults are synced, and the Home Mixer vs. VM Ranker usage paths.**

- [Cron sync notes for the main formal defaults](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/README.md#L428-L434)
- [Sync time in the Home Mixer parameter file](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/params/param.rs#L1)
- [Local weighting, cold start, and RPC fallback](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/scorers/vm_ranker.rs#L59-L135)
- [The VM request includes heads, cached scores, and compute\_value\_model](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/scorers/vm_ranker_request.rs#L26-L68)
- [VM Ranker takes coefficients from its own params](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/vm-ranker/scoring/value_model.rs#L71-L118)
- [Handling when a cached weighted score exists](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/xai-value-model/scoring.rs#L282-L327)

<a id="ref-13"></a>

**[13] CREAD's multi-threshold training and dwell time reconstruction.**

- [The official October 8 update note](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/README.md#L42-L44)
- [The home\_direct\_packed config enabling CREAD](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/configs/xrecsys.py#L260-L282)
- [Non-Gallery and Gallery CREAD ranges and loss settings](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/configs/xrecsys.py#L784-L810)
- [Generating log-spaced thresholds](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/models/loss_recsys.py#L110-L125)
- [Multi-threshold labels, classification, and time reconstruction loss](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/models/loss_recsys.py#L128-L187)
- [Reconstructing time as probability times threshold spacing](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/models/recsys_model.py#L3363-L3389)
- [Using the CREAD loss in training](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/models/recsys_model.py#L4815-L4859)

<a id="ref-14"></a>

**[14] The click-dwell binary target, the ld recall branch, and differing signal definitions.**

- [Click dwell coefficient 0.4](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/params/param.rs#L483-L488)
- [CLICK\_DWELL\_TIME's threshold-10 binary config](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/configs/xrecsys.py#L776-L783)
- [Strictly-greater threshold and sigmoid probability](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/models/loss_recsys.py#L190-L212)
- [The click\_dwell\_time field Home Mixer uses](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/xai-value-model/scoring.rs#L108-L113)
- [The candidate read entrance for Phoenix scores](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/scorers/phoenix_scorer.rs#L131-L141)
- [ld positives and multi-branch config](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/configs/xrecsys_two_tower.py#L280-L304)
- [The home and ld named configs](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/configs/xrecsys_two_tower.py#L514-L539)
- [Recall inference branch weights](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/models/recsys_two_tower_model.py#L2293-L2323)

<a id="ref-15"></a>

**[15] The October history of interaction coefficients along the same path.**

- [October 9 defaults: Favorite, Video open, dwell, and more](https://github.com/xai-org/x-algorithm/blob/cb45b5501423126adfc508052116c2d67c0e3fec/home-mixer/params/param.rs#L314-L419)
- [October 13 Favorite=0.6](https://github.com/xai-org/x-algorithm/blob/e1a0375a903899984545c663bb0bccb3cdcdf046/home-mixer/params/param.rs#L320)
- [October 13 Video open=0.02](https://github.com/xai-org/x-algorithm/blob/e1a0375a903899984545c663bb0bccb3cdcdf046/home-mixer/params/param.rs#L341-L346)
- [October 13 continuous dwell coefficient rises to 0.006](https://github.com/xai-org/x-algorithm/blob/e1a0375a903899984545c663bb0bccb3cdcdf046/home-mixer/params/param.rs#L401-L406)
- [October 14 Favorite=0.66](https://github.com/xai-org/x-algorithm/blob/17c96bf346df3d62b90f1bb01830d432dba74485/home-mixer/params/param.rs#L320)
- [October 14 Not interested=-52.272](https://github.com/xai-org/x-algorithm/blob/17c96bf346df3d62b90f1bb01830d432dba74485/home-mixer/params/param.rs#L414-L419)
- [The same coefficient group in the October 29 public snapshot](https://github.com/xai-org/x-algorithm/blob/606b254b45be798bfaecfa8c23f5a9c51bc8000c/home-mixer/params/param.rs#L396-L513)

<a id="ref-16"></a>

**[16] FairShare preliminary filtering added and enabled in October.**

- [The filter added on October 21](https://github.com/xai-org/x-algorithm/blob/7f2ca2b914cadac591ea7fceec0c477e473d3dee/home-mixer/filters/fair_share_ranking_filter.rs#L1-L109)
- [October 21: 2800 slots and switch=false](https://github.com/xai-org/x-algorithm/blob/7f2ca2b914cadac591ea7fceec0c477e473d3dee/home-mixer/params/param.rs#L1188-L1199)
- [October 22: switch=true](https://github.com/xai-org/x-algorithm/blob/989fb91254d461bf4b9df53fb12d5c9a61c2b354/home-mixer/params/param.rs#L1200-L1211)
- [The October 21 public commit](https://github.com/xai-org/x-algorithm/commit/7f2ca2b914cadac591ea7fceec0c477e473d3dee)
- [The October 22 public commit](https://github.com/xai-org/x-algorithm/commit/989fb91254d461bf4b9df53fb12d5c9a61c2b354)

<a id="ref-17"></a>

**[17] New features, switches, and video paths in the October 28/29 snapshots.**

- [Page logging, decode, and exploration switches added in 5ed7963](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/params/param.rs#L309-L365)
- [Page logging default in 606b254](https://github.com/xai-org/x-algorithm/blob/606b254b45be798bfaecfa8c23f5a9c51bc8000c/home-mixer/params/param.rs#L309-L365)
- [The Carousel switch still false in 606b254](https://github.com/xai-org/x-algorithm/blob/606b254b45be798bfaecfa8c23f5a9c51bc8000c/home-mixer/params/param.rs#L1191-L1196)
- [The new open-times-immersive-dwell coefficient still zero in 606b254](https://github.com/xai-org/x-algorithm/blob/606b254b45be798bfaecfa8c23f5a9c51bc8000c/home-mixer/params/param.rs#L1245-L1269)
- [The new Carousel formula in 606b254](https://github.com/xai-org/x-algorithm/blob/606b254b45be798bfaecfa8c23f5a9c51bc8000c/home-mixer/util/video_carousel.rs#L178-L209)
- [The immersive\_page\_rl\_cread config added in 606b254](https://github.com/xai-org/x-algorithm/blob/606b254b45be798bfaecfa8c23f5a9c51bc8000c/phoenix/xrex/configs/xrecsys.py#L421-L432)
- [Carousel video eligibility and portrait ratio](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/util/video_carousel.rs#L151-L160)
- [VQV's strict video length threshold](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/util/candidates_util.rs#L19-L44)

<a id="ref-18"></a>

**[18] The conversation module's and ancestor posts' actual selection.**

- [Assembling root post, middle ancestors, and current post](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/util/urt/convo_marshaller.rs#L12-L63)
- [Thunder carries only parent and root](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/sources/thunder_source.rs#L84-L95)
- [Phoenix reply ancestor data](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/candidate_hydrators/phoenix_reply_ancestors_hydrator.rs#L79-L97)
- [Assembling the timeline after For You ranking](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/for_you_server.rs#L71-L88)

<a id="ref-19"></a>

**[19] Thread deduplication happens after scoring.**

- [Keeping the highest-scoring candidate per conversation](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/filters/dedup_conversation_filter.rs#L14-L48)
- [Scoring, selection, then post filters](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/candidate-pipeline/candidate_pipeline.rs#L129-L148)
- [The Phoenix flow's scorer and post-hoc conversation dedup](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/candidate_pipeline/phoenix_candidate_pipeline.rs#L466-L507)
- [Per-candidate post and author ID delivery](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/scorers/vm_ranker_request.rs#L53-L67)

<a id="ref-20"></a>

**[20] The seen filter also checks the parent post and the reposted original.**

- [Composition of the related IDs](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/util/candidates_util.rs#L13-L17)
- [The seen-data judgment](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/filters/previously_seen_posts_filter.rs#L16-L31)
- [Served data is a separate check](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/filters/previously_served_posts_filter.rs#L14-L30)
- [Actually installed in the candidate pipeline](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/candidate_pipeline/phoenix_candidate_pipeline.rs#L420-L444)

<a id="ref-21"></a>

**[21] Public default weights and author diversity.**

- [VM Ranker parameters](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/vm-ranker/params.rs)
- [Home Mixer parameters](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/params/param.rs#L396-L513)

<a id="ref-22"></a>

**[22] Time windows and specific source caps are not daily posting quotas.**

- [PopularPosts: per-author selection within ~24 hours](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/util/popular_posts.rs#L27-L85)
- [The PopularPosts source's enable conditions](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/sources/popular_posts_source.rs#L20-L35)
- [Post age filter](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/filters/age_filter.rs)
- [Excluding seen content by reader and post ID](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/filters/previously_seen_posts_filter.rs)

<a id="ref-23"></a>

**[23] X's official thread display documentation.**

- [Followed authors: two or three connected; four or more expanded](https://help.x.com/en/using-x/create-a-thread)

<a id="ref-24"></a>

**[24] The reply candidate filter's scope and switch.**

- [Filter conditions](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/filters/oon_retweet_reply_filter.rs#L15-L27)
- [Switch default](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/params/param.rs#L67-L78)
- [The candidate pipeline it belongs to](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/candidate_pipeline/phoenix_candidate_pipeline.rs#L420-L429)

<a id="ref-25"></a>

**[25] Hootsuite's long single post vs. thread mini-experiment, January 31, 2024.**

- [Six pieces of content: method and results](https://blog.hootsuite.com/experiment-x-threads-vs-longform-posts/)

<a id="ref-26"></a>

**[26] The 2023 official Heavy Ranker document.**

- [Date, prediction definitions, and the original weights](https://github.com/twitter/the-algorithm-ml/blob/main/projects/home/recap/README.md)

<a id="ref-27"></a>

**[27] The current two coefficient sets, probability multiplication, and mutual-follow applicability conditions.**

- [Home Mixer prediction coefficients and official reading notes](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/params/param.rs#L367-L513)
- [VM Ranker's same-named defaults](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/vm-ranker/params.rs#L3-L155)
- [Prediction-term multiplication and summation](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/xai-value-model/scoring.rs#L57-L139)
- [Subsequent translation of positive and negative scores](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/xai-value-model/scoring.rs#L161-L179)
- [A mutual-follow candidate must be neither reply nor repost](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/xai-value-model/inputs.rs#L19-L22)
- [General reply coefficient plus mutual-follow boost](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/xai-value-model/weights.rs#L84-L99)

<a id="ref-28"></a>

**[28] Dwell events and post-click reading are different targets.**

- [Dwelled and NotDwelled labels](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/data/recsys/constants.py#L68-L76)
- [Dwell targets enabled by home\_direct\_packed](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/configs/xrecsys.py#L260-L282)
- [Click dwell's threshold-10 binary target and other dwell targets](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/configs/xrecsys.py#L755-L810)
- [Binary outputs keep probabilities at inference](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/models/recsys_model.py#L532-L553)
- [The service returns model outputs](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/inference/model_runner.py#L4205-L4214)

<a id="ref-29"></a>

**[29] An actual repost adds a social-graph recall path.**

- [Reposts indexed by reposter](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/thunder/posts/post_store.rs#L156-L195)
- [Recalling the original, reposts, and other candidates](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/thunder/posts/post_store.rs#L250-L282)
- [Fetching candidates from Thunder by the reader's follow list](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/sources/thunder_source.rs#L27-L40)
- [Reposts keep the original-post relationship](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/sources/thunder_source.rs#L97-L114)
- [X's official repost documentation](https://help.x.com/en/using-x/repost-faqs)

<a id="ref-30"></a>

**[30] The original author vs. reposter's follower circles, the reply exception, and ancillary content.**

- [Judging in-network by candidate author](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/candidate_hydrators/in_network_candidate_hydrator.rs#L20-L35)
- [Different conditions for OON reposts and replies](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/filters/oon_retweet_reply_filter.rs#L15-L27)
- [The public default of the Phoenix OON replies switch](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/params/param.rs#L67-L78)
- [The reply exception's served types and ancestor completion](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/candidate_hydrators/phoenix_reply_ancestors_hydrator.rs#L11-L29)
- [Reposts placed in a secondary index by reposter](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/thunder/posts/post_store.rs#L156-L195)
- [Fetching candidates by the reader's follow list](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/sources/thunder_source.rs#L27-L40)
- [Preserving reply ancestors and repost source IDs](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/sources/thunder_source.rs#L84-L113)
- [Thunder's conditions for replies at different depths](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/thunder/posts/post_store.rs#L341-L364)
- [The conversation module assembles root, ancestors, and focal](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/util/urt/convo_marshaller.rs#L20-L68)
- [Visibility handling of quotes, reposts, and conversation ancillary content](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/candidate_hydrators/vf_candidate_hydrator.rs#L70-L169)
- [The different sources in For You's top-level assembly](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/candidate_pipeline/for_you_candidate_pipeline.rs#L219-L237)
- [PushToHome builds data for the request-specified post](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/sources/push_to_home_source.rs#L18-L65)

<a id="ref-31"></a>

**[31] Candidate recall reads the current reader's history.**

- [Reader behavior sequence](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/query_hydrators/retrieval_sequence_query_hydrator.rs#L30-L64)
- [Phoenix recall request](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/sources/phoenix_source.rs#L104-L141)
- [Candidate representations of post semantics and author](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/models/recsys_two_tower_model.py#L1799-L1838)
- [The official Semantic ID documentation](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/README.md#L101-L121)

<a id="ref-32"></a>

**[32] The long-dwell target enters recall training and inference.**

- [The October 13 update note](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/README.md#L38-L40)
- [ld positives and multi-branch config](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/configs/xrecsys_two_tower.py#L280-L296)
- [Registration of the named configs](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/configs/xrecsys_two_tower.py#L514-L539)
- [Inference uses branch weights](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/models/recsys_two_tower_model.py#L2293-L2323)
- [The service calls the model](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/inference/model_runner.py#L5552-L5568)

<a id="ref-33"></a>

**[33] Read-to-the-end recall's public timing, training branches, and scope.**

- [The update officially marked October 13](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/README.md#L38-L40)
- [The public commit where the October 28 README addendum sits](https://github.com/xai-org/x-algorithm/commit/5ed796374ea48ee26058aab66ab10c266bea2bef)
- [The public commit adding ld on October 13](https://github.com/xai-org/x-algorithm/commit/e1a0375a903899984545c663bb0bccb3cdcdf046)
- [ld positives and three-branch config as published October 13](https://github.com/xai-org/x-algorithm/blob/e1a0375a903899984545c663bb0bccb3cdcdf046/phoenix/xrex/configs/xrecsys_two_tower.py#L280-L296)
- [The October 8 config, not yet containing ld](https://github.com/xai-org/x-algorithm/blob/35650fb89f3b14dc6234312535f642779d891d88/phoenix/xrex/configs/xrecsys_two_tower.py#L280-L296)
- [Existing named configs' branches, weights, and HOME datasets](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/configs/xrecsys_two_tower.py#L280-L312)
- [The combined and home-only named configs](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/configs/xrecsys_two_tower.py#L514-L539)
- [Computing each branch's training loss by action positives and negatives](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/models/recsys_two_tower_model.py#L2711-L2739)
- [Using branch weights at inference](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/models/recsys_two_tower_model.py#L2293-L2323)
- [The model reads action marks rather than judging full-text completion itself](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/models/recsys_two_tower_model.py#L621-L647)
- [ld positives and weight defaults in the generic model settings](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/models/recsys_two_tower_model.py#L2897-L2924)
- [The cold post pool filters by post likes and views](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/data/cold_pool_filter.py#L26-L63)

<a id="ref-34"></a>

**[34] Index windows and recall datasets: production data does not equal delivered reach.**

- [Index windows in Main and Sid modes](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix-rankall/src/config/mod.rs#L168-L224)
- [Routing by index name to the corresponding window](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix-rankall/src/store/base.rs#L1195-L1220)
- [HOME, HOME\_COLD, HOME\_HOT all reference 1fav\_1day](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/data/retrieval_dataset.py#L247-L282)
- [HOME\_COLD and HOME\_HOT split the same-source data](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/data/retrieval_dataset.py#L437-L479)
- [The Phoenix source's enable conditions and actual recall request](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/sources/phoenix_source.rs#L104-L149)
- [After recall: filtering, scoring, and selection still required](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/candidate_pipeline/phoenix_candidate_pipeline.rs#L420-L507)

<a id="ref-35"></a>

**[35] Cold-start eligibility, experiment grouping, and data boundaries.**

- [Defaults: two hours, Home impressions, followers, and slot](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/params/param.rs#L589-L661)
- [The viewer arm judgment](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/scorers/author_cold_start.rs#L81-L88)
- [Non-reply, non-repost, follower cap, and author corpus](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/scorers/author_cold_start.rs#L188-L233)
- [Selection only when all eligibility conditions hold](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/scorers/author_cold_start.rs#L285-L309)
- [Topic requests and the cold-start switch](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/scorers/author_cold_start.rs#L378-L420)
- [The October 9 snapshot already has the same main thresholds](https://github.com/xai-org/x-algorithm/blob/cb45b5501423126adfc508052116c2d67c0e3fec/home-mixer/params/param.rs#L477-L544)
- [Home counts and general view counts in separate columns](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/candidate_hydrators/engagement_counts_hydrator.rs#L16-L48)
- [The count cache TTL is sixty seconds](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/candidate_hydrators/engagement_counts_hydrator.rs#L59-L65)

<a id="ref-36"></a>

**[36] Cold start's Beta sampling and personalized second selection.**

- [Priors, sample count, and impression-ratio defaults](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/params/param.rs#L633-L661)
- [Highest-score selection and Beta parameters](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/scorers/author_cold_start.rs#L236-L255)
- [Taking the sampled top k, then selecting one by score](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/scorers/author_cold_start.rs#L257-L282)
- [The sampling switch, the single selected candidate, and score promotion](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/scorers/author_cold_start.rs#L311-L333)

<a id="ref-37"></a>

**[37] Like-event index update thresholds, throttling, and age boundaries.**

- [Event counts, the cache branch, and ignoring non-Favorite events](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix-rankall-strato/columns/favoriteEventProcessor.strato#L96-L156)
- [The next power-of-two threshold and update-time writes](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix-rankall-strato/columns/favoriteEventProcessor.strato#L14-L57)
- [The 49-hour post age, 48-hour update span, one-minute interval, and count cap](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix-rankall-strato/lib/eventProcessing.strato#L28-L70)
- [Favorite index events sent to the candidate processor](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix-rankall-strato/stream_forwarders/favoritePhoenixIndexingEventForwarder.strato#L3-L17)

<a id="ref-38"></a>

**[38] The actual production conditions for 1fav, 32fav, search, and reply indexes.**

- [search\_unfiltered, 32fav, and the 1fav count race](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix-rankall-strato/columns/phoenix_rank_all/phoenixRankAllCandidateProcessor.strato#L46-L98)
- [The reply 1fav\_reply and 32fav\_reply indexes](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix-rankall-strato/columns/phoenix_rank_all/phoenixRankAllCandidateProcessor.strato#L277-L298)
- [The post\_creation index at creation time](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix-rankall-strato/columns/phoenix_rank_all/phoenixRankAllCandidateProcessor.strato#L301-L309)
- [Re-reading interaction counts and author data](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix-rankall-strato/columns/phoenix_rank_all/phoenixRankAllCandidateProcessor.strato#L437-L455)
- [The split order for source, community, repost, reply, and visibility](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix-rankall-strato/columns/phoenix_rank_all/phoenixRankAllCandidateProcessor.strato#L470-L529)

<a id="ref-39"></a>

**[39] Whom the 48 hours actually checks: candidate ID, source window, and the reposted original.**

- [The 48-hour constant](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/params/config.rs#L38-L43)
- [AgeFilter computes age by candidate ID and uses less-than-or-equal](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/filters/age_filter.rs#L16-L31)
- [The candidate pipeline containing the age filter](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/candidate_pipeline/phoenix_candidate_pipeline.rs#L420-L444)
- [The repost's own ID and the original's ID in separate columns](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/sources/thunder_source.rs#L103-L113)
- [Core data hydration does not swap the candidate ID for the original ID](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/candidate_hydrators/core_data_candidate_hydrator.rs#L141-L149)
- [Deduplicating original and repost by original ID](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/filters/retweet_deduplication_filter.rs#L19-L29)
- [The original and parent IDs used by the seen check](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/util/candidates_util.rs#L13-L17)
- [The seen candidate judgment](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/filters/previously_seen_posts_filter.rs#L16-L31)
- [The served candidate judgment](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/filters/previously_served_posts_filter.rs#L14-L30)
- [Visibility handling of reposted originals and other ancillary content](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/candidate_hydrators/vf_candidate_hydrator.rs#L70-L169)
- [For You's top-level sources and their filters](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/candidate_pipeline/for_you_candidate_pipeline.rs#L219-L237)
- [The PushToHome source's enabling and data building](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/sources/push_to_home_source.rs#L18-L65)

<a id="ref-40"></a>

**[40] Bookmarks and similar-content follow-up recall.**

- [Reading bookmarks and other interactions](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/query_hydrators/explicit_engagement_signals_query_hydrator.rs#L31-L105)
- [Public switches and per-class data caps](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/params/param.rs#L716-L732)
- [The SimClusters enable default](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/params/param.rs#L48-L53)
- [Seed data and candidate queries](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/sources/simclusters_source.rs#L213-L329)

<a id="ref-41"></a>

**[41] Bookmarks' three positions: fusion, personal follow-up recall, and immersive training.**

- [The shared fusion weight fields have no independent bookmark](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/xai-value-model/weights.rs#L7-L47)
- [The shared weighted formula's actual items](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/xai-value-model/scoring.rs#L92-L139)
- [Fetching interaction data by current reader and reading BookmarkMetadata](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/query_hydrators/explicit_engagement_signals_query_hydrator.rs#L31-L111)
- [Interaction signal switches, per-class caps, and candidate age defaults](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/params/param.rs#L716-L738)
- [SimClusters' public enable default](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/params/param.rs#L48-L53)
- [SimClusters seed age, score, and count limits](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/sources/simclusters_source.rs#L25-L36)
- [SimClusters enable conditions, seeds, and candidate queries](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/sources/simclusters_source.rs#L213-L329)
- [Immersive recall positives include bookmarks](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/configs/xrecsys_two_tower.py#L283-L293)
- [Immersive positives in the model settings](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/models/recsys_two_tower_model.py#L2868-L2878)
- [Each branch trains on its own positives and negatives](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/models/recsys_two_tower_model.py#L2711-L2739)

<a id="ref-42"></a>

**[42] The mutual-follow reply prediction conditional bonus.**

- [General coefficients and bonus defaults](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/params/param.rs#L396-L408)
- [VM Ranker general reply default](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/vm-ranker/params.rs#L3-L4)
- [VM Ranker mutual-follow bonus default](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/vm-ranker/params.rs#L145-L155)
- [Candidate eligibility](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/xai-value-model/inputs.rs#L19-L22)
- [The additive computation](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/xai-value-model/weights.rs#L84-L99)
- [The actual two-way relationship query](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/candidate_hydrators/bidirectional_follow_hydrator.rs#L15-L61)
- [Passed into fusion scoring](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/scorers/value_model.rs#L8-L87)

<a id="ref-43"></a>

**[43] Profile clicks and following the author are different targets.**

- [Profile click default](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/params/param.rs#L425-L430)
- [Follow author default](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/params/param.rs#L459-L464)
- [The two terms fused separately](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/xai-value-model/scoring.rs#L92-L139)
- [VM Ranker's profile dwell and follow defaults](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/vm-ranker/params.rs#L78-L89)

<a id="ref-44"></a>

**[44] Author bio and content representation.**

- [Author name, handle, and bio](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/mm_emb/renderer_v82.py#L186-L215)
- [Text and bio caps](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/mm_emb/renderer_v82.py#L33-L50)

<a id="ref-45"></a>

**[45] Negative predictions and the hard filter for reader blocks and mutes.**

- [Home Mixer negative coefficients](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/params/param.rs#L490-L513)
- [VM Ranker negative coefficients](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/vm-ranker/params.rs#L108-L131)
- [Reader relationship filtering](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/filters/author_socialgraph_filter.rs#L15-L54)
- [Filter order before scoring](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/candidate_pipeline/phoenix_candidate_pipeline.rs#L420-L469)

<a id="ref-46"></a>

**[46] Building and passing length and line-break data.**

- [Text content features](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/models/content_features.rs#L8-L19)
- [Encoding candidate experiment data](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/scorers/vm_ranker_debias_payload.rs#L33-L68)
- [The VM Ranker candidate request](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/scorers/vm_ranker_request.rs#L53-L73)
- [Handling the Article title, cover, and media](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/mm_emb/renderer.py#L65-L92)

<a id="ref-47"></a>

**[47] The local scope of V8.2 text truncation.**

- [The 4000-character cap and truncation function](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/mm_emb/renderer_v82.py#L33-L50)
- [Processing post.full\_text](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/mm_emb/renderer_v82.py#L165-L167)
- [The renderer connects to the embedding service](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/mm_emb/embedder_v82.py#L69-L92)

<a id="ref-48"></a>

**[48] Video targets and the ten-second eligibility are different scopes.**

- [VQV eligibility judgment](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/util/candidates_util.rs#L19-L33)
- [Video length threshold](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/params/param.rs#L688-L693)
- [Video open and VQV coefficients](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/params/param.rs#L417-L431)
- [VM Ranker video open and VQV defaults](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/vm-ranker/params.rs#L12-L27)
- [VM Ranker continued-viewing defaults](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/vm-ranker/params.rs#L66-L89)
- [Continued-viewing settings in local fusion](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/scorers/value_model.rs#L35-L42)
- [Immersive recall positives](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/configs/xrecsys_two_tower.py#L283-L292)

<a id="ref-49"></a>

**[49] Video over ten seconds: the actual index eligibility and the three builders.**

- [Accepted video types and the 10000-millisecond constant](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix-rankall-strato/lib/eventProcessing.strato#L23-L24)
- [hasValidImmersiveVideo's per-media conditions](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix-rankall-strato/lib/eventProcessing.strato#L403-L417)
- [1fav\_video calls the video eligibility function](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix-rankall-strato/columns/phoenix_rank_all/phoenixRankAllCandidateProcessor.strato#L263-L275)
- [video and nsfw\_video call the video eligibility function](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix-rankall-strato/columns/phoenix_rank_all/phoenixRankAllCandidateProcessor.strato#L311-L340)
- [The main flow where Fav and PostCreation call the video index](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix-rankall-strato/columns/phoenix_rank_all/phoenixRankAllCandidateProcessor.strato#L477-L524)
- [The other isMediaEligible's ten-second and media-NSFW judgment](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix-rankall-strato/lib/eventProcessing.strato#L125-L137)
- [Where getTweetypieResponse uses hasEligibleMedia](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix-rankall-strato/lib/eventProcessing.strato#L182-L204)

<a id="ref-50"></a>

**[50] Video index windows, Evergreen naming, and branches not passing the same ten-second check.**

- [The video index's Main and Sid windows](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix-rankall/src/config/mod.rs#L168-L224)
- [The files the video recall datasets actually read](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/data/retrieval_dataset.py#L247-L282)
- [The evergreen\_video and evergreen\_nsfw\_video builders](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix-rankall-strato/columns/phoenix_rank_all/phoenixRankAllCandidateProcessor.strato#L26-L43)
- [The Evergreen event branch calling only hasImmersiveVideo](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix-rankall-strato/columns/phoenix_rank_all/phoenixRankAllCandidateProcessor.strato#L457-L468)
- [The conditions of hasImmersiveVideo and isImaginePost](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix-rankall-strato/lib/eventProcessing.strato#L385-L400)
- [The Imagine index does not call hasValidImmersiveVideo](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix-rankall-strato/columns/phoenix_rank_all/phoenixRankAllCandidateProcessor.strato#L342-L352)
- [The general 1fav is built first; the video index is judged separately](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix-rankall-strato/columns/phoenix_rank_all/phoenixRankAllCandidateProcessor.strato#L506-L524)
- [The general 1fav builder adds no video duration condition](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix-rankall-strato/columns/phoenix_rank_all/phoenixRankAllCandidateProcessor.strato#L78-L88)

<a id="ref-51"></a>

**[51] The 64-like special video eligibility and follow-up checks.**

- [The public default of deluxe\_fav\_count\_threshold](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/config/config.py#L104-L120)
- [Author, video, like count, and motion\_reveal](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/ptos/task_safety_ptos_special_video_filter.py#L16-L49)
- [After fetching the video, the technique screen must still be passed](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/ptos/task_special_video_screen.py#L13-L49)
- [Special video classification, cross-validation, and write order](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/ptos/plan_safety_ptos_special_video.py#L23-L54)
- [The Kafka entrances for special video, leading frames, and media-injected](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/ptos/generators.py#L109-L144)
- [The sixty-second dedup cache for related tasks](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/ptos/task_rate_limit.py#L11-L42)

<a id="ref-52"></a>

**[52] What 64 and 512 each represent in the video comparison check.**

- [Candidates including quoted video, the 64 threshold, and existing NSFW exclusion](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/ptos/task_safety_ptos_media_injected_adult_infrared_video_spam_detection_filter.py#L19-L47)
- [The named 512 constant](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/ptos/constants.py#L34-L40)
- [Inference only with frames; 512 switches reasoning and compares reference videos](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/ptos/task_safety_ptos_media_injected_adult_infrared_video_spam_detection.py#L101-L159)
- [A hit converts to the SpamManipulatedMedia classification](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/ptos/task_safety_ptos_media_injected_adult_infrared_video_spam_detection.py#L174-L189)
- [Execution dependencies of filter, media, check, and sink](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/ptos/plan_safety_ptos_media_injected_adult_infrared_video_spam_detection.py#L19-L43)
- [Reading existing NSFW results and failure handling](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/ptos/prior_nsfw.py#L16-L34)

<a id="ref-53"></a>

**[53] The long-video opening check and the 512 threshold's other qualifications.**

- [The ten-second cut, thirty-second video, and 512 constant](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/ptos/constants.py#L29-L33)
- [Author, long video / broadcast, prior, AdultContent, and 512](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/ptos/task_safety_ptos_adult_content_leading_frames_filter.py#L29-L83)
- [Leading-frames task and cross-validation dependencies](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/ptos/plan_safety_ptos_adult_content_leading_frames.py#L24-L55)
- [Cross-validation when PTOS and the safe model disagree](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/ptos/task_safety_ptos_adult_content_cross_validation.py#L67-L131)
- [Cross-judgment and soft-category write-back](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/ptos/task_safety_ptos_adult_content_cross_validation.py#L133-L152)
- [Finally applying adult-content and spam labels by classification](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/ptos/task_write_safety_post_annotations_result_sink.py#L214-L248)

<a id="ref-54"></a>

**[54] Engagement bait, hashtag abuse, and normal hashtag features.**

- [Pre-handling for test accounts, PageRank, and grey badges](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/ptos/task_write_safety_post_annotations_result_sink.py#L175-L194)
- [Baiting, farming, card manipulation, and other spam branches](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/ptos/task_write_safety_post_annotations_result_sink.py#L233-L248)
- [Named categories including SpamHashTagAbuse](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/ptos/state.py#L37-L46)
- [Safety writes execute only in PTOS production](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/ptos/task_write_safety_post_annotations_result_sink.py#L48-L49)
- [Disable conditions outside PTOS production](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/ptos/disable_rules.py#L6-L11)
- [The spam-judgment prompt is not public](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/ptos/prompts.py#L11-L31)
- [The SimClusters entity extractor takes at most four hashtags](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/simclusters/simclusters_v2/summingbird/common/TweetEntityExtractor.scala#L14-L40)
- [Phoenix history data includes CLICK\_HASHTAG](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/data/recsys/history_id_lists.py#L25-L36)
- [The feature list containing CLICK\_HASHTAG](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/data/recsys/id_list_features.py#L108-L120)

<a id="ref-55"></a>

**[55] The threshold-10 binary target and label function.**

- [The home\_direct\_packed named settings](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/configs/xrecsys.py#L263-L285)
- [The numeric threshold 10 in code](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/configs/xrecsys.py#L776-L783)
- [The strictly-greater original function](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/models/loss_recsys.py#L190-L212)

<a id="ref-56"></a>

**[56] Other dwell targets and inference outputs.**

- [Other dwell targets](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/configs/xrecsys.py#L747-L810)
- [Binary outputs keep probabilities](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/models/recsys_model.py#L532-L553)

<a id="ref-57"></a>

**[57] Cold-start candidate filtering and subsequent selection.**

- [Originality and follower eligibility](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/scorers/author_cold_start.rs#L188-L193)
- [Home impression conditions and selection](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/scorers/author_cold_start.rs#L296-L333)

<a id="ref-58"></a>

**[58] Cold-start numeric defaults.**

- [200 impressions, fifty thousand followers, and 7200 seconds](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/params/param.rs#L589-L624)

<a id="ref-59"></a>

**[59] The official definition of front-end view counts.**

- [X View counts](https://help.x.com/en/using-x/view-counts)

<a id="ref-60"></a>

**[60] Cold-start target rank, author diversity, and final display.**

- [Non-zero score position](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/scorers/author_cold_start.rs#L91-L104)
- [The random range's upper bound is not included](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/scorers/author_cold_start.rs#L216-L225)
- [Replaying the cold-start decision on the ranking score](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/xai-value-model/scoring.rs#L263-L279)
- [Author counts computed by candidate score](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/xai-value-model/scoring.rs#L183-L203)
- [Author and OON adjustments applied after cold start](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/xai-value-model/scoring.rs#L315-L327)
- [VM's author diversity defaults](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/vm-ranker/params.rs#L169-L197)
- [Home Mixer's local scoring disables author diversity](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/scorers/value_model.rs#L45-L49)
- [Blending ads with other modules](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/selectors/blender_selector.rs#L56-L87)

<a id="ref-61"></a>

**[61] FairShare's source grouping, proportional allocation, and model candidate cap.**

- [Enable conditions, budget, and proportional allocation](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/filters/fair_share_ranking_filter.rs#L10-L109)
- [Cold and ZeroFav use independent served types](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/sources/phoenix_source.rs#L199-L204)
- [FairShare executes before model scoring](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/candidate_pipeline/phoenix_candidate_pipeline.rs#L420-L469)
- [The Phoenix request's candidate cap](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/util/phoenix_request.rs#L18-L20)
- [Building the request from only the first MAX\_CANDIDATES](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/util/phoenix_request.rs#L185-L195)
- [The public preliminary budget and enable default](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/params/param.rs#L1277-L1288)
- [The recall count 200 is a different parameter](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/params/param.rs#L16-L21)
- [The cold candidate count actually passed into the recall request](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/sources/phoenix_source.rs#L124-L141)

<a id="ref-62"></a>

**[62] A new-reader condition cannot become a new-author account-warming rule.**

- [The condition using query.user\_id](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/filters/new_user_min_engagement_filter.rs#L31-L90)
- [This filter's enable default is false](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/params/param.rs#L832-L860)

<a id="ref-63"></a>

**[63] The age and deduplication of an old original vs. a new repost candidate.**

- [The 48-hour constant](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/params/config.rs#L38-L43)
- [Checking the candidate's own ID](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/filters/age_filter.rs#L16-L31)
- [The repost's own ID and the original's ID](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/sources/thunder_source.rs#L103-L113)
- [Merging reposts by original ID](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/filters/retweet_deduplication_filter.rs#L19-L29)

<a id="ref-64"></a>

**[64] The judgment that an edited version has been superseded.**

- [The old version's definition](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/visibility-filtering/models/tweet.rs#L69-L71)
- [Filter conditions and exceptions](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/visibility-filtering/rules/tweet_rules.rs#L214-L224)

<a id="ref-65"></a>

**[65] Reply content's model evaluation and public scope.**

- [Sending the conversation and signals to the model](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/reply_spam/classifier_reply_ranking.py#L44-L78)
- [Writing back scores and conditional labeling](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/reply_spam/task_write.py#L124-L148)
- [Other labeling qualifications and exceptions](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/reply_spam/task_write.py#L39-L74)
- [The judgment prompt is not public](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/reply_spam/prompts.py#L6-L24)

<a id="ref-66"></a>

**[66] The complete eligibility for the multi-step self-reply spam check.**

- [Ancestors, authors, same-author parent, the root post's thousand followers, and exemptions](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/reply_spam/task_multi_step_reply_spam.py#L25-L124)
- [Qualifying first, then media, classification, and writing](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/reply_spam/plan_multi_step_reply_spam.py#L12-L28)
- [Both the general and recovery streams register this plan](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/reply_spam/generators.py#L16-L40)
- [The specific model prompt is not public](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/reply_spam/prompts.py#L6-L35)

<a id="ref-67"></a>

**[67] The reply classifier's protection conditions and zero-score write scope.**

- [Must flag the newest reply, keep only the same author, exclude single results](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/reply_spam/classifier_multi_step_reply_spam.py#L32-L88)
- [Long conversations' sampling, per-post media cap, and root-post hint](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/reply_spam/classifier_multi_step_reply_spam.py#L21-L22)
- [When ancestors exceed ten, taking head and tail, and input content](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/reply_spam/classifier_multi_step_reply_spam.py#L90-L134)
- [Excluding the root post when parsing results](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/reply_spam/classifier_multi_step_reply_spam.py#L157-L175)
- [ReplyRankingScore 0 written only for spam-judged replies](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/reply_spam/task_multi_step_reply_spam.py#L151-L198)
- [RiskyHighVizReply labeling's extra author and test-account conditions](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/reply_spam/task_write.py#L39-L79)
- [Scores published to cache, Kafka, and Strato](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/reply_spam/strato_loader.py#L20-L53)

<a id="ref-68"></a>

**[68] Visibility dependence of quoted originals and conversation ancestors.**

- [Querying ancillary content's visibility](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/candidate_hydrators/vf_candidate_hydrator.rs#L70-L105)
- [The ancillary content removal judgment](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/candidate_hydrators/vf_candidate_hydrator.rs#L140-L169)
- [Removing the whole candidate](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/filters/ancillary_vf_filter.rs#L7-L17)
- [The difference between Drop and content-warning dispositions](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/filters/vf_filter.rs#L22-L26)

<a id="ref-69"></a>

**[69] External URLs' public features and safety rules.**

- [The has\_url feature](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/models/content_features.rs#L8-L19)
- [Feature passing](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/scorers/vm_ranker_debias_payload.rs)
- [Malicious URL rules](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/visibility-filtering/rules/tweet_rules.rs#L919-L937)

<a id="ref-70"></a>

**[70] Low-quality URLs in redirect chains.**

- [The actual conditions and post labeling](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/botmaker-rules/scarecrow/bot/LQ_Tweets_With_LQ_URL_Verdict_At_Mention_To_NonFollower_v2.bot#L4-L21)
- [Post label disposition](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/visibility-filtering/rules/tweet_rules.rs#L919-L937)

<a id="ref-71"></a>

**[71] Pinned problem URLs and account labels.**

- [The pinned URL rule](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/botmaker-rules/scarecrow/bot/PinnedLowQualityOrBadUrl.bot#L6-L44)
- [The account label's disposition](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/visibility-filtering/rules/author_rules.rs#L204-L208)
- [The account rules on the recommendation path](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/visibility-filtering/rules/levels.rs#L142-L164)

<a id="ref-72"></a>

**[72] Under the Hood's official entrance and how to read the report.**

- [Official entrance and pilot notes](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/README.md#L466-L470)
- [Under the Hood](https://x.com/i/jf/under_the_hood)
- [Report fields and units](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/under-the-hood/jetfuel/routes/report.tsx#L25-L51)
- [Label names and impact descriptions](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/under-the-hood/strato/lib/underTheHoodLabels.strato)

<a id="ref-73"></a>

**[73] The actual conditions of low-quality URL v1 and v2.**

- [v1's non-reply, non-repost, and mentioned-person-not-following-author](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/botmaker-rules/scarecrow/bot/LQ_Tweets_With_LQ_URL_Verdict_At_Mention_To_NonFollower.bot#L2-L47)
- [v2 checks no mentions, only the redirect chain and author conditions](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/botmaker-rules/scarecrow/bot/LQ_Tweets_With_LQ_URL_Verdict_At_Mention_To_NonFollower_v2.bot#L2-L21)
- [The SPAM\_HIGH\_RECALL post label's recommendation disposition](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/visibility-filtering/rules/tweet_rules.rs#L933-L937)
- [This post rule installed into HomeRecommendations](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/visibility-filtering/rules/levels.rs#L198-L212)

<a id="ref-74"></a>

**[74] The problem pinned URL's seven-day account label.**

- [Pinned after vs. before, URL resolution, exemptions, and the seven-day expiry](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/botmaker-rules/scarecrow/bot/PinnedLowQualityOrBadUrl.bot#L2-L44)
- [The SpamHighRecall account rule](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/visibility-filtering/rules/author_rules.rs#L204-L208)
- [At which recommendation entrance the account rules execute](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/visibility-filtering/rules/levels.rs#L142-L164)

<a id="ref-75"></a>

**[75] How specific account labels affect recommendation eligibility.**

- [Home and HomeRecommendations have different author rules](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/visibility-filtering/rules/levels.rs#L96-L164)
- [NSFW, spam, impersonation, abuse, and other named account rules](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/visibility-filtering/rules/author_rules.rs#L155-L243)
- [The precise definitions of NonAuthors and NonFollowers](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/visibility-filtering/rules/rule_spec/engine.rs#L74-L76)
- [The official visibility description of account labels](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/under-the-hood/strato/lib/underTheHoodLabels.strato#L117-L180)
- [Home-feed filtering distinguishes removal from content warnings](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/filters/vf_filter.rs#L8-L26)

<a id="ref-76"></a>

**[76] Safety rules' public scope and the October 29 refactor check.**

- [Public defaults, experiment configuration, and unpublished prompts / some bot rules](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/README.md#L428-L447)
- [The original version's Home and HomeRecommendations rules](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/visibility-filtering/rules/levels.rs#L96-L212)
- [The newest version's rule combinations at the same entrances](https://github.com/xai-org/x-algorithm/blob/606b254b45be798bfaecfa8c23f5a9c51bc8000c/visibility-filtering/rules/levels.rs#L195-L258)
- [The newest ClientSwitch and original defaults](https://github.com/xai-org/x-algorithm/blob/606b254b45be798bfaecfa8c23f5a9c51bc8000c/visibility-filtering/models/viewer.rs#L120-L143)
- [The newest insults condition restated as ClientHas](https://github.com/xai-org/x-algorithm/blob/606b254b45be798bfaecfa8c23f5a9c51bc8000c/visibility-filtering/rules/tweet_rules.rs#L162-L205)

<a id="ref-77"></a>

**[77] The insult label's application conditions, reader scope, and entrance differences.**

- [Insults, followers, the author, and the old-client fallback](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/visibility-filtering/rules/tweet_rules.rs#L161-L204)
- [In-network, out-of-network, and ancillary content queried for visibility separately](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/candidate_hydrators/vf_candidate_hydrator.rs#L67-L110)
- [Test cases of the same label at different safety levels](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/visibility-filtering/rules/golden_corpus/oon_tweet_label.rs#L192-L268)
- [PTOS's test-account and author eligibility judgments](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/ptos/task_write_safety_post_annotations_result_sink.py#L175-L194)
- [English, the specific insult classification, and author exceptions](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/ptos/task_write_safety_post_annotations_result_sink.py#L258-L268)
- [The official report's effect description for the insults label](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/under-the-hood/strato/lib/underTheHoodLabels.strato#L99-L104)

<a id="ref-78"></a>

**[78] LOW_QUALITY / MISINFO warnings, source, and interaction policy.**

- [The public-interest label rule applying to Everyone, and its time condition](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/visibility-filtering/rules/tweet_rules.rs#L62-L79)
- [The source split for LOW\_QUALITY and the four MISINFO types](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/visibility-filtering/rules/rule_spec.rs#L759-L789)
- [Falling back to NonCompliant even without a limit](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/visibility-filtering/models/verdict.rs#L77-L83)
- [The restriction reasons corresponding to MISINFO sources](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/visibility-filtering/models/verdict.rs#L225-L258)
- [Assembling the warning and the final limited engagements](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/visibility-filtering/treatment.rs#L81-L115)
- [Interaction actions resolved from the feature-switch policy](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/visibility-filtering/params/limited_actions_policy.rs#L49-L80)
- [Test policies for NonCompliant and limited\_replies](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/visibility-filtering/params/limited_actions_policy.rs#L189-L207)
- [Tests for label source, earlier posts, and missing source](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/visibility-filtering/rules/golden_corpus/label_interstitial.rs#L119-L165)

<a id="ref-79"></a>

**[79] The account-label aggregation default: three of the most recent five.**

- [Three/five, mediaOnly=false, 60 days, the seven-day TTL, and author exclusion conditions](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/safety-label-user-agg/postToUserLabelRules.strato#L395-L425)
- [Taking the window, then counting by existing post labels](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/safety-label-user-agg/postToUserLabelRules.strato#L251-L283)
- [Judgments of the trigger event and user exclusion conditions](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/safety-label-user-agg/postToUserLabelRules.strato#L119-L142)
- [mediaOnly is a configurable option, and its scan scope](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/safety-label-user-agg/postToUserLabelRules.strato#L152-L177)
- [Another possible-NSFW default requiring eleven of ten](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/safety-label-user-agg/postToUserLabelRules.strato#L360-L394)
- [The public JSON can be overridden by feature switch](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/safety-label-user-agg/postToUserLabelRules.strato#L430-L432)

<a id="ref-80"></a>

**[80] Account aggregation's events, timeline, reposts, and expiry times.**

- [The Applied event and label-triggered rules](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/safety-label-user-agg/safetyLabelToUserLevelAggregationV2Processor.strato#L12-L28)
- [Reverse-order userTimeline, reposted originals' labels, and event times](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/safety-label-user-agg/safetyLabelToUserLevelAggregationV2Processor.strato#L56-L83)
- [Writing account labels by current time plus TTL](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/safety-label-user-agg/safetyLabelToUserLevelAggregationV2Processor.strato#L89-L106)
- [The stream's ten-minute delay and maxLag target](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/safety-label-user-agg/safetyLabelToUserLevelAggregationV2Forwarder.strato#L3-L20)
- [Another path's NSFW media events](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/botmaker-rules/scarecrow/bot/NsfwTweetMediaProcessor.bot#L3-L30)
- [Another path aggregating one day's events by post ID](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/botmaker-rules/scarecrow/derived-feature/ApplyNsfwUserLabel.df#L19-L45)
- [Another path's labeling or review conditions, and validity](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/botmaker-rules/scarecrow/derived-feature/ApplyNsfwUserLabelOrCreateReport.df#L2-L81)

<a id="ref-81"></a>

**[81] The handling from duplicate-text clusters to COPYPASTA_SPAM.**

- [General duplicate text and the CJK job, eligibility, and label writing](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/botmaker-rules/scarecrow/bot/BBQDuplicateTextProd.bot#L2-L74)
- [The reply version's job, eligibility, and label writing](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/botmaker-rules/scarecrow/bot/BBQDuplicateTextRepliesProd.bot#L2-L58)
- [The public repo does not contain all spam rules](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/README.md#L440-L447)

<a id="ref-82"></a>

**[82] Under the Hood's report eligibility and data periods.**

- [Account age, post count, and time conditions](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/under-the-hood/strato/columns/underTheHoodReport.User.strato#L17-L22)
- [The best effort note](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/under-the-hood/strato/columns/underTheHoodReport.User.strato#L47-L65)
- [Falling back to the previous period when the month isn't ready](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/under-the-hood/strato/columns/underTheHoodReport.User.strato#L423-L458)
- [The service switch](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/under-the-hood/strato/lib/params.strato#L15-L22)
- [The page note on last month's summary](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/under-the-hood/jetfuel/routes/index.tsx#L14-L32)

<a id="ref-83"></a>

**[83] How V8.2 truncates long-post text and Article titles separately.**

- [Character caps for each text class](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/mm_emb/renderer_v82.py#L36-L52)
- [post.full\_text and the Article branch called separately](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/mm_emb/renderer_v82.py#L140-L174)
- [The Article branch reads only the title](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/mm_emb/renderer_v82.py#L317-L321)

<a id="ref-84"></a>

**[84] Engagement-count inputs and the fusion function in the Home model.**

- [The named Home config enables engagement counts](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/configs/xrecsys.py#L260-L322)
- [The fusion function weights by predicted value](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/xai-value-model/scoring.rs#L68-L143)

<a id="ref-85"></a>

**[85] DPP's content diversity selection and subsequent score handling.**

- [DPP candidate construction, content representation, and selection results](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/vm-ranker/scoring/dpp_model.rs)
- [DPP kernel computation and selection](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/vm-ranker/dpp.rs)
- [Conditions for executing DPP in the service](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/vm-ranker/scoring/mod.rs)
- [Finally taking the top-K by score](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/selectors/top_k_score_selector.rs)

<a id="ref-86"></a>

**[86] The OON multiplier, author diversity, and when multipliers apply.**

- [VM Ranker parameters](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/vm-ranker/params.rs)
- [Weighted score transformation and multipliers](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/xai-value-model/scoring.rs)
- [Relationship and request-type conditions](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/xai-value-model/weights.rs)

<a id="ref-87"></a>

**[87] Article and NoteTweet identities, body input fields, and upstream mapping.**

- [NoteTweet ID and Article ID extracted separately](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/botmaker/scarecrow_features/src/main/java/com/twitter/scarecrow/features/FeaturesOfTweet.java#L255-L263)
- [Dispatch conditions for the two object classes](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/botmaker/scarecrow_features/src/main/java/com/twitter/scarecrow/features/FeaturesOfTweet.java#L301-L311)
- [The fields of ArticleMetadata and Post](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/core/data_loaders/data_types.py#L637-L732)
- [post\_metadata.text assigned to full\_text](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/core/data_loaders/post_mapper.py#L130-L174)
- [Article title and media mapping](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/core/data_loaders/post_mapper.py#L273-L289)
- [The entrance for fetching external content metadata](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/core/data_loaders/strato_loader.py#L26-L56)

<a id="ref-88"></a>

**[88] V5 and V8.2 content and media handling differences.**

- [V5's Article cover, text, and media read order](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/mm_emb/renderer.py#L65-L92)
- [V5's image budget and existing image data](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/mm_emb/renderer.py#L107-L120)
- [V8.2's text, Article, and media assembly](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/mm_emb/renderer_v82.py#L140-L184)
- [V8.2's ordinary media selection and Article title](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/mm_emb/renderer_v82.py#L285-L320)
- [V5's processing results handed to the embedding service](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/mm_emb/embedder.py#L55-L90)
- [Media processing and vector generation in the V8.2 plan](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/flows/mm_emb/plan_post_embedding_v82.py)

<a id="ref-89"></a>

**[89] Upstream conditions for Article media fetching.**

- [is\_high\_fav and the selection of posts to process](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/core/data_loaders/media_loader.py#L130-L170)
- [The Article cover and embedded media fetch branch](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/core/data_loaders/media_loader.py#L293-L303)
- [The public default threshold 64 for media fetching](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/grox/config/config.py#L104-L120)

<a id="ref-90"></a>

**[90] Click, expand, detail dwell, and Article page identifiers.**

- [Click, show-more-expand, and Recap dwell action numbers](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/python/common/xai-proto/proto/recsys.proto#L443-L490)
- [Detail impression and detail dwell numbers](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/python/common/xai-proto/proto/recsys.proto#L513-L548)
- [IsShowMoreExpanded and IsClicked mapped separately](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/data/recsys/constants.py#L125-L163)
- [Show-more-expand belongs to the historical interaction event set](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/data/recsys/history_id_lists.py#L75-L98)
- [DWELL\_TIME and CLICK\_DWELL\_TIME in separate slots](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/python/common/xai-proto/proto/recsys.proto#L684-L693)
- [Article page enums](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/python/common/xai-proto/proto/recsys.proto#L1274-L1298)

<a id="ref-91"></a>

**[91] The known chain from reading labels to training and serving, and its gaps.**

- [Training reads ready-made action vectors and continuous values](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/data/recsys/recsys_batch.py#L810-L831)
- [Home Mixer fetches aggregated history from an external service](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/query_hydrators/scoring_sequence_query_hydrator.rs#L92-L117)
- [The public repo contains no production data sources or internal telemetry](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/README.md#L9-L21)
- [CLICK\_DWELL\_TIME's binary threshold 10](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/configs/xrecsys.py#L776-L783)
- [Labels are strictly greater than the threshold; probabilities are output](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/models/loss_recsys.py#L190-L212)
- [Binary outputs undergo no continuous inverse scaling](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/models/recsys_model.py#L532-L553)
- [Independent feature handling for historical dwell and click dwell](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/models/recsys_feature_prep.py#L945-L975)

<a id="ref-92"></a>

**[92] The rule scope for Article publication status and media visibility.**

- [The filter condition: associated Article not Published](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/visibility-filtering/rules/tweet_rules.rs#L247-L252)
- [The rule registered at TimelineHomeHydration](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/visibility-filtering/rules/levels.rs#L215-L256)
- [Public test samples across life cycles](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/visibility-filtering/rules/golden_corpus/article.rs#L19-L70)
- [The other two safety levels Home Mixer uses](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/candidate_hydrators/vf_candidate_hydrator.rs#L60-L106)
- [Article body media and cover entering VF's media judgment](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/visibility-filtering/rules/rule_spec/features/compound.rs#L44-L66)
- [The same Article rule in the next snapshot](https://github.com/xai-org/x-algorithm/blob/606b254b45be798bfaecfa8c23f5a9c51bc8000c/visibility-filtering/rules/tweet_rules.rs#L251-L256)
- [The registration scope in the next snapshot](https://github.com/xai-org/x-algorithm/blob/606b254b45be798bfaecfa8c23f5a9c51bc8000c/visibility-filtering/rules/levels.rs#L258-L297)

<a id="ref-93"></a>

**[93] Subscription eligibility and Article media read permissions.**

- [Filling the candidate's subscription author field](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/candidate_hydrators/subscription_hydrator.rs#L48-L80)
- [Whether the reader subscribes to the corresponding author](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/filters/ineligible_subscription_filter.rs#L8-L29)
- [Subscription handling registered in the Phoenix candidate pipeline](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/candidate_pipeline/phoenix_candidate_pipeline.rs#L383-L444)
- [Handling media authorization failure](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/visibility-filtering/clients/article_client.rs#L81-L101)
- [Subscriber and author permission error samples](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/visibility-filtering/clients/article_client.rs#L210-L220)

<a id="ref-94"></a>

**[94] The check scope for candidate sources, format fields, and final prediction fusion.**

- [The public Phoenix candidate sources](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/candidate_pipeline/phoenix_candidate_pipeline.rs#L345-L381)
- [Processing order after scoring and selection](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/candidate_pipeline/phoenix_candidate_pipeline.rs#L446-L508)
- [FairShare groups by candidate source](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/filters/fair_share_ranking_filter.rs#L44-L65)
- [The final value model's candidate input fields](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/xai-value-model/inputs.rs#L1-L22)
- [Predicted scores list no separate Article completion or Show more term](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/xai-value-model/phoenix_scores.rs#L1-L31)
- [The interaction prediction fusion function](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/xai-value-model/scoring.rs#L68-L143)

<a id="ref-95"></a>

**[95] Longer Post usage in replies and quotes.**

- [X Premium how to: Longer posts](https://help.x.com/en/using-x/x-premium-how-to)

<a id="ref-96"></a>

**[96] The August 2026 Article view observation sample — not a same-draft format experiment.**

- [The NotPeople original author's samples, statistics table, and promotion-effort notes](https://notpeople.ai/blog/how-to-make-money-on-x-2026)

<a id="ref-97"></a>

**[97] Historical Article revenue arrangements and the current rewards plan cannot substitute for recommendation coefficients.**

- [Historical creator updates and Article contest notes](https://blog.x.com/en/business/creator-updates-and-article-contest-replacement)
- [The current Original Content Rewards and the old plan's end date](https://help.x.com/en/using-x/original-content-rewards)

<a id="ref-98"></a>

**[98] Unit evidence for dwell values, and the upstream gap for click dwell.**

- [The Proto path converts only DWELL\_TIME's milliseconds to seconds](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/crates/serving/xai-recsys-engine/src/util.rs#L131-L149)
- [Arrow continuous values copied per slot as-is](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/crates/serving/xai-recsys-engine/src/util.rs#L394-L404)
- [The training side reads existing continuous-value columns](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/data/recsys/recsys_batch.py#L810-L831)
- [The click-dwell binary declares only the threshold value](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/phoenix/xrex/configs/xrecsys.py#L776-L783)
- [The dwell\_time Home returns is explicitly used for predicted\_dwell\_sec](https://github.com/xai-org/x-algorithm/blob/5ed796374ea48ee26058aab66ab10c266bea2bef/home-mixer/scored_posts_server.rs#L143-L148)
