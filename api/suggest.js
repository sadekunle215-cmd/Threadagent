module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { platform, handle, examples } = req.body;

  if (!examples) {
    return res.status(400).json({ error: "Examples are required" });
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: "OpenAI API key not configured" });
  }

  const platformGuides = {
    twitter:   "Twitter/X — short-form, punchy, max 280 chars per tweet. Threads work well. Hooks matter most.",
    linkedin:  "LinkedIn — professional but personal. Long-form posts do well. Storytelling + insight = engagement.",
    instagram: "Instagram — visual-first. Captions that add context or tell a story. Hooks in the first line.",
    facebook:  "Facebook — community-driven, conversational. Longer personal stories or helpful how-tos work best.",
    tiktok:    "TikTok — hook in the first 2 seconds, storytelling structure, strong CTA. Script must work as voiceover.",
  };
  const platformGuide = platformGuides[platform] || platformGuides.twitter;

  const systemPrompt = `
You are an expert content strategist who analyses a creator's posting style and generates hyper-relevant content ideas.
You study the tone, topics, language patterns, and structure of their examples, then suggest ideas that feel like a natural next post for them — not generic advice.

OUTPUT FORMAT:
Return ONLY a raw JSON object. No markdown. No explanation.
{
  "tone": "<one of: conversational | educational | storytelling | bold | analytical | personal | inspirational>",
  "topics": ["<main topic 1>", "<main topic 2>", "<main topic 3>"],
  "style_notes": "<2 sentences describing their writing style for use in generation>",
  "ideas": [
    "<specific, compelling content idea 1 — a full sentence describing exactly what the post is about>",
    "<specific, compelling content idea 2>",
    "<specific, compelling content idea 3>"
  ]
}

Rules for ideas:
- Each idea must be specific enough to generate from immediately (not vague like "post about productivity")
- Ideas should feel like they came from the creator, not a generic content calendar
- Vary the ideas — different angles, formats, or moments
- Make them timely and relevant to what real people in this niche talk about
`.trim();

  const userPrompt = `
Platform: ${platform} (${platformGuide})
Handle: ${handle}

THEIR CONTENT EXAMPLES / DESCRIPTION:
${examples}

Analyse their style and generate 3 specific content ideas that match their voice and niche.
Return ONLY the JSON object.
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
        temperature: 0.85,
        max_tokens: 800,
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

    let result;
    try {
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      result = JSON.parse(cleaned);
    } catch (e) {
      return res.status(500).json({ error: "Failed to parse style analysis", raw });
    }

    return res.status(200).json(result);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
