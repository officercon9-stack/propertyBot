/* PropertyBot backend: a Google Sheet + this Apps Script web app.
   Deploy: Deploy > New deployment > Web app > Execute as: Me, Who has access: Anyone.
   Run setup() once: creates the tabs and the hourly / daily / weekly automation. */
const DEALER_COLS = ["slug", "name", "whatsapp", "pin", "city", "office", "agent", "created", "email", "plan", "paidUntil", "fee", "status", "source"];
const PLOT_COLS = ["dealer", "ref", "society", "area", "address", "marla", "price", "type", "purpose", "features", "status", "added"];
const STAT_COLS = ["dealer", "week", "views", "asks", "wa"];
const PAY_COLS = ["dealer", "date", "months", "amount", "paidUntil"];
const TRIAL_DAYS = 14, GRACE_DAYS = 5, TZ = "Asia/Karachi";
const SITE = "https://officercon9-stack.github.io/propertyBot/";

/* ---------- sheet helpers ---------- */
function sheet_(name, cols) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(cols); sh.setFrozenRows(1); }
  return sh;
}
function rows_(name, cols) {
  const v = sheet_(name, cols).getDataRange().getValues();
  return v.slice(1).map((r, i) => { const o = { _row: i + 2 }; cols.forEach((c, j) => o[c] = r[j]); return o; });
}
function setCell_(name, cols, row, key, val) { sheet_(name, cols).getRange(row, cols.indexOf(key) + 1).setValue(val); }
function setup() {
  sheet_("Dealers", DEALER_COLS); sheet_("Plots", PLOT_COLS); sheet_("Stats", STAT_COLS); sheet_("Payments", PAY_COLS);
  const s1 = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Sheet1");
  if (s1 && s1.getLastRow() === 0 && SpreadsheetApp.getActiveSpreadsheet().getSheets().length > 1) SpreadsheetApp.getActiveSpreadsheet().deleteSheet(s1);
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("hourly").timeBased().everyHours(1).create();
  ScriptApp.newTrigger("daily").timeBased().everyDays(1).atHour(10).inTimezone(TZ).create();
  ScriptApp.newTrigger("weekly").timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(9).inTimezone(TZ).create();
  return "PropertyBot is set up";
}

/* ---------- small helpers ---------- */
function out_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function day_(d) { const x = d ? new Date(d) : new Date(); x.setHours(0, 0, 0, 0); return x; }
function addDays_(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function addMonths_(d, n) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; }
function fmt_(d) { return d ? Utilities.formatDate(new Date(d), TZ, "d MMM yyyy") : ""; }
function week_(d) { return Utilities.formatDate(d || new Date(), TZ, "YYYY-'W'ww"); }
function daysLeft_(d) { return d.paidUntil ? Math.round((day_(d.paidUntil) - day_()) / 864e5) : null; }
function num_(w) { return String(w || "").replace(/\D/g, ""); }
function waLink_(n, text) { return "https://wa.me/" + num_(n) + "?text=" + encodeURIComponent(text); }
function owner_() { return Session.getEffectiveUser().getEmail(); }
function mail_(to, subject, body) { if (!to) return; try { MailApp.sendEmail(to, subject, body); } catch (e) { console.log("mail failed: " + e.message); } }
function shopUrl_(slug) { return SITE + "shop.html?d=" + slug; }
function dealerUrl_(slug) { return SITE + "dealer.html?d=" + slug; }
function active_(d) { return String(d.status || "active") !== "paused"; }
function pub_(d) { return { slug: d.slug, name: d.name, whatsapp: num_(d.whatsapp), city: d.city, office: d.office, agent: d.agent }; }
function plotOut_(p) { return { ref: p.ref, society: p.society, area: p.area, address: p.address, marla: +p.marla || 0, price: +p.price || 0, type: p.type || "Plot", purpose: p.purpose || "sale", features: p.features, sold: p.status === "sold", added: p.added }; }
function dealer_(slug) { return rows_("Dealers", DEALER_COLS).find(d => String(d.slug) === String(slug)); }
function auth_(b) {
  const d = dealer_(b.d);
  if (!d) throw new Error("Shop not found");
  if (String(d.pin) !== String(b.pin)) throw new Error("Wrong PIN");
  return d;
}
function admin_(b) {
  const props = PropertiesService.getScriptProperties();
  const cur = props.getProperty("ADMIN_PIN");
  if (!cur) { if (!b.admin || String(b.admin).length < 4) throw new Error("Choose an admin PIN of 4+ digits"); props.setProperty("ADMIN_PIN", String(b.admin)); return; }
  if (String(b.admin) !== cur) throw new Error("Wrong admin PIN");
}
function shop_(slug, all) {
  const d = dealer_(slug);
  if (!d) throw new Error("Shop not found");
  if (!all && !active_(d)) return { dealer: pub_(d), plots: [], paused: true };
  const plots = rows_("Plots", PLOT_COLS).filter(p => p.dealer === slug && p.status !== "deleted" && (all || p.status !== "sold")).map(plotOut_);
  return { dealer: pub_(d), plots: plots };
}
function bust_(slug) { CacheService.getScriptCache().remove("shop_" + slug); }
function account_(d) {
  const s = rows_("Stats", STAT_COLS).find(x => x.dealer === d.slug && x.week === week_()) || {};
  return { plan: d.plan || "trial", paidUntil: fmt_(d.paidUntil), daysLeft: daysLeft_(d), status: d.status || "active", week: { views: +s.views || 0, asks: +s.asks || 0, wa: +s.wa || 0 } };
}
function welcome_(d, pin) {
  return "Assalam o Alaikum " + (d.agent || d.name) + "!\nAap ki online property shop tayyar hai 🎉\n\n🏡 Customers ke liye link:\n" + shopUrl_(d.slug) +
    "\n\n🔑 Plots add/sold karne ke liye:\n" + dealerUrl_(d.slug) + "\nPIN: " + pin +
    "\n\nApni WhatsApp wali plot list wahan paste karein, shop khud update ho jayegi.";
}
function newDealer_(b, source) {
  const list = rows_("Dealers", DEALER_COLS);
  const wa = num_(b.whatsapp), name = String(b.name || "").trim().slice(0, 80);
  if (!name) throw new Error("Please write your business name");
  if (!/^92\d{10}$/.test(wa)) throw new Error("WhatsApp number looks wrong. Example: 0300 1234567");
  if (source === "signup" && list.some(d => num_(d.whatsapp) === wa)) throw new Error("A shop with this WhatsApp number already exists. Message PropertyBot support to get your links again.");
  let base = String(b.slug || name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "dealer", slug = base, i = 2;
  while (list.some(d => d.slug === slug)) slug = base + "-" + (i++);
  const pin = String(Math.floor(1000 + Math.random() * 9000));
  const email = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(b.email || "").trim()) ? String(b.email).trim() : "";
  const row = { slug: slug, name: name, whatsapp: "'" + wa, pin: "'" + pin, city: String(b.city || "").slice(0, 40), office: "", agent: String(b.agent || "").slice(0, 40),
    created: new Date(), email: email, plan: "trial", paidUntil: addDays_(day_(), TRIAL_DAYS), fee: +b.fee || "", status: "active", source: source };
  sheet_("Dealers", DEALER_COLS).appendRow(DEALER_COLS.map(c => row[c]));
  return { slug: slug, pin: pin, whatsapp: wa, name: name, agent: row.agent, email: email, city: row.city, paidUntil: row.paidUntil };
}

/* ---------- web requests ---------- */
function doGet(e) {
  try {
    const slug = (e.parameter.d || "").toLowerCase();
    const cache = CacheService.getScriptCache();
    const hit = cache.get("shop_" + slug);
    if (hit) return ContentService.createTextOutput(hit).setMimeType(ContentService.MimeType.JSON);
    const res = JSON.stringify({ ok: true, ...shop_(slug, false) });
    cache.put("shop_" + slug, res, 120);
    return ContentService.createTextOutput(res).setMimeType(ContentService.MimeType.JSON);
  } catch (err) { return out_({ ok: false, error: err.message }); }
}

function doPost(e) {
  let b;
  try { b = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: "Bad request" }); }
  const a = b.action;
  // read-only / counter actions: no lock, so a slow AI answer never blocks dealers
  try {
    if (a === "ask") return out_(ask_(b));
    if (a === "stat") return out_(stat_(b));
  } catch (err) { return out_({ ok: false, error: err.message }); }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    if (a === "login") { const d = auth_(b); return out_({ ok: true, ...shop_(b.d, true), account: account_(d) }); }
    if (a === "addPlots") {
      auth_(b);
      const sh = sheet_("Plots", PLOT_COLS);
      const mine = rows_("Plots", PLOT_COLS).filter(p => p.dealer === b.d);
      let n = mine.reduce((m, p) => Math.max(m, +(String(p.ref).replace(/\D/g, "")) || 100), 100);
      const now = new Date();
      const added = (b.plots || []).slice(0, 200).map(p => {
        n += 1;
        const row = { dealer: b.d, ref: "P-" + n, society: p.society || "", area: p.area || "", address: p.address || "", marla: +p.marla || 0, price: +p.price || 0, type: p.type || "Plot", purpose: p.purpose || "sale", features: p.features || "", status: "available", added: now };
        return PLOT_COLS.map(c => row[c]);
      });
      if (added.length) sh.getRange(sh.getLastRow() + 1, 1, added.length, PLOT_COLS.length).setValues(added);
      bust_(b.d);
      return out_({ ok: true, added: added.length, ...shop_(b.d, true) });
    }
    if (a === "setStatus") {
      auth_(b);
      const p = rows_("Plots", PLOT_COLS).find(x => x.dealer === b.d && x.ref === b.ref);
      if (!p) throw new Error("Plot not found");
      const status = ["available", "sold", "deleted"].includes(b.status) ? b.status : "available";
      setCell_("Plots", PLOT_COLS, p._row, "status", status);
      if (status === "available") setCell_("Plots", PLOT_COLS, p._row, "added", new Date());
      if (b.price) setCell_("Plots", PLOT_COLS, p._row, "price", +b.price);
      bust_(b.d);
      return out_({ ok: true, ...shop_(b.d, true) });
    }
    if (a === "updateDealer") {
      const d = auth_(b);
      ["office", "agent", "city", "email"].forEach(k => { if (b[k] !== undefined) setCell_("Dealers", DEALER_COLS, d._row, k, String(b[k]).slice(0, 200)); });
      bust_(b.d);
      return out_({ ok: true, ...shop_(b.d, true) });
    }
    if (a === "signup") {
      if (b.website) throw new Error("Please try again");
      const cache = CacheService.getScriptCache(), k = "signups_" + Utilities.formatDate(new Date(), TZ, "yyyyMMdd"), n = +(cache.get(k) || 0);
      if (n >= 30) throw new Error("Too many sign-ups today. Please try again tomorrow.");
      const d = newDealer_(b, "signup");
      cache.put(k, String(n + 1), 86400);
      mail_(d.email, "Your PropertyBot shop is ready", welcome_(d, d.pin));
      mail_(owner_(), "New PropertyBot dealer: " + d.name,
        "A new dealer signed up by himself.\n\nName: " + d.name + "\nWhatsApp: +" + d.whatsapp + "\nCity: " + d.city + "\nFree trial until: " + fmt_(d.paidUntil) +
        "\n\nHis shop: " + shopUrl_(d.slug) + "\n\nWelcome him on WhatsApp (one tap):\n" +
        waLink_(d.whatsapp, "Assalam o Alaikum " + (d.agent || d.name) + "! PropertyBot mein khush aamdeed 🙏 Aap ki shop tayyar hai: " + shopUrl_(d.slug) + "\nKoi madad chahiye ho to isi number par message karein.") +
        "\n\nAdmin page: " + SITE + "admin.html");
      return out_({ ok: true, slug: d.slug, pin: d.pin, paidUntil: fmt_(d.paidUntil), trialDays: TRIAL_DAYS });
    }
    if (a === "adminAddDealer") {
      admin_(b);
      const d = newDealer_(b, "admin");
      return out_({ ok: true, slug: d.slug, pin: d.pin });
    }
    if (a === "adminPaid") {
      admin_(b);
      const d = dealer_(b.slug); if (!d) throw new Error("Shop not found");
      const months = Math.max(1, Math.min(12, +b.months || 1)), amount = +b.amount || +d.fee || 0;
      const start = d.paidUntil && day_(d.paidUntil) > day_() ? day_(d.paidUntil) : day_();
      const until = addMonths_(start, months);
      setCell_("Dealers", DEALER_COLS, d._row, "paidUntil", until);
      setCell_("Dealers", DEALER_COLS, d._row, "plan", "paid");
      setCell_("Dealers", DEALER_COLS, d._row, "status", "active");
      if (+b.amount) setCell_("Dealers", DEALER_COLS, d._row, "fee", Math.round(+b.amount / months));
      sheet_("Payments", PAY_COLS).appendRow([d.slug, new Date(), months, amount, until]);
      bust_(d.slug);
      return out_({ ok: true, paidUntil: fmt_(until) });
    }
    if (a === "adminStatus") {
      admin_(b);
      const d = dealer_(b.slug); if (!d) throw new Error("Shop not found");
      setCell_("Dealers", DEALER_COLS, d._row, "status", b.status === "paused" ? "paused" : "active");
      bust_(d.slug);
      return out_({ ok: true });
    }
    if (a === "adminSetKey") {
      admin_(b);
      if (!/^sk-ant-/.test(String(b.key || ""))) throw new Error("That does not look like a Claude API key (it starts with sk-ant-)");
      PropertiesService.getScriptProperties().setProperty("ANTHROPIC_KEY", String(b.key).trim());
      if (b.limit) PropertiesService.getScriptProperties().setProperty("AI_DAILY_LIMIT", String(+b.limit || 60));
      return out_({ ok: true });
    }
    if (a === "adminList") {
      admin_(b);
      const plots = rows_("Plots", PLOT_COLS), stats = rows_("Stats", STAT_COLS), wk = week_();
      const month = Utilities.formatDate(new Date(), TZ, "yyyyMM");
      const income = rows_("Payments", PAY_COLS).filter(p => p.date && Utilities.formatDate(new Date(p.date), TZ, "yyyyMM") === month).reduce((s, p) => s + (+p.amount || 0), 0);
      const props = PropertiesService.getScriptProperties();
      const dealers = rows_("Dealers", DEALER_COLS).map(d => {
        const s = stats.find(x => x.dealer === d.slug && x.week === wk) || {};
        return { ...pub_(d), pin: String(d.pin), email: d.email, plan: d.plan || "trial", paidUntil: fmt_(d.paidUntil), daysLeft: daysLeft_(d), fee: +d.fee || 0, status: d.status || "active", source: d.source || "",
          plots: plots.filter(p => p.dealer === d.slug && p.status === "available").length, week: { views: +s.views || 0, asks: +s.asks || 0, wa: +s.wa || 0 } };
      });
      return out_({ ok: true, ai: !!props.getProperty("ANTHROPIC_KEY"), aiLimit: +(props.getProperty("AI_DAILY_LIMIT") || 60), income: income, dealers: dealers });
    }
    throw new Error("Unknown action");
  } catch (err) {
    return out_({ ok: false, error: err.message });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

/* ---------- visitor counters (kept in cache, saved to the Stats tab every hour) ---------- */
function stat_(b) {
  const slug = String(b.d || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40);
  const k = ["views", "asks", "wa"].includes(b.k) ? b.k : "";
  if (!slug || !k) return { ok: false };
  const c = CacheService.getScriptCache(), key = "st|" + slug + "|" + k;
  c.put(key, String(+(c.get(key) || 0) + 1), 21600);
  return { ok: true };
}
function flush_() {
  const c = CacheService.getScriptCache(), dealers = rows_("Dealers", DEALER_COLS), kinds = ["views", "asks", "wa"];
  const keys = []; dealers.forEach(d => kinds.forEach(k => keys.push("st|" + d.slug + "|" + k)));
  if (!keys.length) return;
  const got = c.getAll(keys);
  if (!Object.keys(got).length) return;
  c.removeAll(Object.keys(got));
  const wk = week_(), sh = sheet_("Stats", STAT_COLS), rows = rows_("Stats", STAT_COLS);
  dealers.forEach(d => {
    const add = kinds.map(k => +(got["st|" + d.slug + "|" + k] || 0));
    if (!add.some(Boolean)) return;
    const r = rows.find(x => x.dealer === d.slug && x.week === wk);
    if (r) sh.getRange(r._row, 3, 1, 3).setValues([[(+r.views || 0) + add[0], (+r.asks || 0) + add[1], (+r.wa || 0) + add[2]]]);
    else sh.appendRow([d.slug, wk, add[0], add[1], add[2]]);
  });
}

/* ---------- automation (time triggers made by setup) ---------- */
function hourly() {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try { flush_(); } finally { lock.releaseLock(); }
}

// Every day 10am: renewal reminders 3 days before, on the day, and 3 days after; pause shops unpaid for GRACE_DAYS.
function daily() {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  const lines = [];
  try {
    flush_();
    rows_("Dealers", DEALER_COLS).forEach(d => {
      const left = daysLeft_(d);
      if (left === null) return;
      const who = d.agent || d.name, trial = (d.plan || "trial") === "trial";
      let txt = "";
      if (left === 3) txt = "Assalam o Alaikum " + who + "! Aap ki PropertyBot shop" + (trial ? " ka free trial" : "") + " 3 din mein khatam ho raha hai (" + fmt_(d.paidUntil) + "). Shop chalti rahe, is liye monthly payment kar dein. Shukriya!";
      if (left === 0) txt = "Assalam o Alaikum " + who + "! Aap ki PropertyBot shop" + (trial ? " ka free trial" : "") + " aaj khatam ho raha hai. Payment kar dein taake customers aap ke plots dekhte rahein.";
      if (left === -3) txt = "Assalam o Alaikum " + who + "! Aap ki PropertyBot payment pending hai. " + (GRACE_DAYS - 3) + " din mein shop band ho jayegi. Payment kar ke isi number par bata dein.";
      if (txt) {
        mail_(d.email, "PropertyBot renewal", txt);
        lines.push(d.name + " (" + (left >= 0 ? left + " days left" : -left + " days late") + ")\nSend reminder: " + waLink_(d.whatsapp, txt));
      }
      if (left < -GRACE_DAYS && active_(d)) {
        setCell_("Dealers", DEALER_COLS, d._row, "status", "paused");
        bust_(d.slug);
        lines.push("PAUSED: " + d.name + " (unpaid since " + fmt_(d.paidUntil) + "). It comes back on when you mark it paid.");
      }
    });
  } finally { lock.releaseLock(); }
  if (lines.length) mail_(owner_(), "PropertyBot: payments to chase today (" + lines.length + ")",
    "Tap a link to send that reminder on WhatsApp.\n\n" + lines.join("\n\n") + "\n\nWhen a dealer pays, tap 'Paid' on the admin page: " + SITE + "admin.html");
}

// Every Monday 9am: last week's report for each dealer, plus plots older than 30 days to re-check.
function weekly() {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try { flush_(); } finally { lock.releaseLock(); }
  const last = week_(addDays_(new Date(), -7)), stats = rows_("Stats", STAT_COLS), plots = rows_("Plots", PLOT_COLS), lines = [];
  let tv = 0, ta = 0, tw = 0;
  rows_("Dealers", DEALER_COLS).filter(active_).forEach(d => {
    const s = stats.find(x => x.dealer === d.slug && x.week === last) || {};
    const v = +s.views || 0, q = +s.asks || 0, w = +s.wa || 0; tv += v; ta += q; tw += w;
    const mine = plots.filter(p => p.dealer === d.slug && p.status === "available");
    const old = mine.filter(p => p.added && (new Date() - new Date(p.added)) > 30 * 864e5).map(p => p.ref);
    const txt = "Assalam o Alaikum " + (d.agent || d.name) + "! Aap ki PropertyBot shop ki pichle hafte ki report:\n\n" +
      "👀 " + v + " visits\n💬 " + q + " sawal pooche gaye\n📲 " + w + " customers ne WhatsApp par rabta kiya\n🏡 " + mine.length + " properties available\n" +
      (old.length ? "\n⚠️ Ye plots 30 din se purane hain. Abhi available hain ya SOLD? " + old.slice(0, 15).join(", ") + "\n" : "") +
      (mine.length ? "" : "\n⚠️ Shop mein koi plot nahi. Apni list paste karein taake customers dekh sakein.\n") +
      "\nPlots update karein: " + dealerUrl_(d.slug);
    mail_(d.email, "Your PropertyBot weekly report", txt);
    lines.push(d.name + ": " + v + " visits, " + q + " questions, " + w + " WhatsApp, " + mine.length + " plots" + (old.length ? ", " + old.length + " old" : "") + "\nSend report: " + waLink_(d.whatsapp, txt));
  });
  if (lines.length) mail_(owner_(), "PropertyBot weekly report: " + tv + " visits, " + tw + " WhatsApp leads",
    "Last week across all shops: " + tv + " visits, " + ta + " questions, " + tw + " WhatsApp leads.\n\nTap 'Send report' to forward each dealer his report on WhatsApp.\n\n" + lines.join("\n\n"));
}

/* ---------- AI answers for harder customer questions (Claude Haiku) ---------- */
function ask_(b) {
  const props = PropertiesService.getScriptProperties();
  const key = props.getProperty("ANTHROPIC_KEY");
  if (!key) return { ok: false, error: "ai_off" };
  const slug = String(b.d || "").toLowerCase();
  const limit = +(props.getProperty("AI_DAILY_LIMIT") || 60);
  const day = Utilities.formatDate(new Date(), TZ, "yyyyMMdd");
  const ck = "ai_" + slug + "_" + day, cache = CacheService.getScriptCache();
  const used = +(cache.get(ck) || 0);
  if (used >= limit) return { ok: false, error: "ai_limit" };
  const shop = shop_(slug, false), D = shop.dealer;
  if (shop.paused) return { ok: false, error: "ai_off" };
  cache.put(ck, String(used + 1), 21600 * 4);
  const agent = D.agent || D.name;
  const list = shop.plots.map(p => [p.ref, p.type, p.marla + " marla", [p.society, p.area].filter(String).join(" "), p.address, p.purpose === "rent" ? "rent " + p.price + "/month" : "demand Rs " + p.price, p.features].filter(String).join(" | ")).join("\n");
  const system = "You are the WhatsApp-style property assistant on the online shop of " + D.name + " (" + (D.city || "Pakistan") + "), a real-estate dealer. The dealer is " + agent + ". Office: " + (D.office || "shared on WhatsApp") + ".\n" +
    "Current listings (the ONLY properties you may mention; prices in Pakistani rupees; 1 lakh = 100,000; 1 crore = 100 lakh; 1 kanal = 20 marla):\n" + list + "\n\n" +
    "Rules: Reply in the customer's language and style (Roman Urdu if they write Roman Urdu, Urdu script if Urdu script, else English). Be warm, short (max 90 words), and practical. " +
    "Only state facts from the listings; never invent plots, prices, locations, approvals, NOC status, schools or amenities. If you don't know, say " + agent + " will confirm on WhatsApp. " +
    "Give general, balanced guidance for advice questions but do not promise profits. Mention plot refs (like P-101) when suggesting options. " +
    "For final price, visits, documents or anything uncertain, suggest tapping the WhatsApp button to talk to " + agent + ". No markdown headings.";
  const msgs = (b.history || []).slice(-6).filter(m => m && m.content).map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content).slice(0, 800) }));
  msgs.push({ role: "user", content: String(b.q || "").slice(0, 800) });
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  const res = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
    method: "post", contentType: "application/json", muteHttpExceptions: true,
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
    payload: JSON.stringify({ model: "claude-haiku-4-5", max_tokens: 350, system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }], messages: msgs }),
  });
  if (res.getResponseCode() !== 200) return { ok: false, error: "ai_error", detail: res.getContentText().slice(0, 200) };
  const data = JSON.parse(res.getContentText());
  const text = (data.content || []).filter(c => c.type === "text").map(c => c.text).join("\n").trim();
  const refs = (text.match(/P-\d{3}/g) || []).filter((v, i, a) => a.indexOf(v) === i);
  return { ok: true, text: text, refs: refs };
}
