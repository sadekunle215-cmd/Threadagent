module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { platform, handle, examples } = req.body;

  if (!examples) {
    return res.status(400).json({ error: "Examples are required" });
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const SERPER_API_KEY = process.env.SERPER_API_KEY; // optional — gracefully skipped if missing

  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: "OpenAI API key not configured" });
  }

  // ── 1. Detect niche keywords from the user's examples ──────────────────────
  const lowerExamples = examples.toLowerCase();

  const nicheKeywords = [];
  if (lowerExamples.match(/solana|sol|jupiter|jup|raydium|orca|drift|mango|marinade|jito|bonk|wif|tensor|magic eden|phantom|backpack|saga|svm|spl/))
    nicheKeywords.push("Solana crypto");
  if (lowerExamples.match(/defi|liquidity|swap|amm|yield|staking|lending|borrow|vault|tvl/))
    nicheKeywords.push("DeFi");
  if (lowerExamples.match(/nft|mint|collection|floor|opensea|tensor|magic eden|pfp/))
    nicheKeywords.push("NFT");
  if (lowerExamples.match(/trading|trade|chart|ta|technical analysis|alpha|whale|memecoin|pump|degen/))
    nicheKeywords.push("crypto trading");
  if (lowerExamples.match(/bitcoin|btc|ethereum|eth|base|arbitrum|polygon|layer 2|l2/))
    nicheKeywords.push("multi-chain crypto");
  if (lowerExamples.match(/earn|bounty|superteam|hackathon|grant|build|developer|dev|sdk|api|rust|anchor/))
    nicheKeywords.push("Web3 building");
  if (lowerExamples.match(/twitter|instagram|content|thread|viral|growth|audience|creator|social media/))
    nicheKeywords.push("content creation");
  if (lowerExamples.match(/nigeria|naija|africa|lagos|abuja|naira|fintech|paystack|flutterwave/))
    nicheKeywords.push("Nigerian fintech");

  const searchQuery = nicheKeywords.length > 0
    ? nicheKeywords.slice(0, 2).join(" ") + " latest news 2025"
    : examples.split(" ").slice(0, 6).join(" ") + " latest";

  // ── 2. Fetch trending context via Serper (Google Search) ──────────────────
  let trendingContext = "";

  if (SERPER_API_KEY) {
    try {
      const searchRes = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": SERPER_API_KEY,
        },
        body: JSON.stringify({
          q: searchQuery,
          gl: "ng",       // Nigeria locale for relevance
          hl: "en",
          num: 8,
          tbs: "qdr:w",  // past week only
        }),
      });

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const results = [
          ...(searchData.organic || []),
          ...(searchData.topStories || []),
          ...(searchData.newsResults || []),
        ].slice(0, 6);

        if (results.length > 0) {
          trendingContext = results
            .map((r, i) => `${i + 1}. ${r.title || r.snippet || ""} — ${r.snippet || ""}`.slice(0, 200))
            .join("\n");
        }
      }
    } catch (searchErr) {
      // Silently skip — trending context is optional
      console.warn("Serper search failed:", searchErr.message);
    }
  }

  // ── 3. Also search Twitter/X for what's currently buzzing ─────────────────
  let socialContext = "";

  if (SERPER_API_KEY && nicheKeywords.length > 0) {
    try {
      const twitterRes = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": SERPER_API_KEY,
        },
        body: JSON.stringify({
          q: `site:twitter.com OR site:x.com ${nicheKeywords[0]} trending`,
          gl: "ng",
          hl: "en",
          num: 5,
          tbs: "qdr:d", // past 24h for social signals
        }),
      });

      if (twitterRes.ok) {
        const twitterData = await twitterRes.json();
        const tweets = (twitterData.organic || []).slice(0, 4);
        if (tweets.length > 0) {
          socialContext = tweets
            .map((t) => `• ${t.title || t.snippet || ""}`.slice(0, 160))
            .join("\n");
        }
      }
    } catch (_) {}
  }

  // ── 4. Build the platform guide ───────────────────────────────────────────
  const platformGuides = {
    twitter:   "Twitter/X — punchy, hooky, max 280 chars. First line must stop the scroll. Threads do well. Opinions, takes, and personal stories perform best.",
    linkedin:  "LinkedIn — professional but human. Storytelling + insight = engagement. First line is the hook before 'see more'. Lists and lessons perform well.",
    instagram: "Instagram — visual-first. Captions add context or tell a story. Short punchy hook in first line. Emojis OK. Saves > likes in the algorithm.",
    facebook:  "Facebook — conversational, community-driven. Longer personal stories, helpful tips, or strong opinion pieces work best. Feels personal.",
    tiktok:    "TikTok — hook in first 2 seconds, storytelling arc, strong CTA at end. Script must work as a voiceover. Trending sounds help.",
  };
  const platformGuide = platformGuides[platform] || platformGuides.twitter;

  // ── 5. Deep Solana knowledge base injected into the system prompt ─────────
  const solanaKnowledge = `
DEEP SOLANA ECOSYSTEM KNOWLEDGE (use when relevant):

CORE PROTOCOL:
- Solana runs on Proof of History (PoH) + Proof of Stake (PoS). ~65,000 TPS theoretical, ~4,000 real-world. 400ms block time.
- Validators stake SOL; current APY ~6-7%. Liquid staking via Marinade (mSOL), Jito (jitoSOL), Lido (stSOL).
- Network upgrades: QUIC, Turbine, Gulf Stream, Sealevel (parallel smart contract execution).
- Solana Mobile: Saga phone, dApp Store — crypto-native Android hardware.

MAJOR DEXES & DeFi:
- Jupiter Exchange (JUP): #1 DEX aggregator on Solana. Routes across Orca, Raydium, Lifinity, Meteora. Also has JLP vault, DCA, limit orders, perpetuals.
- Raydium (RAY): AMM + order book hybrid. CLMM pools. Home of most new token launches (LaunchLab).
- Orca: CLMM-focused DEX. Clean UX. Whirlpools for concentrated liquidity.
- Drift Protocol: Perps DEX. Up to 20x leverage. SOL, BTC, ETH, JTO markets.
- Kamino Finance: Automated liquidity vaults, borrow/lend. Huge TVL.
- MarginFi: Lending/borrowing protocol. mrgn points system popular.
- Meteora: Dynamic liquidity pools (DLMM). Best for new token launches.

MEMECOINS & TOKENS:
- BONK, WIF (dogwifhat), POPCAT, MEW, BOME — major Solana memecoins.
- pump.fun: One-click memecoin launcher. Millions of tokens created. Graduation mechanism to Raydium.
- Most Solana memecoin discussion happens on Twitter/X and Telegram.

NFTs:
- Magic Eden: #1 NFT marketplace on Solana (also cross-chain now).
- Tensor: Advanced NFT trading — pro traders prefer it. TNSR token.
- Famous collections: DeGods, Mad Lads (Backpack), Okay Bears, SMB, Claynosaurz.
- cNFTs (compressed NFTs) — extremely cheap bulk minting via Bubblegum protocol.

WALLETS & INFRA:
- Phantom: Most popular Solana wallet. Multi-chain now.
- Backpack: Built by Armani Ferrante (xNFT, Mad Lads team). Growing fast.
- Solflare: Power-user wallet. Great staking UI.
- Helius: Leading Solana RPC/data provider.
- Triton: High-performance RPC.

ECOSYSTEM PROGRAMS & GRANTS:
- Superteam: Solana's global community. Earn platform for bounties/grants. Very active in Nigeria/Africa.
- Solana Foundation grants: Active developer grants program.
- Colosseum: Solana hackathon organiser. $1M+ prize pools.

CURRENT NARRATIVES (2025):
- Solana vs Ethereum L2s debate always hot.
- Real-world assets (RWA) tokenisation growing.
- AI + crypto intersection — AI agents, on-chain AI.
- DePIN (Decentralised Physical Infrastructure) — Helium, Hivemapper, io.net.
- Firedancer (Jump Crypto validator client) — major performance upgrade.
- SIMD proposals — governance and protocol improvements.
- PayFi — using crypto for real payments, not just speculation.
`;

  // ── 6. Build the system prompt ────────────────────────────────────────────
  const systemPrompt = `
You are an elite personal content strategist with deep knowledge of crypto (especially Solana), DeFi, NFTs, and social media content creation.

Your job: study a creator's examples, understand their exact voice, and generate 3 content ideas that feel like THEIR next post — personal, specific, and timely.

${solanaKnowledge}

CONTENT IDEA RULES:
- Write ideas as if the CREATOR is speaking from personal experience — "I just noticed...", "I tested...", "Here's what happened when I...", "Nobody talks about..."
- Each idea must be instantly actionable — specific enough to write from right now
- Ideas should feel like they came from LIVING in this space, not observing it from outside
- Tie ideas to what is ACTUALLY trending/happening right now if possible
- Vary the formats: one could be a personal story/take, one a breakdown/analysis, one a hot opinion
- For crypto/Solana niches: reference specific protocols, tokens, or mechanics — be precise, not generic
- Do NOT be vague ("post about DeFi") — be surgical ("I put $500 into Kamino's JLP vault and here's what the yield actually looked like after 30 days")

OUTPUT FORMAT:
Return ONLY a raw JSON object. No markdown. No explanation. No backticks.
{
  "tone": "<one of: conversational | educational | storytelling | bold | analytical | personal | inspirational>",
  "topics": ["<main topic 1>", "<main topic 2>", "<main topic 3>"],
  "style_notes": "<2 sentences describing their exact writing style — voice, rhythm, vocabulary>",
  "ideas": [
    "<specific, personal, compelling idea 1 written as if the creator is thinking out loud — full sentence>",
    "<specific, personal, compelling idea 2>",
    "<specific, personal, compelling idea 3>"
  ]
}
`.trim();

  // ── 7. Build user prompt with trending context injected ───────────────────
  const trendingSection = trendingContext
    ? `\nWHAT'S TRENDING RIGHT NOW (from live web search — use this to make ideas timely):\n${trendingContext}`
    : "";

  const socialSection = socialContext
    ? `\nWHAT PEOPLE ARE TALKING ABOUT ON SOCIAL RIGHT NOW:\n${socialContext}`
    : "";

  const userPrompt = `
Platform: ${platform} (${platformGuide})
Handle: ${handle}

THEIR CONTENT EXAMPLES / DESCRIPTION:
${examples}
${trendingSection}
${socialSection}

Study their voice deeply. Generate 3 ideas that feel PERSONALLY theirs — like they lived it, tested it, or have a strong opinion about it. Make the ideas specific, timely, and impossible to resist writing.
Return ONLY the JSON object.
`.trim();

  // ── 8. Call OpenAI ────────────────────────────────────────────────────────
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.88,
        max_tokens: 900,
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

    // Attach metadata about what was searched so the frontend can optionally show it
    result._searched = searchQuery;
    result._hasTrending = !!trendingContext;

    return res.status(200).json(result);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
