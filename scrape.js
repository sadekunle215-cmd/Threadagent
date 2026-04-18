export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  // Validate URL
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({ error: "Invalid URL format" });
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: "OpenAI API key not configured" });
  }

  // Fetch the page HTML
  let html;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(parsedUrl.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(400).json({
        error: `Could not fetch page (HTTP ${response.status}). The site may block bots.`,
      });
    }

    html = await response.text();
  } catch (err) {
    if (err.name === "AbortError") {
      return res.status(408).json({ error: "Request timed out. The site took too long to respond." });
    }
    return res.status(400).json({ error: `Failed to fetch URL: ${err.message}` });
  }

  // Strip HTML to readable text
  const text = stripHtml(html);

  if (!text || text.length < 100) {
    return res.status(400).json({
      error: "Could not extract readable content from this page. Try pasting the brief manually.",
    });
  }

  // Truncate to avoid huge token usage (keep first 8000 chars)
  const truncated = text.slice(0, 8000);

  // Use GPT-4o to extract the brief/task
  const systemPrompt = `You are a gig brief extractor. Given raw page text from a bounty/freelance platform (like Superteam Earn, Gitcoin, Dework, etc.), extract the key information a writer needs to complete the task.

Return ONLY a JSON object with these fields:
{
  "title": "The gig/bounty title",
  "platform": "Platform name (e.g. Superteam Earn)",
  "task": "What exactly needs to be written/created",
  "topic": "The core topic or subject matter",
  "requirements": "Key requirements, guidelines, or constraints listed",
  "audience": "Target audience if mentioned",
  "reward": "Reward/payment if mentioned",
  "deadline": "Deadline if mentioned"
}

If a field is not found, use null. Be concise. Focus on what a writer needs to know.
Return ONLY the JSON object. No preamble, no markdown.`;

  try {
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.2,
        max_tokens: 800,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Extract the gig brief from this page content:\n\nURL: ${url}\n\nCONTENT:\n${truncated}`,
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      const err = await aiRes.json();
      return res.status(500).json({ error: err.error?.message || "OpenAI error during extraction" });
    }

    const aiData = await aiRes.json();
    const raw = aiData.choices[0].message.content.trim();

    let brief;
    try {
      const cleaned = raw.replace(/```json|```/g, "").trim();
      brief = JSON.parse(cleaned);
    } catch {
      return res.status(500).json({ error: "Could not parse brief extraction. Try pasting manually." });
    }

    return res.status(200).json({ brief, url });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// Strip HTML tags and clean up whitespace
function stripHtml(html) {
  return html
    // Remove script and style blocks entirely
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    // Remove all HTML tags
    .replace(/<[^>]+>/g, " ")
    // Decode common HTML entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    // Normalize whitespace
    .replace(/\s+/g, " ")
    .trim();
}
