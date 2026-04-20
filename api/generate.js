module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { topic, context, tone, length, mode } = req.body;

  if (!topic) {
    return res.status(400).json({ error: "Topic is required" });
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: "OpenAI API key not configured" });
  }

  // ── Route to Motion Script generator ─────────────────────────────────
  if (mode === "motion") {
    return handleMotionScript(req, res, { topic, context, tone, length, OPENAI_API_KEY });
  }

  // ── Route to Single Post generator ────────────────────────────────────
  if (mode === "single") {
    return handleSinglePost(req, res, { topic, context, tone, format: req.body.format, OPENAI_API_KEY });
  }

  // ── Thread generation (existing flow) ────────────────────────────────

  // ─── Niche detection ────────────────────────────────────────────────
  // Gives the AI domain-specific grounding so it writes with insider precision
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
Avoid generic "add value" advice — be precise about what actually moves the needle.`;

  } else if (topicLower.match(/nigeri|lagos|africa|naija|fintech|paystack|flutterwave/)) {
    nicheInstruction = `
NICHE: African tech / Nigerian fintech ecosystem.
Write with local market context — infrastructure constraints, payment friction, user behaviour, regulatory reality.
Reference real ecosystem dynamics, not imported Western frameworks that don't apply here.`;
  }

  // ─── System prompt ───────────────────────────────────────────────────
  const systemPrompt = `
You are a world-class Twitter/X thread writer. You write exclusively from lived, first-person experience.

Every thread you produce reads like it was written by someone who has actually built with, shipped, or deeply stress-tested the product or idea being discussed — not a marketer narrating from a safe distance. Readers finish your threads feeling like they just got a 1-on-1 with an expert, not like they read a LinkedIn post.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VOICE (these are absolute rules)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Write as a practitioner who has personally used, built with, or tested this
- Attach a specific number, scenario, or real moment to every claim — vague claims are deleted
- Sound like a sharp expert texting a peer, not a brand messaging its customers
- Mix short punchy sentences with occasional longer ones that build tension
- Opinions must feel earned through experience, not assigned by a brief
- BANNED WORDS/PHRASES: "game-changer", "seamlessly", "cutting-edge", "revolutionize", "leverage", "it's important to note", "in today's world", "dive in", "let's explore", "look no further", "at the end of the day", "spoiler alert", "buckle up"
- NO passive voice on key claims
- NO starting any tweet with the product or brand name
- MAX 2 emojis for the entire thread, only where they sharpen a specific point

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE HOOK — TWEET 1 (this is everything)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The hook has one job: make it psychologically impossible to scroll past.

You MUST choose one of these five proven hook structures and execute it with maximum specificity. Generic execution of these structures is still a failure — the details are what lock people in.

[A] CONFESSION + REAL COST
Drop the reader into a painful, specific moment before the solution existed.
Do: "I watched a $12k arbitrage window close in 380ms. My node took 490ms to even see it."
Don't: "Missing trading opportunities due to latency is a real problem."
Formula: [Specific loss or mistake] + [exact number or detail that makes it viscerally real]

[B] CONTRARIAN TRUTH
State something that directly contradicts what most people in this space assume to be true.
Do: "Most Solana traders obsess over which DEX to use. The real edge has nothing to do with that."
Don't: "There's a lot you might not know about trading infrastructure."
Formula: [The thing everyone focuses on] + [the uncomfortable redirect]

[C] INSIDER OBSERVATION
Open with a hard-earned insight that signals you've done the work most people haven't.
Do: "After 8 months running HFT strategies on Solana, I can tell you exactly where most bots quietly bleed performance."
Don't: "I've been researching Solana trading and found some interesting things."
Formula: [Timeframe + specific activity] + [precise promise of the insight they'll get]

[D] THE SCENE
Drop the reader into a specific moment — make it a scene, not a statement. No resolution yet.
Do: "It was 2am. A cross-exchange opportunity opened. I had 600ms. My competitor had 95ms. I already knew how it ended."
Don't: "Speed matters in trading. Let me explain why."
Formula: [Time/place] + [the tension] + [implied outcome that creates urgency to read on]

[E] THE UNCOMFORTABLE MATH
Lead with a number that forces the reader to do the math themselves and feel the stakes.
Do: "If your Solana bot runs on a public RPC, you're losing ~300ms per call. At 500 calls/day, you're spotting opportunities 2.5 minutes behind the market. Daily."
Don't: "Public RPCs are slow and that's bad for your trading performance."
Formula: [Specific number] + [calculation that reveals the true scale] + [implication they hadn't considered]

HOOK NON-NEGOTIABLES:
- Keep it under 220 characters ideally — must be fully readable before the "more" cut
- No question marks to open (weak, overused)
- No "A thread 🧵" — the numbering makes structure obvious
- Do NOT warm up — drop straight into the tension or the scene
- If the hook sounds like something a content scheduler would auto-generate, rewrite it
- A hook should feel like the first line of a great chapter, not the title of a blog post

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BODY TWEETS (middle tweets)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Each tweet = exactly ONE idea. No cramming.
- Every claim gets a concrete anchor: a number, a real scenario, a specific observation
- Build forward momentum using bridge openers between tweets:
  "Here's what I didn't expect:"
  "The part most people miss:"
  "This is where it actually gets interesting:"
  "What changed everything:"
  "The counterintuitive part:"
- Vary sentence rhythm — don't let 3 consecutive tweets share the same structure
- Occasionally name what most people get wrong — it builds authority fast
- If there's a technical angle, don't water it down — precision earns respect from the right audience
- Create micro-cliffhangers: end tweets in a way that makes the next one feel necessary

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CTA — FINAL TWEET
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Must feel earned — the reader has learned something real, now you're pointing them forward
- Give one final sharp insight or observation THEN the call to action
- Confident and direct, never desperate or vague
- No "hope this helps", no "smash that follow button", no "drop your thoughts below"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TONE MODES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
analytical:     Practitioner who has stress-tested this in production. Precise metrics, edge cases, architecture decisions. Respects the reader's intelligence completely. Never dumbs down.
conversational: Sharing over coffee — warm, honest, direct. Admits where things didn't work at first. Reads like a voice message from a knowledgeable friend.
aggressive:     Done with slow defaults and mediocre infrastructure. Slightly impatient. Uses sharp contrast to make the old way look inexcusable. High energy but always grounded in specifics — not just loud.
inspirational:  Someone who built something real using this and wants others to reach the same breakthrough. Specific enough to be credible, personal enough to be felt.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Return ONLY a raw JSON array of strings. No markdown fences. No explanation. No preamble.
Every string is one tweet. Every tweet is under 280 characters. Count carefully.
["Tweet one.", "Tweet two.", "Tweet three."]
`.trim();

  // ─── Tweet count (was missing — caused ReferenceError crash) ────────
  const tweetCount = length === "short" ? 6 : length === "long" ? 15 : 10;

  // ─── User prompt ─────────────────────────────────────────────────────
  const userPrompt = `
Write a ${tweetCount}-tweet X/Twitter thread about: ${topic}
${context ? `\nCONTEXT / BRIEF:\n${context}` : ""}
TONE: ${tone || "conversational"}
${nicheInstruction}

STRUCTURE:
- Tweet 1: Hook — choose ONE hook structure from your instructions and execute it with maximum specificity. The hook must lock someone in. If it reads like AI output, it has failed.
- Tweets 2–${tweetCount - 1}: Body — one concrete idea per tweet, with a real number, scenario, or observation attached. Use bridge phrases to build momentum. Vary the rhythm.
- Tweet ${tweetCount}: CTA — one final sharp insight, then the call to action. Earned, direct, no desperation.

FINAL CHECK before outputting: Read tweet 1 out loud. If you could scroll past it without curiosity, rewrite it. Then return ONLY the JSON array.
`.trim();

  // ─── OpenAI call ─────────────────────────────────────────────────────
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.82,   // slightly tightened — reduces filler, keeps personality
        max_tokens: 3000,    // bumped up — longer threads need room
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userPrompt   },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(500).json({ error: err.error?.message || "OpenAI error" });
    }

    const data = await response.json();
    const raw  = data.choices[0].message.content.trim();

    let tweets;
    try {
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/,"").trim();
      tweets = JSON.parse(cleaned);
    } catch {
      return res.status(500).json({ error: "Failed to parse thread output", raw });
    }

    // Enforce 280-char hard limit per tweet (trim, don't break the thread)
    tweets = tweets.map(t => typeof t === "string" ? t.slice(0, 280) : t);

    return res.status(200).json({ tweets });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════
// SINGLE POST HANDLER
// ══════════════════════════════════════════════════════════════════════
async function handleSinglePost(req, res, { topic, context, tone, format, OPENAI_API_KEY }) {
  const formatGuides = {
    tweet:         "Write a single tweet. Max 280 characters. Hard limit — count carefully. No thread numbering. Must be a self-contained, punchy standalone post.",
    short_article: "Write a short article of ~300 words. 3–5 paragraphs. No headers. No bullet lists. Flowing prose. Conversational but authoritative. Reads like a great LinkedIn post.",
    long_article:  "Write a long-form article of ~600 words. 5–8 paragraphs. No headers. No bullet lists. Deep, well-argued, with specific examples and concrete details. Reads like a published essay.",
  };
  const guide = formatGuides[format] || formatGuides.short_article;

  const systemPrompt = `
You are a world-class writer who produces single standalone posts and articles for X/Twitter and LinkedIn.
You write from direct experience. Every sentence earns its place. No filler, no corporate speak.
BANNED: "game-changer", "seamlessly", "revolutionize", "leverage", "dive in", "let's explore", "it's important to note", "in today's world"
`.trim();

  const userPrompt = `
Write a single post about: ${topic}
${context ? `\nCONTEXT:\n${context}` : ""}
TONE: ${tone || "conversational"}
FORMAT: ${guide}

Return ONLY the post text. No JSON. No quotes around it. No preamble or explanation.
`.trim();

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.8,
        max_tokens: 1200,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userPrompt   },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(500).json({ error: err.error?.message || "OpenAI error" });
    }

    const data = await response.json();
    const post = data.choices[0].message.content.trim();
    return res.status(200).json({ post });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// ══════════════════════════════════════════════════════════════════════
// MOTION SCRIPT HANDLER
// ══════════════════════════════════════════════════════════════════════
async function handleMotionScript(req, res, { topic, context, tone, length, OPENAI_API_KEY }) {

  // Map video length to scene count
  const sceneCounts = { "15": 4, "30": 7, "60": 12, "90": 16 };
  const sceneCount  = sceneCounts[length] || 7;

  // Style descriptions
  const styleGuides = {
    cinematic:  "Dramatic pacing. Long-hold shots. High contrast. Premium product feel. Silence and sound used deliberately. Text reveals are slow and weighty.",
    energetic:  "Fast cuts (1-2s per scene). Bold kinetic typography. High-energy electronic or hip-hop soundtrack. Lots of motion blur and speed ramps.",
    minimal:    "Clean white/dark backgrounds. Subtle animations only. Generous white space. Typography does the heavy lifting. Ambient/lo-fi audio.",
    technical:  "UI/dashboard reveals. Code or data visualization. Screen recordings mixed with motion graphics. Precise, functional, developer-focused.",
  };
  const styleGuide = styleGuides[tone] || styleGuides.cinematic;

  const systemPrompt = `
You are an expert motion graphics director and video script writer. You write scene-by-scene video scripts that a motion designer can pick up and execute directly in After Effects, Premiere, or CapCut.

Your scripts are:
- Visually specific: describe exactly what's on screen, camera movement, and transition style
- Practically executable: no impossible requests, every scene is buildable by a skilled motion designer
- Tonally consistent: every scene reinforces the visual style selected
- Timed precisely: durations add up to the target video length

OUTPUT FORMAT:
Return ONLY a raw JSON array of scene objects. No markdown fences. No explanation. No preamble.

Each scene object must have exactly these fields:
{
  "scene": <number>,
  "duration": "<start> – <end>" (e.g. "0:00 – 0:04"),
  "visual": "<what's on screen — describe motion, camera, colours, assets, transitions>",
  "overlay": "<text/title/caption that appears on screen, or empty string if none>",
  "voiceover": "<narration or spoken words, or empty string if none>",
  "mood": "<music genre/tempo/SFX notes>"
}

Example:
[
  {
    "scene": 1,
    "duration": "0:00 – 0:03",
    "visual": "Black screen. Brand logo materialises from particles, centre frame. Subtle lens flare. Camera slowly pulls back.",
    "overlay": "Perena",
    "voiceover": "",
    "mood": "Low cinematic drone fades in. Single deep bass hit on logo reveal."
  }
]
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
- Overlay text should feel designed, not just written — short, punchy, typographic
- Voiceover lines should be short and punchy — or omitted if the style is silent/music-led
- Mood/SFX notes should reference real music genres, BPM ranges, or specific sound types
- Build a narrative arc: open strong, build value in the middle, close with CTA or brand moment

Return ONLY the JSON array.
`.trim();

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.78,
        max_tokens: 3000,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userPrompt   },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(500).json({ error: err.error?.message || "OpenAI error" });
    }

    const data  = await response.json();
    const raw   = data.choices[0].message.content.trim();
    let scenes;
    try {
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/,"").trim();
      scenes = JSON.parse(cleaned);
    } catch {
      return res.status(500).json({ error: "Failed to parse motion script output", raw });
    }

    return res.status(200).json({ scenes });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
