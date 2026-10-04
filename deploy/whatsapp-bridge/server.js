// جسر واتساب لمثراء — يعمل على Hostinger VPS
// يربط رقم واتساب حقيقي عبر QR ويرسل منه مجانًا بدون Twilio.
import { Boom } from "@hapi/boom";
import express from "express";
import pino from "pino";
import QRCode from "qrcode";
import baileys from "@whiskeysockets/baileys";

const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} = baileys;

const PORT = Number(process.env.PORT || 3010);
const TOKEN = process.env.BRIDGE_TOKEN || "";
const AUTH_DIR = process.env.AUTH_DIR || "./auth";

if (!TOKEN) {
  console.error("BRIDGE_TOKEN مطلوب في متغيرات البيئة");
  process.exit(1);
}

const logger = pino({ level: "warn" });

let sock = null;
let qrDataUrl = null;
let connection = "closed"; // closed | connecting | open
let me = null;
let lastError = null;
let starting = false;

async function start() {
  if (starting) return;
  starting = true;
  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      auth: state,
      logger,
      printQRInTerminal: false,
      browser: ["Mithraa CRM", "Chrome", "1.0.0"],
      markOnlineOnConnect: false,
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      const { connection: conn, lastDisconnect, qr } = update;
      if (qr) {
        qrDataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 320 });
        connection = "connecting";
      }
      if (conn === "open") {
        qrDataUrl = null;
        connection = "open";
        lastError = null;
        me = sock?.user?.id?.split(":")[0] ?? null;
        console.log("واتساب متصل:", me);
      }
      if (conn === "close") {
        connection = "closed";
        const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
        lastError = lastDisconnect?.error?.message ?? null;
        const loggedOut = code === DisconnectReason.loggedOut;
        console.log("انقطع الاتصال:", code, lastError);
        starting = false;
        if (!loggedOut) setTimeout(() => start(), 3000);
        else qrDataUrl = null;
      }
    });
  } catch (e) {
    lastError = e?.message ?? String(e);
    connection = "closed";
    starting = false;
    setTimeout(() => start(), 5000);
    return;
  }
  starting = false;
}

function toJid(raw) {
  let d = String(raw).replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("05")) d = `966${d.slice(1)}`;
  else if (d.length === 9 && d.startsWith("5")) d = `966${d}`;
  return `${d}@s.whatsapp.net`;
}

const app = express();
app.use(express.json({ limit: "2mb" }));

app.use((req, res, next) => {
  if (req.path === "/health") return next();
  const auth = req.headers.authorization || "";
  if (auth !== `Bearer ${TOKEN}`) return res.status(401).json({ ok: false, error: "unauthorized" });
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true, connection }));

app.get("/status", (_req, res) => {
  res.json({ ok: true, connection, qr: qrDataUrl, me, error: lastError });
});

app.post("/send", async (req, res) => {
  const { to, body } = req.body || {};
  if (!to || !body) return res.status(400).json({ ok: false, error: "to و body مطلوبان" });
  if (connection !== "open" || !sock) {
    return res.status(409).json({ ok: false, error: "واتساب غير مرتبط — امسح رمز QR أولًا" });
  }
  try {
    const jid = toJid(to);
    const [check] = await sock.onWhatsApp(jid);
    if (!check?.exists) return res.status(404).json({ ok: false, error: "الرقم غير مسجل في واتساب" });
    const sent = await sock.sendMessage(check.jid, { text: String(body) });
    res.json({ ok: true, id: sent?.key?.id ?? "" });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message ?? "فشل الإرسال" });
  }
});

app.post("/logout", async (_req, res) => {
  try {
    await sock?.logout();
  } catch {
    /* تجاهل */
  }
  sock = null;
  connection = "closed";
  qrDataUrl = null;
  me = null;
  starting = false;
  setTimeout(() => start(), 1000);
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`جسر واتساب يعمل على المنفذ ${PORT}`));
start();
