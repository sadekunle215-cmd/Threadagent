module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { tweet, topic, brandColor, handle } = req.body;
  if (!tweet) return res.status(400).json({ error: "Tweet text is required" });

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) return res.status(500).json({ error: "OpenAI API key not configured" });

  const color = brandColor || "#e8ff47";

  try {
    // Step 1: GPT extracts the visual data from the tweet
    const extractRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 400,
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content: `You are a visual director creating editorial social media cards for Twitter threads.
Given a tweet, extract the key visual elements and a DALL-E background prompt.

Return ONLY valid JSON (no markdown) with this shape:
{
  "headline": "The single most important phrase or concept (3-7 words max, punchy)",
  "stat": "A key number or metric if present, else null (e.g. '65,000 TPS', '$2.4B', '3x faster')",
  "subtext": "A short supporting line (max 8 words)",
  "bgPrompt": "DALL-E prompt for a dark, moody, cinematic background photo. No text. Real photography style. Related to the tweet topic. Dark tones. Dramatic lighting. Shot on film."
}`
          },
          {
            role: "user",
            content: `Tweet: "${tweet}"\nProject/Topic: ${topic || "tech"}\nBrand color: ${color}`
          }
        ]
      })
    });

    if (!extractRes.ok) {
      const err = await extractRes.json();
      return res.status(500).json({ error: err.error?.message || "GPT extract error" });
    }

    const extractData = await extractRes.json();
    let extracted;
    try {
      const raw = extractData.choices[0].message.content.trim().replace(/```json|```/g, "").trim();
      extracted = JSON.parse(raw);
    } catch {
      return res.status(500).json({ error: "Failed to parse GPT response" });
    }

    // Step 2: Generate dark cinematic background with DALL-E 3
    const imageRes = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: extracted.bgPrompt + " Cinematic. High contrast. Dark atmosphere. No text, no typography, no words anywhere in the image.",
        n: 1,
        size: "1024x1024",
        quality: "standard",
        response_format: "b64_json"
      })
    });

    if (!imageRes.ok) {
      const err = await imageRes.json();
      return res.status(500).json({ error: err.error?.message || "DALL-E error" });
    }

    const imageData = await imageRes.json();
    const bgBase64 = imageData.data[0].b64_json;

    return res.status(200).json({
      bg: `data:image/png;base64,${bgBase64}`,
      headline: extracted.headline,
      stat: extracted.stat || null,
      subtext: extracted.subtext,
      handle: handle || null
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
