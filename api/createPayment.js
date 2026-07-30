const admin = require("./_firebaseAdmin");

const CHATFI_BASE = "https://pay.chatfi.pro/api";

async function requireAuth(req) {
  const authHeader = req.headers.authorization || "";
  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) throw new Error("Missing auth token");
  return admin.auth().verifyIdToken(match[1]);
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const user = await requireAuth(req);
    const { amount, ngnAmount, token, label, memo, returnOrigin, clientRequestId } = req.body || {};
    if (!amount || amount <= 0) return res.status(400).json({ error: "Invalid amount" });
    if (!ngnAmount || ngnAmount <= 0) return res.status(400).json({ error: "Invalid ngnAmount" });

    const headers = {
      "x-api-key": process.env.CHATFI_API_KEY,
      "Content-Type": "application/json",
    };
    if (clientRequestId) headers["Idempotency-Key"] = clientRequestId;

    const chatfiRes = await fetch(`${CHATFI_BASE}/payment`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        amount,
        token: token || "USDC",
        label: label || "ThreadCraft Top-up",
        memo: `${memo || ""} uid:${user.uid}`.trim(),
        redirectUrl: `${returnOrigin || "https://threadcraft.pro"}/?payment_return=1`,
      }),
    });
    const data = await chatfiRes.json();
    if (!chatfiRes.ok || !data.success) {
      return res.status(502).json({ error: data.error || "ChatFi payment creation failed" });
    }

    await admin.firestore().collection("pendingPayments").doc(data.id).set({
      uid: user.uid,
      ngnAmount,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({
      id: data.id,
      checkToken: data.checkToken,
      link: data.link,
      amount: data.amount,
      expiresAt: data.expiresAt,
    });
  } catch (e) {
    console.error(e);
    return res.status(401).json({ error: e.message || "Unauthorized" });
  }
};
