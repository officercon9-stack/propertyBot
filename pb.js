/* PropertyBot shared library: formatting, WhatsApp list reader, customer assistant.
   Runs in the browser (window.PB) and in node (module.exports) for tests. */
(function (root) {
  "use strict";

  /* ---------- formatting ---------- */
  function sizeLabel(m) {
    if (!m) return "";
    if (m % 20 === 0) return m / 20 + " Kanal";
    if (m === 10) return "10 Marla";
    return (+m.toFixed(2)) + " Marla";
  }
  function money(p) {
    if (!p) return "Call for price";
    if (p >= 10000000) return "Rs " + +(p / 10000000).toFixed(2) + " crore";
    if (p >= 100000) return "Rs " + +(p / 100000).toFixed(2) + " lakh";
    return "Rs " + p.toLocaleString("en-PK");
  }
  function slugify(s) {
    return String(s).toLowerCase().replace(/real\s*estate|estate|properties|property|builders|associates|&/g, " ")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "dealer";
  }
  function waNumber(s) {
    let d = String(s || "").replace(/\D/g, "");
    if (d.startsWith("0092")) d = d.slice(2);
    if (d.startsWith("03")) d = "92" + d.slice(1);
    if (d.startsWith("3") && d.length === 10) d = "92" + d;
    return d;
  }
  function waLink(number, msg) { return "https://wa.me/" + waNumber(number) + "?text=" + encodeURIComponent(msg); }
  function place(p) { return [p.society, p.area].filter(Boolean).join(" "); }

  /* ---------- WhatsApp list reader ---------- */
  const SOCIETIES = [
    ["Margalla Enclave", /margalla\s*enclave|\bmargala\s*enclave/],
    ["Bahria Enclave", /bahria\s*enclave/],
    ["Bahria Town", /bahria\s*town|\bbahria\b(?!\s*enclave)|\bbtr\b/],
    ["DHA", /\bdha\b|defen[cs]e\s*housing/],
    ["Gulberg Greens", /gulberg\s*greens?/],
    ["Gulberg Residencia", /gulberg\s*residencia|\bgulberg\b/],
    ["B-17 Multi Gardens", /\bb\s*-?\s*17\b|multi\s*gardens?|\bmpchs\b/],
    ["Top City", /top\s*city/],
    ["Capital Smart City", /capital\s*smart\s*city|\bcsc\b/],
    ["Park View City", /park\s*view/],
    ["Blue World City", /blue\s*world/],
    ["Faisal Town", /faisal\s*town/],
    ["Faisal Hills", /faisal\s*hills/],
    ["Mumtaz City", /mumtaz\s*city/],
    ["University Town", /university\s*town/],
    ["Eighteen", /\beighteen\b/],
    ["Gulshan-e-Khudadad", /khudadad/],
    ["PWD", /\bpwd\b/],
    ["Media Town", /media\s*town/],
    ["Soan Garden", /soan\s*garden/],
    ["Jinnah Garden", /jinnah\s*garden/],
    ["Taj Residencia", /taj\s*residencia/],
    ["Rawalpindi", /\brawalpindi\b|\bpindi\b/],
  ];
  function findSociety(t) { for (const [name, re] of SOCIETIES) if (re.test(t)) return name; return ""; }

  function findArea(t) {
    let m;
    if ((m = t.match(/\bme\s*-?\s*(\d)\b/))) return "ME-" + m[1];
    if (/lake\s*district/.test(t)) return "Lake District";
    if ((m = t.match(/\bphase\s*-?\s*(\d+|[ivx]+)\b/))) return "Phase " + m[1].toUpperCase();
    if ((m = t.match(/\bblock\s*-?\s*([a-z]{1,2}\d{0,2}|\d{1,2})\b/))) return "Block " + m[1].toUpperCase();
    if ((m = t.match(/\b([a-z]{1,2}|[a-z]\s*-?\s*\d{1,2})\s*-?\s*block\b/))) return m[1].toUpperCase().replace(/\s+/g, "") + " Block";
    if ((m = t.match(/\bzone\s*-?\s*(\d+|[a-z])\b/))) return "Zone " + m[1].toUpperCase();
    if ((m = t.match(/\bsector\s*([a-z])\s*-?\s*(\d{1,2})(?!\s*(?:kanal|marla|knal))(?:\s*\/\s*(\d))?/))) return "Sector " + m[1].toUpperCase() + "-" + m[2] + (m[3] ? "/" + m[3] : "");
    if ((m = t.match(/\bsector\s*([a-z])\b/))) return "Sector " + m[1].toUpperCase();
    if ((m = t.match(/\b([a-hi])\s*-\s*(\d{1,2})(?:\s*\/\s*(\d))?\b/))) return m[1].toUpperCase() + "-" + m[2] + (m[3] ? "/" + m[3] : "");
    return "";
  }

  function findSize(t) {
    let m;
    if ((m = t.match(/(\d+(?:\.\d+)?)\s*-?\s*(?:kanal|knal|kenal)\b/))) return +m[1] * 20;
    if (/\b(one|ek|1)\s*(?:k)\b/.test(t)) return 20;
    if ((m = t.match(/(\d+(?:\.\d+)?)\s*-?\s*(?:marla|marlay|marle|mrla|mrl|m)\b(?!\s*(?:pm|am))/))) return +m[1];
    if ((m = t.match(/\b(\d{2})\s*[x×*]\s*(\d{2,3})\b/))) {
      const key = m[1] + "x" + m[2], STD = { "25x50": 5, "30x60": 8, "35x70": 10, "40x80": 14, "50x90": 20, "60x120": 32, "100x100": 44 };
      return STD[key] || Math.round(+m[1] * +m[2] / 225 * 10) / 10;
    }
    if ((m = t.match(/(\d{2,5})\s*(?:sq\.?\s*(?:ft|feet)|sqft|square\s*feet)/))) return Math.round(+m[1] / 225 * 100) / 100;
    if ((m = t.match(/(\d{2,4})\s*(?:sq\.?\s*(?:yd|yards?)|sqyd|gaz)/))) return Math.round(+m[1] * 9 / 225 * 100) / 100;
    if (/\bkanal\b/.test(t)) return 20;
    return 0;
  }

  function toRupees(num, unit) {
    const n = parseFloat(num);
    if (!unit) {
      if (n >= 100000) return Math.round(n);
      if (n >= 1000) return Math.round(n * 1000); // e.g. "dem 1500" -> treat as thousands? rare; keep
      return Math.round(n * 100000); // dealer shorthand: "dem 16" = 16 lakh
    }
    if (/^(cr|crore|crores|karor|karod)/.test(unit)) return Math.round(n * 10000000);
    if (/^(l|lac|lacs|lakh|lakhs|laakh)/.test(unit)) return Math.round(n * 100000);
    if (/^(k|thousand|hazar)/.test(unit)) return Math.round(n * 1000);
    if (/^(m|million)/.test(unit)) return Math.round(n * 1000000);
    return Math.round(n);
  }
  function findPrice(t) {
    let m;
    const unit = "(crores?|cr|karor|karod|lakhs?|lacs?|laakh|lac|l|k|thousand|million)";
    // explicit demand keyword
    if ((m = t.match(new RegExp("(?:dem|demand|demnd|price|rs\\.?|pkr|@|asking|qeemat|for)\\s*[:=-]?\\s*(\\d+(?:\\.\\d+)?)\\s*" + unit + "?\\b")))) return toRupees(m[1], m[2]);
    // number with money unit anywhere
    if ((m = t.match(new RegExp("(\\d+(?:\\.\\d+)?)\\s*" + "(crores?|cr|karor|karod|lakhs?|lacs?|laakh|lac)\\b")))) return toRupees(m[1], m[2]);
    if ((m = t.match(/\b(\d+(?:\.\d+)?)\s*(k|thousand|hazar)\b/))) return toRupees(m[1], m[2]);
    if ((m = t.match(/\b(\d{6,9})\b/))) return +m[1];
    return 0;
  }

  function findType(t) {
    if (/\bplot\b/.test(t) && !/\b(house|ghar|makan)\s+for\b/.test(t)) return "Plot";
    if (/\b(house|ghar|home|villa|bungalow|makan)\b/.test(t)) return "House";
    if (/\b(flat|apartment|appartment)\b/.test(t)) return "Flat";
    if (/\b(portion|upper|lower|ground floor|basement)\b/.test(t)) return "Portion";
    if (/\b(shop|dukan|showroom)\b/.test(t)) return "Shop";
    if (/\b(office)\b/.test(t)) return "Office";
    if (/\b(file|files)\b/.test(t) && !/\bplot\b/.test(t)) return "File";
    return "Plot";
  }
  function findFeatures(t) {
    const f = [];
    if (/corner|kona/.test(t)) f.push("corner");
    if (/boulevard|blvd|main\s*(road|double road|sarak)|double\s*road/.test(t)) f.push("main road");
    if (/park\s*facing|facing\s*park/.test(t)) f.push("park facing");
    if (/extra\s*land/.test(t)) f.push("extra land");
    if (/possession|posession|pos\b/.test(t)) f.push("possession");
    if (/developed/.test(t)) f.push("developed");
    if (/balloting|ballot/.test(t)) f.push("balloting file");
    if (/install?ment|qist|kist/.test(t)) f.push("installments");
    if (/\bnew\b|brand\s*new/.test(t)) f.push("new");
    if (/furnished/.test(t)) f.push("furnished");
    if ((m = t.match(/(\d)\s*(?:bed|beds|bedrooms?|br)\b/))) f.push(m[1] + " bed");
    var m;
    return f;
  }
  function findAddress(t) {
    const bits = [];
    let m;
    if ((m = t.match(/\b(?:street|st|gali|street#|st#)\s*(?:no\.?|#)?\s*-?\s*(\d+[a-z]?)\b/))) bits.push("Street " + m[1].toUpperCase());
    if ((m = t.match(/\b(?:road|rd)\s*(?:no\.?|#)?\s*-?\s*(\d+)\b/))) bits.push("Road " + m[1]);
    if ((m = t.match(/\b(?:plot|p)\s*(?:no\.?|#|number)?\s*-?\s*(\d+[a-z]?)\b(?![.\d]*\s*(?:cr|crore|lac|lakh|l\b|k\b|marla|kanal))/)) && !/\bp\s*-?\s*1\d\d\b/.test(m[0])) bits.push("Plot " + m[1].toUpperCase());
    else if ((m = t.match(/\b(?:house|h)\s*(?:no\.?|#)\s*(\d+)/))) bits.push("House " + m[1]);
    return bits.join(", ");
  }
  function findPurpose(t) { return /\b(rent|kiraya|kiraye|per\s*month|monthly|\/month|pm)\b/.test(t) ? "rent" : "sale"; }

  /* readList(text) -> [{society, area, address, marla, price, type, purpose, features, sold, raw, missing:[]}] */
  function readList(text) {
    const lines = String(text || "").replace(/\r/g, "").split(/\n|;|(?:\s{2,}(?=\d+\s*(?:marla|kanal)))/i)
      .map(s => s.replace(/^\s*(?:[*•\-–>✅☑️🔹🔸▪️➡️]+|\d{1,2}[.)](?!\d))\s*/u, "").trim()).filter(Boolean);
    let ctxSociety = "", ctxArea = "", ctxSize = 0;
    const out = [];
    for (const raw of lines) {
      const t = " " + raw.toLowerCase().replace(/[,|]/g, " ").replace(/\s+/g, " ") + " ";
      const society = findSociety(t), area = findArea(t), size = findSize(t), price = findPrice(t);
      const sold = /\bsold\b|\bbik\s*(gaya|gya|chuka)\b/.test(t);
      const hasPlotWords = /\bplot\b|\bst\b|street|\bdem\b|demand|\bhouse\b|\bflat\b|\bshop\b|\bportion\b/.test(t);
      const isHeader = !price && !sold && (!size || !hasPlotWords) && (society || area || size);
      if (isHeader) {
        if (society) { ctxSociety = society; if (!area) ctxArea = ""; }
        if (area) ctxArea = area;
        if (size) ctxSize = size;
        continue;
      }
      if (!price && !size && !sold) continue; // chit-chat line
      const refm = t.match(/\bp\s*-?\s*(\d{3})\b/);
      if (sold && refm && !size) { out.push({ action: "sold", ref: "P-" + refm[1], raw, missing: [] }); continue; }
      const cda = /^(sector )?[a-i]-\d/i.test(area);
      const p = {
        society: society || (cda ? "Islamabad" : (area && !society && ctxArea && area !== ctxArea && /^sector|^[a-i]-/i.test(area) ? "" : ctxSociety)),
        area: area || ctxArea,
        address: findAddress(t),
        marla: size || ctxSize,
        price,
        type: findType(t),
        purpose: findPurpose(t),
        features: findFeatures(t).join(", "),
        sold,
        raw,
      };
      p.missing = [];
      if (!p.marla) p.missing.push("size");
      if (!p.price && !sold) p.missing.push("demand");
      out.push(p);
    }
    return out;
  }

  /* ---------- customer assistant ---------- */
  const URDU = /\b(ho|haal|kaise|kese|kon|kaun|hafiz|hai|hain|kya|ka|ki|ke|mein|main|chahiye|chahye|chaiye|kitn[ae]|kahan|kidhar|batao|bata|dain|dein|wala|wali|nahi|nai|ji|bhai|sahib|sahab|mujhe|muje|apka|aapka|apke|kab|abhi|kal|acha|achha|theek|thik|kiraya|qist|kist|salam|aoa|assalam|tak|shukriya|meherbani|dikhao|batayein|bataen)\b/i;
  const NUM = { ek: 1, one: 1, do: 2, two: 2, teen: 3, three: 3, panch: 5, paanch: 5, five: 5, das: 10, dus: 10, ten: 10 };

  function parseQuery(text, plots) {
    const t = " " + text.toLowerCase().replace(/,/g, " ") + " ";
    const q = { intents: [] };
    let m = t.match(/(\d+(?:\.\d+)?|ek|one|do|two|panch|paanch|five|das|dus|ten)\s*-?\s*(marla|marlay|marle|mrla)/);
    if (m) q.marla = +(NUM[m[1]] || m[1]);
    m = t.match(/(\d+(?:\.\d+)?|ek|one|do|two|aadha|half)?\s*-?\s*(kanal|knal)/);
    if (m) q.marla = (m[1] ? (m[1] === "aadha" || m[1] === "half" ? 0.5 : +(NUM[m[1]] || m[1])) : 1) * 20;
    m = t.match(/(\d+(?:\.\d+)?)\s*(crore|cr|karor|karod)\b/) || t.match(/(\d+(?:\.\d+)?)\s*(lakh|lac|lacs|lakhs|laakh|l)\b/) || t.match(/\b(\d{6,9})\b/);
    if (m) q.budget = toRupees(m[1], m[2]);
    // area / society from the dealer's own inventory
    const names = new Set();
    plots.forEach(p => { if (p.area) names.add(p.area); if (p.society) names.add(p.society); });
    for (const n of [...names].sort((a, b) => b.length - a.length)) {
      const re = new RegExp("\\b" + n.toLowerCase().replace(/[-/ ]+/g, "\\s*-?\\s*") + "\\b");
      if (re.test(t)) { if (plots.some(p => p.area === n)) q.area = n; else q.society = n; break; }
    }
    const soc = findSociety(t);
    if (soc && !plots.some(p => p.society === soc)) q.otherSociety = soc;
    if (/corner|kona/.test(t)) q.feature = "corner";
    else if (/boulevard|main road|double road/.test(t)) q.feature = "main road";
    else if (/park facing/.test(t)) q.feature = "park facing";
    if (/\b(house|ghar|makan)\b/.test(t)) q.type = "House";
    else if (/\b(flat|apartment)\b/.test(t)) q.type = "Flat";
    else if (/\b(shop|dukan)\b/.test(t)) q.type = "Shop";
    else if (/\bportion\b/.test(t)) q.type = "Portion";
    if (/\b(rent|kiraya|kiraye)\b/.test(t)) q.purpose = "rent";
    m = t.match(/\bp\s*-?\s*(\d{3})\b/); if (m) q.ref = "P-" + m[1];
    const add = (re, name) => { if (re.test(t)) q.intents.push(name); };
    add(/\b(salam|aoa|assalam|hello|hi|hey|slam)\b/, "greet");
    add(/\b(office|kahan|kidhar|address|location|map)\b/, "office");
    add(/\b(qist|kist|installment|instalment|monthly|down ?payment|advance)\b/, "installment");
    add(/\b(transfer|noc|documents?|kagzat|balloting|ballot|possession|registry|intiqal)\b/, "documents");
    add(/\b(visit|dekhna|dekhne|site|dikhao|dikha)\b/, "visit");
    add(/\b(kam|discount|negotiable|negotiate|last|final|less|kum)\b/, "negotiate");
    add(/\b(shukriya|thanks|thank|jazak|meherbani)\b/, "thanks");
    add(/\b(sell|bechna|bechni|farokht)\b/, "sell");
    add(/how are you|how r u|kaise ho|kaisay ho|kese ho|kaise hain|kya haal|kia haal|haal hai|khairiyat|how's it going|wassup|what'?s up/, "howareyou");
    add(/who are you|are you (a )?(bot|robot|human|real)|tum kaun|aap kaun|ap kon|kon ho|insaan|robot|bot ho/, "whoareyou");
    add(/\b(bye|allah hafiz|khuda hafiz|good ?night|see you)\b/, "bye");
    add(/\b(number|contact|phone|call|mobile|rabta)\b/, "contact");
    add(/\b(ok|okay|acha|achha|theek|thik|hmm|fine|great|nice|good)\b/, "ack");
    add(/\b(good morning|good evening|subah bakhair)\b/, "greet");
    if (/\b(sab|all|list|kya kya|inventory|options|show)\b/.test(t) || /what.*(have|available)|kya.*(hai|hain).*(available)/.test(t)) q.intents.push("list");
    return q;
  }

  function search(plots, q) {
    let r = plots.filter(p => !p.sold);
    if (q.purpose) r = r.filter(p => (p.purpose || "sale") === q.purpose);
    if (q.type) r = r.filter(p => (p.type || "Plot") === q.type);
    if (q.marla) r = r.filter(p => Math.abs(p.marla - q.marla) < 0.01);
    if (q.area) r = r.filter(p => p.area === q.area);
    if (q.society) r = r.filter(p => p.society === q.society);
    if (q.feature) r = r.filter(p => (p.features || "").includes(q.feature));
    if (q.budget) r = r.filter(p => !p.price || p.price <= q.budget * 1.1);
    return r.sort((a, b) => (a.price || 9e15) - (b.price || 9e15));
  }

  function summarize(plots) {
    const by = {};
    plots.filter(p => !p.sold).forEach(p => { const k = (p.type || "Plot") + " · " + sizeLabel(p.marla); (by[k] = by[k] || []).push(p); });
    return Object.entries(by).map(([k, ls]) => {
      const ps = ls.map(l => l.price).filter(Boolean);
      const lo = Math.min(...ps), hi = Math.max(...ps);
      return `${k}: ${ls.length} available${ps.length ? ", " + (lo === hi ? money(lo) : money(lo) + " to " + money(hi)) : ""}`;
    });
  }

  function reply(text, state, dealer, plots) {
    state = state || {};
    const ur = URDU.test(text);
    const L = (u, e) => ur ? u : e;
    const q = parseQuery(text, plots);
    const KEYS = ["marla", "budget", "area", "society", "feature", "type", "purpose"];
    const own = {}; KEYS.forEach(k => { if (q[k] !== undefined) own[k] = q[k]; });
    let s = (q.marla !== undefined || q.type !== undefined || q.purpose !== undefined) ? {} : Object.assign({}, state);
    Object.assign(s, own);
    if (Object.keys(own).length && !search(plots, s).length && search(plots, own).length) s = Object.assign({}, own);
    const has = i => q.intents.includes(i);
    const hasReq = ["marla", "budget", "area", "society", "feature", "type", "purpose"].some(k => q[k] !== undefined);
    const agent = dealer.agent || dealer.name;
    const parts = []; let shown = []; let handoff = false;
    const live = plots.filter(p => !p.sold);
    const socs = [...new Set(live.map(p => p.society).filter(Boolean))];
    const where = socs.length ? socs.slice(0, 3).join(", ") : (dealer.city || "");

    const only = (...names) => q.intents.length && q.intents.every(i => names.includes(i)) && !hasReq && !q.ref && !q.otherSociety;
    if (has("howareyou") && !hasReq && !q.ref) {
      parts.push(L(`Main bilkul theek hoon, shukriya! 😊 Aap sunayein, kaise hain? Aap ko kis tarah ki property chahiye? Size ya budget bata dein, main foran options dikhata hoon.`,
        `I'm doing well, thank you! 😊 How are you? What kind of property are you looking for? Tell me a size or budget and I'll show you options right away.`));
      return { text: parts.join("\n\n"), plots: shown, state: s, handoff };
    }
    if (has("whoareyou") && !hasReq) {
      parts.push(L(`Main ${dealer.name} ka online assistant hoon. Main properties, size aur demand ke baare mein foran bata sakta hoon. Pakki baat, visit aur deal ${agent} khud WhatsApp par karte hain.`,
        `I'm the online assistant for ${dealer.name}. I can instantly tell you about properties, sizes and demands. ${agent} personally handles deals, visits and final prices on WhatsApp.`));
      return { text: parts.join("\n\n"), plots: shown, state: s, handoff: true };
    }
    if (only("bye", "thanks", "ack") && has("bye")) {
      parts.push(L(`Allah Hafiz! Jab bhi property ka sawal ho, yahan pooch lein ya WhatsApp kar dein.`, `Goodbye! Ask here or message us on WhatsApp whenever you need.`));
      return { text: parts.join("\n\n"), plots: shown, state: s, handoff };
    }
    if (has("contact") && !hasReq && !q.ref) {
      parts.push(L(`${agent} se WhatsApp par baat kar sakte hain, neeche button dabayein. Woh call par bhi baat kar lete hain.`, `You can reach ${agent} on WhatsApp using the button below. He can also talk on a call.`));
      return { text: parts.join("\n\n"), plots: shown, state: s, handoff: true };
    }
    if (only("ack")) {
      parts.push(L(`Ji! Aur kuch poochna ho to bataiye. Misal: "5 marla kitne ka hai?" ya "corner plot hai?"`, `Sure! Anything else? For example: "how much is 5 marla?" or "any corner plot?"`));
      return { text: parts.join("\n\n"), plots: shown, state: s, handoff };
    }
    if (has("greet") && !hasReq && !q.ref && q.intents.length === 1) {
      parts.push(L(`Walaikum Assalam! ${dealer.name} mein khush aamdeed. Hamare paas ${where} mein ${live.length} properties hain. Aap ko kya chahiye, size aur budget batayein.`,
        `Hello, welcome to ${dealer.name}. We have ${live.length} properties in ${where}. Tell me the size and budget you're looking for.`));
      return { text: parts.join("\n\n"), plots: shown, state: s, handoff };
    }
    if (has("sell")) { parts.push(L(`Aap apni property hamare zariye bechna chahte hain? WhatsApp par details bhej dein, ${agent} khud rabta karenge.`, `Want to sell through us? Send the details on WhatsApp and ${agent} will contact you.`)); handoff = true; }
    if (q.otherSociety && !search(plots, { society: q.otherSociety }).length) {
      parts.push(L(`${q.otherSociety} ki koi property is waqt hamari list mein nahi. ${agent} apne contacts se options dhoond sakte hain, requirement WhatsApp par bhej dein.`,
        `We have nothing listed in ${q.otherSociety} right now. ${agent} can source options through his contacts; send your requirement on WhatsApp.`)); handoff = true;
    }
    if (q.ref) {
      const p = plots.find(x => x.ref === q.ref);
      if (p) { shown = [p]; parts.push(`${p.ref}: ${p.type || "Plot"} ${sizeLabel(p.marla)}, ${place(p)}${p.address ? ", " + p.address : ""}. ${L("Demand", "Demand")} ${money(p.price)}${p.features ? ". " + p.features : ""}.${p.sold ? L(" Ye bik chuka hai.", " This one is sold.") : ""}`); handoff = true; }
      else parts.push(L(`${q.ref} hamari list mein nahi mila.`, `I couldn't find ${q.ref}.`));
    } else if (has("list") && !hasReq) {
      parts.push(L(`Hamari properties:\n• ${summarize(plots).join("\n• ")}\nKis mein dilchaspi hai?`, `Our properties:\n• ${summarize(plots).join("\n• ")}\nWhich one interests you?`));
      const seen = new Set(); shown = live.filter(p => { const k = p.type + p.marla; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 5);
    } else if (hasReq && !(q.otherSociety && !q.marla && !q.budget)) {
      const found = search(plots, s);
      const desc = [s.purpose === "rent" && L("rent", "for rent"), s.type, s.marla && sizeLabel(s.marla), s.area, s.society, s.feature, s.budget && L(money(s.budget) + " tak", "up to " + money(s.budget))].filter(Boolean).join(", ");
      if (found.length) {
        shown = found.slice(0, 6);
        parts.push(L(`Ji haan, ${desc} ke liye ${found.length} option${found.length > 1 ? "s" : ""} available ${found.length > 1 ? "hain" : "hai"}${found.length > 6 ? " (sab se munasib 6 neeche)" : ""}. Demand negotiable hai.`,
          `Yes, for ${desc} we have ${found.length} option${found.length > 1 ? "s" : ""}${found.length > 6 ? " (best 6 below)" : ""}. Demands are negotiable.`));
      } else {
        parts.push(L(`Maaf kijiye, ${desc} is waqt hamari list mein nahi.`, `Sorry, nothing matches ${desc} right now.`));
        let alt = [];
        const maxM = Math.max(0, ...live.map(p => p.marla));
        if (s.marla && s.marla > maxM) alt = search(plots, { marla: maxM, purpose: s.purpose });
        if (!alt.length && s.marla) alt = search(plots, { marla: s.marla, purpose: s.purpose });
        if (!alt.length && s.budget) alt = search(plots, { budget: s.budget, purpose: s.purpose });
        if (!alt.length && s.type) alt = search(plots, { type: s.type });
        if (!alt.length) alt = search(plots, { purpose: s.purpose });
        if (!alt.length) alt = search(plots, {});
        shown = alt.slice(0, 4);
        if (shown.length) parts.push(L(`Ye milte julte options dekh lein (demand negotiable hai):`, `Here are the closest options (demands are negotiable):`));
        parts.push(L(`Exact yahi chahiye to ${agent} unlisted options bhi dhoond sakte hain.`, `If you need exactly this, ${agent} can look for unlisted options.`));
      }
      handoff = true;
    }
    if (has("installment")) { parts.push(L(`Qist aur down payment ki tafseel ${agent} property ke hisaab se bata denge.`, `${agent} will share installment and down payment details for the property you choose.`)); handoff = true; }
    if (has("documents")) { parts.push(L(`Transfer, NOC aur documents ke sawalat ${agent} khud samjhate hain.`, `${agent} answers transfer, NOC and document questions personally.`)); handoff = true; }
    if (has("negotiate")) { parts.push(L(`Demand negotiable hai. Apna offer WhatsApp par bhej dein.`, `Demands are negotiable. Send your offer on WhatsApp.`)); handoff = true; }
    if (has("visit")) { parts.push(L(`Site visit ho sakti hai. WhatsApp par din aur waqt bata dein.`, `A site visit can be arranged. Send your preferred day and time on WhatsApp.`)); handoff = true; }
    if (has("office")) { parts.push(dealer.office ? L(`Hamara office: ${dealer.office}.`, `Our office: ${dealer.office}.`) : L(`Office ka address ${agent} WhatsApp par share kar denge.`, `${agent} will share the office address on WhatsApp.`)); handoff = true; }
    if (has("thanks") && !parts.length) parts.push(L(`Shukriya! Koi aur sawal ho to zaroor poochein.`, `You're welcome. Ask anything else any time.`));
    if (!parts.length) {
      parts.push(L(`Maaf kijiye, ye sawal main theek se samajh nahi paya. 🙏 Main properties ke baare mein madad karta hoon: size, area, demand, qist ya visit. Misal: "10 marla 15 lakh tak" ya "corner plot hai?"\n\nKoi aur baat ho to neeche WhatsApp button se ${agent} se seedha poochein.`,
        `Sorry, I didn't quite get that. 🙏 I can help with properties: size, area, demand, installments or a visit. For example: "10 marla up to 15 lakh" or "any corner plot?"\n\nFor anything else, ask ${agent} directly with the WhatsApp button below.`));
      handoff = true;
    }
    return { text: parts.join("\n\n"), plots: shown, state: s, handoff };
  }

  function requirementText(s, shown) {
    const bits = [s.purpose === "rent" && "for rent", s.type, s.marla && sizeLabel(s.marla), s.area, s.society, s.feature, s.budget && "budget " + money(s.budget)].filter(Boolean);
    return bits.join(", ") + (shown && shown.length ? (bits.length ? ". " : "") + "Interested in " + shown.map(p => p.ref).join(", ") : "");
  }

  const PB = { sizeLabel, money, slugify, waNumber, waLink, place, readList, reply, search, summarize, requirementText, findSociety };
  if (typeof module !== "undefined" && module.exports) module.exports = PB; else root.PB = PB;
})(typeof window !== "undefined" ? window : globalThis);
