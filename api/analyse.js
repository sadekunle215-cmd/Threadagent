module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL is required" });

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: "OpenAI API key not configured" });
  }

  try {
    // Use jina.ai reader to scrape cleanly — no auth needed
    const scraped = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: "text/plain" },
    });

    if (!scraped.ok) {
      return res.status(500).json({ error: "Failed to fetch page content" });
    }

    const pageText = await scraped.text();

    if (!pageText || pageText.trim().length < 50) {
      return res.status(500).json({ error: "Page content too short or empty" });
    }

    // Extract topic + context from the page using OpenAI
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 500,
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content: `You are a content analyst. Given a web page's text, extract the core topic and relevant context that would help write a viral Twitter/X thread about it.
Return ONLY a JSON object with this exact shape — no markdown, no preamble:
{ "topic": "concise thread topic here", "context": "key details, stats, or talking points from the page" }`,
          },
          {
            role: "user",
            content: pageText.slice(0, 3000),
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      const err = await aiRes.json();
      return res.status(500).json({ error: err.error?.message || "OpenAI error" });
    }

    const aiData = await aiRes.json();
    const raw = aiData.choices[0].message.content.trim();

    let parsed;
    try {
      const cleaned = raw.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return res.status(500).json({ error: "Failed to parse AI response", raw });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
