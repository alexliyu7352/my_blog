---
pubDatetime: 2026-10-31T19:04:47-07:00
title: "Must-read for X/Twitter creators: most posting rules you swear by are wrong, per the source code"
description: "I checked X's public For You recommendation code line by line and distilled the full 75,000-word report into 13 practical rules: which viral claims — 'second post of the day drops to 62.5%', 'one author reply equals 150 likes', 'links are safe in the first reply' — have code behind them, and which are misreadings."
tags: ["X", "Recommendation Algorithm", "Open Source"]
lang: en
ogImage: ./comic-d34-guide.png
translationKey: x-algorithm-guide
xPost: https://x.com/alexlee20122022/status/2116713031002390528
---

Start with a trap almost everyone steps into every day. You post something with 4 images. Image #1 is a cover you designed on purpose (it says "three findings from this test") or a funny comic. The actual results table — the thing the post is really about — sits in image #4. So which image do you think the recommendation system's AI looks at first?

Open the V8.2 content-understanding code in X's public algorithm repo (`xai-org/x-algorithm`) and look at the `_collect_post_media` function. Its logic is blunt: it checks images starting from #1, and **the moment it hits the first image it can read successfully, it immediately `return`s — done, clocked out, never reads any further**. So when all 4 of your images open fine, this pipeline takes only image #1 to understand what your post is about. The core test data in image #4 never gets sent in at all.

Now take a piece of creator advice that gets repeated everywhere: "Your second post of the day keeps only 62.5% of its weight. Post at most three times a day, and wait four hours for the weight to recover." The code really can produce the number `0.625`. But nowhere does the program count "how many posts you published today."

I went through all of X's public For You recommendation code (base commit `5ed7963`, cross-checked against 20 parameter snapshots from October, all the way to the latest commit `606b254` as of October 29 UTC), rewrote 143 ranking and filtering checks in Python, ran 10 function tests on the content processors, and put together a full report of about 75,000 words.

So that readers who don't write code can follow all of it, let's spend 30 seconds on one basic premise first, then get to the 13 truths that directly decide whether your posts live or die:

---

## 💡 Zero-background explainer: how does your post actually climb onto someone else's home timeline?

A lot of people picture the recommendation algorithm like a video game level system: I publish a post, the system gives it a base score, someone likes it so +1 point, and once it banks enough points it levels up into the next traffic pool. **The real code does not work like that at all.**

The real recommendation happens in the 0.1 seconds while a reader is pulling down to refresh their home timeline, and every refresh runs in two steps:

1. **Step one: grab candidates (into a temporary basket / retrieval)**
When a reader — call him Zhang San — pulls down to refresh "For You," the system sends several buyers to different warehouses at the same time to fetch posts. One goes to the `Thunder` warehouse for "posts just published by people Zhang San follows." One goes to `Phoenix` for "posts from strangers Zhang San doesn't follow, but which the AI thinks he'll be interested in based on his recent reading history." One goes to `SimClusters` for "posts the communities he belongs to are buzzing about." Together these buyers haul back a few thousand posts and dump them into a temporary candidate pool built just for this one refresh of Zhang San's.


2. **Step two: compute predicted scores and rank (scoring)**
A few thousand posts don't fit on a screen, so the system has to pick the top few dozen for Zhang San. The AI model looks at each post in the basket and **predicts, in advance (places a bet)**: "If we show this post to Zhang San, how likely is he to like it, reply, copy the link, stop and read, or hit 'not interested'?" The total it computes is called the **Ranking Score**. High scores sit at the top where Zhang San sees them. Low scores sink and get dropped.



Twenty more seconds to pin down three words, because all 13 truths below lean on them:

* **Weight (also called a coefficient)**: not a score itself. It's a multiplier. And what it multiplies is not something that already happened — it's the probability below.
* **Probability**: before the reader has even seen your post, the AI guesses "how likely is this reader to take a given action after seeing it," somewhere between 0 and 1.
* **One item's score = weight × probability**. Concrete example: the weight for expanding a photo is `0.05`. If the AI guesses a reader has a 60% chance of tapping your image to view it full-size, that item contributes `0.05 × 0.6 = 0.03` points. It is NOT "someone opened an image, so you get +0.05 points" — a lot of online tutorials describe weight as points added, and that's exactly where they go wrong.

Once you've got "first grab into a temporary basket, then compute predicted scores to rank," the 13 code truths below will read clearly at a glance:

---

## 1. Second post from the same author gets hit with a 0.625 multiplier? The program isn't counting "how many you posted today"

* **The rumor online**: "Your second post of the day keeps only 62.5% of its weight. Post at most 2–3 times a day, wait at least 4 hours between posts, or slip a short post in between to reset the weight."


* **How the code actually runs**:
In `scoring.rs` there really is an "author diversity multiplier," with the formula $m(k)=0.75\times 0.5^{k}+0.25$ (the VM Ranker defaults are decay `decay = 0.5`, floor `floor = 0.25`). Run it for the 1st, 2nd, and 3rd post and the multipliers really do come out as `1.0` (no discount), `0.625`, and `0.4375`, with a floor of `0.25` after that.
**But! The index $k$ here does not count "how many posts you published today." It counts "how many of your posts got pulled into the temporary basket (a single candidate pool) created by this one refresh from reader Zhang San, at the same time"!**


* **The 4 questions you actually care about, answered**:
1. **Why would my two posts A1 and A2 land in the same basket?**
Say you post A1 at 10 a.m. and A2 at noon. Your follower Zhang San opens X for the first time today at 1 p.m. and refreshes his home timeline. He hasn't seen either A1 or A2, so the buyers pull both into Zhang San's temporary basket at once — say A1 with a predicted score of 1.0 and A2 with 0.9. To stop Zhang San's screen from being wall-to-wall you, the system keeps your top post A1 at ×`1.0` (stays 1.0), and multiplies the second one in the basket, A2, by `0.625` (drops to 0.5625).
**But watch this**: another reader, Li Si, already scrolled past your A1 at 11 a.m. When Li Si refreshes again at 1 p.m., A1 never enters his basket because he's already seen it. His basket holds only your A2 — and for Li Si, A2 is your 1st post from the same author, so it gets the full `1.0`! This function rebuilds its table on every refresh. There is no "daily post counter," and no rule about "recovering after 4 hours" or "resetting at midnight."


2. **But doesn't the code say "at most 5 posts per 24 hours"?**
That's a local rule belonging to one single channel, `PopularPosts` (a channel that stocks popular posts): it picks at most 5 posts per author from the last 24 hours. The channels that do the heavy lifting — the following feed (`Thunder`) and the AI recommendation feed (`Phoenix`) — have no such 5-post cap.


3. **If I slip a short post between two long ones, does it "wash off" the decay and restore weight?**
**It can't, and it can backfire.** The code only looks at your author ID (`author_id`); it doesn't care whether a post is long or short. Say you post long piece A1 (1.0), then a short post, then long piece A2 (0.9). If that short post also lands in the same basket and scores 0.95, it takes the second slot and pushes your A2 down to third ($k=2$), so A2's multiplier falls further, from `0.625` to `0.4375`!


4. **I heard the system also filters similar content (DPP). Can I turn my article into vectors on my own computer and check for duplicates in advance?**
`dpp_model.rs` does have DPP diversity selection: if two posts in the basket have highly overlapping content vectors, the system keeps the 1st and zeroes the 2nd one's score. But **you can't compute these vectors yourself ahead of time**, because X uses an internal multimodal model whose weights aren't public (`grox/flows/mm_emb`, plus your hashed author ID), and DPP is built to catch "same soup, different bowl" rewrites — swapping a few synonyms won't fool it.




* **So how should you actually post?**:
Stop setting alarms for a "4-hour cooldown," and stop forcing yourself to publish filler just to alternate long and short. If two drafts make the same point, merge them into one post. If you have new test data, a new case, or a new development, post it whenever it's ready.



---

## 2. Why do people say a thread should be 3 posts? The secret is display truncation — and thread parts fight each other for weight

* **The rumor online**: "Splitting a long piece into a 3-post thread earns extra algorithmic credit, and the whole thread counts as only 1 author slot in the algorithm, so it never triggers the same-author decay."


* **How the code actually runs**:
The ranking code has **no formula anywhere that adds points for a 3-post thread or subtracts them for a 4th post**. But buried in the code around threads are three harsh truths:


1. **Truth one: every part of a thread scores on its own, and the parts compete with each other for slots.**
When you publish a 5-part thread (1/5 through 5/5), the VM Ranker does **not** merge the thread into a single unit before scoring. It treats the parts as 5 independent candidate posts that happen to share the same `author_id`. So if several parts land in the same candidate pool, they first trigger the same-author decay against each other — `0.625`, `0.4375`. Only after scoring picks a winner does a later conversation dedup filter (`DedupConversationFilter`) step in, delete the lower-scoring parts from the same thread, and keep just the highest-scoring one.


2. **Truth two: strangers will struggle to ever see the later parts of your thread.**
In the regular recommendation feed (Phoenix), the filter that handles "replies from authors you don't follow" (`oon_retweet_reply_filter.rs`) has a public default switch, `EnablePhoenixOonReplies`, set to `false` (off). Parts 2 and onward of a thread are, in essence, reply posts. Under this default, strangers who don't follow you usually only ever get a chance to see part 1 (the root post).


3. **Truth three: `NUM_INTERMEDIATE_ANCESTORS = 1` decides which parts a reader actually sees on screen.**
Say you write a 10-part thread (parts 1 through 10), and the system selects your **part 10** to show on a reader's home timeline.
At that point the display assembler, `convo_marshaller.rs`, stitches it into **one connected conversation card** on screen. But the code fixes `NUM_INTERMEDIATE_ANCESTORS = 1` (at most 1 intermediate ancestor post), and the assembly rule is: **part 1 (the root) + 1 intermediate ancestor (the direct parent of the selected post) + the selected post itself**.
The result: the card a reader scrolls past on their home timeline shows parts **1, 9, and 10**. The reasoning you built up across parts 2 through 8 is simply skipped in the home card. But if your thread has exactly **3 parts** and part 3 gets selected, the assembled card is the complete **part 1, part 2, part 3** — nothing missing!




* **So how should you actually post?**:
1. **If one long Post can say it coherently, publish one long Post. Don't force it into a dozen thread parts.**


2. **If a thread really is the right shape (say, a summary thread after a long column), 3 parts or fewer is the sweet spot**: part 1 states the core judgment up front (never write "I'll explain it in ten posts, the last one is the key"), part 2 carries the concrete comparison of options, part 3 adds the limits and conditions and a question people can answer.


3. **If you do write a long thread anyway, every part has to stand on its own with no context**, so that someone who only ever sees 1, 9, 10 still understands what you're saying.





---

## 3. Clicking through to your profile and following = +4 points? Copying your link = +20? How "engagement weights" are actually calculated

* **The big misunderstanding**: people see the parameter table — like `0.66`, reply `5`, follow author `4`, copy link `20` — and assume: "If one reader clicks from the timeline into my profile and follows me, the system credits my post +4 points. Every link copy is +20. One reply from the author in the comments equals 150 likes."


* **How the code actually runs**:
**It's not bookkeeping after the fact at all. It's betting before the fact.**
The source comments in `scoring.rs` carry an explicit warning: `the weights do not multiply raw engagement counts` (**the weights do not multiply the number of engagements that actually happened!**).
The ranking score is computed in the 0.1 seconds **after Zhang San pulls to refresh but before he has seen your post**. The real formula is $S_{\mathrm{engagement}}(u,p)=\sum_i w_i\,P(a_i\mid u,p)$: the AI first **predicts (guesses)** the **probability** of Zhang San taking each possible action after seeing your post, then totals it up as "predicted probability × weight coefficient."


* **A real worked example**:
Under the public defaults, a normal reply has weight `5` and copying a link has weight `20`. But suppose that for reader Zhang San, the AI predicts a **2% (0.02)** chance he'll leave a reply after reading your post, and only a **0.1% (0.001)** chance he'll copy the link. Then at scoring time:


* **The reply item contributes** = $5 \times 0.02 = 0.10$ points;


* **The copy-link item contributes** = $20 \times 0.001 = 0.02$ points.
The copy-link coefficient (`20`) is far bigger than reply (`5`), yet in this particular scoring run it's the reply item that earns your post more. As for the viral claim that "one reply from the author is worth 150 likes" — that comes from dividing numbers out of an old file from April 2023 that was retired years ago (`75 ÷ 0.5`). The version is three years stale, and it treats probability coefficients as piece-rate wages.






* **So what good are the likes, link copies, and follows that readers actually do after reading?**
They pay off with the **next wave of readers**. The public configuration feeds real engagement counts (`engagement counts`) in as input features for the upstream AI model. When the first batch of readers who saw your post actually do click into your profile and follow you, or copy the link, the model picks up that signal right away. Then, when thousands of similar strangers refresh their home timelines, the **predicted probabilities** the AI computes for them jump, those get multiplied by the big weights — `20` for copy link, `4` for follow author — and your post rides that to the front rows of far more home timelines.


* **Appendix: the actual weight table in the current code (Home Mixer / VM Ranker defaults)**:


* **High-value positive actions**: copy link (`Share via copy link`) **`20`**; a reply prediction from a mutual-follow friend on an original post **`5 + 15 = 20`** (note: the code hard-requires the candidate post to satisfy `!is_reply && !is_retweet && is_mutual_follow_author` — you must be posting an **original post**, and the reader who sees it must **follow you back**, for their reply prediction to be multiplied by 20. A comment you rushed to leave under a big account's post is itself an `is_reply` and gets none of this 20× treatment! Also, out-of-network stranger candidates carry a default `0.75` OON multiplier in the VM Ranker, which means an out-of-network post needs roughly 1.3333× the score of an in-network post just to draw even); normal reply **`5`**; quote with comment (`Quote`) **`5`**; share via DM (`Share via DM`) **`5`**; follow author (`Follow author`) **`4`**; general share **`2`**; normal repost (`Retweet`) **`1`**.


* **Clicks and reading behavior**: like (`Favorite`) **`0.66`** (VM: `0.5`); click-and-dwell past the threshold (`ContClickDwellTime`) **`0.4`**; normal click (`Click`) **`0.3`**; open external link (`Open link`) **`0.2`**; dwell event (`Dwell`) **`0.05`**; photo expand (`Photo expand`) **`0.05`**; clicking the quoted post **`0.05`**; open video **`0.02`** (VM: `0.07`); continuous dwell time (`ContDwellTime`) **`0.006`** (VM: `0.004`); clicking into the author's profile (`profile_click`) **`0`**.


* **One-vote-veto negative penalties**: not dwelled (swiped straight past, `Not dwelled`) **`-0.02`**; block author (`Block`) **`-31.2`**; "not interested" (`Not interested`) **`-52.272`** (VM: `-47.52`); mute author (`Mute`) **`-58.8`**; report (`Report`) **`-234`**.




* **So how should you actually post?**:
1. **Wire your posts, your bio, and your pinned post into one line**: a profile click itself is worth `0`, but if the reader glances at your bio and pinned post and taps "follow author" while he's there, the follow-author coefficient of **`4`** gets multiplied by its predicted probability and lands in the total (and the V8.2 model also reads your name, your handle, and your truncated bio directly). Don't fill your bio with fluff. State plainly what you keep delivering, and use the pinned post to make good on that promise, so people who land on your profile turn into followers.


2. **Never bait replies with flame wars and outrage**: a reply is worth `5`, but "not interested" is `-52.272`, "mute" is `-58.8`, and "report" is `-234`. The moment negative predictions stir, your total score goes underwater on the spot.





---

## 4. How big is the gap between a repost and "just reading without interacting"? The truth is the opposite of what you think

People glance at the table above — a normal repost (`Retweet`) is **`1.0`**, a basic dwell event (`Dwell`) is **`0.05`** — and conclude: "A repost is worth 20× more than just reading without interacting! If everyone reads my long posts and nobody reposts them, I'm getting robbed."

* **The truth, after checking the code and redoing the math**:
1. **Factor in the probability of it happening, and a single basic dwell item often beats a repost.**
On the surface, $1.0 \div 0.05 = 20$×. But remember, weight multiplies the **predicted probability of the action happening**. A reader who hits a good post is far more likely to stop and read it than to bother reposting. Suppose a given reader's predicted repost probability is **2% (0.02)** and his predicted dwell probability is **60% (0.60)**. Then the repost item contributes $1.0 \times 0.02 = 0.02$ points, while the basic dwell item contributes $0.05 \times 0.60 = 0.03$ points — dwell wins outright.


2. **"Just reading without interacting" isn't 1 item in the code at all. It's 4 stacked reading bonuses at once.**
A reader opens your long post, reads silently for 30 seconds, then swipes away without a single like or word. In the system's eyes, that "silent reader" has actually triggered **4 layers of positive mechanisms** in a row:


* **Layer one (normal click, `Click`)**: opens the post or expands it, weight **`0.3`**;


* **Layer two (deep dwell after clicking, `ContClickDwellTime`)**: reads past the code's threshold of `10.0` after opening, weight a hefty **`0.4`** (this one item alone is nearly half of a repost's `1.0`, and it triggers far more often);


* **Layer three (basic dwell `Dwell` `0.05` + per-second continuous dwell `ContDwellTime` `0.006`)**: after the **CREAD multi-threshold dwell prediction** was switched on on October 8 (it splits 2 to 120 seconds, and 2 to 240 seconds on immersive pages, into 30 logarithmic time buckets to reconstruct how long someone read), the continuous dwell weight was raised again on October 13, from `0.004` to **`0.006`** (up 50%). If the model predicts a reader will stay 30 seconds, the per-second item alone adds another $0.006 \times 30 = 0.18$ points!


* **Layer four (the `ld` reading-retrieval branch in step-one candidate fetching)**: since October 13 (`e1a0375`), the two-tower retrieval model has a new `ld` branch with weight **`0.75`** (it trains on `CLIENT_TWEET_RECAP_DWELLED` as positive examples, covering `HOME`, `HOME_COLD`, and `HOME_HOT`). Back in step one, while posts are being hauled into the basket, this branch specifically fishes out the good posts "that people quietly read to the end."
Add those four layers together and a reader who "finishes in silence without saying a word" often contributes several times the score of a normal repost during scoring.




3. **So what is a repost's real, exclusive value? It gets other people to open doors across circles for you.**
When a big account in your field — call him B — hits repost, `thunder/posts/post_store.rs` writes that repost into B's personal index store. When B's follower C refreshes his home timeline, `Thunder` follows C's follow list and serves your post to C directly, as an in-network candidate.




* **So how should you actually post?**:
Don't let a quiet comment section push you, out of anxiety, into rewriting solid material as outrage bait. And don't pad your opening with ten lines of filler to farm a 10-second dwell either (a padded opening makes people swipe away instantly and triggers the `-0.02` `Not dwelled` penalty). **Use solid tables and cases to make silent readers stop and finish (that's what props up a high algorithmic score), and include one comparison graphic that sums up the core conclusion so peers can repost it without thinking (borrowing their following feeds to break out of your circle).**



---

## 5. A long post with one comic image: is it scored as an image post or as a long post?

A lot of deep-content creators ask: "I wrote a few thousand words and attached one comic illustration. Will the system treat it as an image post and swallow my long post's reading weight?"

* **The truth, after checking the code**:
1. **Scoring isn't either/or. It's long-post score + image score, all added together.**
The blended scoring formula in `scoring.rs` treats every post the same: your long text earns the 4 big reading-dwell items described above, in full, as normal. And because you attached an image, the system **adds one more predicted item on top: "photo expand" (`Photo expand`, weight `0.05`)**. A comic image will never swallow the weight of the long text itself.


2. **What actually changes is how the AI multimodal model understands your topic (`grox/flows/mm_emb`)**:
In the V8.2 processor (`renderer_v82.py`), the program extracts two things and packages them for the multimodal embedding service: **the first 4,000 characters of body text (`Post text:`)** + **the first usable image it selected (`Post image:`)**.


* **If you attach only 1 comic image**: as long as your first 4,000 characters state the core topic clearly, a comic that fits the topic is completely fine. But don't open with vague, cloudy writing and then attach an unrelated funny meme — that muddies the semantic precision of the multimodal vector.


* **If you have 1 decorative comic AND 2 charts with real test data (the easiest pit to fall into!)**: remember that V8.2's `_collect_post_media` **returns the moment it finds the first usable image**. If you put the funny comic in slot #1 and the real data comparison tables in slots #2 and #3, the AI takes only the comic, and your two core data tables are ignored outright in this pipeline.






* **So how should you actually post?**:
If you're attaching just 1 comic illustration, attach it without worry (the formula has a photo-expand prediction anyway — coefficient `0.05`, multiplied by the probability a reader opens the image), but make sure the opening of your text states the subject and the conclusion clearly. If you have both a decorative comic and charts carrying your real data, **always put the chart with the core conclusion in slot #1, and push the comic to slot #2 or later**.



---

## 6. What happens if you publish the same content in multiple languages (say, a Chinese-English bilingual post)?

Plenty of creators working in tech or across borders write bilingual content. Should you "stack Chinese on top and English below inside one post," or "split it into a separate Chinese post and English post"?

* **Option A: Chinese and English mixed inside one post**
1. **There is no mixed-language penalty**: the code contains no rule that docks points for mixing Chinese and English. Language is just one of the model's input features.


2. **But there are two hidden traps**:
* **First, the 4,000-character truncation line**: the V8.2 processor takes only **the first 4,000 characters** of `post.full_text`. If you write 3,500 characters of Chinese on top and attach 3,500 characters of English below, everything past character 4,000 gets cut off and never reaches the content vector model at all!


* **Second, an English-only safety rule**: in the Grox PTOS auto-labeling path (Grox is X's internal AI system for "understanding content"; PTOS is the part of it that handles safety review and labels violations), labels like `FOSNR_ABUSE_INSULTS` (the abuse/insults label) are only written automatically when **the post's language is English**. So if a bilingual post uses heated wording and gets classified as English, it stands to reason that this automatic review triggers more easily on that path.






* **Option B: split it into one all-Chinese post and one all-English post**
1. **Single-language readers don't interfere with each other**: the Phoenix retrieval model reads **the current reader's behavior history (`query.user_id`)**. Readers who normally read only Chinese will only retrieve your Chinese version (at the full `1.0`); readers who read only English retrieve only your English version (also full `1.0`).


2. **Bilingual readers can make the two versions compete in the same pool**: for bilingual followers who read both, if you publish both versions in the same second and they land in the same candidate pool under the same `author_id`, the second one eats the `0.625` decay, and the two may also compete in DPP similar-content selection (`dpp_model.rs`).




* **So how should you actually post?**:
**Short posts (Chinese plus English together, well under 4,000 characters)** can go in a single post. **Long, deep pieces** should be **split into a separate all-Chinese post and an all-English post**, ideally staggered by a few hours (timed to the Chinese-speaking and the Europe/US active windows respectively). That way each version gets its full 4,000-character allowance, and your two posts don't fight each other inside a bilingual follower's candidate pool.



---

## 7. Do hashtags actually help, or do they hurt?

* **The truth, after checking the code**:
1. **They help, but they don't add points directly**: the scoring formula has no rule like "add a `#` tag, gain X points." But Phoenix's history-feature list explicitly includes **`CLICK_HASHTAG` (hashtag-click history)**, so the system does look at tag-related behavior features. You can't say tags are worth exactly zero.


2. **The hard cap is 4 (`MaxHashtagsPerTweet = 4`)**: in the `SimClusters` entity extractor (`TweetEntityExtractor.scala`), **`MaxHashtagsPerTweet = 4`** — when extracting text entities it keeps **at most the first 4 `#` tags**. The 5th and beyond are dropped on this path!


3. **Stuffing tags in triggers a `SpamHashTagAbuse` penalty**: the PTOS safety policy has a dedicated **`SpamHashTagAbuse` (hashtag abuse)** category. If you cram a post with trending tags that have nothing to do with the body, and the model calls it abuse (with no high-PageRank or grey-badge exemption to save you), it writes a **`SpamHighRecall`** spam label, and the post gets removed from stranger recommendation feeds.




* **So how should you actually post?**:
Ordinary posts don't need forced hashtags. Only when a specific proper noun, project name, or event is involved, add **1 to 2 (never more than 4)** directly relevant `#` tags. Never pile unrelated trending words at the end.



---

## 8. The same deep long piece: long Post or Article? And what is the Article's "64-like image-fetch gate"?

* **The truth, after checking the code**:
1. **The scoring formula has no Article bonus anywhere**: the final scoring inputs of Home Mixer and VM Ranker (`CandidateScoringInputs`) **contain no `is_article` bonus field at all**. The "Articles get 5.7× the exposure" figure floating around comes from third-party observation samples — but the creators in those samples published, on average, 6 to 28 normal posts promoting each Article. And the Article weight officials mentioned in the past was an ad-revenue-sharing weight, not a recommendation ranking coefficient.


2. **The Article's "64-like image-fetch gate (`is_high_fav`)" and the V5 vs. V8.2 reading difference, explained properly**:
* **What `is_high_fav` at 64 likes means**: for the AI to understand an image, a background "media porter" (`MediaLoader`) first has to fetch it. To save server compute, `grox/core/data_loaders/media_loader.py` sets a gate called `is_high_fav` (a "high-like post" check) when fetching **an Article's cover image and in-body images**. The public default threshold is **64 likes (`deluxe_fav_count_threshold = 64`)**. In other words, before your Article reaches 64 likes, the system, on this `MediaLoader` path, **may not fetch your Article's cover and in-body images at all** (note: this governs only this media-fetch path. It does not mean an Article needs 64 likes to qualify for recommendation)!


* **The big difference between the V5 and V8.2 readers**: the old **V5 reader** reads, in order: Article title → Article cover → post text → regular post media → Article in-body images (if the image budget is 1, it takes only the Article cover). The new **V8.2 reader**, for an Article, reads only `post.full_text` (first 4,000 characters) and the **Article title (first 200 characters)**. Its image-selection function takes images only from "regular post attachments (`post.media`)" and **never reads the Article's own cover or in-body images** (if your images live only inside the Article editor, V8.2's returned image list is simply empty)!


* **The "invisible window" when you edit an Article**: the `ArticleTweetContent` rule in `TimelineHomeHydration` blocks every Article that isn't in `Published` state. Editing an already-published Article first takes it down into an unpublished state, then republishes it when you're done — and during frequent unpublish-edit cycles, it gets filtered out.






* **Now that you know these three, how do you choose between an Article and a long Post?**:
1. **A coherent argument of roughly three to four thousand characters or less → just publish a long Post**: put the core conclusion inside the first 4,000 characters, attach 1 results image in the regular image slot, and V8.2 can read the full text-plus-image from 0 likes onward.


2. **A multi-chapter investigation or handbook of ten thousand-plus words → the "Article + one illustrated guide Post" combo**:
* **The Article title (first 200 characters) must be packed with core keywords and the conclusion** (because below 64 likes, or on the V8.2 path, the AI identifies what you're writing about almost entirely from those 200 title characters and the carrying post's text — never give it an artsy, empty title)!


* **The Article cover image should be the core information graphic** (it's the first thing read once you pass 64 likes, or on the V5 path with a 1-image budget).


* **The step people miss**: after publishing the Article, **publish a separate long Post as a guide to it, and attach the single most important results-comparison image directly to that guide Post as a "regular image attachment (`post.media`)"** — that way the guide post doesn't have to wait for 64 likes; from 0 likes, V8.2 can take in its text and first image completely!







---

## 9. The small-account cold start: "200 impressions" and the FairShare pre-screen — how can new and small accounts actually use them?

Split this mechanism into two rooms and it clicks:

* **Gate one: the ticket check at the door of the scoring room (the `FairShareRankingFilter`, on by default since October 22)**
On every home refresh, the channels may haul 3,000+ posts into the temporary basket, but the big AI model doing the fine scoring (Phoenix) looks at most at **`2800`** posts per pass (`PHOENIX_CLIENT_MAX_CANDIDATES`). The ticket check used to cut strictly in list order, so new posts from the "cold-start channel (`ForYouPhoenixRetrievalCold`)" or the "zero-like channel (`ZeroFav`)" at the end of the line got chopped before ever seeing the judge. `FairShare` now **hands out those 2,800 tickets in proportion to how many posts each channel delivered**, so a small author's new post gets into the room, proportionally, and gets scored.


* **Gate two: the "small-account express elevator" inside the scoring room (`author_cold_start.rs`)**
Once inside and through the first round of scoring, if your post meets **all 5 conditions at once**: ① the author has **no more than 50,000** followers; ② it must be an **original post** (`!is_reply && !is_retweet`); ③ it was published **no more than 2 hours** ago (7,200 seconds); ④ it has been shown on the For You home feed **fewer than 200 times** (`view_count_on_home` under 200); ⑤ its initial score is not in the bottom 3% of non-zero candidates —
then the system takes the likes and home impressions these new posts have collected, runs a round of **Thompson Sampling (sampling from a Beta distribution, with a default baseline expectation of a 1.5% home like rate)**, draws the top **2 posts**, picks the **1** with the highest model-predicted score for the current reader, and **forcibly lifts its score to the level of the current #16 on the leaderboard (index 15)**, escorting it into the front rows!


* **3 hard rules for small accounts when posting**:
1. **Don't give up just because the public Views counter passes 200**: the public view count includes profile clicks, search, and your own refreshes. The code checks the internal, purely-home-recommendation impression count (**`view_count_on_home`, with a 60-second cache**). Example: when the public counter shows 300 views, the internal home impressions might still be under 100 (that's an example — the real numbers exist only on the backend), still inside the support window!


2. **The first 2 hours after posting are a genuine golden window, but don't round up a group to like each other's posts**: at the 2-hour mark the eligibility expires on the spot, so publish original posts when your audience is online. But don't drop the link into chat groups to farm likes — clicks from outside don't count into the home denominator, and the final head-to-head still comes down to the model-predicted score from stranger readers.


3. **Don't believe the "new accounts must warm up as readers for 7 days" nonsense**: the `query.user_id` that `NewUserMinEngagementFilter` checks is **whether the person refreshing the home feed is a new user** — it isn't checking the author at all, and the default switch is `false` (off) anyway. Set up your bio properly on day one and start posting solid original content.



---

## 10. The 1st like, the 32nd like, bookmarks, and the video "10.001-second" life-or-death line

1. **The 1st like (`1fav`) and the 32nd like (`32fav`)**:
When a like comes in, `favoriteEventProcessor` triggers index updates at powers of 2 (1, 2, 4... 32, 64) (subject to a 1-minute update interval and the post being younger than 49 hours). In the public code, the three main datasets for the regular home feed (`HOME`, `HOME_COLD`, `HOME_HOT`) all explicitly read **`1fav_1day.parquet`** (the 24-hour index of posts that got their 1st like). The `32fav_1day` store that a normal post generates when it collects 32 likes, on the other hand, has **no consumer reading it anywhere in the public For You code tree**. Getting the 1st like really does get you into the main store. Chasing 32 likes by begging for them everywhere is a waste.


2. **Bookmarks score 0 in the scoring table, but they have two big hidden uses**:
The main scoring table has no standalone bookmark item, but: ① **SimClusters similarity retrieval** takes up to 15 of a reader's most recently bookmarked posts (younger than 90 days) as seeds and fetches similar new posts younger than 48 hours; ② **immersive retrieval training (`immersive_positive_actions`)** explicitly lists `CLIENT_TWEET_BOOKMARK` as a positive example. Making tool comparison tables and checklists that readers want to save and consult again is very good for precise distribution.


3. **Two big video traps (10.001 seconds, and mixing video with images)**:
All three core video indexes (`1fav_video`, `video`, `nsfw_video`) call the `hasValidImmersiveVideo` function:


* **Trap one**: the video's duration must be **strictly greater than 10,000 milliseconds**. A video cut to exactly `10.000` seconds fails. You need at least **10.001 seconds (cut everything to 11 seconds or more, to be safe)**! (5–8 second clips can't enter these three video stores, though they can still enter a normal post's `1fav` store.)


* **Trap two**: the function checks every piece of media in the post with `forall` (all must pass) — if one post contains a 15-second video and you also mix in 1 still image, the image alone strips the whole post of eligibility for these three video indexes!


* As for the "video 64 likes and 512 likes" numbers going around online, those are **thresholds that trigger safety and violation review** (64 likes switches on `SpecialVideo` motion-content screening; 512 likes switches on `MediaInjected` deep inference, or trimming the first 10 seconds of videos of at least 30 seconds to check for adult content). They are not traffic reward pools at all.





---

## 11. What happens if you repost your own old post? How do you actually revive old material?

People keep asking: "A normal post ages out of the candidate pool after 48 hours (`AgeFilter`), and a repost (Repost / Retweet) mints a brand-new `tweet_id` dated today. So if I repost my own old post every couple of days, can it live forever and keep reaching strangers?"

* **4 harsh realities, after checking the code**:
1. **It slips past the 48-hour age limit, but not past the "stranger interceptor" (`OONRetweetReplyFilter`)!**
Your new repost does carry a `tweet_id` born today (the old post's ID sits in `retweeted_tweet_id`), so the 48-hour `AgeFilter` can't cut it. But in `oon_retweet_reply_filter.rs`, the system **unconditionally removes every normal repost whose reposter is not on the reader's follow list (`is_retweet`)**. When someone else reposts you and it reaches their followers, that's because he is someone his followers follow (in-network). When **you repost yourself**, to a stranger who doesn't follow you, you're still an "outsider (OON)" — in the normal recommendation pipeline, that repost **simply never gets in front of strangers at all**.


2. **Followers who already saw it won't see it a second time either (`previously_seen_posts_filter.rs`)!**
The already-seen filter checks the new repost's `tweet_id` together with **the original post's `retweeted_tweet_id`**. Any follower who scrolled past your old post a few days ago already has that old post's ID in his seen list (`seen_ids`), so today's repost gets blocked on the spot. **Only followers who happened to be offline and missed it last time, or who just followed you, will see this repost on their home timeline.**


3. **It fights your own new post for slots (triggers the `0.625` decay), and gets no cold-start support!**
Reposting yourself still carries your `author_id`. If the repost and today's new post land in the same candidate pool of a follower who hasn't read either, the two posts fight each other and trigger the `0.625` decay. And if you repost before the original is 48 hours old, `RetweetDeduplicationFilter` merges the original and the repost by original ID and dedupes them. On top of that, both cold-start support and the 20× mutual-follow reply bonus are written with `!self.is_retweet` — normal reposts get neither.


4. **If the old post carries a sensitive label, reposting drags the mine into today (`userTimeline` window counting)!**
In the "count the sensitive posts" rule (3 of your most recent 5 posts carrying an `NSFW_HIGH_PRECISION` label gets the whole account labeled; `NSFW_HIGH_PRECISION` is the high-precision internal label the system puts on sensitive content — adult material, say — meaning "we're basically certain this is sensitive"), a repost makes the system look up **the original post's safety labels** and count them in the time window under the new repost's ID. Repost an old post of yours that carries a sensitive label, and it eats one of your current top-5 violation counting slots directly!




* **So how do you actually revive an old post?**:
1. **A plain repost (Repost)**: only good for "covering time zones" (say you posted something solid during the day — repost it once late at night to feed it to your own followers who weren't online, and to new followers).


2. **Want old material to break out to *strangers* again → never use a plain repost. Use a quote post (Quote Post)!**
In the code, a quote post is not a normal repost (its `is_retweet` is `false`, and the original sits in `quoted_tweet_id`), so: **① it's never blocked by `OONRetweetReplyFilter` and reaches strangers across the whole site normally; ② it qualifies for the small-account cold-start support (first 2 hours, 200 impressions); ③ a Quote's own engagement weight is a hefty `5.0`!** When you quote an old post, write a fresh angle tied to what's happening now (quote your three-month-old rental checklist during moving season, say) — in the algorithm's eyes, that's a brand-new original post at full strength.





---

## 12. Why must an important correction never live only in the old post's replies? And what to watch for when quoting someone to debunk them

1. **Why won't old readers ever see an important correction you add under the old post?**
The already-seen filter, `previously_seen_posts_filter.rs`, checks not just repost original IDs but also **the parent post ID of a direct reply (`in_reply_to_tweet_id`)**. Say 10,000 people saw your post A yesterday, and today you post an important correction B as a "reply" under it. Because B's direct parent A is already in those 10,000 people's seen lists, **the system filters your new correction B out as already-seen content too**, and old readers never encounter it on their home timelines! So **any update or correction that changes a conclusion has to go out as a brand-new original post** (or be published as a Quote of the original, per the section above), with a signpost link left in the old post's replies.


2. **The hidden splash damage when you quote someone to debunk them (`ancillary_vf_filter.rs`)**:
When you quote a post to comment on it or push back, the system checks the visibility of the quoted original. If that original later gets deleted, or is judged a violation (`Drop` / `Tombstone`), `ancillary_vf_filter.rs` removes your quote post from the recommendation candidates along with it. And if your own text is just one line like "this person is talking nonsense," once the original's card is gone, readers have no idea who you were even refuting. So when you quote someone, write their core claim and your evidence out in full, in your own text.



---

## 13. Links in the replies get reviewed just the same! Put the wrong link in your pin and your account wears a label for 7 days (plus the official self-check tool)

1. **"External links cost you 30–50% of your reach; putting them in the first reply avoids the penalty" — false!**
The scoring table has no formula that docks points for carrying an external link (the predicted `Open link` action even has a positive weight of `0.2`). The bot that hunts links, `LQ_Tweets_With_LQ_URL_Verdict_At_Mention_To_NonFollower_v2.bot`, in its latest **v2 form has removed, entirely, the old v1 exemption that excluded replies and reposts**. If the redirect chain contains a low-quality (`LOW_QUALITY`) URL and the final landing page isn't whitelisted, **it gets caught whether it sits in the body or hides in the first reply**, and a post-level `SPAM_HIGH_RECALL` label is written directly.


2. **The extremely nasty "pinned-post link bomb" (`PinnedLowQualityOrBadUrl.bot`)**:
When you change the post pinned to your profile, if the link inside the new pin resolves to `BAD` or `LOW_QUALITY` (an old domain that expired and was taken over, say), it **puts a 7-day account-level `SPAM_HIGH_RECALL` label on your entire account**, and for the next 7 days your new posts get removed at the stranger-recommendation entrance (`HomeRecommendations`)! And the code has **no logic for "unpin it and the label comes off immediately."** Before you pin anything with a link, click through and check the landing page yourself.


3. **Three more auto-labeling minefields you should never step on**:
* **3 sensitive posts among your most recent 5 (`postToUserLabelRules.strato`)**: it takes up to your 5 most recent posts, newest first. If 3 of them carry the `NSFW_HIGH_PRECISION` sensitive label (within 60 days — the same label from truth 11), then after a delay of roughly 10 minutes the **whole account** gets an account-level label. That label carries a 7-day validity in the code itself: for 7 days your new posts can't enter stranger recommendations, and then it expires on its own (that's this rule's own setting — the pinned-post path has its own separate 7 days, see point 2 above; don't merge the two paths into one). Note that `mediaOnly` defaults to `false` — **it counts posts, not images** (one post with 4 images counts as 1 post, and a text-only post also takes 1 slot in the 5-post window).


* **Replying to yourself in a chain under a big account (`TaskMultiStepReplySpamFilter`)**: if you comment under someone else's post (with the author having at least 1,000 followers) and then reply to your own comment (at least two levels of ancestry), and the AI judges it to be tiered spam promotion, those replies get their `ReplyRankingScore` written directly to **`0.0` — zero**.


* **Chinese copy-paste and engagement bait**: `BBQDuplicateTextProd.bot` runs a dedicated `duplicate_text_characters_cjk` duplicate-detection job for Chinese/Japanese/Korean characters; mass-posting near-identical copy earns a `COPYPASTA_SPAM` write. And the three engagement-inducement categories (`SpamEngagementBaiting`, `SpamEngagementFarming`, `SpamCardManipulation`) get **no exemption in the PTOS write path even for high-PageRank accounts and grey-badge verified accounts** — hit them and `SpamHighRecall` is written.




4. **Suspect you've been throttled? Self-check with the "X-ray" the official code points to!**
Don't ask followers who already follow you "can you still see me?" — most account labels only block **recommendation to strangers who don't follow you (`HomeRecommendations`)**, and of course followers still see you in their following feed (`TimelineHome`).
**The right move**: log in and open the transparency tool X published in its own algorithm repo: **https://x.com/i/jf/under_the_hood** (a trial feature; it usually requires an account at least a year old and at least 10 qualifying posts in the stats month). Check the stats month in the top right (`Period`), then look at `Post labels` (the share of posts restricted), `Account labels` (days the account was restricted), and `Effect on visibility` — whether you've been labeled is right there at a glance.



---

## 📚 What's in the full 75,000-word research report?

The 13 truths above are the hands-on core I distilled from the full report — a complete source-code audit, about 250,000 characters in the Chinese edition and roughly 75,000 words in English. So that every claim can stand up to scrutiny from programmers and creators alike, the full report keeps:

1. **98 sets of source links pinned to exact GitHub files and line numbers** (open one and you see the Rust / Python / Strato original);


2. **A side-by-side comparison table of all 24 prediction parameters across Home Mixer and VM Ranker**, plus the local recomputation I used to verify them;


3. **A list of 49 open questions, each marked "established code fact" vs. "still needs live data to confirm"** (an honest account of which claims the public source code proves beyond argument, and where the evidence boundary sits because live feature flags or unreleased model prompts aren't public).



The full report is on my blog: https://blog.go5.si/posts/x-algorithm-teardown/ . If you'd rather not check the findings one by one yourself, you can use the skill I already built from them: https://github.com/alexliyu7352/for-you-skills — the conclusions from this post and the handbook have been packaged into a skill you can call directly, so it can give a post a once-over before you publish. **Bookmark** this guide and keep it — next time you're torn between an Article and a long Post, wondering how to refresh an old post, how to split a bilingual release, or chasing a reach anomaly, running through it once will save you a lot of detours.

---

I'll keep doing these teardowns — taking algorithm source code apart line by line. AI, security, open source: three tracks, all of it stuff you can put to use right away. If this one helped, give it a like and a follow, and you'll see the next teardown the moment it's out. I'll be tracking the algorithm repo as it changes; the moment it updates, I'll sync-update the handbook and the skills repo, so the revised edition won't pass you by.
