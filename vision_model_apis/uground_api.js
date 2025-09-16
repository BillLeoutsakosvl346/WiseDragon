// vision_model_apis/uground_api.js
import "dotenv/config";
import path from "node:path";
import { uploadAndSign } from "./gcs_upload_and_sign.js";

const HF_ENDPOINT = process.env.HF_ENDPOINT;         // e.g. https://xxx.aws.endpoints.huggingface.cloud/v1
const HF_TOKEN    = process.env.HF_TOKEN;            // HF access token
const HF_MODEL    = process.env.HF_MODEL || "osunlp/UGround-V1-2B";

// EDIT THIS: local screenshot path
const IMG_PATH = "C:/Users/vleou/Downloads/WiseDragon/screenshots_seen/session_2025-09-14_18-10-05-789Z/2025-09-14_18-11-34-178Z_1920x1200_plain.png";

// --- helpers ---
function inferDimsFromName(p) {
  const m = path.basename(p).match(/_(\d+)x(\d+)_/);
  return m ? { w: Number(m[1]), h: Number(m[2]) } : { w: 1920, h: 1200 };
}
function normToPixels(x1000, y1000, w, h) {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  return {
    x: clamp(Math.round((x1000 / 1000) * w), 0, w - 1),
    y: clamp(Math.round((y1000 / 1000) * h), 0, h - 1),
  };
}
function parsePointer(text) {
  const m = (text || "").match(/-?\d+(\.\d+)?/g);
  if (m && m.length >= 2) return { x: Number(m[0]), y: Number(m[1]) };
  try {
    const j = JSON.parse(text);
    if (typeof j?.x === "number" && typeof j?.y === "number") return { x: j.x, y: j.y };
  } catch {}
  return null;
}

// --- main ---
async function main() {
  if (!HF_ENDPOINT || !HF_TOKEN) {
    console.log("(null, null)");
    return;
  }

  const signedUrl = await uploadAndSign(IMG_PATH);
  const { w, h } = inferDimsFromName(IMG_PATH);

  const body = {
    model: HF_MODEL,
    temperature: 0.2,
    max_tokens: 16,
    messages: [
      { role: "system", content: 'Output exactly one line "(x, y)". x,y are integers in 0..1000 from the image top-left.' },
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: signedUrl } },
          { type: "text", text: "Point to the green Play button." }
        ]
      }
    ]
  };

  const url = `${HF_ENDPOINT.replace(/\/+$/, "")}/chat/completions`;
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${HF_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);

  if (!r) return console.log("(null, null)");

  const json = await r.json().catch(() => null);
  const text = json?.choices?.[0]?.message?.content?.trim() || "";
  const coords = parsePointer(text);
  if (!coords) return console.log("(null, null)");

  const px = normToPixels(coords.x, coords.y, w, h);
  console.log(`(${px.x}, ${px.y})`);
}

main();
