## Goal
Update the Billing tab on `/Account` to accurately reflect the user’s current plan and billing cycle, and add a robust "Download Invoice" action that produces a detailed, professional PDF invoice.

## Current State
- Billing UI exists in `app/Account/page.tsx:686–736` with placeholders:
  - Displays `billing.currentPlan`, `billing.status`, and `billing.renewalDate` loaded from Firestore `users` fields in `loadUserData` (`app/Account/page.tsx:100–141`), but does not reconcile with plan lifecycle helpers in `lib/plans.ts`.
  - "Download Invoice" button has no handler (`app/Account/page.tsx:717–723`).
- Plan policies and lifecycle helpers are in `lib/plans.ts` (e.g., `getEffectivePlanId`, `applyPlanIfTrialEnded`).
- Pricing metadata is hardcoded in `app/pricing/page.tsx:50–166` (monthly prices: Basic 19, Pro 29, Enterprise 49; yearly price = `Math.floor(monthly * 12 * 0.8)`).
- PDF generation libraries are already installed (`package.json:17–18`) and used elsewhere for reports.

## Implementation Plan
### 1) Accurate Billing Details (in `app/Account/page.tsx`)
- On load:
  - Fetch `users` doc and reconcile with `lib/plans.ts`:
    - Call `applyPlanIfTrialEnded(user.uid)` to transition out of trial when needed.
    - Determine `effectivePlanId` via `getEffectivePlanId(userData)`.
  - Read and display these normalized fields:
    - Current Plan: map `effectivePlanId` → "Free Trial", "Basic", "Pro", "Enterprise".
    - Status: `Trial` when in-trial else `Active` (or the stored `planStatus`).
    - Billing Cycle: from `users.subscriptionPeriod` (`monthly`|`yearly`; default `monthly`).
    - Renewal Date: ISO → formatted `YYYY-MM-DD` (or `N/A` when absent).
    - Next Charge: computed from plan price + cycle (see 2).
- UI updates inside the Billing card (`app/Account/page.tsx:690–706`): add display rows for Billing Cycle and Next Charge under Status/Renewal Date.

### 2) Price Source & Computation
- Avoid duplication by centralizing price constants:
  - Extend `lib/plans.ts` with `PLAN_PRICES: Record<PlanId, number>` and `getYearlyPrice(monthly: number)` mirroring pricing page logic.
- In `Account` page, use `PLAN_PRICES[effectivePlanId]` and cycle to compute:
  - Monthly: `$price`.
  - Yearly: `$Math.floor(price * 12 * 0.8)`.
  - Trial: `$0`.

### 3) "Download Invoice" – PDF Generation
- Add a click handler to the button (`app/Account/page.tsx:717–723`) and implement `generateInvoicePDF()` using `jspdf` + `jspdf-autotable`:
  - Header: company name/logo text (LinkGuard), optional support email.
  - Invoice meta: `Invoice #` (e.g., `INV-<uid>-<YYYYMMDD>`), `Issue Date`, `Billing Period` (derived from cycle & renewal date), `Status`.
  - Bill To: user full name and email (from profile state).
  - Line Items table:
    - Single item: `Subscription – <Plan Name> (<Monthly|Yearly>)`, qty `1`, unit price, line total.
    - Trial state: unit price `$0`.
  - Summary totals: Subtotal, Tax (0% unless a `NEXT_PUBLIC_TAX_RATE` env is present), Grand Total.
  - Footer: "Thank you" and support note.
- Use consistent brand colors and readable layout (autotable headings/body styles). File name: `invoice_<plan>_<YYYY-MM-DD>.pdf`.

### 4) Data Mapping & Edge Cases
- If `renewalDate` missing, set Billing Period to the last cycle length from `applyPlanIfTrialEnded` logic (30 days monthly, 365 days yearly) using today as anchor.
- If `planStatus === 'Trial'`, label the invoice as a zero-charge trial and show `$0` totals.
- If `effectivePlanId === 'free'` and not in trial, still produce a $0 invoice for record-keeping.

### 5) Verification
- Manual validation paths:
  - Login and navigate to `/Account` (route file: `app/Account/page.tsx`).
  - Confirm Current Plan, Status, Billing Cycle, Renewal Date, and Next Charge reflect Firestore values and plan helpers.
  - Click "Download Invoice" and open the generated PDF; verify all fields and formatting.
- Spot-check across states: trial vs active, monthly vs yearly, each plan tier.

### 6) Optional Config
- Support overriding seller info and tax rate via environment variables (readable client-side):
  - `NEXT_PUBLIC_COMPANY_NAME`, `NEXT_PUBLIC_COMPANY_ADDRESS`, `NEXT_PUBLIC_SUPPORT_EMAIL`, `NEXT_PUBLIC_TAX_RATE`.
  - Fallbacks used when absent to avoid blocking invoice creation.

## Deliverables
- Updated Billing card with accurate plan details and next charge.
- Working "Download Invoice" button that generates a clear, well-formatted PDF.
- Central price constants in `lib/plans.ts` to keep pricing DRY and consistent.

## Notes
- Key code references to be modified:
  - Billing UI: `app/Account/page.tsx:690–706` and button `app/Account/page.tsx:717–723`.
  - Data load: `app/Account/page.tsx:100–141` to reconcile plan details.
  - Price constants: `lib/plans.ts` (add `PLAN_PRICES` and `getYearlyPrice`).

If this plan looks good, I’ll implement the changes and wire up the invoice generation accordingly.