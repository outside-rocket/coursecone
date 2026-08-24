/* CampusPeer SPA — vanilla JS */
const $ = (s) => document.querySelector(s);
const API = "";
let TOKEN = localStorage.getItem("cp_token") || sessionStorage.getItem("cp_token") || null;
let ME = null;
let chatPeer = null;
const PALETTE = ["#a78bfa", "#ff9440", "#c4b0ff", "#ffb066", "#8b5cf6",
  "#ff7e33", "#d8ccff", "#ffc49b"];

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
  if (!t) return;
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

/* ---------- menu / nav ---------- */
const menuBtn = $("#menu-btn");
if (menuBtn) {
  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const dd = $("#menu-dropdown");
    // sidebar has overflow:hidden + backdrop-filter which clip fixed children;
    // re-parent the dropdown to <body> so it renders above everything
    if (dd && dd.parentNode !== document.body) document.body.appendChild(dd);
    dd.classList.toggle("hidden");
  });
}
document.addEventListener("click", (e) => {
  if (!e.target.closest(".menu-wrap") && $("#menu-dropdown")) $("#menu-dropdown").classList.add("hidden");
  if (!e.target.closest("#app-sidebar") && !e.target.closest("#mobile-nav-toggle")) {
    const sb = $("#app-sidebar");
    if (sb) sb.classList.remove("mobile-open");
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if ($("#menu-dropdown")) $("#menu-dropdown").classList.add("hidden");
    const sb = $("#app-sidebar");
    if (sb) sb.classList.remove("mobile-open");
  }
});

const sidebarCollapseBtn = $("#sidebar-collapse-btn");
if (sidebarCollapseBtn) {
  sidebarCollapseBtn.addEventListener("click", () => {
    const isCollapsed = $("#app-sidebar").classList.toggle("collapsed");
    $("#app-view").classList.toggle("sidebar-collapsed", isCollapsed);
    localStorage.setItem("cp_sidebar_collapsed", isCollapsed ? "1" : "0");
  });
  if (localStorage.getItem("cp_sidebar_collapsed") === "1") {
    const sb = $("#app-sidebar");
    if (sb) sb.classList.add("collapsed");
    const av = $("#app-view");
    if (av) av.classList.add("sidebar-collapsed");
  }
}

const mobileNavToggle = $("#mobile-nav-toggle");
if (mobileNavToggle) {
  mobileNavToggle.addEventListener("click", () => {
    const sb = $("#app-sidebar");
    if (sb) sb.classList.toggle("mobile-open");
  });
}

const logoutBtn = $("#logout-btn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    TOKEN = null; ME = null;
    localStorage.removeItem("cp_token");
    sessionStorage.removeItem("cp_token");
    $("#app-view").classList.add("hidden");
    $("#auth-view").classList.remove("hidden");
  });
}

async function enterApp(token) {
  TOKEN = token;
  localStorage.setItem("cp_token", token);
  sessionStorage.setItem("cp_token", token);
  ME = await api("GET", "/api/auth/me");
  if ($("#menu-name")) $("#menu-name").textContent = ME.name;
  if ($("#menu-roll")) $("#menu-roll").textContent = ME.roll_no;
  if ($("#sidebar-user-name")) $("#sidebar-user-name").textContent = ME.name ? ME.name.split(" ")[0] : "Account";
  $("#auth-view").classList.add("hidden");
  $("#app-view").classList.remove("hidden");
  showView("timetable");
}

/* ---------- nav ---------- */
document.querySelectorAll(".nav-btn[data-view]").forEach((btn) =>
  btn.addEventListener("click", () => showView(btn.dataset.view)));

function showView(name) {
  CURRENT_VIEW = name;
  document.querySelectorAll(".nav-btn[data-view]").forEach((b) =>
    b.classList.toggle("active", b.dataset.view === name));
  document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
  const viewEl = $("#view-" + name);
  if (viewEl) viewEl.classList.remove("hidden");
  const sb = $("#app-sidebar");
  if (sb) sb.classList.remove("mobile-open");
  if (name === "timetable") { loadGrid(); }
  if (name === "classmates") { findClassmates(); loadRequests(); }
  if (name === "social") { loadSocial(); loadRequests(); }
  if (name === "compare") { loadCompare(); }
  if (name === "profile") { loadProfile(); }
  if (name === "swap") { loadSwap(); searchMarket(); }
}

/* live refresh removed: polling re-rendered lists and reset user selections */

/* ---------- timetable ---------- */
function recentsKey() { return `cp_recent_${ME ? ME.student_id : "anon"}`; }

function getRecents() {
  try { return JSON.parse(localStorage.getItem(recentsKey()) || "[]"); } catch { return []; }
}

function addRecents(saved, parsedCount) {
  const now = new Date().toLocaleString();
  const entry = { at: now, courses: saved, count: parsedCount };
  const list = [entry, ...getRecents()].slice(0, 5);
  localStorage.setItem(recentsKey(), JSON.stringify(list));
}

function renderRecents(justAdded = false) {
  const list = getRecents();
  const el = $("#recent-list");
  if (!el) return;
  if (!list.length) {
    el.innerHTML = '<p class="hint">courses you paste will show up here.</p>';
    return;
  }
  el.innerHTML = list.map((r, i) => `
    <div class="recent-item ${justAdded && i === 0 ? "new" : ""}">
      <div><b>${r.courses.length} course${r.courses.length === 1 ? "" : "s"} added</b>
        <div class="meta-line">${r.courses.slice(0, 4).map(esc).join(", ")}${r.courses.length > 4 ? " …" : ""}</div></div>
      <small class="meta-line">${esc(r.at)}</small>
    </div>`).join("");
}

const uploadBtn = $("#upload-btn");
if (uploadBtn) {
  uploadBtn.addEventListener("click", async () => {
    try {
      const res = await api("POST", "/api/timetable/upload", { raw_text: $("#raw-upload").value });
      if (res.warnings && res.warnings.length)
        toast(`saved ${res.saved_courses.length} courses — ⚠ ${res.warnings.length} slot clash${res.warnings.length > 1 ? "es" : ""}`, true);
      else
        toast(`saved ${res.saved_courses.length} courses ✦`);
      showView("timetable");
    } catch (err) { toast(err.message, true); }
  });
}

async function loadGrid() {
  let g;
  try { g = await api("GET", "/api/timetable/grid"); }
  catch (e) {
    if ($("#grid-table")) {
      $("#grid-table").innerHTML =
        `<tr><td><div class="cell free">could not load grid: ${esc(e.message)} — try re-pasting your registration</div></td></tr>`;
    }
    return;
  }
  if (!g.grid_view || !g.theory_slots) {
    if ($("#grid-table")) {
      $("#grid-table").innerHTML =
        '<tr><td><div class="cell free">timetable format updated — please re-paste your registration in “add courses”.</div></td></tr>';
    }
    return;
  }

  const T = g.theory_slots;

  // header: DAY | TYPE | 6 morning | LUNCH | 6 afternoon
  let html = "<tr><th>day</th><th>type</th>"
    + T.slice(0, 6).map((t) => `<th>${t}</th>`).join("")
    + '<th class="lunch-col">lunch</th>'
    + T.slice(6).map((t) => `<th>${t}</th>`).join("") + "</tr>";

  const cellHtml = (c) => {
    if (!c.occupied) return c.token ? esc(c.token) : "·";
    const d = c.data;
    const tip = `${d.course_code || ""} \u2014 ${d.course_title || ""}\nFaculty: ${d.faculty || "TBD"}\nVenue: ${d.venue || "TBD"}\nSlot: ${d.slot_token || d.token || ""}`;
    return `<span class="tt-tip" data-tip="${esc(tip)}" tabindex="0">${esc(d.course_title)}</span><small>${esc(d.venue || "")}</small>`;
  };

  const mkTd = (c) =>
    `<td class="${c.occupied ? "occ" : "free"}">${cellHtml(c)}</td>`;

  const rowCells = (row) =>
    row.slice(0, 6).map(mkTd).join("")
    + `<td class="lunch-spacer"></td>`
    + row.slice(6).map(mkTd).join("");

  for (const block of g.grid_view) {
    html += `<tr class="theory-row"><td class="day-cell" rowspan="2">${block.day}</td>
      <td class="tier-label">TH</td>${rowCells(block.theory_row)}</tr>
      <tr class="lab-row"><td class="tier-label">LAB</td>${rowCells(block.lab_row)}</tr>`;
  }
  if ($("#grid-table")) $("#grid-table").innerHTML = html;
}

function hash(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }

/* ---------- classmates ---------- */
const REL_LABEL = { MUTUAL: "mutual ✓", FOLLOWING: "following", REQUESTED: "requested…" };

async function loadRequests() {
  try {
    const res = await api("GET", "/api/social/requests");
    const count = res.requests ? res.requests.length : 0;

    // Update WhatsApp-style green round badge on Social nav tab
    const navBadge = $("#nav-badge-social");
    if (navBadge) {
      if (count > 0) {
        navBadge.textContent = count > 99 ? "99+" : String(count);
        navBadge.classList.remove("hidden");
      } else {
        navBadge.classList.add("hidden");
      }
    }

    const renderInto = (listEl, countEl) => {
      if (countEl) countEl.textContent = count ? `${count} pending` : "";
      if (!listEl) return;
      listEl.innerHTML = count
        ? res.requests.map((r) => `
          <div class="glass card req-card" data-sid="${r.student_id}">
            <div class="avatar" style="background:${avatarColor(r.name)}">${esc(r.name[0] || "?")}</div>
            <div class="card-main"><b>${esc(r.name)}</b><div class="meta-line">wants to follow you</div></div>
            <button class="btn btn-primary req-accept">accept</button>
            <button class="btn btn-secondary req-reject">reject</button>
          </div>`).join("")
        : '<p class="hint">no pending requests.</p>';
    };
    renderInto($("#req-list"), $("#req-count"));
    renderInto($("#req-list-social"), $("#req-count-social"));
    document.querySelectorAll(".req-accept").forEach((b) => b.addEventListener("click", () => answerRequest(b, true)));
    document.querySelectorAll(".req-reject").forEach((b) => b.addEventListener("click", () => answerRequest(b, false)));
  } catch (err) { console.error("loadRequests error:", err); }
}

async function answerRequest(btn, accept) {
  const card = btn.closest(".req-card");
  if (!card) return;
  try {
    await api("POST", `/api/social/requests/${accept ? "accept" : "reject"}`,
              { student_id: card.dataset.sid });
    document.querySelectorAll(`.req-card[data-sid="${card.dataset.sid}"]`).forEach((c) => c.remove());
    toast(accept ? "request accepted — say hi 👋" : "request declined");
    loadRequests();
  } catch (err) { toast(err.message, true); }
}

let CM_DATA = { courses: [], classmates: [] };
let selectedCourse = "ALL";

async function findClassmates() {
  try {
    const res = await api("GET", "/api/classmates/all");
    CM_DATA = { courses: res.my_courses || [], classmates: res.classmates || [] };
    renderCourseTabs();
    renderPeers();
  } catch (err) { toast(err.message, true); }
}

function renderCourseTabs() {
  const counts = {};
  CM_DATA.classmates.forEach((m) =>
    m.classes.forEach((c) => { counts[c.course] = (counts[c.course] || 0) + 1; }));
  const tab = (id, label, n) => `
    <button class="course-tab ${selectedCourse === id ? "active" : ""}" data-course="${esc(id)}">
      <span>${esc(label)}</span><small>${n}</small></button>`;
  const tabsEl = $("#course-tabs");
  if (!tabsEl) return;
  tabsEl.innerHTML =
    tab("ALL", "all classmates", CM_DATA.classmates.length)
    + CM_DATA.courses.map((c) => tab(c.course, `${c.course} · ${c.slot}`, counts[c.course] || 0)).join("");
  document.querySelectorAll(".course-tab").forEach((b) =>
    b.addEventListener("click", () => { selectedCourse = b.dataset.course; renderCourseTabs(); renderPeers(); }));
}

function renderPeers() {
  const peers = selectedCourse === "ALL"
    ? CM_DATA.classmates
    : CM_DATA.classmates.filter((m) => m.classes.some((c) => c.course === selectedCourse));
  if ($("#peers-title")) {
    $("#peers-title").textContent = selectedCourse === "ALL"
      ? "all classmates" : `classmates · ${selectedCourse}`;
  }
  const resultsEl = $("#cm-results");
  if (resultsEl) {
    resultsEl.innerHTML = peers.length
      ? peers.map(classmateCard).join("")
      : emptyState("no classmates in this course yet.");
  }
  bindFollowButtons();
}

function relButton(rel) {
  switch (rel) {
    case "MUTUAL":
      return '<button class="btn btn-secondary follow-btn is-following is-mutual" data-rel="MUTUAL" title="Mutual follow · Click to unfollow"><span class="btn-text">mutual ✓</span><span class="btn-hover-text">unfollow</span></button>';
    case "FOLLOWING":
      return '<button class="btn btn-secondary follow-btn is-following" data-rel="FOLLOWING" title="Following · Click to unfollow"><span class="btn-text">following ✓</span><span class="btn-hover-text">unfollow</span></button>';
    case "REQUESTED":
      return '<button class="btn btn-secondary follow-btn is-requested" data-rel="REQUESTED" title="Request pending · Click to cancel"><span class="btn-text">requested…</span><span class="btn-hover-text">cancel ✕</span></button>';
    case "FOLLOWS_YOU":
      return '<button class="btn btn-primary follow-btn is-follow-back" data-rel="FOLLOWS_YOU" title="Follows you · Click to follow back"><span class="btn-text">follow back ↩</span></button>';
    default:
      return '<button class="btn btn-primary follow-btn is-none" data-rel="NONE"><span class="btn-text">+ follow</span></button>';
  }
}

function classmateCard(m) {
  const cls = m.classes.map((c) => `<span class="chip">${esc(c.course)}</span> ${esc(c.slot)} @ ${esc(c.venue)}`).join(" &nbsp;·&nbsp; ");
  return `<div class="glass card" data-sid="${m.student_id}">
    <div class="avatar" style="background:${avatarColor(m.name)}">${esc(m.name[0] || "?")}</div>
    <div class="card-main"><b>${esc(m.name)}</b><div class="meta-line">${cls}</div></div>
    ${relButton(m.rel || (m.is_following ? "FOLLOWING" : "NONE"))}</div>`;
}

function bindFollowButtons() {
  document.querySelectorAll(".follow-btn").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const card = btn.closest(".card");
      if (!card) return;
      const sid = card.dataset.sid;
      const isUnfollowAction = btn.classList.contains("is-following") || btn.classList.contains("is-requested");

      try {
        if (isUnfollowAction) {
          const res = await api("POST", "/api/social/unfollow", { student_id: sid });
          if (res.status === "FOLLOWS_YOU") {
            btn.className = "btn btn-primary follow-btn is-follow-back";
            btn.dataset.rel = "FOLLOWS_YOU";
            btn.title = "Follows you · Click to follow back";
            btn.innerHTML = '<span class="btn-text">follow back ↩</span>';
          } else {
            btn.className = "btn btn-primary follow-btn is-none";
            btn.dataset.rel = "NONE";
            btn.title = "";
            btn.innerHTML = '<span class="btn-text">+ follow</span>';
          }
          if (CM_DATA && CM_DATA.classmates) {
            CM_DATA.classmates.forEach((m) => { if (m.student_id === sid) m.rel = res.status; });
          }
          toast("unfollowed");
        } else {
          const res = await api("POST", "/api/social/follow", { student_id: sid });
          if (res.status === "MUTUAL") {
            btn.className = "btn btn-secondary follow-btn is-following is-mutual";
            btn.dataset.rel = "MUTUAL";
            btn.title = "Mutual follow · Click to unfollow";
            btn.innerHTML = '<span class="btn-text">mutual ✓</span><span class="btn-hover-text">unfollow</span>';
            toast("mutual follow ✓");
          } else {
            btn.className = "btn btn-secondary follow-btn is-requested";
            btn.dataset.rel = "REQUESTED";
            btn.title = "Request pending · Click to cancel";
            btn.innerHTML = '<span class="btn-text">requested…</span><span class="btn-hover-text">cancel ✕</span>';
            toast("follow request sent 👋");
          }
          if (CM_DATA && CM_DATA.classmates) {
            CM_DATA.classmates.forEach((m) => { if (m.student_id === sid) m.rel = res.status; });
          }
        }
        loadSocial();
      } catch (err) { toast(err.message, true); }
    }));
}

function emptyState(msg) { return `<div class="glass card"><div class="meta-line">${msg}</div></div>`; }

/* ---------- social / chat ---------- */
async function loadSocial() {
  try {
    const [net, reqs] = await Promise.all([
      api("GET", "/api/social/followers"), api("GET", "/api/social/requests")]);
    const mutualIds = new Set(net.mutual || []);
    const people = {};
    [...(net.followers || []), ...(net.following || [])].forEach((u) => (people[u.student_id] = u.name));

    const statCol = $("#network-stats");
    if (statCol) statCol.innerHTML = [
      [(net.followers || []).length, "followers"], [(net.following || []).length, "following"],
      [mutualIds.size, "mutuals"], [(reqs.requests || []).length, "requests"],
    ].map(([n, l]) => `<div class="stat"><div class="n">${n}</div><div class="l">${l}</div></div>`).join("");

    const tipFor = (u) => [
      u.email ? `\u2709 ${u.email}` : "",
      u.phone ? `\u260e ${u.phone}` : "",
      u.instagram ? `instagram: @${u.instagram}` : "",
      u.facebook ? `facebook: ${u.facebook}` : "",
      u.bio ? `\n${u.bio}` : "",
    ].filter(Boolean).join("\n") || "no details shared yet";

    // Followers row: shows 'follow back' if not mutual, or 'unfollow' if mutual
    const followerRow = (u) => {
      const isMutual = mutualIds.has(u.student_id);
      const tag = isMutual ? "MUTUAL" : "FOLLOWS YOU";
      const t = tipFor(u).replace(/"/g, "&quot;");
      const actionBtn = isMutual
        ? `<button class="social-action-btn social-unfollow-btn" data-sid="${u.student_id}" data-name="${esc(u.name)}" title="Unfollow">unfollow</button>`
        : `<button class="social-action-btn social-follow-back-btn" data-sid="${u.student_id}" data-name="${esc(u.name)}" title="Follow back">follow back ↩</button>`;

      return `<div class="people-row"><div class="avatar sm" style="background:${avatarColor(u.name)}">${esc(u.name[0] || "?")}</div>
        <span class="tt-tip" data-tip="${t}" tabindex="0">${esc(u.name)}</span>
        <small class="tag ${tag.toLowerCase().replace(/\s+/g, '-')}">${tag}</small>
        ${actionBtn}
      </div>`;
    };

    // Following row: always allows 'unfollow'
    const followingRow = (u) => {
      const isMutual = mutualIds.has(u.student_id);
      const tag = isMutual ? "MUTUAL" : "YOU FOLLOW";
      const t = tipFor(u).replace(/"/g, "&quot;");
      const actionBtn = `<button class="social-action-btn social-unfollow-btn" data-sid="${u.student_id}" data-name="${esc(u.name)}" title="Unfollow">unfollow</button>`;

      return `<div class="people-row"><div class="avatar sm" style="background:${avatarColor(u.name)}">${esc(u.name[0] || "?")}</div>
        <span class="tt-tip" data-tip="${t}" tabindex="0">${esc(u.name)}</span>
        <small class="tag ${tag.toLowerCase().replace(/\s+/g, '-')}">${tag}</small>
        ${actionBtn}
      </div>`;
    };

    const box = (el, list, isFollowersList) => {
      if (el) el.innerHTML = list && list.length
        ? list.map(isFollowersList ? followerRow : followingRow).join("")
        : '<p class="hint">none yet.</p>';
    };

    box($("#followers-box"), net.followers, true);
    box($("#following-box"), net.following, false);

    // Bind social action buttons (unfollow & follow-back)
    document.querySelectorAll(".social-unfollow-btn").forEach((b) => {
      b.addEventListener("click", async (e) => {
        e.stopPropagation();
        const sid = b.dataset.sid;
        const name = b.dataset.name || "user";
        try {
          await api("POST", "/api/social/unfollow", { student_id: sid });
          toast(`unfollowed ${name}`);
          loadSocial();
          loadClassmates();
        } catch (err) { toast(err.message, true); }
      });
    });

    document.querySelectorAll(".social-follow-back-btn").forEach((b) => {
      b.addEventListener("click", async (e) => {
        e.stopPropagation();
        const sid = b.dataset.sid;
        const name = b.dataset.name || "user";
        try {
          await api("POST", "/api/social/follow", { student_id: sid });
          toast(`follow request sent to ${name} 👋`);
          loadSocial();
          loadClassmates();
        } catch (err) { toast(err.message, true); }
      });
    });

  } catch (err) { toast(err.message, true); }
}

/* ---------- compare ---------- */
async function loadCompare() {
  try {
    const net = await api("GET", "/api/social/followers");
    const peers = [...(net.followers || []), ...(net.following || [])];
    const seen = new Set();
    const uniqPeers = peers.filter((p) => {
      if (seen.has(p.student_id) || (ME && p.student_id === String(ME.student_id))) return false;
      seen.add(p.student_id);
      return true;
    });

    const el = $("#cmp-peers");
    if (!uniqPeers.length) {
      if (el) el.innerHTML = '<p class="hint">follow classmates or accept requests to compare timetables.</p>';
      if ($("#cmp-result-wrap")) $("#cmp-result-wrap").classList.add("hidden");
      return;
    }
    if ($("#cmp-result-wrap")) $("#cmp-result-wrap").classList.remove("hidden");
    if (el) {
      el.innerHTML = uniqPeers.map((p, i) => `
        <button class="course-tab cmp-peer-btn ${i === 0 ? "active" : ""}" data-sid="${p.student_id}">
          <span>${esc(p.name)}</span>
        </button>`).join("");

      document.querySelectorAll(".cmp-peer-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          document.querySelectorAll(".cmp-peer-btn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          compareWith(btn.dataset.sid);
        });
      });
    }

    if (uniqPeers.length) {
      compareWith(uniqPeers[0].student_id);
    }
  } catch (err) { toast(err.message, true); }
}

async function compareWith(peerId) {
  try {
    const data = await api("GET", `/api/social/compare/${peerId}`);
    if ($("#cmp-title")) $("#cmp-title").textContent = `comparison with ${data.peer.name}`;

    const s = data.summary || { common: 0, both_busy: 0, mine: 0, theirs: 0, both_free: 0 };
    if ($("#cmp-summary")) {
      $("#cmp-summary").innerHTML = `
        <div class="stat"><div class="n">${s.common}</div><div class="l">same class</div></div>
        <div class="stat"><div class="n">${s.both_busy}</div><div class="l">both busy</div></div>
        <div class="stat"><div class="n">${s.mine}</div><div class="l">only me</div></div>
        <div class="stat"><div class="n">${s.theirs}</div><div class="l">only them</div></div>
        <div class="stat"><div class="n">${s.both_free}</div><div class="l">both free</div></div>
      `;
    }

    const T = data.time_slots || [];
    let html = "<tr><th>day</th>"
      + T.slice(0, 6).map((t) => `<th>${t}</th>`).join("")
      + '<th class="lunch-col">lunch</th>'
      + T.slice(6).map((t) => `<th>${t}</th>`).join("") + "</tr>";

    for (const block of (data.grid || [])) {
      html += `<tr class="cmp-row"><td class="day-cell">${block.day}</td>`;
      const morning = block.row.slice(0, 6);
      const afternoon = block.row.slice(6);

      const cellHtml = (c) => {
        if (c.state === "common") {
          return `<td class="cmp-common"><b>${esc(c.course)}</b><small>${esc(c.venue || "")}</small></td>`;
        }
        if (c.state === "both_busy") {
          return `<td class="cmp-busy">●●</td>`;
        }
        if (c.state === "mine") {
          return `<td class="cmp-mine">you</td>`;
        }
        if (c.state === "theirs") {
          return `<td class="cmp-theirs">them</td>`;
        }
        return `<td class="cmp-free">·</td>`;
      };

      html += morning.map(cellHtml).join("");
      html += '<td class="lunch-spacer"></td>';
      html += afternoon.map(cellHtml).join("");
      html += "</tr>";
    }
    if ($("#cmp-table")) $("#cmp-table").innerHTML = html;
  } catch (err) { toast(err.message, true); }
}

/* ---------- market (sell / buy) ---------- */
let MY_CLASSES = [];

document.querySelectorAll("[data-market-tab]").forEach((btn) =>
  btn.addEventListener("click", () => {
    document.querySelectorAll("[data-market-tab]").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    $("#mkt-sell").classList.toggle("hidden", btn.dataset.marketTab !== "sell");
    $("#mkt-buy").classList.toggle("hidden", btn.dataset.marketTab !== "buy");
  }));

async function loadSwap() {
  try {
    const [res, mine] = await Promise.all([
      api("GET", "/api/swap/my-classes"), api("GET", "/api/swap/mine")]);
    MY_CLASSES = res.classes || [];
    const sel = $("#sw-class");
    if (sel) {
      sel.innerHTML = MY_CLASSES.length
        ? MY_CLASSES.map((c, i) =>
            `<option value="${i}">${esc(c.course)} \u00b7 ${esc(c.slot_tokens.join("+"))} @ ${esc(c.venue || "?")}</option>`).join("")
        : '<option value="">\u2014 add courses first \u2014</option>';
    }
    renderMyListings(mine || []);
  } catch (err) { toast(err.message, true); }
}

function renderMyListings(listings) {
  const el = $("#my-listings");
  if (!el) return;
  el.innerHTML = listings.length
    ? listings.map((l) => `
      <div class="my-listing-item" data-lid="${l.listing_id}">
        <button class="course-tab my-listing-btn" data-lid="${l.listing_id}">
          <span>${esc(l.offered_course_code)} \u00b7 ${(l.desired_slot_tokens || []).length ? "wants " + esc(l.desired_slot_tokens.join("+")) : "any slot"}</span>
          <small>${l.interest_count} \u{1F44B}</small>
        </button>
        <button class="del-listing-btn" data-lid="${l.listing_id}" title="Remove this course from the market">✕</button>
      </div>`).join("")
    : '<p class="hint">nothing listed yet.</p>';

  document.querySelectorAll(".my-listing-btn").forEach((b) =>
    b.addEventListener("click", () => showInterests(+b.dataset.lid, b.querySelector("span").textContent)));

  document.querySelectorAll(".del-listing-btn").forEach((b) =>
    b.addEventListener("click", async (e) => {
      e.stopPropagation();
      const lid = +b.dataset.lid;
      try {
        await api("DELETE", `/api/swap/list/${lid}`);
        toast("course removed from market");
        loadSwap();
      } catch (err) { toast(err.message, true); }
    }));
}

async function showInterests(lid, label) {
  if ($("#int-title")) $("#int-title").textContent = `requests \u00b7 ${label}`;
  try {
    const res = await api("GET", `/api/swap/list/${lid}/interests`);
    const pane = $("#interest-pane");
    if (pane) {
      pane.innerHTML = res.requests && res.requests.length
        ? res.requests.map((r) => `
          <div class="people-row"><div class="avatar sm" style="background:${avatarColor(r.name)}">${esc(r.name[0] || "?")}</div>
            <span>${esc(r.name)}</span><small class="tag you-follow">WANTS YOUR SLOT</small></div>`).join("")
        : '<p class="hint">no one has requested this slot yet.</p>';
    }
  } catch (err) { toast(err.message, true); }
}

const swCreateBtn = $("#sw-create");
if (swCreateBtn) {
  swCreateBtn.addEventListener("click", async () => {
    const selVal = $("#sw-class") ? $("#sw-class").value : "";
    const c = MY_CLASSES[selVal];
    if (!c) return toast("add courses to your timetable first", true);
    try {
      await api("POST", "/api/swap/list", {
        offered_class_id: c.class_id,
        offered_course_code: c.course,
        desired_course_code: $("#sw-want-course").value.trim().toUpperCase(),
        desired_slot_tokens: $("#sw-want-slots").value.split("+")
          .map((t) => t.trim().toUpperCase()).filter(Boolean),
      });
      toast(`${c.course} (${c.slot_tokens.join("+")}) is on the market ⇄`);
      loadSwap();
    } catch (err) { toast(err.message, true); }
  });
}

/* ---- buy tab ---- */
let MK_LISTINGS = [];
async function searchMarket() {
  try {
    const p = new URLSearchParams();
    if ($("#mk-q") && $("#mk-q").value.trim()) p.set("q", $("#mk-q").value.trim());
    if ($("#mk-type") && $("#mk-type").value) p.set("slot_type", $("#mk-type").value);
    const res = await api("GET", "/api/swap/market" + (p.toString() ? "?" + p : ""));
    MK_LISTINGS = res.listings || [];
    const el = $("#mk-results");
    if (el) {
      el.innerHTML = res.count
        ? res.listings.map((l) => `
          <button class="course-tab mk-item" data-lid="${l.listing_id}">
            <span>${esc(l.course)} · ${esc(l.faculty || "TBD")}</span>
            <small>${esc(l.slot_tokens.join("+"))}${l.kinds.includes("LAB") ? " LAB" : ""}</small>
          </button>`).join("")
        : '<p class="hint">no listings match your search.</p>';
      document.querySelectorAll(".mk-item").forEach((b) =>
        b.addEventListener("click", () => {
          document.querySelectorAll(".mk-item").forEach((x) => x.classList.remove("active"));
          b.classList.add("active");
          showMkDetail(+b.dataset.lid);
        }));
    }
  } catch (err) { toast(err.message, true); }
}
const mkSearchBtn = $("#mk-search");
if (mkSearchBtn) mkSearchBtn.addEventListener("click", searchMarket);
const mkQInput = $("#mk-q");
if (mkQInput) mkQInput.addEventListener("keydown", (e) => e.key === "Enter" && searchMarket());

function showMkDetail(lid) {
  const l = MK_LISTINGS.find((x) => x.listing_id === lid);
  if (!l) return;
  if ($("#mk-badge")) {
    $("#mk-badge").classList.remove("hidden");
    $("#mk-badge").textContent = l.kinds.includes("LAB") ? "LAB SLOT" : "THEORY SLOT";
  }
  if ($("#mk-detail")) {
    $("#mk-detail").innerHTML = `
      <h2 style="margin-bottom:4px">${esc(l.course)} — ${esc(l.course_title)}</h2>
      <div class="meta-line" style="margin-bottom:10px">
        ${l.slot_tokens.map((t) => `<span class="chip">${esc(t)}</span>`).join("")}</div>
      <div class="stat-row">
        <div class="stat"><div class="n" style="font-size:14px">${esc(l.faculty || "TBD")}</div><div class="l">faculty</div></div>
        <div class="stat"><div class="n" style="font-size:14px">${esc(l.venue || "TBD")}</div><div class="l">venue</div></div>
        <div class="stat"><div class="n" style="font-size:14px">${esc(l.peer_name)}</div><div class="l">listed by</div></div>
      </div>
      <p class="hint" style="margin-bottom:10px">wants in return:
        <b>${esc(l.desired_course_code)}</b>
        ${(l.desired_slot_tokens || []).map((t) => `<span class="chip">${esc(t)}</span>`).join("") || "(any slot)"}</p>
      <button id="mk-request" class="btn btn-primary">I want this slot 🙋</button>`;
    $("#mk-request").addEventListener("click", async () => {
      try {
        const out = await api("POST", `/api/swap/list/${lid}/interest`);
        toast(out.interested ? "request sent to the seller ✦" : "request withdrawn");
      } catch (err) { toast(err.message, true); }
    });
  }
}

/* ---------- profile ---------- */

function updateAge() {
  const v = $("#pf-dob").value;
  const el = $("#pf-age");
  if (!v) { el.textContent = ""; return; }
  const d = new Date(v), now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  el.textContent = age >= 0 && age < 130 ? `${age} yrs` : "";
}
$("#pf-dob")?.addEventListener("change", updateAge);
async function loadProfile() {
  try {
    const me = await api("GET", "/api/auth/me");
    if ($("#pf-name")) $("#pf-name").value = me.name || "";
    if ($("#pf-email")) $("#pf-email").value = me.email || "";
    if ($("#pf-phone")) $("#pf-phone").value = me.phone || "";
    if ($("#pf-insta")) $("#pf-insta").value = me.instagram || "";
    if ($("#pf-fb")) $("#pf-fb").value = me.facebook || "";
    if ($("#pf-linkedin")) $("#pf-linkedin").value = me.linkedin || "";
    if ($("#pf-reddit")) $("#pf-reddit").value = me.reddit || "";
    if ($("#pf-bio")) $("#pf-bio").value = me.bio || "";
  } catch (err) { toast(err.message, true); }
}

const pfSaveBtn = $("#pf-save");
if (pfSaveBtn) {
  pfSaveBtn.addEventListener("click", async () => {
    try {
      await api("POST", "/api/auth/profile", {
        name: $("#pf-name") ? $("#pf-name").value.trim() : "",
        email: $("#pf-email") ? $("#pf-email").value.trim() : "",
        phone: $("#pf-phone") ? $("#pf-phone").value.trim() : "",
        instagram: $("#pf-insta") ? $("#pf-insta").value.trim() : "",
        facebook: $("#pf-fb") ? $("#pf-fb").value.trim() : "",
        linkedin: $("#pf-linkedin") ? $("#pf-linkedin").value.trim() : "",
        reddit: $("#pf-reddit") ? $("#pf-reddit").value.trim() : "",
        bio: $("#pf-bio") ? $("#pf-bio").value : "",
      });
      ME = await api("GET", "/api/auth/me");
      if ($("#menu-name")) $("#menu-name").textContent = ME.name;
      toast("profile saved ✦");
    } catch (err) { toast(err.message, true); }
  });
}

/* ---------- boot ---------- */
(async function init() {
  if (TOKEN) {
    try {
      await enterApp(TOKEN);
    } catch (err) {
      console.error("Init auth error:", err);
      // Only clear token if server explicitly rejected credentials with 401 / 403 / Invalid token
      if (err.message && (err.message.includes("401") || err.message.includes("403") || err.message.includes("Invalid") || err.message.includes("Unauthorized"))) {
        TOKEN = null;
        localStorage.removeItem("cp_token");
        sessionStorage.removeItem("cp_token");
        $("#app-view").classList.add("hidden");
        $("#auth-view").classList.remove("hidden");
      }
    }
  }
})();
