const fs = require("fs");
const path = require("path");

function loadEnv(file) {
  if (!fs.existsSync(file)) throw new Error("Missing " + file);
  const raw = fs.readFileSync(file, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const s = (line || "").trim();
    if (!s || s.startsWith("#")) continue;

    const idx = s.indexOf("=");
    if (idx < 1) continue;

    const key = s.slice(0, idx).trim();
    let val = s.slice(idx + 1).trim();

    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

(async () => {
  loadEnv(path.join(process.cwd(), ".env.local"));

  const { createClient } = require("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log("URL:", url || null);
  console.log("ANON LEN:", anon ? anon.length : 0);

  const sb = createClient(url, anon);
  const r = await sb.from("deals").select("id, deal_code, stage").limit(1);

  console.log("ERROR:", r.error ? r.error.message : null);
  console.log("DATA:", r.data);
})();
