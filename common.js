/* Shared page helpers: talking to the Google Sheet backend, small DOM helpers. */
window.PB_API = "__API_URL__";
window.PBX = {
  ready() { return !/^__/.test(PB_API); },
  async get(slug) {
    if (!this.ready()) { const r = await fetch("data/" + encodeURIComponent(slug) + ".json"); return r.ok ? r.json() : { ok: false, error: "Shop not found" }; }
    const r = await fetch(PB_API + "?d=" + encodeURIComponent(slug));
    return r.json();
  },
  async post(body) {
    if (!this.ready()) return { ok: false, error: "Shop editing is being set up. Please try again later." };
    const r = await fetch(PB_API, { method: "POST", body: JSON.stringify(body) });
    return r.json();
  },
  beacon(body) {
    if (!this.ready()) return;
    try { if (navigator.sendBeacon && navigator.sendBeacon(PB_API, JSON.stringify(body))) return; } catch (e) {}
    fetch(PB_API, { method: "POST", body: JSON.stringify(body), keepalive: true }).catch(() => {});
  },
  el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; },
  base() { return location.href.replace(/[^/]*([?#].*)?$/, ""); },
  shopUrl(slug) { return this.base() + "shop.html?d=" + slug; },
  dealerUrl(slug) { return this.base() + "dealer.html?d=" + slug; },
  param(k) { return new URLSearchParams(location.search).get(k) || ""; },
  store: {
    get(k) { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  },
  async copy(text, btn, label) {
    try { await navigator.clipboard.writeText(text); btn.textContent = "Copied ✓"; }
    catch (e) { btn.textContent = "Press and hold the link to copy"; }
    setTimeout(() => (btn.textContent = label), 2000);
  },
  plotIcon(marla) {
    const box = this.el("div", "plot-sq"); box.setAttribute("aria-hidden", "true");
    const i = this.el("i"); const side = Math.round(16 + Math.min(1.6, Math.sqrt((marla || 5) / 20)) * 26);
    i.style.width = side + "px"; i.style.height = side + "px"; box.append(i); return box;
  },
  priceText(p) { return PB.money(p.price) + (p.purpose === "rent" && p.price ? "/month" : ""); },
};
