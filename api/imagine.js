module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { tweet, topic, brandColor } = req.body;
  if (!tweet) return res.status(400).json({ error: "Tweet text is required" });

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) return res.status(500).json({ error: "OpenAI API key not configured" });

  const color = brandColor || "#e8ff47";

  try {
    // Step 1: Use GPT-4o to extract a sharp visual concept from the tweet
    const conceptRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 300,
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content: `You are a visual director for social media. Given a tweet, write a concise DALL-E image generation prompt that visually represents the tweet's core idea as a striking, modern graphic.

Rules:
- Focus on the KEY concept, data point, or emotion in the tweet
- Dark background aesthetic (#0a0a0a or similar dark)
- The primary accent/highlight color must be: ${color}
- Style: bold, minimal, editorial infographic — like a Wired or Verge cover graphic
- Abstract or conceptual — no portrait photography
- NO text, NO typography, NO words in the image
- Make it viscerally communicate the tweet's message through shape, light, data viz, or metaphor
- Keep prompt under 120 words

Return ONLY the prompt text. Nothing else.`
          },
          {
            role: "user",
            content: `Tweet: "${tweet}"\nTopic context: ${topic || "general"}`
          }
        ]
      })
    });

    if (!conceptRes.ok) {
      const err = await conceptRes.json();
      return res.status(500).json({ error: err.error?.message || "GPT concept error" });
    }

    const conceptData = await conceptRes.json();
    const imagePrompt = conceptData.choices[0].message.content.trim();

    // Step 2: Generate image with DALL-E 3
    const imageRes = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: imagePrompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        response_format: "b64_json"
      })
    });

    if (!imageRes.ok) {
      const err = await imageRes.json();
      return res.status(500).json({ error: err.error?.message || "DALL-E error", prompt: imagePrompt });
    }

    const imageData = await imageRes.json();
    const b64 = imageData.data[0].b64_json;

    return res.status(200).json({
      image: `data:image/png;base64,${b64}`,
      prompt: imagePrompt
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
