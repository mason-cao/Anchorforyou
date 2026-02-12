/* Anchor for You — logic
   - no-scroll SPA router (hash + history)
   - intake form -> rules engine -> renders results cards
   - top progress bar + glass skeleton loader
   - stores last results in localStorage
*/

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const STORAGE_KEY = "anchorforyou_intake_v1";

/* --------- Data --------- */
const SUPP = {
  iron: {
    name: "Iron (clinician guided)",
    note: "Consider lab guidance and GI tolerance.",
  },
  zinc: {
    name: "Zinc",
    note: "Avoid excess long-term; review total daily intake.",
  },
  magnesium: { name: "Magnesium", note: "Commonly used for recovery support." },
  vitd: { name: "Vitamin D (lab-guided)", note: "Best guided by testing." },
  omega3: { name: "Omega-3", note: "Often included as a recovery foundation." },
  electrolytes: {
    name: "Electrolytes",
    note: "Often used during higher load weeks.",
  },
  bcomplex: {
    name: "B-complex (B6/B12/folate)",
    note: "Conservative support; confirm suitability.",
  },
  vitc: {
    name: "Vitamin C",
    note: "Often paired with iron in clinician-guided plans.",
  },
  riboflavin: {
    name: "Riboflavin (B2)",
    note: "Sometimes used in headache-focused routines.",
  },
  ginger: {
    name: "Ginger extract",
    note: "Often used in cramp-focused wellness stacks.",
  },
  probiotic: {
    name: "Probiotic",
    note: "Some athletes trial for GI/bloating support.",
  },
  ltheanine: {
    name: "L-theanine",
    note: "Some people use for sleep wind-down; variable response.",
  },
};

function setYear() {
  const y = new Date().getFullYear();
  const el = $("#year");
  if (el) el.textContent = y;
}

/* --------- Loading UI --------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function showTopProgress() {
  const wrap = $("#topProgress");
  const bar = $("#topProgressBar");
  if (!wrap || !bar) return;
  wrap.classList.add("show");
  bar.style.width = "0%";
}

function setTopProgress(pct) {
  const bar = $("#topProgressBar");
  if (!bar) return;
  bar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
}

function finishTopProgress() {
  const wrap = $("#topProgress");
  const bar = $("#topProgressBar");
  if (!wrap || !bar) return;
  setTopProgress(100);
  setTimeout(() => {
    wrap.classList.remove("show");
    bar.style.width = "0%";
  }, 260);
}

function showResultsLoading() {
  const wrap = $("#resultsLoadingWrap");
  const grid = $("#resultsGrid");
  if (grid) grid.innerHTML = "";
  if (wrap) wrap.hidden = false;
}

function hideResultsLoading() {
  const wrap = $("#resultsLoadingWrap");
  if (wrap) wrap.hidden = true;
}

function setResultsSummary(text) {
  const el = $("#resultsSummary");
  if (el) el.textContent = text;
}

/* --------- Router (no scroll) --------- */
function setActiveNav(hash) {
  const current = (hash || "#home").split("?")[0] || "#home";
  $$(".nav a").forEach((a) => {
    const href = a.getAttribute("href");
    const isActive = href === current;
    a.classList.toggle("active", isActive);
    if (isActive) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

function showView(hash) {
  setActiveNav(hash);

  const id = (hash || "#home").replace("#", "");
  const target = document.getElementById(id) || document.getElementById("home");
  if (!target) return;

  $$(".view").forEach((v) => v.classList.remove("view-active", "view-anim"));

  target.classList.add("view-active");
  void target.offsetWidth; // restart animation
  target.classList.add("view-anim");

  if (target.id === "results") {
    const saved = loadSaved();
    if (saved?.results) {
      hideResultsLoading();
      renderResults(saved.results);
    } else {
      hideResultsLoading();
      setResultsSummary("Complete the intake to generate your stack.");
      const grid = $("#resultsGrid");
      if (grid) grid.innerHTML = "";
    }
  } else {
    hideResultsLoading();
  }
}

function navigateTo(hash, { replace = false } = {}) {
  const url = new URL(window.location.href);
  url.hash = hash;

  if (replace) history.replaceState(null, "", url);
  else history.pushState(null, "", url);

  showView(hash);
}

function initRouter() {
  window.addEventListener("popstate", () => {
    showView(location.hash || "#home");
  });

  showView(location.hash || "#home");
}

function initInternalLinks() {
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;

    const hash = a.getAttribute("href");
    if (!hash || hash === "#") return;

    e.preventDefault(); // stop anchor scroll
    navigateTo(hash);
  });
}

/* --------- Mobile nav --------- */
function initNavToggle() {
  const btn = $(".nav-toggle");
  const nav = $(".nav");
  if (!btn || !nav) return;

  btn.addEventListener("click", () => {
    const expanded = btn.getAttribute("aria-expanded") === "true";
    btn.setAttribute("aria-expanded", String(!expanded));
    nav.classList.toggle("open", !expanded);
  });

  $$(".nav a").forEach((a) =>
    a.addEventListener("click", () => {
      if (window.innerWidth <= 720) {
        nav.classList.remove("open");
        btn.setAttribute("aria-expanded", "false");
      }
    }),
  );

  window.addEventListener("resize", () => {
    if (window.innerWidth > 720) {
      nav.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
    }
  });
}

/* --------- Intake + rules engine --------- */
function getFormData(form) {
  const fd = new FormData(form);
  const symptoms = fd.getAll("symptoms");
  let sport = fd.get("sport");
  const sportOther = (fd.get("sportOther") || "").trim();
  if (sport === "Other" && sportOther) sport = sportOther;

  return {
    cycleRegularity: fd.get("cycleRegularity"),
    sport,
    trainingLoad: fd.get("trainingLoad"),
    phase: fd.get("phase"),
    lmp: fd.get("lmp") || "",
    symptoms,
    notes: (fd.get("notes") || "").trim(),
  };
}

function uniqueNonEmpty(arr) {
  return [...new Set(arr.filter(Boolean))];
}

function titleCase(s) {
  if (!s) return "";
  return s[0].toUpperCase() + s.slice(1);
}

function prettyPhase(v) {
  const map = {
    follicular: "Follicular",
    ovulatory: "Ovulatory",
    luteal: "Luteal",
    "unsure-phase": "Not sure",
  };
  return map[v] || "Not sure";
}

function prettySymptom(v) {
  const map = {
    fatigue: "fatigue",
    "heavy-bleeding": "heavy bleeding",
    cramps: "cramps",
    "poor-sleep": "poor sleep",
    "brain-fog": "brain fog",
    headaches: "headaches",
    bloating: "bloating",
    "mood-swings": "mood swings",
  };
  return map[v] || v;
}

function buildSummary(intake) {
  const parts = [];
  parts.push(`${titleCase(intake.trainingLoad)} training load`);
  parts.push(`${prettyPhase(intake.phase)} phase`);
  if (intake.sport) parts.push(`Primary sport: ${intake.sport}`);
  if (intake.symptoms?.length)
    parts.push(`Symptoms: ${intake.symptoms.map(prettySymptom).join(", ")}`);
  return parts.join(" • ");
}

function buildStack(intake) {
  const base = [SUPP.magnesium, SUPP.omega3, SUPP.vitd, SUPP.zinc];

  const pack1 = new Map();
  const pack2 = new Map();
  base.forEach((x) => {
    pack1.set(x.name, x);
    pack2.set(x.name, x);
  });

  const why1 = [];
  const why2 = [];

  if (intake.trainingLoad === "high") {
    pack2.set(SUPP.electrolytes.name, SUPP.electrolytes);
    why2.push("High training load → hydration/recovery emphasis.");
  } else if (intake.trainingLoad === "moderate") {
    why2.push("Moderate load → consistent recovery foundation.");
  } else {
    why2.push("Lower load → streamlined foundation.");
  }

  if (intake.phase === "luteal") {
    pack1.set(SUPP.bcomplex.name, SUPP.bcomplex);
    why1.push("Luteal phase → magnesium + B-vitamin support focus.");
  } else if (intake.phase === "follicular") {
    why1.push(
      "Follicular phase → steady foundation with energy support as needed.",
    );
  }

  const s = new Set(intake.symptoms);

  if (s.has("fatigue")) {
    pack1.set(SUPP.bcomplex.name, SUPP.bcomplex);
    pack1.set(SUPP.iron.name, SUPP.iron);
    why1.push("Fatigue selected → iron + B-vitamins considered (lab-guided).");
  }

  if (s.has("heavy-bleeding")) {
    pack1.set(SUPP.iron.name, SUPP.iron);
    pack1.set(SUPP.vitc.name, SUPP.vitc);
    why1.push(
      "Heavy bleeding selected → iron paired with vitamin C in some plans.",
    );
  }

  if (s.has("cramps")) {
    pack1.set(SUPP.ginger.name, SUPP.ginger);
    why1.push("Cramps selected → magnesium + ginger commonly paired.");
  }

  if (s.has("poor-sleep")) {
    pack2.set(SUPP.ltheanine.name, SUPP.ltheanine);
    why2.push("Poor sleep selected → wind-down support add-on.");
  }

  if (s.has("headaches")) {
    pack2.set(SUPP.riboflavin.name, SUPP.riboflavin);
    why2.push("Headaches selected → riboflavin often included in routines.");
  }

  if (s.has("bloating")) {
    pack2.set(SUPP.probiotic.name, SUPP.probiotic);
    why2.push("Bloating selected → probiotic trial option.");
  }

  if (s.has("brain-fog") || s.has("mood-swings")) {
    pack1.set(SUPP.bcomplex.name, SUPP.bcomplex);
    why1.push(
      "Cognition/mood selected → omega-3 + B-vitamins commonly included.",
    );
  }

  const pack1Arr = [...pack1.values()];
  const pack2Arr = [...pack2.values()];
  while (pack1Arr.length < 4) pack1Arr.push(SUPP.omega3);
  while (pack2Arr.length < 4) pack2Arr.push(SUPP.omega3);

  return {
    summary: buildSummary(intake),
    packs: [
      {
        title: "Anchor Pack 1",
        subtitle: "Cycle + performance support",
        items: pack1Arr,
        why: uniqueNonEmpty(why1),
      },
      {
        title: "Anchor Pack 2",
        subtitle: "Recovery + immune support",
        items: pack2Arr,
        why: uniqueNonEmpty(why2),
      },
    ],
  };
}

/* --------- Rendering --------- */
function pillSVG() {
  return `
  <svg width="74" height="52" viewBox="0 0 74 52" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="6" y="8" width="44" height="18" rx="9" fill="#ffffff" stroke="#ead2d2"/>
    <rect x="24" y="22" width="44" height="18" rx="9" fill="#ffd7dd" stroke="#ead2d2"/>
    <circle cx="18" cy="38" r="8" fill="#bfe9ff" stroke="#ead2d2"/>
    <circle cx="44" cy="14" r="7" fill="#f5f0ff" stroke="#ead2d2"/>
  </svg>`;
}

function escapeHTML(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderResults(results) {
  hideResultsLoading();
  setResultsSummary(results.summary);

  const grid = $("#resultsGrid");
  grid.innerHTML = "";

  results.packs.forEach((pack) => {
    const card = document.createElement("article");
    card.className = "card stack-card will-reveal";

    const items = pack.items
      .slice(0, 8)
      .map(
        (x) =>
          `<li><strong>${escapeHTML(x.name)}</strong> <span class="muted">— ${escapeHTML(x.note)}</span></li>`,
      )
      .join("");

    const why = pack.why?.length
      ? `<div class="stack-why"><strong>Why this set:</strong><ul>${pack.why.map((w) => `<li>${escapeHTML(w)}</li>`).join("")}</ul></div>`
      : "";

    card.innerHTML = `
      <div class="stack-top">
        <div>
          <h3 class="stack-title">${escapeHTML(pack.title)}</h3>
          <p class="stack-sub">${escapeHTML(pack.subtitle)}</p>
        </div>
        <div class="pill-art">${pillSVG()}</div>
      </div>
      <ul class="stack-list">${items}</ul>
      ${why}
    `;

    grid.appendChild(card);
  });

  requestAnimationFrame(() => {
    const cards = $$(".stack-card", grid);
    cards.forEach((c, i) => {
      c.style.animationDelay = `${i * 110}ms`;
      c.classList.remove("will-reveal");
      c.classList.add("reveal");
    });
  });
}

/* --------- Storage --------- */
function save(intake, results) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ intake, results, savedAt: Date.now() }),
  );
}
function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/* --------- Form wiring --------- */
function hydrateForm(form, intake) {
  if (intake.cycleRegularity) {
    const r = form.querySelector(
      `input[name="cycleRegularity"][value="${CSS.escape(intake.cycleRegularity)}"]`,
    );
    if (r) r.checked = true;
  }
  if (intake.trainingLoad) {
    const r = form.querySelector(
      `input[name="trainingLoad"][value="${CSS.escape(intake.trainingLoad)}"]`,
    );
    if (r) r.checked = true;
  }
  if (intake.phase) {
    const r = form.querySelector(
      `input[name="phase"][value="${CSS.escape(intake.phase)}"]`,
    );
    if (r) r.checked = true;
  }

  const sportSel = form.querySelector(`select[name="sport"]`);
  if (sportSel && intake.sport) {
    const options = [...sportSel.options].map((o) => o.value);
    if (options.includes(intake.sport)) {
      sportSel.value = intake.sport;
    } else {
      sportSel.value = "Other";
      const other = form.querySelector(`input[name="sportOther"]`);
      if (other) other.value = intake.sport;
    }
  }

  const lmp = form.querySelector(`input[name="lmp"]`);
  if (lmp && intake.lmp) lmp.value = intake.lmp;

  const notes = form.querySelector(`textarea[name="notes"]`);
  if (notes && intake.notes) notes.value = intake.notes;

  if (Array.isArray(intake.symptoms)) {
    intake.symptoms.forEach((v) => {
      const cb = form.querySelector(
        `input[name="symptoms"][value="${CSS.escape(v)}"]`,
      );
      if (cb) cb.checked = true;
    });
  }
}

function initForm() {
  const form = $("#intakeForm");
  const clearBtn = $("#clearFormBtn");
  if (!form) return;

  const saved = loadSaved();
  if (saved?.intake) hydrateForm(form, saved.intake);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const intake = getFormData(form);

    navigateTo("#results");
    showResultsLoading();

    showTopProgress();
    setTopProgress(10);

    await sleep(240);
    setTopProgress(32);
    await sleep(280);
    setTopProgress(56);
    await sleep(280);
    setTopProgress(76);

    const results = buildStack(intake);
    save(intake, results);

    await sleep(220);

    renderResults(results);
    finishTopProgress();
  });

  clearBtn?.addEventListener("click", () => {
    form.reset();
    localStorage.removeItem(STORAGE_KEY);
    setResultsSummary("Complete the intake to generate your stack.");
    const grid = $("#resultsGrid");
    if (grid) grid.innerHTML = "";
  });

  $$("[data-plan]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const plan = btn.getAttribute("data-plan");
      alert(
        `Selected "${plan}".\n(Connect checkout + accounts in production.)`,
      );
    });
  });
}

/* --------- Init --------- */
document.addEventListener("DOMContentLoaded", () => {
  setYear();
  initRouter();
  initInternalLinks();
  initNavToggle();
  initForm();
});
