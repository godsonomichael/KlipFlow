import { createClient } from "@supabase/supabase-js";

const token = process.env.TELEGRAM_BOT_TOKEN;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
if (!token || !supabaseUrl || !supabaseKey) throw new Error("Required server configuration is missing");

const db = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: settings, error } = await db.from("clipper_settings").select("telegram_chat_id,telegram_enabled").eq("telegram_enabled", true).not("telegram_chat_id", "is", null).limit(1).maybeSingle();
if (error) throw new Error(`Supabase settings lookup failed: ${error.message}`);
if (!settings?.telegram_chat_id) {
  console.log("telegram_delivery=not_testable_no_enabled_chat");
  process.exit(0);
}

const base = `https://api.telegram.org/bot${token}`;
const chatResponse = await fetch(`${base}/getChat?chat_id=${encodeURIComponent(settings.telegram_chat_id)}`);
const chatPayload = await chatResponse.json() as { ok?: boolean };
if (!chatResponse.ok || !chatPayload.ok) throw new Error("Telegram getChat rejected the saved chat connection");

const sendResponse = await fetch(`${base}/sendMessage`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ chat_id: settings.telegram_chat_id, text: "KlipFlow test: Telegram alerts are connected and working." }),
});
const sendPayload = await sendResponse.json() as { ok?: boolean };
if (!sendResponse.ok || !sendPayload.ok) throw new Error("Telegram sendMessage rejected the saved chat connection");
console.log("telegram_delivery=success");
