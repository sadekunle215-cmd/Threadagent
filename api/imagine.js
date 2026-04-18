module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) return res.status(500).json({ error: "OpenAI API key not configured" });

  // ── MODE: DALL-E image generation (when request contains a "prompt" field) ──
  if (req.body.prompt) {
    const { prompt, size = "1024x1024" } = req.body;
    try {
      const imgRes = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt,
          n: 1,
          size,
          quality: "standard",
          response_format: "url",
        }),
      });

      if (!imgRes.ok) {
        const err = await imgRes.json();
        return res.status(500).json({ error: err.error?.message || "DALL-E error" });
      }

      const imgData = await imgRes.json();
      const url = imgData.data?.[0]?.url;
      if (!url) return res.status(500).json({ error: "No image URL returned from DALL-E" });

      return res.status(200).json({ url });

    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── MODE: Layout JSON extraction (when request contains a "tweet" field) ──
  const { tweet, topic, brandColor, handle, tweetNum, tweetTotal, isHook, isCTA } = req.body;
  if (!tweet) return res.status(400).json({ error: "Tweet text or prompt is required" });

  const systemPrompt = `You are a professional infographic data extractor for Twitter/X thread graphics.
Given a tweet, extract its key visual content for a clean, editorial infographic card rendered on a 1600x900px canvas with a gradient background.

Return ONLY valid JSON, no markdown, no backticks:

{
  "layout": "stat" | "list" | "data" | "comparison" | "quote",
  "headline": "Short punchy headline (4-8 words)",
  "accentLabel": "2-3 word category label (e.g. KEY INSIGHT, FAST FACT, PRO TIP)",
  "subtext": "Supporting line (max 10 words)",
  "stat": null or { "value": "65,000", "unit": "TPS", "label": "transactions per second", "pct": 78 },
  "points": [],
  "leftCol": null or { "label": "Before", "points": ["point1","point2","point3"] },
  "rightCol": null or { "label": "After", "points": ["point1","point2","point3"] },
  "quoteText": null or "Key quote from tweet (under 20 words)",
  "chartType": null or "bar" | "numbers" | "donut",
  "chartData": null or array of { "label": "...", "value": "...", "pct": 0-100 }
}

Layout guide:
- "stat": tweet has ONE key number/metric — make it the hero. Include stat object. Set pct (0-100) if it's a percentage or can be expressed as progress.
- "list": tweet has 3-4 distinct tips, steps, or reasons — fill points array (3-4 items, max 10 words each).
- "data": tweet has MULTIPLE numbers, a comparison of values, or a breakdown — use chartData array (3-5 items). Set chartType: "bar" if items have percentages/rankings, "numbers" if just raw values, "donut" if single percentage.
- "comparison": tweet contrasts two things (before/after, wrong/right, old/new) — fill leftCol and rightCol (2-4 points each).
- "quote": tweet is a strong opinion, insight, or standalone statement — use quoteText.

For chartData items: always include a numeric "value" string (e.g. "65K", "$2.4B", "3x") and "label". Add "pct" (0-100) only for bar charts where relative size makes sense.
Do NOT include pct for raw number grids.`;

  try {
    const extractRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 700,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Tweet: "${tweet}"\nTopic: ${topic || "general"}\nBrand color: ${brandColor || "#6366f1"}\nHandle: ${handle || ""}\nTweet ${tweetNum || 1} of ${tweetTotal || 1}. Is hook: ${isHook || false}. Is CTA: ${isCTA || false}`,
          },
        ],
      }),
    });

    if (!extractRes.ok) {
      const err = await extractRes.json();
      return res.status(500).json({ error: err.error?.message || "GPT-4o error" });
    }

    const extractData = await extractRes.json();
    let d;
    try {
      const raw = extractData.choices[0].message.content.trim().replace(/```json|```/g, "").trim();
      d = JSON.parse(raw);
    } catch {
      return res.status(500).json({ error: "Failed to parse GPT-4o response" });
    }

    // Ensure required fields
    d.tweetNum = tweetNum || 1;
    d.tweetTotal = tweetTotal || 1;
    d.layout = d.layout || "quote";
    d.headline = d.headline || "";
    d.accentLabel = d.accentLabel || "KEY INSIGHT";
    d.subtext = d.subtext || "";
    d.points = d.points || [];
    d.stat = d.stat || null;
    d.leftCol = d.leftCol || null;
    d.rightCol = d.rightCol || null;
    d.quoteText = d.quoteText || null;
    d.chartType = d.chartType || null;
    d.chartData = d.chartData || null;

    return res.status(200).json(d);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
