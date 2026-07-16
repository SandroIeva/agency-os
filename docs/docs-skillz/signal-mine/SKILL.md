---
name: signal-mine
description: Turn a raw dump of news articles, tweets, Reddit threads, trending posts, or research into content ideas mapped to the creator's niche and pillars. Triggers on "/signal-mine", "/signal", "mine this", "turn this into content", "what content is in here", "content ideas from this", or any time the creator pastes raw external input (news, social posts, threads, research) and wants the content angles extracted. The skill is the intelligence layer on top of whatever input pipeline the creator uses (manual, automation, scraper).
---

# Signal Mine

The skill that finds the signal in the noise. Paste a pile of raw inputs — news, tweets, Reddit, trending content — and get the content angles worth posting about.

## When to run this

- Daily/weekly content hunt — you've gathered raw inputs and need to find what's worth making
- After an automation drops a digest of trending content into your lap
- Researching a topic and drowning in tabs
- Trying to react fast to something breaking in your niche

## How it works

The creator brings the raw input — however they gathered it (manual copy-paste, an automation, a scraper, a newsletter they read). Claude doesn't fetch it. Claude's job is the intelligence: reading the noise and surfacing the content opportunities.

## Inputs

Required:
- The raw dump (articles, tweets, Reddit threads, trending posts, research notes — any volume)
- The creator's niche/pillars (read from a pillar doc if available, otherwise ask)

## Output structure

```
# Signal Mine — [date / topic]

## What's in here
[2-line summary of the input — what the dump contains]

## The signals worth posting about (ranked)

### 1. [The angle]
**The signal:** [What in the input triggered this]
**Why it's worth posting:** [Relevance to the creator's audience/goal]
**The take:** [The creator's specific angle — not just "talk about X" but the opinion/frame]
**Format:** [Best format for this — Reel, carousel, video, thread, newsletter]
**Draft hook:** [Climax-led opener]

### 2. ...
[Continue for 5-8 signals]

## The noise to ignore
[What's in the input that ISN'T worth posting about, and why — saves the creator from chasing weak signals]

## The fastest win
[Of all the signals, the one to post about TODAY while it's hot]
```

## Process

1. Read the entire input dump
2. Identify what's genuinely relevant to the creator's niche and audience
3. For each strong signal: the angle, why it matters, the specific take, the format, a draft hook
4. Explicitly call out the noise — what to ignore
5. Surface the fastest win — the time-sensitive one

## Critical rules

- The skill provides the TAKE, not just the topic. "Talk about the new AI model" is noise. "The new model kills the 'AI can't write' excuse — here's what that means for creators who still won't use it" is signal.
- Always include the noise-to-ignore section. Knowing what NOT to post is as valuable as knowing what to post.
- Rank by relevance to the creator's goal and audience, not by how big the news is.
- Every signal gets a draft hook. No exceptions.
- Flag time-sensitivity. Some signals are post-today; some are evergreen.
