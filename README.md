# Anchor for You
Link: anchorforyou.com

Anchor for You is a static, client-side website that generates a cycle-phase aligned supplement plan for female athletes using intake inputs (cycle regularity, training volume, phase, and symptoms). The experience is built as a no-scroll single-page app (SPA) with hash routing and local storage persistence.

## What’s Included

- **No-scroll SPA navigation** via hash routes  
  `#home` · `#supplements` · `#get-started` · `#results` · `#plans` · `#credits`
- **Intake form** that captures:
  - Cycle regularity
  - Primary sport
  - Training load (low / moderate / high)
  - Current phase (menstrual / follicular / ovulatory / luteal / unsure)
  - Symptoms (multi-select)
- **Rules engine** that generates two packs:
  - **Phase-Aligned Plan** (cycle-phase coverage)
  - **Training and Symptom Adjustments** (training + symptom add-ons)
- **Results UI** with skeleton loader + top progress bar
- **localStorage save/restore** of intake + results
- **Tier recommendation** shown in the Plans tab (Core / Performance / Elite)
- **Stripe Payment Links checkout** (works on GitHub Pages without a backend)

## Project Structure

/
├─ index.html
├─ style.css
└─ app.js


## How It Works

### Intake → Results
1. User submits the Get Started form.
2. `buildStack(intake)` generates a plan using:
   - A foundation baseline
   - Phase-aligned adjustments
   - Training volume logic
   - Symptom-specific add-ons
3. Results render into the Results view as two cards with rationale.

### Persistence
The site stores the most recent intake + results so users can return without re-entering everything.

- **localStorage key:** `anchorforyou_intake_v1`

## Subscription Tiers

The Plans tab displays three tiers:

- **Anchor Core** — $7.99/mo  
  Recreational / <5 hrs/week · basic tracking · phase-aligned foundation stack
- **Anchor Performance** — $12.99/mo  
  Competitive / 5–10 hrs/week · expanded micronutrient support · smarter adjusted dosing
- **Anchor Elite** — $19.99/mo  
  Elite / >10 hrs/week · advanced personalization · higher-frequency adjustments · platform integrations

### Tier Recommendation
The site recommends a tier based on:
- **Training load**
- **Symptom count** (higher symptom burden can shift recommendation upward)

## Stripe Checkout (GitHub Pages Compatible)

This project uses **Stripe Payment Links** (redirect checkout), which requires no backend.

In `app.js`, ensure your links are set:

```js
const STRIPE_PAYMENT_LINKS = {
  core: "https://buy.stripe.com/...",
  performance: "https://buy.stripe.com/...",
  elite: "https://buy.stripe.com/...",
};
