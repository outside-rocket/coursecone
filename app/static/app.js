/* ==========================================================================
   CourseConE — Formal Monochromatic Liquid Glass Client Engine
   Rotating Blue-Green Planet Background · Optical Blur · 2% Cyan Accent
   ========================================================================== */

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const API = "";
let TOKEN = localStorage.getItem("cp_token") || sessionStorage.getItem("cp_token") || null;
let ME = null;
let CURRENT_VIEW = "timetable";

const PALETTE = [
  "#a1a1aa", "#71717a", "#e4e4e7", "#d4d4d8",
  "#00f0ff", "#38bdf8", "#52525b", "#94a3b8"
];

/* --------------------------------------------------------------------------
   1. CORE API & UTILITIES
   -------------------------------------------------------------------------- */
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
  t.classList.remove("toast-hidden");
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.add("toast-hidden"), 3400);
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function avatarColor(name) {
  let h = 0;
  for (const ch of name || "?") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/* --------------------------------------------------------------------------
   2. LIQUID INTRO LOADER
   -------------------------------------------------------------------------- */
function dismissLoader() {
  const loader = $("#liquid-loader-screen");
  if (loader) {
    setTimeout(() => {
      loader.classList.add("fade-out");
      setTimeout(() => loader.remove(), 600);
    }, 380);
  }
}

/* --------------------------------------------------------------------------
   3. REALISTIC ROTATING BLUE-GREEN PLANET CANVAS (OFFSET TO RIGHT)
   -------------------------------------------------------------------------- */
(function initPlanetAndStarsCanvas() {
  const canvas = $("#liquid-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let width, height;

  // Offscreen Texture for Planet Surface & Rotating Atmosphere
  const textureCanvas = document.createElement("canvas");
  const tCtx = textureCanvas.getContext("2d");
  const texW = 1200;
  const texH = 600;
  textureCanvas.width = texW;
  textureCanvas.height = texH;

  // Generate Procedural Blue-Green Earth-like Texture
  function generatePlanetTexture() {
    // 1. Deep Oceanic Gradient
    const oceanGrad = tCtx.createLinearGradient(0, 0, 0, texH);
    oceanGrad.addColorStop(0, "#081d36");
    oceanGrad.addColorStop(0.35, "#0b2b48");
    oceanGrad.addColorStop(0.65, "#093d58");
    oceanGrad.addColorStop(1, "#051829");
    tCtx.fillStyle = oceanGrad;
    tCtx.fillRect(0, 0, texW, texH);

    // 2. Continental Landmasses (Emerald, Sage, & Coastal Cyan)
    const continents = [
      { x: 160, y: 180, rx: 140, ry: 90, col: "#0d5a45" },
      { x: 210, y: 220, rx: 90, ry: 70, col: "#107c5c" },
      { x: 420, y: 320, rx: 180, ry: 110, col: "#0b4d3b" },
      { x: 500, y: 280, rx: 120, ry: 80, col: "#138865" },
      { x: 740, y: 160, rx: 160, ry: 95, col: "#0e634c" },
      { x: 820, y: 240, rx: 110, ry: 80, col: "#127558" },
      { x: 1040, y: 340, rx: 150, ry: 100, col: "#0a4434" },
      { x: 1120, y: 290, rx: 100, ry: 75, col: "#108563" },
    ];

    continents.forEach(c => {
      // Coastal shallow waters (cyan shimmer)
      tCtx.beginPath();
      tCtx.ellipse(c.x, c.y, c.rx * 1.25, c.ry * 1.25, 0.2, 0, Math.PI * 2);
      tCtx.fillStyle = "rgba(0, 240, 255, 0.18)";
      tCtx.filter = "blur(12px)";
      tCtx.fill();

      // Landmass core
      tCtx.beginPath();
      tCtx.ellipse(c.x, c.y, c.rx, c.ry, 0.1, 0, Math.PI * 2);
      tCtx.fillStyle = c.col;
      tCtx.filter = "blur(6px)";
      tCtx.fill();

      // Lush vegetation inner
      tCtx.beginPath();
      tCtx.ellipse(c.x + 10, c.y - 5, c.rx * 0.65, c.ry * 0.65, 0, 0, Math.PI * 2);
      tCtx.fillStyle = "rgba(34, 197, 94, 0.35)";
      tCtx.filter = "blur(4px)";
      tCtx.fill();
    });

    // 3. Wispy Swirling Clouds
    tCtx.filter = "blur(8px)";
    for (let i = 0; i < 28; i++) {
      const cx = (i * 45) % texW;
      const cy = 60 + Math.sin(i * 0.8) * 180 + (i % 3) * 60;
      tCtx.beginPath();
      tCtx.ellipse(cx, cy, 75 + (i % 4) * 25, 20 + (i % 3) * 8, (i % 2 === 0 ? 0.35 : -0.25), 0, Math.PI * 2);
      tCtx.fillStyle = "rgba(255, 255, 255, 0.42)";
      tCtx.fill();
    }
    tCtx.filter = "none";
  }
  generatePlanetTexture();

  let stars = [];
  let shootingStars = [];
  let mouse = { x: -1000, y: -1000, active: false, radius: 140 };
  const starCount = window.innerWidth < 768 ? 60 : 120;
  const connectionDist = window.innerWidth < 768 ? 95 : 120;
  let planetRotation = 0;

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resize);
  resize();

  window.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.active = true;
  });

  window.addEventListener("mouseleave", () => {
    mouse.active = false;
    mouse.x = -1000;
    mouse.y = -1000;
  });

  class StarNode {
    constructor() {
      this.reset(true);
    }
    reset(initial = false) {
      this.x = Math.random() * width;
      this.y = initial ? Math.random() * height : (Math.random() > 0.5 ? -10 : height + 10);
      this.vx = (Math.random() - 0.5) * 0.18;
      this.vy = (Math.random() - 0.5) * 0.18;
      this.radius = Math.random() < 0.15 ? (Math.random() * 1.1 + 1.4) : (Math.random() * 0.8 + 0.5);
      this.baseAlpha = Math.random() * 0.4 + 0.2;
      this.phase = Math.random() * Math.PI * 2;
      this.twinkleSpeed = Math.random() * 0.018 + 0.006;
      this.isCyan = Math.random() < 0.04;
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.phase += this.twinkleSpeed;

      if (this.x < -20) this.x = width + 20;
      if (this.x > width + 20) this.x = -20;
      if (this.y < -20) this.y = height + 20;
      if (this.y > height + 20) this.y = -20;

      if (mouse.active) {
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < mouse.radius && dist > 10) {
          const force = (mouse.radius - dist) / mouse.radius;
          this.x += (dx / dist) * force * 0.4;
          this.y += (dy / dist) * force * 0.4;
        }
      }
    }
    draw() {
      const alpha = this.baseAlpha + Math.sin(this.phase) * (this.baseAlpha * 0.55);
      const effAlpha = Math.max(0.05, Math.min(0.9, alpha));

      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = this.isCyan
        ? `rgba(0, 240, 255, ${effAlpha})`
        : `rgba(255, 255, 255, ${effAlpha})`;
      ctx.fill();
    }
  }

  class ShootingStar {
    constructor() {
      this.reset();
    }
    reset() {
      this.x = Math.random() * (width * 0.5);
      this.y = Math.random() * (height * 0.35);
      this.len = Math.random() * 85 + 55;
      this.speed = Math.random() * 6 + 7;
      this.angle = (Math.PI / 4) + (Math.random() - 0.5) * 0.2;
      this.alpha = 1;
      this.active = false;
    }
    trigger() {
      this.reset();
      this.active = true;
    }
    update() {
      if (!this.active) return;
      this.x += Math.cos(this.angle) * this.speed;
      this.y += Math.sin(this.angle) * this.speed;
      this.alpha -= 0.022;
      if (this.alpha <= 0 || this.x > width || this.y > height) {
        this.active = false;
      }
    }
    draw() {
      if (!this.active) return;
      const tailX = this.x - Math.cos(this.angle) * this.len;
      const tailY = this.y - Math.sin(this.angle) * this.len;
      const grad = ctx.createLinearGradient(tailX, tailY, this.x, this.y);
      grad.addColorStop(0, "rgba(255, 255, 255, 0)");
      grad.addColorStop(1, `rgba(255, 255, 255, ${this.alpha * 0.7})`);
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(this.x, this.y);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  for (let i = 0; i < starCount; i++) {
    stars.push(new StarNode());
  }

  const meteor = new ShootingStar();
  setInterval(() => {
    if (Math.random() > 0.35 && !meteor.active) meteor.trigger();
  }, 14000);

  function drawConstellationLines() {
    ctx.lineWidth = 0.65;
    for (let i = 0; i < stars.length; i++) {
      for (let j = i + 1; j < stars.length; j++) {
        const dx = stars[i].x - stars[j].x;
        const dy = stars[i].y - stars[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < connectionDist) {
          const lineAlpha = (1 - dist / connectionDist) * 0.2;
          const isCyanLine = stars[i].isCyan || stars[j].isCyan;

          ctx.beginPath();
          ctx.moveTo(stars[i].x, stars[i].y);
          ctx.lineTo(stars[j].x, stars[j].y);
          ctx.strokeStyle = isCyanLine
            ? `rgba(0, 240, 255, ${lineAlpha * 1.2})`
            : `rgba(255, 255, 255, ${lineAlpha})`;
          ctx.stroke();
        }
      }

      if (mouse.active) {
        const dx = stars[i].x - mouse.x;
        const dy = stars[i].y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < mouse.radius) {
          const mouseLineAlpha = (1 - dist / mouse.radius) * 0.25;
          ctx.beginPath();
          ctx.moveTo(stars[i].x, stars[i].y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = `rgba(0, 240, 255, ${mouseLineAlpha})`;
          ctx.stroke();
        }
      }
    }
  }

  // Draw the Realistic Rotating Blue-Green Planet Offset to the Right
  function drawPlanet() {
    const isMobile = width < 768;
    const planetRadius = Math.min(width, height) * (isMobile ? 0.65 : 0.58);
    const planetX = width * (isMobile ? 0.92 : 0.86);
    const planetY = height * 0.52;

    // Slow rotation speed
    planetRotation = (planetRotation + 0.16) % texW;

    // 1. Outer Atmospheric Corona Glow (Cyan & Emerald limb radiance)
    const coronaGrad = ctx.createRadialGradient(
      planetX - planetRadius * 0.35, planetY - planetRadius * 0.35, planetRadius * 0.75,
      planetX, planetY, planetRadius * 1.22
    );
    coronaGrad.addColorStop(0, "rgba(0, 240, 255, 0.0)");
    coronaGrad.addColorStop(0.78, "rgba(0, 240, 255, 0.08)");
    coronaGrad.addColorStop(0.92, "rgba(16, 185, 129, 0.14)");
    coronaGrad.addColorStop(1, "rgba(0, 240, 255, 0)");

    ctx.save();
    ctx.beginPath();
    ctx.arc(planetX, planetY, planetRadius * 1.22, 0, Math.PI * 2);
    ctx.fillStyle = coronaGrad;
    ctx.fill();
    ctx.restore();

    // 2. Planet Sphere Clip
    ctx.save();
    ctx.beginPath();
    ctx.arc(planetX, planetY, planetRadius, 0, Math.PI * 2);
    ctx.clip();

    // 3. Draw Rotating Surface Texture Map
    const sx = Math.floor(planetRotation);
    const drawW = planetRadius * 2.2;
    const drawH = planetRadius * 2.2;
    const drawX = planetX - planetRadius * 1.1;
    const drawY = planetY - planetRadius * 1.1;

    // Two-pass draw for seamless infinite wrap
    ctx.drawImage(textureCanvas, sx, 0, texW - sx, texH, drawX, drawY, (texW - sx) / texW * drawW * 1.8, drawH);
    ctx.drawImage(textureCanvas, 0, 0, sx, texH, drawX + (texW - sx) / texW * drawW * 1.8, drawY, sx / texW * drawW * 1.8, drawH);

    // 4. Photorealistic 3D Sunlight & Shadow Terminator
    // Light source coming from top-right
    const shadowGrad = ctx.createRadialGradient(
      planetX + planetRadius * 0.35, planetY - planetRadius * 0.35, planetRadius * 0.15,
      planetX - planetRadius * 0.25, planetY + planetRadius * 0.25, planetRadius * 1.05
    );
    shadowGrad.addColorStop(0, "rgba(255, 255, 255, 0.0)");
    shadowGrad.addColorStop(0.45, "rgba(0, 10, 20, 0.25)");
    shadowGrad.addColorStop(0.72, "rgba(0, 4, 10, 0.72)");
    shadowGrad.addColorStop(0.95, "rgba(0, 0, 0, 0.94)");
    shadowGrad.addColorStop(1, "#000000");

    ctx.fillStyle = shadowGrad;
    ctx.fillRect(planetX - planetRadius, planetY - planetRadius, planetRadius * 2, planetRadius * 2);

    // 5. Atmospheric Rim Scatter (Fresnel limb illumination)
    const rimGrad = ctx.createRadialGradient(
      planetX, planetY, planetRadius * 0.88,
      planetX, planetY, planetRadius
    );
    rimGrad.addColorStop(0, "rgba(0, 240, 255, 0)");
    rimGrad.addColorStop(0.7, "rgba(16, 185, 129, 0.18)");
    rimGrad.addColorStop(0.95, "rgba(0, 240, 255, 0.55)");
    rimGrad.addColorStop(1, "rgba(255, 255, 255, 0.85)");

    ctx.fillStyle = rimGrad;
    ctx.fillRect(planetX - planetRadius, planetY - planetRadius, planetRadius * 2, planetRadius * 2);

    ctx.restore();
  }

  function loop() {
    // Pure Pitch Black Base
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, height);

    // Stars in Deep Space
    for (let s of stars) {
      s.update();
    }
    drawConstellationLines();
    for (let s of stars) {
      s.draw();
    }

    // Realistic Rotating Blue-Green Planet on the Right
    drawPlanet();

    meteor.update();
    meteor.draw();
    requestAnimationFrame(loop);
  }
  loop();
})();

/* --------------------------------------------------------------------------
   4. CURSOR REFRACTION & 2D SPECULAR TRACKING
   -------------------------------------------------------------------------- */
(function initCursorAndRefraction() {
  const orb = $("#liquid-cursor-follower");
  let orbX = -1000, orbY = -1000;
  let targetX = -1000, targetY = -1000;

  window.addEventListener("mousemove", (e) => {
    targetX = e.clientX;
    targetY = e.clientY;

    const hoveredElement = e.target.closest(".glass, .liquid-glass, .card, .panel, .btn");
    if (hoveredElement) {
      const rect = hoveredElement.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      hoveredElement.style.setProperty("--mouse-x", `${x}%`);
      hoveredElement.style.setProperty("--mouse-y", `${y}%`);
    }
  });

  function renderOrb() {
    if (orb) {
      orbX += (targetX - orbX) * 0.16;
      orbY += (targetY - orbY) * 0.16;
      orb.style.transform = `translate3d(${orbX}px, ${orbY}px, 0)`;
    }
    requestAnimationFrame(renderOrb);
  }
  renderOrb();
})();

/* --------------------------------------------------------------------------
   5. FLOATING LIQUID GLASS TOOLTIP LENS (HOVERS ABOVE TIMETABLE CELLS)
   -------------------------------------------------------------------------- */
let lensTimer = null;

function positionFloatingLens(targetEl, data) {
  const lens = $("#liquid-glass-lens");
  if (!lens || !targetEl) return;

  const rect = targetEl.getBoundingClientRect();
  const lensWidth = lens.offsetWidth || 330;
  const lensHeight = lens.offsetHeight || 110;

  let x = rect.left + (rect.width / 2) - (lensWidth / 2);
  let y = rect.top - lensHeight - 12;

  if (x < 14) x = 14;
  if (x + lensWidth > window.innerWidth - 14) x = window.innerWidth - lensWidth - 14;
  if (y < 14) {
    y = rect.bottom + 12;
  }

  lens.style.setProperty("--lens-x", `${Math.round(x)}px`);
  lens.style.setProperty("--lens-y", `${Math.round(y)}px`);

  $("#lens-token").textContent = data.slot_token || data.token || "SLOT";
  $("#lens-title").textContent = `${data.course_code ? data.course_code + " — " : ""}${data.course_title || "Course Slot"}`;
  $("#lens-venue").textContent = data.venue || "TBD";
  $("#lens-faculty").textContent = data.faculty || "TBD";

  lens.classList.add("active");
}

function hideFloatingLens() {
  const lens = $("#liquid-glass-lens");
  if (lens) lens.classList.remove("active");
}

/* --------------------------------------------------------------------------
   6. COMMAND PALETTE HUD (Cmd+K) (SMOOTH OPTICAL BLUR IN)
   -------------------------------------------------------------------------- */
(function initCommandPalette() {
  const palette = $("#command-palette-backdrop");
  const input = $("#cp-search-input");
  const list = $("#cp-results-list");
  const quickPaletteBtn = $("#btn-quick-palette");

  function openPalette() {
    if (!palette) return;
    palette.classList.add("active");
    if (input) {
      input.value = "";
      setTimeout(() => input.focus(), 60);
    }
  }

  function closePalette() {
    if (palette) palette.classList.remove("active");
  }

  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      palette && palette.classList.contains("active") ? closePalette() : openPalette();
    } else if (e.key === "Escape") {
      closePalette();
      hideFloatingLens();
      $("#menu-dropdown")?.classList.remove("active");
    }
  });

  if (quickPaletteBtn) quickPaletteBtn.addEventListener("click", openPalette);
  if (palette) {
    palette.addEventListener("click", (e) => {
      if (e.target === palette) closePalette();
    });
  }

  if (list) {
    list.addEventListener("click", (e) => {
      const item = e.target.closest(".cp-item");
      if (!item) return;
      const action = item.dataset.action;
      if (action && action.startsWith("view:")) {
        showView(action.split(":")[1]);
        closePalette();
      }
    });
  }

  if (input) {
    input.addEventListener("input", () => {
      const q = input.value.toLowerCase().trim();
      $$(".cp-item").forEach((item) => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(q) ? "flex" : "none";
      });
    });
  }
})();

/* --------------------------------------------------------------------------
   7. AUTH & DEMO QUICK-LOGIN
   -------------------------------------------------------------------------- */
$$("[data-auth-tab]").forEach((btn) =>
  btn.addEventListener("click", () => {
    $$("[data-auth-tab]").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    $("#login-form").classList.toggle("hidden", btn.dataset.authTab !== "login");
    $("#register-form").classList.toggle("hidden", btn.dataset.authTab !== "register");
    $("#auth-error").textContent = "";
  }));

$("#login-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const res = await api("POST", "/api/auth/login", {
      email: $("#li-email").value.trim(),
      password: $("#li-pass").value,
    }, false);
    enterApp(res.token);
  } catch (err) {
    $("#auth-error").textContent = err.message;
  }
});

$("#register-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const res = await api("POST", "/api/auth/register", {
      roll_no: $("#rg-roll").value.trim(),
      name: $("#rg-name").value.trim(),
      email: $("#rg-email").value.trim(),
      password: $("#rg-pass").value,
    }, false);
    enterApp(res.token);
  } catch (err) {
    $("#auth-error").textContent = err.message;
  }
});

$("#btn-demo-1")?.addEventListener("click", () => {
  $("#li-email").value = "22bce0001@vitstudent.ac.in";
  $("#li-pass").value = "password123";
  $("#login-form").dispatchEvent(new Event("submit"));
});

$("#btn-demo-2")?.addEventListener("click", () => {
  $("#li-email").value = "22bce0002@vitstudent.ac.in";
  $("#li-pass").value = "password123";
  $("#login-form").dispatchEvent(new Event("submit"));
});

/* --------------------------------------------------------------------------
   8. NAVIGATION & DOCK MANAGEMENT
   -------------------------------------------------------------------------- */
const menuBtn = $("#menu-btn");
if (menuBtn) {
  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const dd = $("#menu-dropdown");
    if (dd && dd.parentNode !== document.body) document.body.appendChild(dd);
    dd.classList.toggle("active");
  });
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".menu-wrap") && $("#menu-dropdown")) {
    $("#menu-dropdown").classList.remove("active");
  }
  if (!e.target.closest("#app-sidebar") && !e.target.closest("#mobile-nav-toggle")) {
    $("#app-sidebar")?.classList.remove("mobile-open");
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
    $("#app-sidebar")?.classList.add("collapsed");
    $("#app-view")?.classList.add("sidebar-collapsed");
  }
}

const mobileNavToggle = $("#mobile-nav-toggle");
if (mobileNavToggle) {
  mobileNavToggle.addEventListener("click", () => {
    $("#app-sidebar")?.classList.toggle("mobile-open");
  });
}

const logoutBtn = $("#logout-btn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    TOKEN = null; ME = null;
    localStorage.removeItem("cp_token");
    sessionStorage.removeItem("cp_token");
    $("#menu-dropdown")?.classList.remove("active");
    $("#app-view").classList.add("hidden");
    $("#auth-view").classList.remove("hidden");
    toast("Signed out");
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
  toast(`Signed in as ${ME.name} ✦`);
}

$$(".nav-btn[data-view]").forEach((btn) =>
  btn.addEventListener("click", () => showView(btn.dataset.view)));

function showView(name) {
  CURRENT_VIEW = name;
  hideFloatingLens();
  $$(".nav-btn[data-view]").forEach((b) =>
    b.classList.toggle("active", b.dataset.view === name));
  $$(".view").forEach((v) => v.classList.add("hidden"));
  const viewEl = $("#view-" + name);
  if (viewEl) viewEl.classList.remove("hidden");
  $("#app-sidebar")?.classList.remove("mobile-open");

  if (name === "timetable") loadGrid();
  if (name === "classmates") { findClassmates(); loadRequests(); }
  if (name === "social") { loadSocial(); loadRequests(); }
  if (name === "compare") loadCompare();
  if (name === "profile") loadProfile();
  if (name === "swap") { loadSwap(); searchMarket(); }
}

/* --------------------------------------------------------------------------
   9. TIMETABLE MATRIX & FLOATING LIQUID GLASS HOVER LENS
   -------------------------------------------------------------------------- */
const SAMPLE_REGISTRATION_DATA = `1
General (Semester)
BCSE302L - Database Systems
( Theory Only )
3 0 0 0 3.0
Discipline Core
Regular
CH2026270100945
A1+TA1 -
AB3-505
HELEN VIJITHA P -
SCOPE
27-Jun-2026 10:47
28-Jun-2026 - Manual
Registered and Approved

2
General (Semester)
BCSE302P - Database Systems Lab
( Lab Only )
0 0 2 0 1.0
Discipline Core
Regular
CH2026270100947
L11+L12 -
AB3-311
HELEN VIJITHA P -
SCOPE
27-Jun-2026 10:47
Registered and Approved

3
General (Semester)
BMAT205L - Discrete Mathematics and Graph Theory
( Theory Only )
3 1 0 0 4.0
Discipline-linked Engineering Sciences
Regular
CH2026270100261
C1+TC1+TCC1 -
AB3-405
THANGARAJ M -
SAS
27-Jun-2026 10:22
Registered and Approved

4
General (Semester)
BCSE301L - Computer Networks
( Theory Only )
3 0 0 0 3.0
Discipline Core
Regular
CH2026270100812
B1+TB1 -
AB3-204
RAJESH KUMAR K -
SCOPE
27-Jun-2026 10:30
Registered and Approved`;

$("#btn-fill-sample-timetable")?.addEventListener("click", () => {
  const uploadArea = $("#raw-upload");
  if (uploadArea) {
    uploadArea.value = SAMPLE_REGISTRATION_DATA;
    toast("Sample registration data loaded ✦ Click 'Parse & Synchronize'");
  }
});

const uploadBtn = $("#upload-btn");
if (uploadBtn) {
  uploadBtn.addEventListener("click", async () => {
    try {
      const res = await api("POST", "/api/timetable/upload", { raw_text: $("#raw-upload").value });
      if (res.warnings && res.warnings.length) {
        toast(`Synchronized ${res.saved_courses.length} courses (${res.warnings.length} slot clash)`, true);
      } else {
        toast(`Synchronized ${res.saved_courses.length} courses successfully ✦`);
      }
      showView("timetable");
    } catch (err) {
      toast(err.message, true);
    }
  });
}

async function loadGrid() {
  let g;
  try {
    g = await api("GET", "/api/timetable/grid");
  } catch (e) {
    if ($("#grid-table")) {
      $("#grid-table").innerHTML =
        `<tr><td><div class="cell free" style="padding:20px; text-align:center;">Could not load timetable: ${esc(e.message)} — try pasting your registration in 'Add Courses'.</div></td></tr>`;
    }
    return;
  }
  if (!g.grid_view || !g.theory_slots) {
    if ($("#grid-table")) {
      $("#grid-table").innerHTML =
        '<tr><td><div class="cell free" style="padding:20px; text-align:center;">No courses synchronized yet — click "Add Courses" or load sample data.</div></td></tr>';
    }
    return;
  }

  const T = g.theory_slots;
  let html = "<tr><th>DAY</th><th>TIER</th>"
    + T.slice(0, 6).map((t) => `<th>${t}</th>`).join("")
    + '<th class="lunch-col">LUNCH</th>'
    + T.slice(6).map((t) => `<th>${t}</th>`).join("") + "</tr>";

  const cellHtml = (c) => {
    if (!c.occupied) return c.token ? esc(c.token) : "·";
    const d = c.data;
    const jsonStr = JSON.stringify(d).replace(/"/g, "&quot;");
    return `<span class="tt-tip" data-slot-json="${jsonStr}" tabindex="0">${esc(d.course_title)}</span><small>${esc(d.venue || "")}</small>`;
  };

  const mkTd = (c) => `<td class="${c.occupied ? "occ" : "free"}">${cellHtml(c)}</td>`;

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

  $$("#grid-table td.occ").forEach((td) => {
    const tipEl = td.querySelector(".tt-tip");
    if (!tipEl) return;

    td.addEventListener("mouseenter", () => {
      clearTimeout(lensTimer);
      lensTimer = setTimeout(() => {
        try {
          const data = JSON.parse(tipEl.getAttribute("data-slot-json"));
          positionFloatingLens(td, data);
        } catch (e) {}
      }, 90);
    });

    td.addEventListener("mouseleave", () => {
      clearTimeout(lensTimer);
      lensTimer = setTimeout(hideFloatingLens, 120);
    });
  });

  $(".table-wrap")?.addEventListener("scroll", hideFloatingLens);
}

/* --------------------------------------------------------------------------
   10. CLASSMATES & SOCIAL RADAR
   -------------------------------------------------------------------------- */
async function loadRequests() {
  try {
    const res = await api("GET", "/api/social/requests");
    const count = res.requests ? res.requests.length : 0;

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
            <div class="card-main"><b>${esc(r.name)}</b><div class="meta-line">Wants to synchronize timetable</div></div>
            <button class="btn btn-primary req-accept">Accept</button>
            <button class="btn btn-secondary req-reject">Decline</button>
          </div>`).join("")
        : '<p class="hint">No pending requests.</p>';
    };
    renderInto($("#req-list"), $("#req-count"));
    renderInto($("#req-list-social"), $("#req-count-social"));
    $$(".req-accept").forEach((b) => b.addEventListener("click", () => answerRequest(b, true)));
    $$(".req-reject").forEach((b) => b.addEventListener("click", () => answerRequest(b, false)));
  } catch (err) {
    console.error("loadRequests error:", err);
  }
}

async function answerRequest(btn, accept) {
  const card = btn.closest(".req-card");
  if (!card) return;
  try {
    await api("POST", `/api/social/requests/${accept ? "accept" : "reject"}`,
              { student_id: card.dataset.sid });
    $$(`.req-card[data-sid="${card.dataset.sid}"]`).forEach((c) => c.remove());
    toast(accept ? "Request accepted — timetable comparison unlocked" : "Request declined");
    loadRequests();
    loadSocial();
  } catch (err) {
    toast(err.message, true);
  }
}

let CM_DATA = { courses: [], classmates: [] };
let selectedCourse = "ALL";

async function findClassmates() {
  try {
    const res = await api("GET", "/api/classmates/all");
    CM_DATA = { courses: res.my_courses || [], classmates: res.classmates || [] };
    renderCourseTabs();
    renderPeers();
  } catch (err) {
    toast(err.message, true);
  }
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
    tab("ALL", "All Classmates", CM_DATA.classmates.length)
    + CM_DATA.courses.map((c) => tab(c.course, `${c.course} · ${c.slot}`, counts[c.course] || 0)).join("");
  $$(".course-tab").forEach((b) =>
    b.addEventListener("click", () => { selectedCourse = b.dataset.course; renderCourseTabs(); renderPeers(); }));
}

function renderPeers() {
  const peers = selectedCourse === "ALL"
    ? CM_DATA.classmates
    : CM_DATA.classmates.filter((m) => m.classes.some((c) => c.course === selectedCourse));
  if ($("#peers-title")) {
    $("#peers-title").textContent = selectedCourse === "ALL"
      ? "Classmate Radar" : `Classmates · ${selectedCourse}`;
  }
  const resultsEl = $("#cm-results");
  if (resultsEl) {
    resultsEl.innerHTML = peers.length
      ? peers.map(classmateCard).join("")
      : '<div class="glass card"><div class="meta-line">No classmates detected in this course yet.</div></div>';
  }
  bindFollowButtons();
}

function relButton(rel) {
  switch (rel) {
    case "MUTUAL":
      return '<button class="btn btn-secondary follow-btn is-following is-mutual" data-rel="MUTUAL" title="Mutual follow · Click to unfollow"><span class="btn-text">Mutual ✓</span><span class="btn-hover-text">Unfollow</span></button>';
    case "FOLLOWING":
      return '<button class="btn btn-secondary follow-btn is-following" data-rel="FOLLOWING" title="Following · Click to unfollow"><span class="btn-text">Following ✓</span><span class="btn-hover-text">Unfollow</span></button>';
    case "REQUESTED":
      return '<button class="btn btn-secondary follow-btn is-requested" data-rel="REQUESTED" title="Request pending · Click to cancel"><span class="btn-text">Requested…</span><span class="btn-hover-text">Cancel ✕</span></button>';
    case "FOLLOWS_YOU":
      return '<button class="btn btn-primary follow-btn is-follow-back" data-rel="FOLLOWS_YOU" title="Follows you · Click to follow back"><span class="btn-text">Follow Back ↩</span></button>';
    default:
      return '<button class="btn btn-primary follow-btn is-none" data-rel="NONE"><span class="btn-text">+ Follow</span></button>';
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
  $$(".follow-btn").forEach((btn) =>
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
            btn.innerHTML = '<span class="btn-text">Follow Back ↩</span>';
          } else {
            btn.className = "btn btn-primary follow-btn is-none";
            btn.dataset.rel = "NONE";
            btn.title = "";
            btn.innerHTML = '<span class="btn-text">+ Follow</span>';
          }
          if (CM_DATA && CM_DATA.classmates) {
            CM_DATA.classmates.forEach((m) => { if (m.student_id === sid) m.rel = res.status; });
          }
          toast("Unfollowed");
        } else {
          const res = await api("POST", "/api/social/follow", { student_id: sid });
          if (res.status === "MUTUAL") {
            btn.className = "btn btn-secondary follow-btn is-following is-mutual";
            btn.dataset.rel = "MUTUAL";
            btn.title = "Mutual follow · Click to unfollow";
            btn.innerHTML = '<span class="btn-text">Mutual ✓</span><span class="btn-hover-text">Unfollow</span>';
            toast("Mutual follow unlocked ✓");
          } else {
            btn.className = "btn btn-secondary follow-btn is-requested";
            btn.dataset.rel = "REQUESTED";
            btn.title = "Request pending · Click to cancel";
            btn.innerHTML = '<span class="btn-text">Requested…</span><span class="btn-hover-text">Cancel ✕</span>';
            toast("Follow request sent");
          }
          if (CM_DATA && CM_DATA.classmates) {
            CM_DATA.classmates.forEach((m) => { if (m.student_id === sid) m.rel = res.status; });
          }
        }
        loadSocial();
      } catch (err) {
        toast(err.message, true);
      }
    }));
}

/* --------------------------------------------------------------------------
   11. SOCIAL NETWORK & COMPARE MATRIX
   -------------------------------------------------------------------------- */
async function loadSocial() {
  try {
    const [net, reqs] = await Promise.all([
      api("GET", "/api/social/followers"), api("GET", "/api/social/requests")]);
    const mutualIds = new Set(net.mutual || []);

    const statCol = $("#network-stats");
    if (statCol) statCol.innerHTML = [
      [(net.followers || []).length, "followers"], [(net.following || []).length, "following"],
      [mutualIds.size, "mutuals"], [(reqs.requests || []).length, "requests"],
    ].map(([n, l]) => `<div class="stat"><div class="n">${n}</div><div class="l">${l}</div></div>`).join("");

    const tipFor = (u) => [
      u.email ? `Email: ${u.email}` : "",
      u.phone ? `Phone: ${u.phone}` : "",
      u.instagram ? `Instagram: @${u.instagram}` : "",
      u.bio ? `\n${u.bio}` : "",
    ].filter(Boolean).join("\n") || "No details shared yet";

    const followerRow = (u) => {
      const isMutual = mutualIds.has(u.student_id);
      const tag = isMutual ? "MUTUAL" : "FOLLOWS YOU";
      const t = tipFor(u).replace(/"/g, "&quot;");
      const actionBtn = isMutual
        ? `<button class="social-action-btn social-unfollow-btn" data-sid="${u.student_id}" data-name="${esc(u.name)}" title="Unfollow">Unfollow</button>`
        : `<button class="social-action-btn social-follow-back-btn" data-sid="${u.student_id}" data-name="${esc(u.name)}" title="Follow back">Follow Back ↩</button>`;

      return `<div class="people-row"><div class="avatar sm" style="background:${avatarColor(u.name)}">${esc(u.name[0] || "?")}</div>
        <span class="tt-tip" data-tip="${t}" tabindex="0">${esc(u.name)}</span>
        <small class="tag ${tag.toLowerCase().replace(/\s+/g, '-')}">${tag}</small>
        ${actionBtn}
      </div>`;
    };

    const followingRow = (u) => {
      const isMutual = mutualIds.has(u.student_id);
      const tag = isMutual ? "MUTUAL" : "YOU FOLLOW";
      const t = tipFor(u).replace(/"/g, "&quot;");
      const actionBtn = `<button class="social-action-btn social-unfollow-btn" data-sid="${u.student_id}" data-name="${esc(u.name)}" title="Unfollow">Unfollow</button>`;

      return `<div class="people-row"><div class="avatar sm" style="background:${avatarColor(u.name)}">${esc(u.name[0] || "?")}</div>
        <span class="tt-tip" data-tip="${t}" tabindex="0">${esc(u.name)}</span>
        <small class="tag ${tag.toLowerCase().replace(/\s+/g, '-')}">${tag}</small>
        ${actionBtn}
      </div>`;
    };

    const box = (el, list, isFollowersList) => {
      if (el) el.innerHTML = list && list.length
        ? list.map(isFollowersList ? followerRow : followingRow).join("")
        : '<p class="hint">None yet.</p>';
    };

    box($("#followers-box"), net.followers, true);
    box($("#following-box"), net.following, false);

    $$(".social-unfollow-btn").forEach((b) => {
      b.addEventListener("click", async (e) => {
        e.stopPropagation();
        const sid = b.dataset.sid;
        const name = b.dataset.name || "user";
        try {
          await api("POST", "/api/social/unfollow", { student_id: sid });
          toast(`Unfollowed ${name}`);
          loadSocial();
          findClassmates();
        } catch (err) { toast(err.message, true); }
      });
    });

    $$(".social-follow-back-btn").forEach((b) => {
      b.addEventListener("click", async (e) => {
        e.stopPropagation();
        const sid = b.dataset.sid;
        const name = b.dataset.name || "user";
        try {
          await api("POST", "/api/social/follow", { student_id: sid });
          toast(`Follow request sent to ${name}`);
          loadSocial();
          findClassmates();
        } catch (err) { toast(err.message, true); }
      });
    });

  } catch (err) {
    toast(err.message, true);
  }
}

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
      if (el) el.innerHTML = '<p class="hint">Follow classmates or accept follow requests to compare timetables.</p>';
      $("#cmp-result-wrap")?.classList.add("hidden");
      return;
    }
    $("#cmp-result-wrap")?.classList.remove("hidden");
    if (el) {
      el.innerHTML = uniqPeers.map((p, i) => `
        <button class="course-tab cmp-peer-btn ${i === 0 ? "active" : ""}" data-sid="${p.student_id}">
          <span>${esc(p.name)}</span>
        </button>`).join("");

      $$(".cmp-peer-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          $$(".cmp-peer-btn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          compareWith(btn.dataset.sid);
        });
      });
    }

    if (uniqPeers.length) {
      compareWith(uniqPeers[0].student_id);
    }
  } catch (err) {
    toast(err.message, true);
  }
}

async function compareWith(peerId) {
  try {
    const data = await api("GET", `/api/social/compare/${peerId}`);
    if ($("#cmp-title")) $("#cmp-title").textContent = `Comparison with ${data.peer.name}`;

    const s = data.summary || { common: 0, both_busy: 0, mine: 0, theirs: 0, both_free: 0 };
    if ($("#cmp-summary")) {
      $("#cmp-summary").innerHTML = `
        <div class="stat"><div class="n">${s.common}</div><div class="l">Same Class</div></div>
        <div class="stat"><div class="n">${s.both_busy}</div><div class="l">Both Busy</div></div>
        <div class="stat"><div class="n">${s.mine}</div><div class="l">Only Me</div></div>
        <div class="stat"><div class="n">${s.theirs}</div><div class="l">Only Them</div></div>
        <div class="stat"><div class="n">${s.both_free}</div><div class="l">Both Free</div></div>
      `;
    }

    const T = data.time_slots || [];
    let html = "<tr><th>DAY</th>"
      + T.slice(0, 6).map((t) => `<th>${t}</th>`).join("")
      + '<th class="lunch-col">LUNCH</th>'
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
          return `<td class="cmp-mine">You</td>`;
        }
        if (c.state === "theirs") {
          return `<td class="cmp-theirs">Them</td>`;
        }
        return `<td class="cmp-free">·</td>`;
      };

      html += morning.map(cellHtml).join("");
      html += '<td class="lunch-spacer"></td>';
      html += afternoon.map(cellHtml).join("");
      html += "</tr>";
    }
    if ($("#cmp-table")) $("#cmp-table").innerHTML = html;
  } catch (err) {
    toast(err.message, true);
  }
}

/* --------------------------------------------------------------------------
   12. SLOT EXCHANGE MARKETPLACE
   -------------------------------------------------------------------------- */
let MY_CLASSES = [];

$$("[data-market-tab]").forEach((btn) =>
  btn.addEventListener("click", () => {
    $$("[data-market-tab]").forEach((b) => b.classList.remove("active"));
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
        : '<option value="">— Add courses to your timetable first —</option>';
    }
    renderMyListings(mine || []);
  } catch (err) {
    toast(err.message, true);
  }
}

function renderMyListings(listings) {
  const el = $("#my-listings");
  if (!el) return;
  el.innerHTML = listings.length
    ? listings.map((l) => `
      <div class="my-listing-item" data-lid="${l.listing_id}" style="display:flex; gap:6px; margin-bottom:6px;">
        <button class="course-tab my-listing-btn" data-lid="${l.listing_id}">
          <span>${esc(l.offered_course_code)} \u00b7 ${(l.desired_slot_tokens || []).length ? "wants " + esc(l.desired_slot_tokens.join("+")) : "any slot"}</span>
          <small>${l.interest_count} ⇄</small>
        </button>
        <button class="btn btn-secondary del-listing-btn" data-lid="${l.listing_id}" title="Remove listing" style="padding:6px 10px;">✕</button>
      </div>`).join("")
    : '<p class="hint">Nothing listed yet.</p>';

  $$(".my-listing-btn").forEach((b) =>
    b.addEventListener("click", () => showInterests(+b.dataset.lid, b.querySelector("span").textContent)));

  $$(".del-listing-btn").forEach((b) =>
    b.addEventListener("click", async (e) => {
      e.stopPropagation();
      const lid = +b.dataset.lid;
      try {
        await api("DELETE", `/api/swap/list/${lid}`);
        toast("Course listing removed from market");
        loadSwap();
      } catch (err) { toast(err.message, true); }
    }));
}

async function showInterests(lid, label) {
  if ($("#int-title")) $("#int-title").textContent = `Requests \u00b7 ${label}`;
  try {
    const res = await api("GET", `/api/swap/list/${lid}/interests`);
    const pane = $("#interest-pane");
    if (pane) {
      pane.innerHTML = res.requests && res.requests.length
        ? res.requests.map((r) => `
          <div class="people-row"><div class="avatar sm" style="background:${avatarColor(r.name)}">${esc(r.name[0] || "?")}</div>
            <span>${esc(r.name)}</span><small class="tag you-follow">REQUESTED</small></div>`).join("")
        : '<p class="hint">No one has requested this slot listing yet.</p>';
    }
  } catch (err) {
    toast(err.message, true);
  }
}

$("#sw-create")?.addEventListener("click", async () => {
  const selVal = $("#sw-class") ? $("#sw-class").value : "";
  const c = MY_CLASSES[selVal];
  if (!c) return toast("Add courses to your timetable first", true);
  try {
    await api("POST", "/api/swap/list", {
      offered_class_id: c.class_id,
      offered_course_code: c.course,
      desired_course_code: $("#sw-want-course").value.trim().toUpperCase(),
      desired_slot_tokens: $("#sw-want-slots").value.split("+")
        .map((t) => t.trim().toUpperCase()).filter(Boolean),
    });
    toast(`${c.course} (${c.slot_tokens.join("+")}) published to slot market ⇄`);
    loadSwap();
  } catch (err) {
    toast(err.message, true);
  }
});

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
          <button class="course-tab mk-item" data-lid="${l.listing_id}" style="margin-bottom:4px;">
            <span>${esc(l.course)} · ${esc(l.faculty || "TBD")}</span>
            <small>${esc(l.slot_tokens.join("+"))}${l.kinds.includes("LAB") ? " LAB" : ""}</small>
          </button>`).join("")
        : '<p class="hint">No listings match your search.</p>';
      $$(".mk-item").forEach((b) =>
        b.addEventListener("click", () => {
          $$(".mk-item").forEach((x) => x.classList.remove("active"));
          b.classList.add("active");
          showMkDetail(+b.dataset.lid);
        }));
    }
  } catch (err) {
    toast(err.message, true);
  }
}

$("#mk-search")?.addEventListener("click", searchMarket);
$("#mk-q")?.addEventListener("keydown", (e) => e.key === "Enter" && searchMarket());

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
      <div class="stat-row" style="margin-bottom:12px;">
        <div class="stat"><div class="n" style="font-size:14px">${esc(l.faculty || "TBD")}</div><div class="l">Faculty</div></div>
        <div class="stat"><div class="n" style="font-size:14px">${esc(l.venue || "TBD")}</div><div class="l">Venue</div></div>
        <div class="stat"><div class="n" style="font-size:14px">${esc(l.peer_name)}</div><div class="l">Listed By</div></div>
      </div>
      <p class="hint" style="margin-bottom:12px">Wants in exchange:
        <b>${esc(l.desired_course_code)}</b>
        ${(l.desired_slot_tokens || []).map((t) => `<span class="chip">${esc(t)}</span>`).join("") || "(any slot)"}</p>
      <button id="mk-request" class="btn btn-primary">
        <span>Request This Slot</span>
      </button>`;
    $("#mk-request").addEventListener("click", async () => {
      try {
        const out = await api("POST", `/api/swap/list/${lid}/interest`);
        toast(out.interested ? "Trade interest sent to student" : "Request withdrawn");
      } catch (err) {
        toast(err.message, true);
      }
    });
  }
}

/* --------------------------------------------------------------------------
   13. PROFILE MANAGEMENT
   -------------------------------------------------------------------------- */
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
    if ($("#pf-github")) $("#pf-github").value = me.github || "";
    if ($("#pf-reddit")) $("#pf-reddit").value = me.reddit || "";
    if ($("#pf-bio")) $("#pf-bio").value = me.bio || "";
  } catch (err) {
    toast(err.message, true);
  }
}

$("#pf-save")?.addEventListener("click", async () => {
  try {
    await api("POST", "/api/auth/profile", {
      name: $("#pf-name") ? $("#pf-name").value.trim() : "",
      email: $("#pf-email") ? $("#pf-email").value.trim() : "",
      phone: $("#pf-phone") ? $("#pf-phone").value.trim() : "",
      instagram: $("#pf-insta") ? $("#pf-insta").value.trim() : "",
      facebook: $("#pf-fb") ? $("#pf-fb").value.trim() : "",
      linkedin: $("#pf-linkedin") ? $("#pf-linkedin").value.trim() : "",
      github: $("#pf-github") ? $("#pf-github").value.trim() : "",
      reddit: $("#pf-reddit") ? $("#pf-reddit").value.trim() : "",
      bio: $("#pf-bio") ? $("#pf-bio").value : "",
    });
    ME = await api("GET", "/api/auth/me");
    if ($("#menu-name")) $("#menu-name").textContent = ME.name;
    toast("Profile updated ✦");
  } catch (err) {
    toast(err.message, true);
  }
});

/* --------------------------------------------------------------------------
   14. INITIAL BOOTSTRAP
   -------------------------------------------------------------------------- */
(async function init() {
  dismissLoader();
  if (TOKEN) {
    try {
      await enterApp(TOKEN);
    } catch (err) {
      console.error("Session error:", err);
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
