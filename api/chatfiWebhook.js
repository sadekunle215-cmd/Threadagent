const crypto = require("crypto");
const admin = require("./_firebaseAdmin");

async function creditOnce(uid, paymentId, ngnAmount, txSignature) {
  const userRef = admin.firestore().collection("users").doc(uid);
  const txRef = userRef.collection("transactions").doc(paymentId);
  await admin.firestore().runTransaction(async (t) => {
    const txDoc = await t.get(txRef);
    if (txDoc.exists) return;
    t.update(userRef, { balance: admin.firestore.FieldValue.increment(ngnAmount) });
    t.set(txRef, {
      amount: ngnAmount,
      description: "Wallet top-up (crypto)",
      ref: paymentId,
      txSignature: txSignature || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
}

module.exports.config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  try {
    const rawBody = await readRawBody(req);
    const webhookSecret = process.env.CHATFI_WEBHOOK_SECRET;

    if (webhookSecret) {
      const signature = req.headers["x-chatfi-signature"] || "";
      const expected = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
      if (signature !== `sha256=${expected}`) {
        console.warn("Invalid ChatFi webhook signature");
        return res.status(401).send("Invalid signature");
      }
    } else {
      console.warn("CHATFI_WEBHOOK_SECRET not set — processing webhook WITHOUT signature verification");
    }

    const event = JSON.parse(rawBody);

    if (event.event === "payment.confirmed") {
      const pendingDoc = await admin.firestore().collection("pendingPayments").doc(event.id).get();
      if (pendingDoc.exists) {
        const { uid, ngnAmount } = pendingDoc.data();
        await creditOnce(uid, event.id, ngnAmount, event.txSignature);
      } else {
        console.warn(`Webhook for unknown payment id: ${event.id}`);
      }
    } else if (event.event === "payment.expired") {
      await admin.firestore().collection("pendingPayments").doc(event.id).delete().catch(() => {});
    }

    return res.status(200).send("ok");
  } catch (e) {
    console.error(e);
    return res.status(500).send("error");
  }
};
