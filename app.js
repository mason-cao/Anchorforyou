/* app.js
   Anchor for You logic
   - no-scroll SPA router (hash + history)
   - intake form -> rules engine -> renders results cards (WITH DOSAGES)
   - top progress bar + glass skeleton loader
   - stores last results in localStorage
   - subscription tier recommendation based on intake/results
   - Stripe checkout via Payment Links (GitHub Pages-friendly)

   Notes:
   - Omega-3 REMOVED from logic
   - Weekly training is split into HOURS + INTENSITY
*/

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const STORAGE_KEY = "anchorforyou_intake_v1";

/* --------- Stripe Checkout (Payment Links) --------- */
const STRIPE_PAYMENT_LINKS = {
  core: "https://buy.stripe.com/test_5kQ6oH22DdvOfXYa2KaMU07",
  performance: "https://buy.stripe.com/test_cNi14naz963mbHI5MuaMU06",
  elite: "https://buy.stripe.com/test_eVq8wP4aL8bu7rsfn4aMU05",
};

function normalizeTierName(name) {
  const n = String(name || "").toLowerCase();
  if (n.includes("core")) return "core";
  if (n.includes("performance")) return "performance";
  if (n.includes("elite")) return "elite";
  if (n === "core") return "core";
  if (n === "performance") return "performance";
  if (n === "elite") return "elite";
  return null;
}

function startCheckout(tierLabel) {
  const key = normalizeTierName(tierLabel);
  const url = key ? STRIPE_PAYMENT_LINKS[key] : null;

  if (!url) {
    alert("Checkout link not set for this plan yet.");
    return;
  }
  window.location.href = url;
}

function initCheckout() {
  $$("[data-plan]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const plan = btn.getAttribute("data-plan");
      startCheckout(plan);
    });
  });
}

/* --------- Data (Omega-3 removed) --------- */
const SUPP = {
  folate: {
    name: "Folate",
    note: "Vital for red blood cell production, hormonal balance, and energy metabolism: supporting endurance, recovery, and long-term reproductive health.",
  },
  iron: {
    name: "Iron",
    note: "Essential for oxygen delivery to muscles (endurance/VO₂ max). Female endurance athletes are at higher risk due to menstrual + sweat loss. Lab-guided monitoring helps.",
  },
  magnesium: {
    name: "Magnesium",
    note: "Supports neuromuscular signaling, muscle relaxation, and stress regulation. Often emphasized in luteal/PMS support; lost through sweat at higher loads.",
  },
  calcium: {
    name: "Calcium",
    note: "Key for bone integrity and muscle contraction. Especially important with menstrual dysfunction/RED-S risk (pair with vitamin D).",
  },
  zinc: {
    name: "Zinc",
    note: "Supports immune health, recovery, protein synthesis, and hormone signaling. Can help during PMS-related symptom burden.",
  },
  vitd: {
    name: "Vitamin D",
    note: "Supports calcium absorption, bone strength, immune regulation, and muscle function. Lab-guided dosing is best if deficiency is suspected.",
  },
};

const PHASE_DOSAGES = {
  menstrual: {
    iron: "20–24 mg/day",
    magnesium: "350–380 mg/day",
    zinc: "11–14 mg/day",
    calcium: "1200–1300 mg/day",
    vitd: "1000–2000 IU/day",
    folate: "500–600 mcg/day",
  },
  follicular: {
    iron: "18–20 mg/day",
    magnesium: "300–340 mg/day",
    zinc: "9–12 mg/day",
    calcium: "1000–1200 mg/day",
    vitd: "800–1500 IU/day",
    folate: "400–500 mcg/day",
  },
  ovulatory: {
    iron: "18–20 mg/day",
    magnesium: "320–350 mg/day",
    zinc: "10–13 mg/day",
    calcium: "1100–1200 mg/day",
    vitd: "1000–1500 IU/day",
    folate: "400–500 mcg/day",
  },
  luteal: {
    iron: "18–22 mg/day",
    magnesium: "360–420 mg/day",
    zinc: "12–15 mg/day",
    calcium: "1200–1300 mg/day",
    vitd: "1000–2000 IU/day",
    folate: "450–600 mcg/day",
  },
};

/* --------- Helpers --------- */
function setYear() {
  const y = new Date().getFullYear();
  const el = $("#year");
  if (el) el.textContent = y;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function uniqueNonEmpty(arr) {
  return [...new Set((arr || []).filter(Boolean))];
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

function prettyTrainingHours(v) {
  const map = {
    lt5: "<5 hrs/week",
    "5to10": "5–10 hrs/week",
    gt10: ">10 hrs/week",
  };
  return map[v] || "";
}

function prettyTrainingIntensity(v) {
  const map = {
    low: "low–moderate",
    moderate: "moderate",
    high: "high",
  };
  return map[v] || "";
}

/* internal derived load bucket for logic compatibility */
function deriveTrainingLoad(trainingHours, trainingIntensity) {
  const hScore =
    trainingHours === "gt10" ? 3 : trainingHours === "5to10" ? 2 : 1;
  const iScore =
    trainingIntensity === "high" ? 3 : trainingIntensity === "moderate" ? 2 : 1;

  // Conservative: elite only if hours are high OR (hours moderate + intensity high)
  if (hScore === 3 || (hScore >= 2 && iScore === 3)) return "high";
  if (hScore === 2 || iScore === 2) return "moderate";
  return "low";
}

function prettyTraining(intake) {
  const hours = prettyTrainingHours(intake.trainingHours);
  const intensity = prettyTrainingIntensity(intake.trainingIntensity);

  if (hours && intensity) return `${hours} • Intensity: ${intensity}`;

  // Backward-compat fallback (old saved data)
  const mapOld = {
    low: "<5 hrs/week",
    moderate: "5–10 hrs/week",
    high: ">10 hrs/week",
  };
  return mapOld[intake.trainingLoad] || titleCase(intake.trainingLoad);
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

function normalizedPhase(phaseValue, intake) {
  const p = String(phaseValue || "").trim();
  if (
    p === "menstrual" ||
    p === "follicular" ||
    p === "ovulatory" ||
    p === "luteal"
  ) {
    return p;
  }

  const s = new Set(intake?.symptoms || []);
  if (s.has("heavy-bleeding")) return "menstrual";
  if (s.has("cramps") || s.has("mood-swings") || s.has("poor-sleep"))
    return "luteal";
  return "follicular";
}

function buildSummary(intake) {
  const parts = [];
  parts.push(`Training: ${prettyTraining(intake)}`);
  parts.push(`Phase: ${prettyPhase(intake.phase)}`);
  parts.push(`Cycle: ${prettyCycleReg(intake.cycleRegularity)}`);
  if (intake.sport) parts.push(`Sport: ${intake.sport}`);
  if (intake.symptoms?.length)
    parts.push(`Symptoms: ${intake.symptoms.map(prettySymptom).join(", ")}`);
  return parts.join(" • ");
}

/* --------- Loading UI --------- */
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

/* --------- Intake --------- */
function getFormData(form) {
  const fd = new FormData(form);
  const symptoms = fd.getAll("symptoms");
  let sport = fd.get("sport");
  const sportOther = (fd.get("sportOther") || "").trim();
  if (sport === "Other" && sportOther) sport = sportOther;

  const trainingHours = fd.get("trainingHours");
  const trainingIntensity = fd.get("trainingIntensity");

  // derived bucket to preserve existing recommendation/logic structure
  const trainingLoad = deriveTrainingLoad(trainingHours, trainingIntensity);

  return {
    cycleRegularity: fd.get("cycleRegularity"),
    sport,
    trainingHours,
    trainingIntensity,
    trainingLoad,
    phase: fd.get("phase"),
    lmp: fd.get("lmp") || "",
    symptoms,
    notes: (fd.get("notes") || "").trim(),
  };
}

/* --------- Phase plan: choose which nutrients appear --------- */
function phaseSupplementKeys(intake) {
  const phaseKey = normalizedPhase(intake.phase, intake);
  const s = new Set(intake.symptoms || []);

  // Baseline
  const keys = new Set(["magnesium", "calcium", "vitd"]);

  // Iron: menstrual or fatigue/heavy bleeding signals
  if (phaseKey === "menstrual" || s.has("fatigue") || s.has("heavy-bleeding")) {
    keys.add("iron");
  }

  // Folate: menstrual / fatigue / heavy bleeding / irregular cycle
  if (
    phaseKey === "menstrual" ||
    s.has("fatigue") ||
    s.has("heavy-bleeding") ||
    intake.cycleRegularity === "irregular"
  ) {
    keys.add("folate");
  }

  // Zinc: luteal/menstrual or cramps/mood swings
  if (
    phaseKey === "luteal" ||
    phaseKey === "menstrual" ||
    s.has("cramps") ||
    s.has("mood-swings")
  ) {
    keys.add("zinc");
  }

  const order = ["folate", "iron", "magnesium", "calcium", "zinc", "vitd"];
  return order.filter((k) => keys.has(k));
}

function buildPhaseItems(intake) {
  const phaseKey = normalizedPhase(intake.phase, intake);
  const table = PHASE_DOSAGES[phaseKey] || PHASE_DOSAGES.follicular;
  const keys = phaseSupplementKeys(intake);

  return keys.map((k) => ({
    name: SUPP[k].name,
    dose: table[k] || "",
    note: SUPP[k].note,
  }));
}

/* --------- Targeted adjustments (protocols w/ explicit dosages) --------- */
function buildAdjustmentItems(intake) {
  const items = [];
  const s = new Set(intake.symptoms || []);
  const phaseKey = normalizedPhase(intake.phase, intake);

  // Cramps protocol (explicit)
  if (s.has("cramps")) {
    items.push({
      name: "Cramps Protocol (pre-period)",
      dose: "Nightly for 7 days before period: 250 mg magnesium (glycinate/citrate) + 45 mg zinc",
      note: "Premenstrual protocol aimed at reducing side effects and supporting performance during the pre-period window.",
    });
  }

  // Iron risk / screening notes
  if (s.has("fatigue") || s.has("heavy-bleeding") || phaseKey === "menstrual") {
    items.push({
      name: "Iron Risk Notes (screening + replenishment)",
      dose: "Baseline female RDI: 18 mg/day • Additional athlete replenishment: +1–2 mg/day",
      note: "Athletes can have higher iron turnover and loss (sweat/hemolysis/GI). Consider screening at ~6-month intervals if you’re at risk.",
    });
  }

  // Low estrogen / amenorrhea risk proxy: irregular + high training
  if (
    intake.cycleRegularity === "irregular" &&
    intake.trainingLoad === "high"
  ) {
    items.push({
      name: "Bone Support (low-estrogen/amenorrhea risk)",
      dose: "Calcium: 1500 mg/day (split into <500 mg doses across the day)",
      note: "Higher calcium targets are sometimes suggested to support bone health in the presence of low estrogen. Pair with adequate vitamin D and professional guidance.",
    });
  }

  // Vitamin D deficiency protocol (explicit)
  items.push({
    name: "Vitamin D (if deficiency is confirmed)",
    dose: "2000–4000 IU vitamin D3/day",
    note: "This range is commonly used when labs show inadequacy. For ongoing dosing, use lab-guided targets and avoid long-term high dosing without supervision.",
  });

  // Folate deficiency/pregnancy note (explicit)
  items.push({
    name: "Folate (if deficiency/pregnancy planning applies)",
    dose: "Typical prenatal range: 800–1000 mcg DFE/day",
    note: "Most prenatal formulations fall in this range. If you suspect deficiency or are pregnant/planning, individualized screening and guidance is recommended.",
  });

  return items;
}

function buildStack(intake) {
  const phaseKey = normalizedPhase(intake.phase, intake);

  const whyPhase = [];
  const whyAdjust = [];

  whyPhase.push(
    "Nutrient recommendations reflect shifts in estrogen/progesterone, inflammatory load, iron turnover, and bone metabolism across the menstrual cycle.",
  );

  if (phaseKey === "luteal") {
    whyPhase.push(
      "Luteal phase: progesterone-dominant; magnesium needs often trend higher and perceived fatigue can increase.",
    );
  }
  if (phaseKey === "menstrual") {
    whyPhase.push(
      "Menstrual phase: blood loss + higher inflammatory load. Iron/folate support may be more relevant.",
    );
  }

  if (intake.trainingLoad === "high") {
    whyAdjust.push(
      "High training load: consider more frequent screening and bone-support awareness if cycle irregularity is present.",
    );
  }
  if ((intake.symptoms || []).length) {
    whyAdjust.push(
      "Symptom-targeted protocols activate based on the symptoms you selected.",
    );
  }

  const phaseItems = buildPhaseItems(intake);
  const adjustItems = buildAdjustmentItems(intake);

  return {
    summary: buildSummary(intake),
    packs: [
      {
        title: "Phase-Aligned Dosage Plan",
        subtitle: `${prettyPhase(intake.phase)} dosing aligned to cycle physiology.`,
        items: phaseItems,
        why: uniqueNonEmpty(whyPhase),
      },
      {
        title: "Targeted Adjustments",
        subtitle:
          "Protocols and lab-guided ranges based on symptoms/risk signals.",
        items: adjustItems,
        why: uniqueNonEmpty(whyAdjust),
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
  if (!grid) return;
  grid.innerHTML = "";

  results.packs.forEach((pack) => {
    const card = document.createElement("article");
    card.className = "card stack-card will-reveal";

    const items = (pack.items || [])
      .slice(0, 20)
      .map((x) => {
        const dose = x.dose
          ? ` <span class="dose">• ${escapeHTML(x.dose)}</span>`
          : "";
        const note = x.note
          ? ` <span class="muted">— ${escapeHTML(x.note)}</span>`
          : "";
        return `<li><strong>${escapeHTML(x.name)}</strong>${dose}${note}</li>`;
      })
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
      <ul class="stack-list">${items || "<li class='muted'>No items for this section yet.</li>"}</ul>
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

  const load = intake.trainingLoad || "low";

  if (load === "high") {
    plan = "Anchor Elite";
    reasons.push(
      "Your training load is high (hours and/or intensity), Elite aligns to higher-frequency adjustments.",
    );
  } else if (load === "moderate") {
    plan = "Anchor Performance";
    reasons.push(
      "Your training load is moderate, Performance aligns to expanded support.",
    );
  } else {
    plan = "Anchor Core";
    reasons.push(
      "Your training load is baseline, Core aligns to foundational tracking and coverage.",
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

  if (symptomCount >= 5 && load === "high") {
    plan = "Anchor Elite";
    reasons.push(
      "High load plus higher symptom burden supports Elite-level adjustments.",
    );
  }

  return { plan, reasons: uniqueNonEmpty(reasons) };
}

function clearPlanHighlights() {
  $$(".plan").forEach((p) => p.classList.remove("recommended"));
  $$(".badge-reco").forEach((b) => b.remove());
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
  // Backward compat: if older saved data exists, map trainingLoad to hours/intensity
  if (!intake.trainingHours || !intake.trainingIntensity) {
    const old = intake.trainingLoad;
    if (old === "high") {
      intake.trainingHours = "gt10";
      intake.trainingIntensity = "high";
    } else if (old === "moderate") {
      intake.trainingHours = "5to10";
      intake.trainingIntensity = "moderate";
    } else if (old === "low") {
      intake.trainingHours = "lt5";
      intake.trainingIntensity = "low";
    }
    if (intake.trainingHours && intake.trainingIntensity) {
      intake.trainingLoad = deriveTrainingLoad(
        intake.trainingHours,
        intake.trainingIntensity,
      );
    }
  }

  if (intake.cycleRegularity) {
    const r = form.querySelector(
      `input[name="cycleRegularity"][value="${CSS.escape(intake.cycleRegularity)}"]`,
    );
    if (r) r.checked = true;
  }

  if (intake.trainingHours) {
    const r = form.querySelector(
      `input[name="trainingHours"][value="${CSS.escape(intake.trainingHours)}"]`,
    );
    if (r) r.checked = true;
  }

  if (intake.trainingIntensity) {
    const r = form.querySelector(
      `input[name="trainingIntensity"][value="${CSS.escape(intake.trainingIntensity)}"]`,
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
}

/* --------- Init --------- */
document.addEventListener("DOMContentLoaded", () => {
  setYear();
  initRouter();
  initInternalLinks();
  initNavToggle();
  initForm();
  initTierRecommendation();
  initCheckout();
  updateTierRecommendationUI();
});
