# Anchor for You ⚓
anchorforyou.com
A cycle-aware micronutrient decision engine for female athletes — delivered as a single-page website that generates a phase-aligned supplement plan based on cycle timing, weekly training **hours + intensity**, and symptoms.

---

## What this site does
**Anchor for You** is a lightweight SPA (single-page application) that:
- Collects intake inputs (cycle regularity, sport, training hours, intensity, phase, symptoms)
- Generates two outputs:
  1) **Phase-Aligned Dosage Plan** (phase-specific micronutrient ranges)
  2) **Targeted Adjustments** (symptom/risk-driven protocols and notes)
- Recommends a subscription tier based on training demand and symptom burden
- Connects plan selection buttons to **Stripe Payment Links** for checkout

---

## Pages / Tabs
The navigation is hash-based (no scrolling between sections):
- **Home**
- **Supplement Info**
- **Packaging**
- **Get Started**
- **Results**
- **Subscription**
- **Credits**

---

## Tech Stack
- **HTML / CSS / Vanilla JS**
- Hash-based SPA router (`#home`, `#get-started`, etc.)
- Local storage persistence:
  - Key: `anchorforyou_intake_v1`
  - Stores latest intake + generated results

No frameworks, no build step.

---

## File Overview
### `index.html`
- SPA layout + section views
- Intake form (Get Started)
- Results container
- Subscription cards and Credits

### `style.css`
- Luxury rose theme styling
- Responsive grid layout
- Plan cards equal height (buttons pinned)
- Result skeleton loader + animations
- `.dose` class styles dosage text in bold pink

### `app.js`
Core logic:
- Router: swaps visible section based on hash
- Intake parsing and rules engine for recommendations
- Results rendering (dosages and rationales)
- Tier recommendation + plan highlight UI
- Stripe checkout wiring via Payment Links

---

## Stripe Payment Links
Plan buttons route to Stripe checkout links defined in `app.js`:

```js
const STRIPE_PAYMENT_LINKS = {
  core: "https://buy.stripe.com/test_bJe8wPfTtgI08vw1weaMU04",
  performance: "https://buy.stripe.com/test_5kQ00jdLlfDW7rsej0aMU03",
  elite: "https://buy.stripe.com/test_eVq8wP4aL8bu7rsfn4aMU05",
};
