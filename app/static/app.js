/* ==========================================================================
   CourseConE — Formal Monochromatic Liquid Glass Client Engine
   Photorealistic Black Hole (Gargantua Optics) · Scrollback to Home · Spatial HUD
   ========================================================================== */

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const API = "";
let TOKEN = localStorage.getItem("cp_token") || sessionStorage.getItem("cp_token") || null;
let ME = null;
let CURRENT_VIEW = "home";
let IN_PLANETARY_MODE = true;

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

function getGreeting(rawName) {
  const hour = new Date().getHours();
  const firstName = (rawName || "Student").trim().split(" ")[0];
  let timeStr = "Good evening";
  if (hour >= 5 && hour < 12) timeStr = "Good morning";
  else if (hour >= 12 && hour < 17) timeStr = "Good afternoon";
  else if (hour >= 17 && hour < 23) timeStr = "Good evening";
  else timeStr = "Good night";
  return `${timeStr}, ${firstName}`;
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
   3. PHOTOREALISTIC BLACK HOLE & BLINKING STARS (GARGANTUA ENGINE)
   -------------------------------------------------------------------------- */
let planetRotation = 0;
let scrollTargetRotation = 0;
let diveDim = 0;   // eased darkness level for the scroll-dive
let isDraggingPlanet = false;
let dragStartX = 0;

(function initBlackHoleAndBlinkingStars() {
  const canvas = $("#liquid-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let width, height;

  // Pure Blinking Optical Stars (Zero Threads / Zero Lines)
  let stars = [];
  const starCount = window.innerWidth < 768 ? 110 : 220;

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resize);
  resize();

  class BlinkingStar {
    constructor() {
      this.baseX = Math.random() * width;
      this.baseY = Math.random() * height;
      this.baseRadius = Math.random() < 0.12 ? (Math.random() * 0.9 + 1.2) : (Math.random() * 0.55 + 0.4);
      this.baseBrightness = Math.random() * 0.45 + 0.35;
      this.phase = Math.random() * Math.PI * 2;
      this.blinkSpeed = Math.random() * 0.035 + 0.015;
      this.isMajor = this.baseRadius > 1.3;

      const rnd = Math.random();
      if (rnd < 0.05) {
        this.colorR = 0; this.colorG = 240; this.colorB = 255; // Cyan
      } else if (rnd < 0.25) {
        this.colorR = 210; this.colorG = 240; this.colorB = 255; // Blue-White
      } else if (rnd < 0.45) {
        this.colorR = 255; this.colorG = 230; this.colorB = 180; // Amber-White
      } else {
        this.colorR = 255; this.colorG = 255; this.colorB = 255; // Pure Diamond White
      }
    }
    update() {
      this.phase += this.blinkSpeed;
    }
    draw(bhX, bhY, bhRadius) {
      // Gravitational Light Lensing: Warp star position around the black hole horizon
      let drawX = this.baseX;
      let drawY = this.baseY;

      const dx = this.baseX - bhX;
      const dy = this.baseY - bhY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const lensMax = bhRadius * 2.8;

      if (dist < lensMax && dist > bhRadius * 0.92) {
        // Gravitational Einstein deflection
        const warpFactor = Math.pow((lensMax - dist) / lensMax, 2) * (bhRadius * 0.45);
        drawX += (dx / dist) * warpFactor;
        drawY += (dy / dist) * warpFactor;
      } else if (dist <= bhRadius * 0.92) {
        // Star swallowed by event horizon shadow
        return;
      }

      const s1 = Math.sin(this.phase);
      const s2 = Math.sin(this.phase * 2.3);
      const s3 = Math.cos(this.phase * 0.7);
      const twinkle = Math.max(0.02, Math.min(1.0, Math.pow(((s1 + s2 * 0.5 + s3 * 0.3) / 1.8 + 0.5), 1.9)));
      const alpha = this.baseBrightness * twinkle;

      ctx.beginPath();
      ctx.arc(drawX, drawY, this.baseRadius * (0.8 + twinkle * 0.3), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${this.colorR}, ${this.colorG}, ${this.colorB}, ${alpha})`;
      ctx.fill();

      if (this.isMajor && alpha > 0.4) {
        ctx.beginPath();
        ctx.arc(drawX, drawY, this.baseRadius * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${this.colorR}, ${this.colorG}, ${this.colorB}, ${alpha * 0.16})`;
        ctx.fill();
      }
    }
  }

  for (let i = 0; i < starCount; i++) {
    stars.push(new BlinkingStar());
  }

  // Scroll & Drag to Rotate Spatial Orbit
  // Scrolling DOWN past a threshold dives into the workspace (carousel rise).
  // The cosmos progressively darkens as you scroll, until the TT appears.
  let scrollEnterAccum = 0;
  window.__diveTarget = 0;   // 0 = lit cosmos .. 1 = fully dark
  window.addEventListener("wheel", (e) => {
    if (IN_PLANETARY_MODE) {
      e.preventDefault();
      scrollTargetRotation += e.deltaY * 0.0022;
      if (!window.__enteringWorkspace) {
        scrollEnterAccum = e.deltaY > 0 ? scrollEnterAccum + e.deltaY : Math.max(0, scrollEnterAccum + e.deltaY * 0.5);
        window.__diveTarget = Math.min(1, scrollEnterAccum / 420);
        if (scrollEnterAccum > 420) {
          window.__enteringWorkspace = true;
          window.__diveTarget = 1;
          enterWorkspaceFromScroll();
        }
      }
    }
  }, { passive: false });

  window.addEventListener("pointerdown", (e) => {
    if (IN_PLANETARY_MODE && !e.target.closest(".orbital-node-card, .btn, input")) {
      isDraggingPlanet = true;
      dragStartX = e.clientX;
    }
  });

  window.addEventListener("pointermove", (e) => {
    if (isDraggingPlanet && IN_PLANETARY_MODE) {
      const deltaX = e.clientX - dragStartX;
      dragStartX = e.clientX;
      scrollTargetRotation -= deltaX * 0.006;
    }
  });

  window.addEventListener("pointerup", () => { isDraggingPlanet = false; });
  window.addEventListener("pointercancel", () => { isDraggingPlanet = false; });

  // Draw Photorealistic Relativistic Black Hole (Gargantua Singularity & Accretion Disk)
  function drawPhotorealisticBlackHole() {
    const isMobile = width < 768;
    const bhRadius = Math.min(width, height) * (isMobile ? 0.38 : 0.32);
    const bhX = width * (isMobile ? 0.94 : 0.88);
    const bhY = height * 0.50;

    scrollTargetRotation += 0.0015;
    planetRotation += (scrollTargetRotation - planetRotation) * 0.08;

    const time = Date.now() * 0.0012 + (planetRotation * 1.5);

    // 1. Outer Gravitational Lensing Glow / Corona
    const outerCorona = ctx.createRadialGradient(
      bhX, bhY, bhRadius * 0.9,
      bhX, bhY, bhRadius * 3.4
    );
    outerCorona.addColorStop(0, "rgba(0, 240, 255, 0.18)");
    outerCorona.addColorStop(0.35, "rgba(255, 180, 50, 0.14)");
    outerCorona.addColorStop(0.65, "rgba(255, 170, 90, 0.04)");
    outerCorona.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.save();
    ctx.beginPath();
    ctx.arc(bhX, bhY, bhRadius * 3.4, 0, Math.PI * 2);
    ctx.fillStyle = outerCorona;
    ctx.fill();
    ctx.restore();

    // 2. Gravitationally Lensed Rear Accretion Disk (Upper & Lower Warped Halo Arcs)
    // Upper Lensed Arch
    ctx.save();
    const upperGrad = ctx.createRadialGradient(
      bhX - bhRadius * 0.2, bhY - bhRadius * 0.4, bhRadius * 0.8,
      bhX, bhY, bhRadius * 2.1
    );
    upperGrad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
    upperGrad.addColorStop(0.18, "rgba(0, 240, 255, 0.85)"); // Blueshifted hot core
    upperGrad.addColorStop(0.48, "rgba(245, 158, 11, 0.75)"); // Thermal amber plasma
    upperGrad.addColorStop(0.85, "rgba(180, 83, 9, 0.25)");
    upperGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.beginPath();
    ctx.ellipse(bhX, bhY, bhRadius * 2.1, bhRadius * 1.75, -0.08, Math.PI * 0.95, Math.PI * 2.05);
    ctx.lineWidth = bhRadius * 0.75;
    ctx.strokeStyle = upperGrad;
    ctx.filter = "blur(8px)";
    ctx.stroke();

    // Secondary crisp core upper arc
    ctx.beginPath();
    ctx.ellipse(bhX, bhY, bhRadius * 1.7, bhRadius * 1.45, -0.08, Math.PI * 0.98, Math.PI * 2.02);
    ctx.lineWidth = bhRadius * 0.25;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.filter = "blur(3px)";
    ctx.stroke();
    ctx.restore();

    // Lower Lensed Arch (Underneath event horizon)
    ctx.save();
    const lowerGrad = ctx.createRadialGradient(
      bhX, bhY + bhRadius * 0.3, bhRadius * 0.85,
      bhX, bhY, bhRadius * 1.95
    );
    lowerGrad.addColorStop(0, "rgba(255, 255, 255, 0.8)");
    lowerGrad.addColorStop(0.25, "rgba(0, 240, 255, 0.6)");
    lowerGrad.addColorStop(0.55, "rgba(217, 119, 6, 0.45)");
    lowerGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.beginPath();
    ctx.ellipse(bhX, bhY, bhRadius * 1.95, bhRadius * 1.45, -0.08, 0, Math.PI);
    ctx.lineWidth = bhRadius * 0.65;
    ctx.strokeStyle = lowerGrad;
    ctx.filter = "blur(9px)";
    ctx.stroke();
    ctx.restore();

    // 3. Photon Sphere — soft warm glow that melts into the horizon
    //    (harsh cyan rays replaced by a smooth amber falloff)
    ctx.save();
    const photonGlow = ctx.createRadialGradient(bhX, bhY, bhRadius * 1.0, bhX, bhY, bhRadius * 1.22);
    photonGlow.addColorStop(0, "rgba(255, 236, 205, 0.85)");   // bright rim at horizon edge
    photonGlow.addColorStop(0.30, "rgba(255, 190, 110, 0.35)");
    photonGlow.addColorStop(1, "rgba(255, 160, 60, 0)");       // melts smoothly to black
    ctx.beginPath();
    ctx.arc(bhX, bhY, bhRadius * 1.22, 0, Math.PI * 2);
    ctx.fillStyle = photonGlow;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(bhX, bhY, bhRadius * 1.03, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 244, 225, 0.9)";
    ctx.lineWidth = Math.max(1.5, bhRadius * 0.014);
    ctx.shadowColor = "rgba(255, 190, 110, 0.8)";
    ctx.shadowBlur = bhRadius * 0.12;
    ctx.stroke();
    ctx.restore();

    // 4. Central Singularity Event Horizon (Pure #000000 Void)
    ctx.save();
    ctx.beginPath();
    ctx.arc(bhX, bhY, bhRadius * 1.0, 0, Math.PI * 2);
    ctx.fillStyle = "#000000";
    ctx.shadowColor = "#000000";
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.restore();

    // 5. Front Equatorial Accretion Disk (Passing in front with Doppler Beaming)
    ctx.save();
    const diskW = bhRadius * 3.2;
    const diskH = bhRadius * 0.42;

    // Relativistic Doppler Beaming: Left side approaching (bright cyan-white), Right side receding (dimmer amber)
    const frontDiskGrad = ctx.createLinearGradient(bhX - diskW, bhY, bhX + diskW, bhY);
    frontDiskGrad.addColorStop(0, "rgba(0, 240, 255, 0.0)");
    frontDiskGrad.addColorStop(0.18, "rgba(0, 240, 255, 0.65)");
    frontDiskGrad.addColorStop(0.35, "rgba(255, 255, 255, 0.98)"); // Peak approaching Doppler brightness
    frontDiskGrad.addColorStop(0.50, "rgba(255, 235, 170, 0.90)");
    frontDiskGrad.addColorStop(0.72, "rgba(245, 158, 11, 0.70)");  // Redshifted amber matter
    frontDiskGrad.addColorStop(0.92, "rgba(180, 83, 9, 0.35)");
    frontDiskGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

    // Outer diffuse front disk layer
    ctx.beginPath();
    ctx.ellipse(bhX, bhY, diskW, diskH, -0.08, 0, Math.PI * 2);
    ctx.fillStyle = frontDiskGrad;
    ctx.filter = "blur(7px)";
    ctx.fill();

    // Intense high-speed relativistic core stream with animated noise waves
    ctx.beginPath();
    ctx.ellipse(bhX, bhY, diskW * 0.94, diskH * 0.45, -0.08, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.filter = "blur(2.5px)";
    ctx.fill();

    // Plasma swirl dots removed — clean continuous disk instead.
    ctx.restore();

    // Re-draw crisp sharp event horizon over the center to maintain physical eclipse
    ctx.save();
    ctx.beginPath();
    ctx.arc(bhX, bhY, bhRadius * 0.98, 0, Math.PI * 2);
    ctx.fillStyle = "#000000";
    ctx.fill();
    ctx.restore();

    // Update Floating Orbital Capsules around the Singularity Orbit
    updateOrbitalNodesPositions(bhX, bhY, bhRadius * 1.55);
  }

  function updateOrbitalNodesPositions(px, py, pr) {
    if (!IN_PLANETARY_MODE) return;
    const cards = $$(".orbital-node-card");
    const total = cards.length;
    const isMobile = width < 768;
    const orbitRadiusX = pr * (isMobile ? 0.92 : 0.98);
    const orbitRadiusY = pr * (isMobile ? 0.78 : 0.84);

    cards.forEach((card, i) => {
      const baseAngle = (i / total) * (Math.PI * 2);
      const angle = baseAngle + (planetRotation * 1.8);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      const x = px + (sin * orbitRadiusX) - 110;
      const y = py + (cos * orbitRadiusY) - 24;
      const zDepth = cos;

      if (zDepth > -0.32) {
        const scale = 0.82 + 0.28 * Math.max(0, zDepth);
        const opacity = Math.min(1.0, Math.max(0, (zDepth + 0.32) * 1.5));
        card.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) scale(${scale.toFixed(3)})`;
        card.style.opacity = opacity.toFixed(3);
        card.style.pointerEvents = opacity > 0.4 ? "auto" : "none";
        card.style.zIndex = String(Math.round(30 + zDepth * 20));
      } else {
        card.style.opacity = "0";
        card.style.pointerEvents = "none";
      }
    });
  }

  function loop() {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, height);

    const isMobile = width < 768;
    const bhRadius = Math.min(width, height) * (isMobile ? 0.38 : 0.32);
    const bhX = width * (isMobile ? 0.94 : 0.88);
    const bhY = height * 0.50;

    // Stars with Gravitational Lensing Deflection
    for (let s of stars) {
      s.update();
      s.draw(bhX, bhY, bhRadius);
    }

    // Photorealistic Black Hole Rendering
    drawPhotorealisticBlackHole();

    // Scroll-dive darkening: the cosmos fades to black as you scroll down.
    // Once the workspace has been entered, the dim PERSISTS (never returns to
    // full brightness) until you explicitly scroll back to Planetary Orbit.
    const targetDim = window.__workspaceDim
      ? 0.62
      : (IN_PLANETARY_MODE ? (window.__diveTarget || 0) : 0);
    diveDim += (targetDim - diveDim) * 0.10;
    if (diveDim > 0.004) {
      ctx.fillStyle = `rgba(0, 0, 0, ${(diveDim * 0.92).toFixed(3)})`;
      ctx.fillRect(0, 0, width, height);
    }

    requestAnimationFrame(loop);
  }
  loop();
})();

/* --------------------------------------------------------------------------
   4. SCROLLBACK TO HOME ENGINE (SCROLL UP AT TOP OF PAGE RETURNS HOME)
   -------------------------------------------------------------------------- */
let scrollbackDelta = 0;
let scrollbackTimer = null;

function handleScrollbackToHome(e) {
  if (IN_PLANETARY_MODE) return;

  const isAtTop = window.scrollY <= 4;
  const isScrollingUp = e.deltaY < 0;

  if (isAtTop && isScrollingUp) {
    scrollbackDelta += Math.abs(e.deltaY);

    const hintHud = $("#scrollback-hint-hud");
    if (hintHud) {
      hintHud.classList.add("visible");
      clearTimeout(scrollbackTimer);
      scrollbackTimer = setTimeout(() => {
        hintHud.classList.remove("visible");
        scrollbackDelta = 0;
      }, 750);
    }

    if (scrollbackDelta > 65) {
      scrollbackDelta = 0;
      if (hintHud) hintHud.classList.remove("visible");
      openPlanetaryHome();
      toast("Returned to Planetary Orbit 🪐");
    }
  } else {
    scrollbackDelta = 0;
  }
}

window.addEventListener("wheel", handleScrollbackToHome, { passive: true });

// Touch / Swipe Down at top of screen
let touchStartY = 0;
window.addEventListener("touchstart", (e) => {
  if (e.touches.length === 1) touchStartY = e.touches[0].clientY;
}, { passive: true });

window.addEventListener("touchmove", (e) => {
  if (IN_PLANETARY_MODE || e.touches.length !== 1) return;
  const touchY = e.touches[0].clientY;
  const pullDistance = touchY - touchStartY;

  if (window.scrollY <= 0 && pullDistance > 70) {
    openPlanetaryHome();
    toast("Returned to Planetary Orbit 🪐");
    touchStartY = 999999;
  }
}, { passive: true });

/* --------------------------------------------------------------------------
   5. CURSOR REFRACTION & 2D SPECULAR TRACKING
   -------------------------------------------------------------------------- */
(function initCursorAndRefraction() {
  const orb = $("#liquid-cursor-follower");
  let orbX = -1000, orbY = -1000;
  let targetX = -1000, targetY = -1000;

  window.addEventListener("mousemove", (e) => {
    targetX = e.clientX;
    targetY = e.clientY;

    const hoveredElement = e.target.closest(".glass, .liquid-glass, .card, .panel, .btn, .orbital-node-card");
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
   6. FLOATING LIQUID GLASS TOOLTIP LENS (HOVERS ABOVE TIMETABLE CELLS)
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
   7. COMMAND PALETTE HUD (Cmd+K) (SMOOTH OPTICAL BLUR IN)
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
        const targetView = action.split(":")[1];
        if (targetView === "home") {
          openPlanetaryHome();
        } else {
          openAppView(targetView);
        }
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
   8. AUTH & DEMO QUICK-LOGIN
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
   9. PLANETARY SPATIAL NAVIGATION & SWITCHING
   -------------------------------------------------------------------------- */
function openPlanetaryHome() {
  IN_PLANETARY_MODE = true;
  CURRENT_VIEW = "home";
  hideFloatingLens();
  document.body.classList.add("planetary-lock");
  window.__enteringWorkspace = false;
  window.__diveTarget = 0;   // cosmos lights back up smoothly
  window.__workspaceDim = false;

  $("#app-view")?.classList.add("in-planetary-mode");
  $("#planetary-home-view")?.classList.remove("hidden-spatial");
  $("#planetary-home-view")?.classList.remove("leaving");
  $("#app-sidebar")?.classList.add("planetary-hidden");
  $$(".view").forEach((v) => v.classList.add("hidden"));

  if ($("#home-greeting-text")) {
    $("#home-greeting-text").textContent = getGreeting(ME ? ME.name : "Varun");
  }

  $$(".nav-btn[data-view]").forEach((b) =>
    b.classList.toggle("active", b.dataset.view === "home"));
}

/* ---- Scroll-dive: hero fades away, then the workspace carousels up ---- */
function enterWorkspaceFromScroll() {
  const hero = $("#planetary-home-view");
  if (hero) hero.classList.add("leaving");   // fades the Good Evening greeting
  window.__workspaceDim = true;              // hold the dimmed cosmos permanently
  setTimeout(() => openAppView("timetable"), 480);
}

/* ---- Each module gets its own signature entrance animation ---- */
const VIEW_ANIM = {
  timetable: "anim-ascend",     // carousels up from below, de-blurring
  upload: "anim-slide-left",    // slides in from the right edge
  classmates: "anim-zoom",      // zoom-unfold from deep space
  social: "anim-flip",          // 3D flip around X axis
  compare: "anim-split",        // splits open from centre seam
  profile: "anim-rise-stagger", // modular rise with stagger
  swap: "anim-swing"            // pendulum swing settle
};
const ALL_ANIM_CLASSES = [...Object.values(VIEW_ANIM), "exit-down"];

function openAppView(viewName) {
  const currentView = $(".view:not(.hidden)");

  const doOpen = () => {
    IN_PLANETARY_MODE = false;
    CURRENT_VIEW = viewName;
    hideFloatingLens();
    document.body.classList.remove("planetary-lock");

    $("#app-view")?.classList.remove("in-planetary-mode");
    $("#planetary-home-view")?.classList.add("hidden-spatial");
    $("#planetary-home-view")?.classList.remove("leaving");
    $("#app-sidebar")?.classList.remove("planetary-hidden");

    $$(".nav-btn[data-view]").forEach((b) =>
      b.classList.toggle("active", b.dataset.view === viewName));
    $$(".view").forEach((v) => v.classList.add("hidden"));

    const viewEl = $("#view-" + viewName);
    if (viewEl) {
      viewEl.classList.remove(...ALL_ANIM_CLASSES);
      viewEl.classList.remove("hidden");
      void viewEl.offsetWidth; // restart entrance animation cleanly
      viewEl.classList.add(VIEW_ANIM[viewName] || "anim-ascend");
    }
    $("#app-sidebar")?.classList.remove("mobile-open");

    if (viewName === "timetable") loadGrid();
    if (viewName === "classmates") { findClassmates(); loadRequests(); }
    if (viewName === "social") { loadSocial(); loadRequests(); }
    if (viewName === "compare") loadCompare();
    if (viewName === "profile") loadProfile();
    if (viewName === "swap") { loadSwap(); searchMarket(); }
  };

  // Outgoing module sinks away first for a smooth modular hand-off
  if (currentView && currentView.id !== "view-" + viewName && !IN_PLANETARY_MODE) {
    currentView.classList.add("exit-down");
    setTimeout(() => {
      currentView.classList.add("hidden");
      currentView.classList.remove("exit-down");
      doOpen();
    }, 200);
  } else {
    doOpen();
  }
}

$("#sidebar-brand-home-btn")?.addEventListener("click", () => {
  openPlanetaryHome();
});

$$(".orbital-node-card").forEach((card) => {
  card.addEventListener("click", () => {
    const target = card.dataset.targetView;
    if (target) openAppView(target);
  });
});

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

  openPlanetaryHome();
  toast(`Welcome, ${ME.name} ✦`);
}

$$(".nav-btn[data-view]").forEach((btn) =>
  btn.addEventListener("click", () => {
    const viewName = btn.dataset.view;
    if (viewName === "home") {
      openPlanetaryHome();
    } else {
      openAppView(viewName);
    }
  }));

function showView(name) {
  if (name === "home") {
    openPlanetaryHome();
  } else {
    openAppView(name);
  }
}

/* --------------------------------------------------------------------------
   10. TIMETABLE MATRIX & FLOATING LIQUID GLASS HOVER LENS
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
      openAppView("timetable");
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
   11. CLASSMATES & SOCIAL RADAR
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
   12. SOCIAL NETWORK & COMPARE MATRIX
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
   13. SLOT EXCHANGE MARKETPLACE
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
   14. PROFILE MANAGEMENT
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
   15. INITIAL BOOTSTRAP
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
