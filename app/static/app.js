/* CampusPeer SPA — vanilla JS */
const $ = (s) => document.querySelector(s);
const API = "";
let TOKEN = sessionStorage.getItem("cp_token") || null;
let ME = null;
let chatPeer = null;
const PALETTE = ["#f6c177", "#9ecbff", "#c3a6ff", "#8ee0d4", "#f2a7c3",
  "#b5e48c", "#ffd6a5", "#cdb4db"];

/* ---------- helpers ---------- */
async function api(method, path, body, auth = true) {
  const headers = { "Content-Type": "application/json" };
  if (auth && TOKEN) headers["Authorization"] = "Bearer " + TOKEN;
  const r = await fetch(API + path, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.detail || r.statusText);
  return data;
}

function toast(msg, err = false) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "toast" + (err ? " err" : "");
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.add("hidden"), 3200);
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function avatarColor(name) {
  let h = 0; for (const ch of name || "?") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/* ---------- auth ---------- */
document.querySelectorAll("[data-auth-tab]").forEach((btn) =>
  btn.addEventListener("click", () => {
    document.querySelectorAll("[data-auth-tab]").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    $("#login-form").classList.toggle("hidden", btn.dataset.authTab !== "login");
    $("#register-form").classList.toggle("hidden", btn.dataset.authTab !== "register");
    $("#auth-error").textContent = "";
  }));

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const res = await api("POST", "/api/auth/login", {
      email: $("#li-email").value.trim(), password: $("#li-pass").value,
    }, false);
    enterApp(res.token);
  } catch (err) { $("#auth-error").textContent = err.message; }
});

$("#register-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const res = await api("POST", "/api/auth/register", {
      roll_no: $("#rg-roll").value.trim(), name: $("#rg-name").value.trim(),
      email: $("#rg-email").value.trim(), password: $("#rg-pass").value,
    }, false);
    enterApp(res.token);
  } catch (err) { $("#auth-error").textContent = err.message; }
});

$("#logout-btn").addEventListener("click", () => {
  TOKEN = null; ME = null;
  sessionStorage.removeItem("cp_token");
  $("#app-view").classList.add("hidden");
  $("#auth-view").classList.remove("hidden");
});

async function enterApp(token) {
  TOKEN = token;
  sessionStorage.setItem("cp_token", token);
  ME = await api("GET", "/api/auth/me");
  $("#auth-view").classList.add("hidden");
  $("#app-view").classList.remove("hidden");
  showView("timetable");
}

/* ---------- nav ---------- */
document.querySelectorAll(".nav-btn").forEach((btn) =>
  btn.addEventListener("click", () => showView(btn.dataset.view)));

function showView(name) {
  document.querySelectorAll(".nav-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.view === name));
  document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
  $("#view-" + name).classList.remove("hidden");
  if (name === "timetable") loadGrid();
  if (name === "social") loadSocial();
}

/* ---------- timetable ---------- */
$("#upload-btn").addEventListener("click", async () => {
  try {
    const res = await api("POST", "/api/timetable/upload", { raw_text: $("#raw-upload").value });
    toast(`saved ${res.saved_courses.length} courses ✦`);
    loadGrid();
  } catch (err) { toast(err.message, true); }
});

async function loadGrid() {
  let g;
  try { g = await api("GET", "/api/timetable/grid"); }
  catch { $("#grid-table").innerHTML = ""; return; }

  $("#free-count").textContent = `${g.free_cells} free periods · ${g.lunch} lunch`;
  const rows = [...g.morning_hours.map((h, i) => [h, g.theory[i]]),
                ["LUNCH", null],
                ...g.afternoon_hours.map((h, i) => [h, g.theory[i + 5]])];

  let html = "<tr><th></th>" + g.days.map((d) => `<th>${d}</th>`).join("") + "</tr>";
  for (const [label, row] of rows) {
    if (!row) { html += `<tr class="lunch"><td class="time">${label}</td><td colspan="5">· · ·</td></tr>`; continue; }
    html += `<tr><td class="time">${label}</td>` + row.map((cell) => {
      if (!cell) return '<td><div class="cell">free</div></td>';
      const c = PALETTE[(hash(cell.course_code)) % PALETTE.length];
      return `<td><div class="cell filled" style="background:${c}66;border-color:${c};color:#eee">
        <b>${esc(cell.course_code)}</b><small>${esc(cell.venue || "")} · ${esc(cell.slot_token)}</small></div></td>`;
    }).join("") + "</tr>";
  }
  $("#grid-table").innerHTML = html;

  $("#lab-list").innerHTML = g.lab.map((l) =>
    `<div class="lab-item"><b>${l.day} ${l.time}</b> ` +
    l.entries.map((e) => `${esc(e.course_code)} @ ${esc(e.venue)} <span class="chip">${esc(e.slot_token)}</span>`).join(" &nbsp; ") +
    `</div>`).join("");
}

function hash(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }

/* ---------- classmates ---------- */
$("#cm-search").addEventListener("click", findClassmates);
$("#cm-course").addEventListener("keydown", (e) => e.key === "Enter" && findClassmates());

async function findClassmates() {
  const cc = $("#cm-course").value.trim().toUpperCase();
  if (!cc) return toast("enter a course code", true);
  const sl = $("#cm-slot").value.trim().toUpperCase();
  try {
    const res = await api("GET",
      `/api/classmates/find?course_code=${encodeURIComponent(cc)}&slot_token=${encodeURIComponent(sl)}`);
    $("#cm-results").innerHTML = res.classmates.length
      ? res.classmates.map(classmateCard).join("")
      : emptyState("nobody here yet — the night shift is quiet 🌙");
    bindFollowButtons();
  } catch (err) { toast(err.message, true); }
}

function classmateCard(m) {
  const cls = m.classes.map((c) => `<span class="chip">${esc(c.slot)}</span> @ ${esc(c.venue)}`).join(" &nbsp;");
  return `<div class="glass card" data-sid="${m.student_id}">
    <div class="avatar" style="background:${avatarColor(m.name)}">${esc(m.name[0] || "?")}</div>
    <div class="card-main"><b>${esc(m.name)}</b><div class="meta-line">${cls}</div></div>
    <button class="btn ${m.is_following ? "btn-secondary" : "btn-primary"} follow-btn">
      ${m.is_following ? "following ✓" : "+ follow"}</button></div>`;
}

function bindFollowButtons() {
  document.querySelectorAll(".follow-btn").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const sid = btn.closest(".card").dataset.sid;
      try {
        const res = await api("POST", "/api/social/follow", { student_id: sid });
        btn.textContent = res.following ? "following ✓" : "+ follow";
        btn.className = "btn " + (res.following ? "btn-secondary" : "btn-primary") + " follow-btn";
        if (res.mutual) toast("it's mutual — chat unlocked ☾");
      } catch (err) { toast(err.message, true); }
    }));
}

function emptyState(msg) { return `<div class="glass card"><div class="meta-line">${msg}</div></div>`; }

/* ---------- social / chat ---------- */
async function loadSocial() {
  const net = await api("GET", "/api/social/followers");
  const mutualIds = new Set(net.mutual);
  const people = {};
  [...net.followers, ...net.following].forEach((u) => (people[u.student_id] = u.name));

  $("#network-stats").innerHTML = [
    [net.followers.length, "followers"], [net.following.length, "following"],
    [net.mutual.length, "mutuals"],
  ].map(([n, l]) => `<div class="stat"><div class="n">${n}</div><div class="l">${l}</div></div>`).join("");

  $("#mutual-list").innerHTML = net.mutual.length
    ? net.mutual.map((id) => `<span class="mutual-chip" data-peer="${id}">☾ ${esc(people[id] || id)}</span>`).join("")
    : `<p class="hint">follow each other with someone to unlock chat.</p>`;
  document.querySelectorAll("#mutual-list .mutual-chip").forEach((chip) =>
    chip.addEventListener("click", () => startChat(chip.dataset.peer)));

  const sel = $("#chat-with");
  sel.innerHTML = ["— choose a mutual —"].concat(Object.keys(people))
    .filter((id) => id.startsWith("—") || mutualIds.has(id))
    .map((id) => `<option value="${id}">${id.startsWith("—") ? id : esc(people[id])}</option>`).join("");
  sel.onchange = () => sel.value.startsWith("—") ? null : startChat(sel.value);

  if (chatPeer && mutualIds.has(chatPeer)) renderChat();
}

async function startChat(peerId) {
  chatPeer = peerId;
  $("#chat-box").innerHTML = '<p class="hint">loading…</p>';
  try { await renderChat(); } catch (err) { toast(err.message, true); }
}

async function renderChat() {
  if (!chatPeer) return;
  const msgs = await api("GET", `/api/social/messages/${chatPeer}`);
  const box = $("#chat-box");
  box.innerHTML = msgs.length ? msgs.map((m) =>
    `<div class="msg ${m.from === ME.student_id ? "me" : "them"}">${esc(m.text)}</div>`).join("")
    : '<p class="hint">no messages yet — say hi 👋</p>';
  box.scrollTop = box.scrollHeight;
}

$("#chat-send").addEventListener("click", sendChat);
$("#chat-input").addEventListener("keydown", (e) => e.key === "Enter" && sendChat());

async function sendChat() {
  if (!chatPeer) return toast("pick a mutual first", true);
  const text = $("#chat-input").value.trim();
  if (!text) return;
  try {
    await api("POST", "/api/social/message", { receiver_id: chatPeer, message_text: text });
    $("#chat-input").value = "";
    renderChat();
  } catch (err) { toast(err.message, true); }
}

/* ---------- swap market ---------- */
$("#sw-create").addEventListener("click", async () => {
  try {
    await api("POST", "/api/swap/list", {
      offered_class_id: $("#sw-class").value.trim(),
      desired_course_code: $("#sw-want-course").value.trim().toUpperCase(),
      desired_slot_tokens: $("#sw-want-slots").value.split("+")
        .map((t) => t.trim().toUpperCase()).filter(Boolean),
    });
    toast("your slot is on the market ⇄");
  } catch (err) { toast(err.message, true); }
});

$("#sw-match").addEventListener("click", async () => {
  try {
    const res = await api("GET", "/api/swap/match");
    const oneToOneHtml = res.one_to_one.map(({ my_listing: mine, peer_listing: p }) => `
      <div class="glass card" style="flex-wrap:wrap">
        <div class="avatar" style="background:${avatarColor(p.offered_course_code)}">⇄</div>
        <div class="card-main">
          <b>direct swap available</b>
          <div class="meta-line">they offer
            ${p.offered_slot_tokens.map((t) => `<span class="chip">${esc(t)}</span>`).join("")}
            of ${esc(p.offered_course_code)} and want your
            ${esc(p.desired_course_code)} ${p.desired_slot_tokens.map((t) => `<span class="chip">${esc(t)}</span>`).join("")}
          </div></div>
        <span class="badge-open">● OPEN</span>
        <button class="btn btn-primary sw-exec" data-mine="${mine.listing_id}" data-peer="${p.listing_id}">
          accept &amp; swap</button></div>`).join("");

    const cycleHtml = res.three_way_cycles.map((c) => `
      <div class="glass card"><div class="card-main"><b>🌀 3-way cycle detected</b>
      <div class="meta-line">${c.cycle.map((x) => `${esc(x.offered_course_code)}:${x.offered_slot_tokens.join("+")}`).join(" → ")}</div>
      </div></div>`).join("");

    $("#sw-results").innerHTML =
      (oneToOneHtml + cycleHtml) ||
      emptyState("no matches yet — list your slot and check back 🌙");

    document.querySelectorAll(".sw-exec").forEach((btn) =>
      btn.addEventListener("click", async () => {
        try {
          const out = await api("POST", "/api/swap/execute", {
            my_listing_id: +btn.dataset.mine, peer_listing_id: +btn.dataset.peer });
          // note: executed from this user's perspective
          toast(out.status === "COMPLETED" ? "swap complete — contacts unlocked ✦" : out.detail || "done");
          $("#sw-match").click();
        } catch (err) { toast(err.message, true); }
      }));
  } catch (err) { toast(err.message, true); }
});

/* ---------- boot ---------- */
(async function init() {
  if (TOKEN) {
    try { await enterApp(TOKEN); return; } catch { TOKEN = null; sessionStorage.removeItem("cp_token"); }
  }
})();
