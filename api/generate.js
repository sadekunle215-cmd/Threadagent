module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { topic, context, tone, length } = req.body;

  if (!topic) {
    return res.status(400).json({ error: "Topic is required" });
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: "OpenAI API key not configured" });
  }

  const tweetCount = length === "short" ? "5-7" : length === "medium" ? "8-12" : "13-18";

  const systemPrompt = `You are an elite Twitter/X thread writer. Your threads go viral because they combine:
- A devastating hook that stops the scroll
- Storytelling that feels personal and real
- Insights that make people feel smarter
- Conversational tone — like texting a sharp friend, not writing a blog
- Zero fluff. Every tweet earns its place or gets cut.

RULES:
1. Tweet 1 is ALWAYS the hook — bold claim, counterintuitive stat, or a story opener. No "In this thread" garbage.
2. Each tweet must flow into the next. Use cliffhangers, callbacks, and payoffs.
3. Max 280 characters per tweet. Count carefully.
4. No emojis unless they add punch (use sparingly, max 1-2 per thread).
5. Numbers and specific details beat vague claims every time.
6. Last tweet = strong CTA or a final gut-punch insight. No "hope this helps".
7. Use short sentences. White space is your friend.
8. Write in first person where it fits — makes it feel lived-in.

OUTPUT FORMAT:
Return ONLY a JSON array of tweet strings. No preamble, no markdown, no explanation.
Example: ["Tweet 1 text", "Tweet 2 text", "Tweet 3 text"]`;

  const userPrompt = `Write a ${tweetCount} tweet thread about: "${topic}"
${context ? `\nAdditional context: ${context}` : ""}
${tone ? `\nTone: ${tone}` : ""}

Make it the kind of thread that gets bookmarked and quoted. No filler. Pure value.`;

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
        max_tokens: 2500,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(500).json({ error: err.error?.message || "OpenAI error" });
    }

    const data = await response.json();
    const raw = data.choices[0].message.content.trim();

    let tweets;
    try {
      const cleaned = raw.replace(/```json|```/g, "").trim();
      tweets = JSON.parse(cleaned);
    } catch {
      return res.status(500).json({ error: "Failed to parse thread output", raw });
    }

    return res.status(200).json({ tweets });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
