module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { tweet, topic, brandColor, handle, tweetNum, tweetTotal, isHook, isCTA } = req.body;
  if (!tweet) return res.status(400).json({ error: "Tweet text is required" });

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) return res.status(500).json({ error: "OpenAI API key not configured" });

  const systemPrompt = `You are a professional infographic data extractor for Twitter/X thread graphics.
Given a tweet, extract its key visual content for a clean, editorial infographic card.

The card will be 1600x900px (Twitter landscape). Your job is to identify the BEST layout for this tweet's content.

Return ONLY valid JSON, no markdown, no preamble, no backticks:

{
  "layout": "stat" | "list" | "quote" | "comparison" | "tip",
  "headline": "Short punchy headline (4-8 words max)",
  "accentLabel": "2-3 word category label (e.g. DID YOU KNOW, KEY INSIGHT, FAST FACT)",
  "stat": null or { "value": "65,000", "unit": "TPS", "label": "transactions per second" },
  "points": [] or array of 3-4 short bullet strings (for list layout, max 8 words each),
  "leftCol": null or { "label": "Option A", "points": ["point1","point2","point3"] },
  "rightCol": null or { "label": "Option B", "points": ["point1","point2","point3"] },
  "quoteText": null or "The key quote or stat statement from the tweet (under 20 words)",
  "subtext": "Supporting line (max 10 words)",
  "tweetNum": ${tweetNum || 1},
  "tweetTotal": ${tweetTotal || 1}
}

Layout selection guide:
- "stat": tweet contains a key number, metric, or percentage — show it HUGE
- "list": tweet has 3-4 tips, steps, reasons, or items
- "quote": tweet has a strong statement, insight, or opinion to highlight
- "comparison": tweet contrasts two things — before/after, right/wrong, A vs B
- "tip": tweet is a single actionable piece of advice with supporting context`;

  try {
    const extractRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 600,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Tweet: "${tweet}"\nTopic: ${topic || "general"}\nBrand color: ${brandColor || "#e8ff47"}\nHandle: ${handle || ""}\nIs hook tweet: ${isHook || false}\nIs CTA tweet: ${isCTA || false}`
          }
        ]
      })
    });

    if (!extractRes.ok) {
      const err = await extractRes.json();
      return res.status(500).json({ error: err.error?.message || "GPT-4o extraction error" });
    }

    const extractData = await extractRes.json();
    let extracted;

    try {
      const raw = extractData.choices[0].message.content.trim().replace(/```json|```/g, "").trim();
      extracted = JSON.parse(raw);
    } catch {
      return res.status(500).json({ error: "Failed to parse GPT-4o response as JSON" });
    }

    // Ensure required fields always present
    extracted.tweetNum = tweetNum || 1;
    extracted.tweetTotal = tweetTotal || 1;
    extracted.layout = extracted.layout || "quote";
    extracted.headline = extracted.headline || "";
    extracted.accentLabel = extracted.accentLabel || "KEY INSIGHT";
    extracted.subtext = extracted.subtext || "";
    extracted.points = extracted.points || [];
    extracted.stat = extracted.stat || null;
    extracted.leftCol = extracted.leftCol || null;
    extracted.rightCol = extracted.rightCol || null;
    extracted.quoteText = extracted.quoteText || null;

    return res.status(200).json(extracted);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
