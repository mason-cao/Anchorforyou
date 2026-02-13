/* app.js
   Anchor for You logic
   - no-scroll SPA router (hash + history)
   - intake form -> rules engine -> renders results cards
   - top progress bar + glass skeleton loader
   - stores last results in localStorage
   - subscription tier recommendation based on intake/results
*/

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const STORAGE_KEY = "anchorforyou_intake_v1";

/* --------- Data --------- */
const SUPP = {
  iron: {
    name: "Iron",
    note: "Supports oxygen transport and endurance capacity; selected when fatigue or higher blood loss is reported.",
  },
  magnesium: {
    name: "Magnesium",
    note: "Supports neuromuscular signaling and normal muscle contraction; commonly used in recovery routines.",
  },
  omega3: {
    name: "Omega-3",
    note: "Foundation component commonly used to support recovery consistency and general wellness.",
  },
  vitd: {
    name: "Vitamin D",
    note: "Often selected as foundational support, especially when baseline status suggests a need for coverage.",
  },
  zinc: {
    name: "Zinc",
    note: "Conservative foundation option frequently used to support immune function when stacking.",
  },
  electrolytes: {
    name: "Electrolytes",
    note: "Emphasized during high-volume training periods to support hydration routines.",
  },
  bcomplex: {
    name: "B-complex (B6/B12/folate)",
    note: "Supportive micronutrient option often used in performance-focused routines when symptom burden increases.",
  },
  vitc: {
    name: "Vitamin C",
    note: "Commonly paired with iron-focused routines as supportive coverage.",
  },
  riboflavin: {
    name: "Riboflavin (B2)",
    note: "Often included in headache-focused routines as a supportive option.",
  },
  ginger: {
    name: "Ginger extract",
    note: "Commonly used in cramp-focused wellness stacks.",
  },
  probiotic: {
    name: "Probiotic",
    note: "Often selected as a GI support option when bloating is reported.",
  },
  ltheanine: {
    name: "L-theanine",
    note: "Supportive wind-down option often used when sleep disruption is reported.",
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

  const id = (hash || "#home").split("?")[0].replace("#", "");
  const target = document.getElementById(id) || document.getElementById("home");
  if (!target) return;

  $$(".view").forEach((v) => v.classList.remove("view-active", "view-anim"));

  target.classList.add("view-active");
  void target.offsetWidth;
  target.classList.add("view-anim");

  if (target.id === "results") {
    const saved = loadSaved();
    if (saved?.results) {
      hideResultsLoading();
      renderResults(saved.results);
    } else {
      hideResultsLoading();
      setResultsSummary("Submit your intake to generate a phase-aligned plan.");
      const grid = $("#resultsGrid");
      if (grid) grid.innerHTML = "";
    }
  } else {
    hideResultsLoading();
  }

  if (target.id === "plans") {
    updateTierRecommendationUI();
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

    e.preventDefault();
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
    menstrual: "Menstrual",
    follicular: "Follicular",
    ovulatory: "Ovulatory",
    luteal: "Luteal",
    "unsure-phase": "Not sure",
  };
  return map[v] || "Not sure";
}

function prettyCycleReg(v) {
  const map = {
    regular: "regular",
    irregular: "irregular",
    "birth-control": "on hormonal birth control",
    unsure: "tracking/unsure",
  };
  return map[v] || "unspecified";
}

function prettyTraining(v) {
  const map = {
    low: "<5 hrs/week",
    moderate: "5-10 hrs/week",
    high: ">10 hrs/week",
  };
  return map[v] || titleCase(v);
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
  parts.push(`Training: ${prettyTraining(intake.trainingLoad)}`);
  parts.push(`Phase: ${prettyPhase(intake.phase)}`);
  parts.push(`Cycle: ${prettyCycleReg(intake.cycleRegularity)}`);
  if (intake.sport) parts.push(`Sport: ${intake.sport}`);
  if (intake.symptoms?.length)
    parts.push(`Symptoms: ${intake.symptoms.map(prettySymptom).join(", ")}`);
  return parts.join(" • ");
}

function buildStack(intake) {
  const phasePack = new Map();
  const supportPack = new Map();

  // Foundation baselines
  [SUPP.omega3, SUPP.vitd, SUPP.magnesium].forEach((x) =>
    phasePack.set(x.name, x),
  );
  [SUPP.omega3, SUPP.zinc, SUPP.magnesium].forEach((x) =>
    supportPack.set(x.name, x),
  );

  const whyPhase = [];
  const whySupport = [];

  const s = new Set(intake.symptoms || []);

  // Phase logic
  switch (intake.phase) {
    case "menstrual":
      phasePack.set(SUPP.iron.name, SUPP.iron);
      phasePack.set(SUPP.vitc.name, SUPP.vitc);
      whyPhase.push(
        "Menstrual phase: prioritize blood-loss aware coverage and symptom support.",
      );
      break;

    case "follicular":
      whyPhase.push(
        "Follicular phase: maintain a stable baseline while training load returns.",
      );
      if (s.has("heavy-bleeding") || s.has("fatigue")) {
        phasePack.set(SUPP.iron.name, SUPP.iron);
        whyPhase.push(
          "Fatigue or heavy bleeding: include iron-focused coverage.",
        );
      }
      break;

    case "ovulatory":
      whyPhase.push(
        "Ovulatory phase: maintain baseline coverage and adjust based on symptoms.",
      );
      break;

    case "luteal":
      phasePack.set(SUPP.bcomplex.name, SUPP.bcomplex);
      whyPhase.push(
        "Luteal phase: symptom burden often increases, so supportive micronutrients are emphasized.",
      );
      break;

    default:
      whyPhase.push(
        "Phase not specified: prioritize symptom profile and training volume with a stable baseline.",
      );
      break;
  }

  // Training volume logic
  if (intake.trainingLoad === "high") {
    supportPack.set(SUPP.electrolytes.name, SUPP.electrolytes);
    whySupport.push(
      "Training volume >10 hrs/week: hydration and recovery support is emphasized.",
    );
  } else if (intake.trainingLoad === "moderate") {
    whySupport.push(
      "Training volume 5-10 hrs/week: consistent recovery foundation is prioritized.",
    );
  } else {
    whySupport.push(
      "Training volume <5 hrs/week: streamlined baseline with symptom-targeted add-ons.",
    );
  }

  // Symptom logic
  if (s.has("fatigue")) {
    phasePack.set(SUPP.bcomplex.name, SUPP.bcomplex);
    phasePack.set(SUPP.iron.name, SUPP.iron);
    whyPhase.push(
      "Fatigue: energy-supporting micronutrient coverage is emphasized.",
    );
  }

  if (s.has("heavy-bleeding")) {
    phasePack.set(SUPP.iron.name, SUPP.iron);
    phasePack.set(SUPP.vitc.name, SUPP.vitc);
    whyPhase.push("Heavy bleeding: reinforce blood-health aligned coverage.");
  }

  if (s.has("cramps")) {
    phasePack.set(SUPP.ginger.name, SUPP.ginger);
    whyPhase.push("Cramps: include common cramp-support pairing options.");
  }

  if (s.has("poor-sleep")) {
    supportPack.set(SUPP.ltheanine.name, SUPP.ltheanine);
    whySupport.push("Sleep disruption: add wind-down support option.");
  }

  if (s.has("headaches")) {
    supportPack.set(SUPP.riboflavin.name, SUPP.riboflavin);
    whySupport.push("Headaches: include supportive routine option.");
  }

  if (s.has("bloating")) {
    supportPack.set(SUPP.probiotic.name, SUPP.probiotic);
    whySupport.push("Bloating: include GI support option.");
  }

  if (s.has("brain-fog") || s.has("mood-swings")) {
    phasePack.set(SUPP.bcomplex.name, SUPP.bcomplex);
    whyPhase.push(
      "Cognition or mood symptoms: emphasize supportive micronutrient coverage.",
    );
  }

  const phaseArr = [...phasePack.values()];
  const supportArr = [...supportPack.values()];

  while (phaseArr.length < 4) phaseArr.push(SUPP.omega3);
  while (supportArr.length < 4) supportArr.push(SUPP.omega3);

  return {
    summary: buildSummary(intake),
    packs: [
      {
        title: "Phase-Aligned Plan",
        subtitle: "Coverage aligned to your current cycle phase",
        items: phaseArr,
        why: uniqueNonEmpty(whyPhase),
      },
      {
        title: "Training and Symptom Adjustments",
        subtitle: "Add-ons aligned to training volume and reported symptoms",
        items: supportArr,
        why: uniqueNonEmpty(whySupport),
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
      .slice(0, 10)
      .map(
        (x) =>
          `<li><strong>${escapeHTML(x.name)}</strong> <span class="muted">- ${escapeHTML(x.note)}</span></li>`,
      )
      .join("");

    const why = pack.why?.length
      ? `<div class="stack-why"><strong>Rationale:</strong><ul>${pack.why
          .map((w) => `<li>${escapeHTML(w)}</li>`)
          .join("")}</ul></div>`
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

/* --------- Tier recommendation (Plans) --------- */
function recommendTier(intake) {
  const reasons = [];
  let plan = "Anchor Core";

  if (intake.trainingLoad === "high") {
    plan = "Anchor Elite";
    reasons.push(
      "Training volume is >10 hrs/week, Elite aligns to higher-frequency adjustments.",
    );
  } else if (intake.trainingLoad === "moderate") {
    plan = "Anchor Performance";
    reasons.push(
      "Training volume is 5-10 hrs/week, Performance aligns to expanded support.",
    );
  } else {
    plan = "Anchor Core";
    reasons.push(
      "Training volume is <5 hrs/week, Core aligns to baseline tracking and coverage.",
    );
  }

  const symptomCount = Array.isArray(intake.symptoms)
    ? intake.symptoms.length
    : 0;

  if (symptomCount >= 4 && plan === "Anchor Core") {
    plan = "Anchor Performance";
    reasons.push(
      "Multiple symptoms selected, Performance supports broader adjustment logic.",
    );
  }

  if (symptomCount >= 5 && intake.trainingLoad === "high") {
    plan = "Anchor Elite";
    reasons.push(
      "High volume plus higher symptom burden supports Elite-level adjustments.",
    );
  }

  return { plan, reasons: uniqueNonEmpty(reasons) };
}

function clearPlanHighlights() {
  $$("[data-plan-card]").forEach((card) => {
    card.classList.remove("recommended");
    const badge = $(".badge-reco", card);
    if (badge) badge.remove();
  });
}

function highlightRecommendedPlan(planName) {
  clearPlanHighlights();
  const card = document.querySelector(
    `[data-plan-card="${CSS.escape(planName)}"]`,
  );
  if (!card) return;

  card.classList.add("recommended");

  const b = document.createElement("div");
  b.className = "badge badge-reco";
  b.textContent = "Recommended";
  card.prepend(b);
}

function updateTierRecommendationUI() {
  const text = $("#tierRecText");
  const reasonsEl = $("#tierRecReasons");
  if (!text || !reasonsEl) return;

  const saved = loadSaved();
  if (!saved?.intake) {
    text.textContent =
      "Complete the Get Started form to receive a recommendation based on your results.";
    reasonsEl.innerHTML = "";
    clearPlanHighlights();
    return;
  }

  const rec = recommendTier(saved.intake);
  text.innerHTML = `Recommended tier: <strong>${escapeHTML(rec.plan)}</strong>`;
  reasonsEl.innerHTML = rec.reasons
    .map((r) => `<li>${escapeHTML(r)}</li>`)
    .join("");
  highlightRecommendedPlan(rec.plan);
}

function initTierRecommendation() {
  const btn = $("#refreshTierRecBtn");
  btn?.addEventListener("click", () => updateTierRecommendationUI());
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
    setResultsSummary("Submit your intake to generate a phase-aligned plan.");
    const grid = $("#resultsGrid");
    if (grid) grid.innerHTML = "";
    updateTierRecommendationUI();
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
  initTierRecommendation();
  updateTierRecommendationUI();
});
