/* Anchor for You — prototype logic
   - simple hash-based router
   - intake form -> rules engine -> renders results cards
   - stores last results in localStorage
*/

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const STORAGE_KEY = "anchorforyou_intake_v1";

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
  $("#year").textContent = y;
}

/* ---------------- Router ---------------- */
function showView(hash) {
  const id = (hash || "#home").replace("#", "");
  const views = $$(".view");
  views.forEach((v) => v.classList.remove("view-active"));
  const target = document.getElementById(id) || document.getElementById("home");
  target.classList.add("view-active");

  // If user lands on results, render from storage if available
  if (id === "results") {
    const saved = loadSaved();
    if (saved?.results) renderResults(saved.results, saved.intake);
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function initRouter() {
  window.addEventListener("hashchange", () => showView(location.hash));
  showView(location.hash || "#home");
}

/* ---------------- Mobile nav ---------------- */
function initNavToggle() {
  const btn = $(".nav-toggle");
  const nav = $(".nav");
  if (!btn || !nav) return;

  btn.addEventListener("click", () => {
    const expanded = btn.getAttribute("aria-expanded") === "true";
    btn.setAttribute("aria-expanded", String(!expanded));
    nav.style.display = expanded ? "none" : "flex";
    nav.style.flexDirection = "column";
    nav.style.position = "absolute";
    nav.style.right = "18px";
    nav.style.top = "66px";
    nav.style.padding = "10px";
    nav.style.background = "rgba(255,255,255,.92)";
    nav.style.border = "1px solid var(--line)";
    nav.style.borderRadius = "18px";
    nav.style.boxShadow = "var(--shadow)";
  });

  // Close menu after clicking a link
  $$(".nav a").forEach((a) =>
    a.addEventListener("click", () => {
      if (window.innerWidth <= 720) {
        $(".nav").style.display = "none";
        btn.setAttribute("aria-expanded", "false");
      }
    }),
  );
}

/* ---------------- Intake + rules engine ---------------- */
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

function buildStack(intake) {
  // Base foundation (conservative prototype)
  const base = [SUPP.magnesium, SUPP.omega3, SUPP.vitd, SUPP.zinc];

  // Pack 1: "Cycle & Performance"
  const pack1 = new Map();
  base.forEach((x) => pack1.set(x.name, x));
  // Pack 2: "Recovery & Immune"
  const pack2 = new Map();
  base.forEach((x) => pack2.set(x.name, x));

  const why1 = [];
  const why2 = [];

  // Training load
  if (intake.trainingLoad === "high") {
    pack2.set(SUPP.electrolytes.name, SUPP.electrolytes);
    why2.push(
      "High training load → add hydration/recovery support (electrolytes).",
    );
  } else if (intake.trainingLoad === "moderate") {
    why2.push("Moderate load → keep recovery foundation consistent.");
  } else {
    why2.push("Lower load → keep a lighter foundation stack.");
  }

  // Phase
  if (intake.phase === "luteal") {
    pack1.set(SUPP.magnesium.name, SUPP.magnesium);
    pack1.set(SUPP.bcomplex.name, SUPP.bcomplex);
    why1.push(
      "Luteal phase → emphasize magnesium + B-vitamin support (conservative).",
    );
  }
  if (intake.phase === "follicular") {
    why1.push(
      "Follicular phase → prioritize consistent foundation and energy support as needed.",
    );
  }

  // Symptoms
  const s = new Set(intake.symptoms);

  if (s.has("fatigue")) {
    pack1.set(SUPP.bcomplex.name, SUPP.bcomplex);
    pack1.set(SUPP.iron.name, SUPP.iron);
    why1.push("Fatigue selected → consider lab-guided iron + B-vitamins.");
  }

  if (s.has("heavy-bleeding")) {
    pack1.set(SUPP.iron.name, SUPP.iron);
    pack1.set(SUPP.vitc.name, SUPP.vitc);
    why1.push(
      "Heavy bleeding selected → flag iron for clinician review; pair with vitamin C in some plans.",
    );
  }

  if (s.has("cramps")) {
    pack1.set(SUPP.magnesium.name, SUPP.magnesium);
    pack1.set(SUPP.ginger.name, SUPP.ginger);
    why1.push(
      "Cramps selected → magnesium + ginger are common conservative additions.",
    );
  }

  if (s.has("poor-sleep")) {
    pack2.set(SUPP.magnesium.name, SUPP.magnesium);
    pack2.set(SUPP.ltheanine.name, SUPP.ltheanine);
    why2.push(
      "Poor sleep selected → consider a gentle wind-down add-on (variable response).",
    );
  }

  if (s.has("headaches")) {
    pack2.set(SUPP.riboflavin.name, SUPP.riboflavin);
    why2.push(
      "Headaches selected → riboflavin is a common conservative option in some routines.",
    );
  }

  if (s.has("bloating")) {
    pack2.set(SUPP.probiotic.name, SUPP.probiotic);
    why2.push(
      "Bloating selected → some athletes trial probiotics for GI support.",
    );
  }

  if (s.has("brain-fog")) {
    pack1.set(SUPP.omega3.name, SUPP.omega3);
    pack1.set(SUPP.bcomplex.name, SUPP.bcomplex);
    why1.push(
      "Brain fog selected → omega-3 + B-vitamins are common conservative inclusions.",
    );
  }

  if (s.has("mood-swings")) {
    pack1.set(SUPP.omega3.name, SUPP.omega3);
    pack1.set(SUPP.bcomplex.name, SUPP.bcomplex);
    why1.push(
      "Mood swings selected → omega-3 + B-vitamins are common conservative inclusions.",
    );
  }

  // If cycle irregular or on birth control, flag clinician review
  const flags = [];
  if (intake.cycleRegularity === "irregular")
    flags.push(
      "Irregular cycles: consider screening for contributing factors with a clinician.",
    );
  if (intake.cycleRegularity === "birth-control")
    flags.push(
      "Hormonal birth control: review interactions/contraindications for any add-ons.",
    );

  // Turn maps into arrays
  const pack1Arr = [...pack1.values()];
  const pack2Arr = [...pack2.values()];

  // Ensure pack1 has at least 4 items
  while (pack1Arr.length < 4) pack1Arr.push(SUPP.omega3);
  while (pack2Arr.length < 4) pack2Arr.push(SUPP.omega3);

  return {
    summary: buildSummary(intake),
    packs: [
      {
        title: "Anchor Pack 1",
        subtitle: "Cycle + performance support (draft)",
        items: pack1Arr,
        why: uniqueNonEmpty(why1),
      },
      {
        title: "Anchor Pack 2",
        subtitle: "Recovery + immune support (draft)",
        items: pack2Arr,
        why: uniqueNonEmpty(why2),
      },
    ],
    flags,
  };
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

function titleCase(s) {
  if (!s) return "";
  return s[0].toUpperCase() + s.slice(1);
}

function uniqueNonEmpty(arr) {
  return [...new Set(arr.filter(Boolean))];
}

/* ---------------- Rendering ---------------- */
function pillSVG() {
  return `
  <svg width="74" height="52" viewBox="0 0 74 52" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="6" y="8" width="44" height="18" rx="9" fill="#ffffff" stroke="#ead2d2"/>
    <rect x="24" y="22" width="44" height="18" rx="9" fill="#ffd7dd" stroke="#ead2d2"/>
    <circle cx="18" cy="38" r="8" fill="#bfe9ff" stroke="#ead2d2"/>
    <circle cx="44" cy="14" r="7" fill="#f5f0ff" stroke="#ead2d2"/>
  </svg>`;
}

function renderResults(results, intake) {
  $("#resultsSummary").textContent = results.summary;

  const grid = $("#resultsGrid");
  grid.innerHTML = "";

  results.packs.forEach((pack) => {
    const card = document.createElement("article");
    card.className = "card stack-card";

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

  const note = $("#safetyNote");
  note.hidden = false;

  // If flags exist, append to safety note
  if (results.flags?.length) {
    note.innerHTML = `
      <p><strong>Safety note:</strong> ${results.flags.map(escapeHTML).join(" ")}</p>
      <p><strong>Prototype reminder:</strong> No diagnoses or prescriptions are provided here; a clinician must review.</p>
    `;
  } else {
    note.innerHTML = `
      <p><strong>Safety note:</strong> Recommendations are conservative and must be reviewed for interactions,
      conditions, and lab values (especially iron/vitamin D).</p>
      <p><strong>Prototype reminder:</strong> No diagnoses or prescriptions are provided here; a clinician must review.</p>
    `;
  }
}

function escapeHTML(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ---------------- Storage ---------------- */
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

/* ---------------- Form wiring ---------------- */
function initForm() {
  const form = $("#intakeForm");
  const clearBtn = $("#clearFormBtn");
  if (!form) return;

  // Restore prior intake (optional)
  const saved = loadSaved();
  if (saved?.intake) hydrateForm(form, saved.intake);

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const intake = getFormData(form);
    const results = buildStack(intake);

    save(intake, results);
    renderResults(results, intake);

    location.hash = "#results";
  });

  clearBtn?.addEventListener("click", () => {
    form.reset();
    localStorage.removeItem(STORAGE_KEY);
  });

  // Plan selection buttons
  $$("[data-plan]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const plan = btn.getAttribute("data-plan");
      alert(
        `Prototype: selected "${plan}".\nIn production, this would proceed to checkout (Stripe) + account creation.`,
      );
    });
  });
}

function hydrateForm(form, intake) {
  // Radios
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

  // Select
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

  // Date/notes
  const lmp = form.querySelector(`input[name="lmp"]`);
  if (lmp && intake.lmp) lmp.value = intake.lmp;

  const notes = form.querySelector(`textarea[name="notes"]`);
  if (notes && intake.notes) notes.value = intake.notes;

  // Symptoms
  if (Array.isArray(intake.symptoms)) {
    intake.symptoms.forEach((v) => {
      const cb = form.querySelector(
        `input[name="symptoms"][value="${CSS.escape(v)}"]`,
      );
      if (cb) cb.checked = true;
    });
  }
}

/* ---------------- Init ---------------- */
setYear();
initRouter();
initNavToggle();
initForm();
