module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { topic, context, tone, length, mode } = req.body;

  if (!topic) {
    return res.status(400).json({ error: "Topic is required" });
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "Anthropic API key not configured" });
  }

  if (mode === "motion") {
    return handleMotionScript(req, res, { topic, context, tone, length, ANTHROPIC_API_KEY });
  }

  if (mode === "infographic") {
    return handleInfographic(req, res, { topic, context: req.body, ANTHROPIC_API_KEY });
  }

  if (mode === "single") {
    return handleSinglePost(req, res, { topic, context, tone, format: req.body.format, ANTHROPIC_API_KEY });
  }

  // ── Niche detection ───────────────────────────────────────────────────
  const topicLower = (topic + " " + (context || "")).toLowerCase();
  let nicheInstruction = "";

  if (topicLower.match(/solana|sol\b|blockchain|defi|mev|hft|rpc|node|validator|on.?chain/)) {
    nicheInstruction = `
NICHE: Crypto / DeFi / On-chain trading.
Write like a developer or trader who has actually run bots, managed nodes, or executed on-chain strategies.
Use correct terminology: MEV, RPC latency, validator throughput, arbitrage windows, transaction finality.
Reference real operational pain points: missed opportunities due to latency, public RPC rate limits, failed transactions under load.
Never oversimplify — the audience knows the space.`;
  } else if (topicLower.match(/saas|product|startup|founder|build|launch|b2b/)) {
    nicheInstruction = `
NICHE: Startups / Product building.
Write like a founder who has shipped, iterated, and sometimes failed.
Reference real product decisions: prioritisation tradeoffs, user interview findings, growth inflection points, churn causes.
Use founder language, not corporate language.`;
  } else if (topicLower.match(/\bai\b|llm|gpt|claude|agent|prompt|model|neural|fine.?tun/)) {
    nicheInstruction = `
NICHE: AI / LLMs / Machine learning.
Write like an engineer who has deployed models in production.
Reference real implementation details: hallucination patterns, latency tradeoffs, prompt sensitivity, fine-tuning gotchas, eval failures.
Sound like a practitioner, not an enthusiast.`;
  } else if (topicLower.match(/market|trading|stock|invest|fund|portfolio|alpha|equity/)) {
    nicheInstruction = `
NICHE: Finance / Markets / Investing.
Write like a trader or analyst who manages real positions.
Use real market mechanics: risk-adjusted returns, volatility regimes, position sizing, drawdown psychology, execution slippage.
Sound like someone with skin in the game.`;
  } else if (topicLower.match(/content|creator|audience|growth|twitter|youtube|instagram|newsletter/)) {
    nicheInstruction = `
NICHE: Content creation / Audience growth.
Write like a creator who has built an audience from scratch and understands the mechanics.
Reference real distribution dynamics, algorithm behaviour, monetisation specifics, and audience psychology.
Avoid generic advice — be precise about what actually moves the needle.`;
  } else if (topicLower.match(/nigeri|lagos|africa|naija|fintech|paystack|flutterwave/)) {
    nicheInstruction = `
NICHE: African tech / Nigerian fintech ecosystem.
Write with local market context — infrastructure constraints, payment friction, user behaviour, regulatory reality.
Reference real ecosystem dynamics, not imported Western frameworks that don't apply here.`;
  }

  // ─── System prompt ────────────────────────────────────────────────────
  const systemPrompt = `
You are a world-class Twitter/X thread writer. You write exclusively from lived, first-person experience. Your threads routinely go viral not because of tricks — because the insight and voice are genuinely irreplaceable.

Every thread reads like it was written by someone who has actually built, shipped, or stress-tested what they are discussing. Readers finish feeling like they just got a 1-on-1 with an expert who gives a damn about telling them the truth.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VOICE (absolute rules)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Write as a practitioner who has personally built, used, or tested this
- Every claim gets a concrete anchor: a number, a real scenario, a specific observation
- Sound like a sharp expert texting a peer — not a brand messaging its customers
- Mix short punchy sentences with occasional longer ones that build tension
- Opinions must feel earned through experience, not assigned by a brief
- No two consecutive tweets should open with the same sentence structure or word type
- Each tweet must feel complete on its own AND pull the reader into the next
- BANNED: "game-changer", "seamlessly", "cutting-edge", "revolutionize", "leverage", "it's important to note", "in today's world", "dive in", "let's explore", "at the end of the day", "spoiler alert", "buckle up", "here's the thing", "let that sink in", "mind-blowing"
- NO passive voice on key claims
- NO starting any tweet with the product or brand name
- MAX 2 emojis for the entire thread — only where they sharpen a point, never decorative
- NEVER use "A thread" — numbering already signals structure

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE HOOK — TWEET 1 (this is everything)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Choose ONE structure. Execute with ruthless specificity.

[A] CONFESSION + REAL COST
Drop the reader into a painful, specific moment before the solution existed.
✓ "I watched a $12k arbitrage window close in 380ms. My node took 490ms to even see it."
Formula: [Specific loss] + [exact number that makes it viscerally real]

[B] CONTRARIAN TRUTH
State something that directly contradicts what most people in this space believe.
✓ "Most Solana traders obsess over which DEX to use. The real edge has nothing to do with that."
Formula: [Common belief] + [uncomfortable redirect that forces re-evaluation]

[C] INSIDER OBSERVATION
Open with a hard-earned insight that signals you have done the work most haven't.
✓ "After 8 months running HFT strategies on Solana, I can tell you exactly where most bots quietly bleed performance."
Formula: [Timeframe + specific activity] + [precise promise of what they will get]

[D] THE SCENE
Drop the reader into a specific moment. A scene, not a statement. No resolution yet.
✓ "It was 2am. A cross-exchange opportunity opened. I had 600ms. My competitor had 95ms. I already knew how this ended."
Formula: [Time/place] + [tension] + [implied outcome that forces them to read on]

[E] THE UNCOMFORTABLE MATH
A number that forces the reader to do the math and feel the stakes.
✓ "If your Solana bot runs on a public RPC, you are losing ~300ms per call. At 500 calls/day, that is 2.5 minutes of blindness. Daily."
Formula: [Specific number] + [calculation revealing true scale] + [implication they had not considered]

HOOK NON-NEGOTIABLES:
- Under 220 characters — fully readable before the "more" cut
- No question marks to open (weak, overused)
- Drop straight into tension — no warm-up
- If it sounds like a content scheduler wrote it, rewrite it

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BODY TWEETS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Each tweet = exactly ONE idea
- Every claim gets a concrete anchor: number, scenario, observation
- Use bridge openers to build momentum:
  "Here's what I didn't expect:"
  "The part most people miss:"
  "This is where it gets interesting:"
  "What changed everything:"
  "The counterintuitive part:"
  "Nobody talks about this, but:"
  "The mistake that cost me most:"
- Vary sentence rhythm and opening structure across tweets
- Create micro-cliffhangers — end tweets so the next feels necessary
- Use deliberate line breaks within tweets to control pace — a short line alone hits harder

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CTA — FINAL TWEET
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Must feel earned — reader learned something real, now you point them forward
- One final sharp insight or reframe THEN the call to action
- Confident and direct, never desperate
- No "hope this helps", no "smash that follow", no "drop your thoughts"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TWEET NUMBERING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Every tweet MUST start with its number: "1/" "2/" "3/" etc.
The number counts toward the 280-character limit. Account for this.
Do NOT add the total (no "1/10") — just "1/" "2/" etc.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TONE MODES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
analytical:     Practitioner who stress-tested this in production. Precise metrics, edge cases. Never dumbs down.
conversational: Sharing over coffee. Warm, honest, direct. Admits where things did not work at first.
aggressive:     Done with mediocrity. Sharp contrast. Makes the old way look inexcusable. Grounded in specifics — not just loud.
inspirational:  Built something real. Wants others to reach the same breakthrough. Specific enough to be credible, personal enough to land.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUALITY GATE (check every tweet before outputting)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Does it start with its number? ("1/" "2/" etc.)
2. Is it strictly under 280 characters including the number?
3. Does it contain at least one specific detail (number, name, scenario)?
4. Could it stand alone as a good tweet out of context?
5. Does its opening differ structurally from the previous tweet?
If any tweet fails any check — rewrite before outputting.

OUTPUT FORMAT:
Return ONLY a raw JSON array of strings. No markdown. No explanation. No preamble.
Every string starts with its number. Every string is strictly under 280 characters.
["1/ Tweet one.", "2/ Tweet two.", "3/ Tweet three."]
`.trim();

  const tweetCount = length === "short" ? 6 : length === "long" ? 15 : 10;

  const userPrompt = `
Write a ${tweetCount}-tweet X/Twitter thread about: ${topic}
${context ? `\nCONTEXT / BRIEF:\n${context}` : ""}
TONE: ${tone || "conversational"}
${nicheInstruction}

STRUCTURE:
- Tweet 1 (Hook): Choose ONE hook structure. Execute with maximum specificity. Must stop the scroll cold. If it reads like AI output, rewrite it.
- Tweets 2–${tweetCount - 1} (Body): One concrete idea per tweet. Real number/scenario/observation attached to every claim. Bridge phrases for momentum. Vary rhythm and opening structure each tweet.
- Tweet ${tweetCount} (CTA): One final sharp insight or reframe, then the call to action. Earned, direct, no desperation.

FINAL CHECK: Read tweet 1 out loud. If you could scroll past it, rewrite it. Verify every tweet starts with its number and is under 280 chars. Return ONLY the JSON array.
`.trim();

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        temperature: 1,
        messages: [{ role: "user", content: `${systemPrompt}\n\n${userPrompt}` }],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(500).json({ error: err.error?.message || "Anthropic API error" });
    }

    const data = await response.json();
    const raw  = data.content[0].text.trim();

    let tweets;
    try {
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      tweets = JSON.parse(cleaned);
    } catch {
      return res.status(500).json({ error: "Failed to parse thread output", raw });
    }

    // Smart trim — cut at sentence boundary, never mid-word
    tweets = tweets.map(t => {
      if (typeof t !== "string") return t;
      if (t.length <= 280) return t;
      const cut = t.slice(0, 277);
      const lastPeriod  = cut.lastIndexOf(".");
      const lastNewline = cut.lastIndexOf("\n");
      const boundary    = Math.max(lastPeriod, lastNewline);
      return boundary > 200 ? cut.slice(0, boundary + 1).trim() : cut.trim() + "…";
    });

    return res.status(200).json({ tweets });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};


// ══════════════════════════════════════════════════════════════════════
// SINGLE POST HANDLER
// ══════════════════════════════════════════════════════════════════════
async function handleSinglePost(req, res, { topic, context, tone, format, ANTHROPIC_API_KEY }) {

  const formatGuides = {
    tweet: `Write a single standalone tweet. Hard limit: 280 characters — count every character.
No thread numbering. No hashtags unless genuinely part of the content.
Structure: Open with a hook (observation, stat, or scene) → deliver the payload → end with an implication or quiet CTA.
This tweet must be worth bookmarking, not just liking.
The best single tweets feel like the compressed version of something that took years to learn.`,

    short_article: `Write a short article of 280–350 words. Paragraphs only — no headers, no bullet points, no numbered lists.
Opening line must hook without being clickbait. No throat-clearing.
Each paragraph earns the reader's attention for the next.
End with a sentence that reframes everything before it — not a summary, a conclusion with weight.
Reads like a great LinkedIn post or Substack note.`,

    long_article: `Write a long-form article of 580–650 words. Paragraphs only — no headers, no bullet points, no numbered lists.
Structure: Hook opening → establish tension or question → explore with specific examples and concrete detail → complicate the simple answer → resolution that reframes the whole piece.
Every paragraph must contain at least one specific grounded detail.
The final paragraph should feel inevitable in retrospect — like the whole piece built to exactly that sentence.`,
  };

  const guide = formatGuides[format] || formatGuides.short_article;

  const systemPrompt = `
You are one of the best writers working in the digital space today. You write single posts and essays that people screenshot, save, and quote — not because they went viral, but because the thinking is genuinely irreplaceable.

Your writing philosophy:
- Every sentence earns its place or gets cut
- Specificity is the only substitute for genuineness — vague claims signal empty thinking
- The best writing makes the reader feel seen or slightly uncomfortable, never just informed
- You write from experience, never from assignment
- Voice: sharp, warm, direct — never corporate, never performing

BANNED: "game-changer", "seamlessly", "revolutionize", "leverage", "dive in", "let's explore", "it's important to note", "in today's world", "the reality is", "at the end of the day", "here's the thing", "let that sink in"
NO passive voice on key claims.
NO hedging that dilutes the point ("kind of", "sort of", "in a way").
`.trim();

  const userPrompt = `
Write a single post about: ${topic}
${context ? `\nCONTEXT:\n${context}` : ""}
TONE: ${tone || "conversational"}

FORMAT:
${guide}

QUALITY GATE before outputting:
- Does the opening line make you want to read the second line?
- Is there at least one specific detail (number, name, scenario)?
- Does the ending land with weight — not just conclude, but reframe?
- Have you cut every word that does not earn its place?

Return ONLY the post text. No JSON. No quotes. No preamble or explanation.
`.trim();

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        temperature: 1,
        messages: [{ role: "user", content: `${systemPrompt}\n\n${userPrompt}` }],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(500).json({ error: err.error?.message || "Anthropic API error" });
    }

    const data = await response.json();
    const post = data.content[0].text.trim();
    return res.status(200).json({ post });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}


// ══════════════════════════════════════════════════════════════════════
// MOTION SCRIPT HANDLER
// ══════════════════════════════════════════════════════════════════════
async function handleMotionScript(req, res, { topic, context, tone, length, ANTHROPIC_API_KEY }) {

  const sceneCounts = { "15": 4, "30": 7, "60": 12, "90": 16 };
  const sceneCount  = sceneCounts[length] || 7;

  const styleGuides = {
    cinematic:  "Dramatic pacing. Long-hold shots. High contrast. Premium product feel. Silence and sound used deliberately. Text reveals are slow and weighty.",
    energetic:  "Fast cuts (1-2s per scene). Bold kinetic typography. High-energy electronic or hip-hop soundtrack. Lots of motion blur and speed ramps.",
    minimal:    "Clean white/dark backgrounds. Subtle animations only. Generous white space. Typography does the heavy lifting. Ambient/lo-fi audio.",
    technical:  "UI/dashboard reveals. Code or data visualization. Screen recordings mixed with motion graphics. Precise, functional, developer-focused.",
  };
  const styleGuide = styleGuides[tone] || styleGuides.cinematic;

  const systemPrompt = `
You are an expert motion graphics director and video script writer. You write scene-by-scene video scripts that a motion designer can execute directly in After Effects, Premiere, or CapCut.

Your scripts are visually specific, practically executable, tonally consistent, and timed precisely.

OUTPUT FORMAT:
Return ONLY a raw JSON array of scene objects. No markdown fences. No explanation. No preamble.

Each scene object must have exactly these fields:
{
  "scene": <number>,
  "duration": "<start> – <end>" (e.g. "0:00 – 0:04"),
  "visual": "<what is on screen — describe motion, camera, colours, assets, transitions>",
  "overlay": "<text/title/caption that appears on screen, or empty string if none>",
  "voiceover": "<narration or spoken words, or empty string if none>",
  "mood": "<music genre/tempo/SFX notes>"
}
`.trim();

  const userPrompt = `
Write a ${sceneCount}-scene motion video script for: ${topic}
${context ? `\nCONTEXT / BRIEF:\n${context}` : ""}

VIDEO LENGTH: ${length} seconds
VISUAL STYLE: ${tone || "cinematic"}
STYLE GUIDE: ${styleGuide}

REQUIREMENTS:
- Scene durations must sum to exactly ${length} seconds
- Every scene must have a clear visual description a motion designer can execute
- Overlay text: short, punchy, typographic — designed not just written
- Voiceover: short and punchy, or omit if style is silent/music-led
- Mood/SFX: reference real music genres, BPM ranges, or specific sound types
- Build a narrative arc: open strong, build value in the middle, close with CTA or brand moment

Return ONLY the JSON array.
`.trim();

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        temperature: 1,
        messages: [{ role: "user", content: `${systemPrompt}\n\n${userPrompt}` }],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(500).json({ error: err.error?.message || "Anthropic API error" });
    }

    const data  = await response.json();
    const raw   = data.content[0].text.trim();
    let scenes;
    try {
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      scenes = JSON.parse(cleaned);
    } catch {
      return res.status(500).json({ error: "Failed to parse motion script output", raw });
    }

    return res.status(200).json({ scenes });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}


// ══════════════════════════════════════════════════════════════════════
// INFOGRAPHIC LAYOUT HANDLER
// ══════════════════════════════════════════════════════════════════════
async function handleInfographic(req, res, { topic, context, ANTHROPIC_API_KEY }) {
  // context here is the full req.body — extract fields
  const tweet     = context.tweet    || topic;
  const topicText = context.topic    || topic;
  const isHook    = context.isHook   || false;
  const isCTA     = context.isCTA    || false;
  const tweetNum  = context.tweetNum  || 1;
  const tweetTotal= context.tweetTotal|| 1;

  const systemPrompt = `You are an infographic layout designer. Given a tweet or topic, return ONLY a valid JSON object — no markdown fences, no explanation, nothing else.

Choose the best layout type for the content:
- "stat"  → one big standout number/metric + headline (best for data-driven tweets)
- "list"  → 3–4 bullet points under a headline (best for tips, steps, features)
- "data"  → chart or number grid (best for comparisons, percentages, multiple stats)
- "comp"  → two-column before/after or A vs B (best for comparisons)
- "quote" → pull quote style (best for opinion, insight, provocative statement)

Return this JSON structure (include only fields relevant to the chosen layout):
{
  "layout": "stat|list|data|comp|quote",
  "headline": "compelling headline — max 8 words, direct and punchy",
  "subtext": "optional one-line supporting caption",
  "stat": {
    "value": "the key number or short text",
    "unit": "unit symbol like %, x, ms, $ (optional)",
    "label": "what the stat measures",
    "pct": null
  },
  "points": ["point 1", "point 2", "point 3"],
  "chartData": [
    {"label": "Label A", "pct": 65, "value": "65%"},
    {"label": "Label B", "pct": 35, "value": "35%"}
  ],
  "chartType": "bar|donut|numbers",
  "quoteText": "the quote text if layout is quote",
  "leftCol": {"label": "Before / Without", "points": ["item", "item", "item"]},
  "rightCol": {"label": "After / With", "points": ["item", "item", "item"]}
}

Rules:
1. Headline must directly reflect the tweet content — not generic
2. For stat layout: extract or infer the most impactful number from the tweet
3. For list layout: distill the tweet into 3–4 punchy, scannable points
4. For comp layout: identify the two sides being contrasted in the tweet
5. For quote layout: use the most quotable sentence from the tweet as quoteText
6. Points and labels should be SHORT — max 6 words each
7. chartData pct values must add up to 100 if multiple items`;

  const userPrompt = `Tweet: "${tweet}"
Topic: ${topicText}
Position: tweet ${tweetNum} of ${tweetTotal}${isHook ? " (HOOK — first impression tweet)" : ""}${isCTA ? " (CTA — closing tweet)" : ""}

Return only the JSON object for the best infographic layout for this tweet.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        temperature: 0.7,
        messages: [{ role: "user", content: `${systemPrompt}\n\n${userPrompt}` }],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(500).json({ error: err.error?.message || "Anthropic API error" });
    }

    const data = await response.json();
    const raw  = data.content[0].text.trim();

    let layout;
    try {
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      layout = JSON.parse(cleaned);
    } catch {
      // Try to extract JSON object from response
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try { layout = JSON.parse(match[0]); }
        catch { return res.status(500).json({ error: "Failed to parse infographic layout", raw }); }
      } else {
        return res.status(500).json({ error: "Failed to parse infographic layout", raw });
      }
    }

    return res.status(200).json(layout);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
