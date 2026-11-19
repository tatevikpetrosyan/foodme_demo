---
paths:
  - "apps/web/**"
---

# Storefront conventions

- Every API call goes through `src/api/foodme.ts`. No direct `fetch` in components.
- Keep `src/types` in sync with the backend DTOs.
- Server state goes in TanStack Query, not `useState` + `useEffect` fetching.
- Put form validation in a zod schema in `src/schemas`.
- Import from `src` with the `@/` alias.
- User-facing text goes in `src/locales/en/translation.json` via i18next. Nothing hardcoded.
- Reuse `src/components/ui` primitives before adding new ones. Page-specific blocks go in `components/sections`.
- Do not add `data-testid` attributes. Playwright specs in `e2e/` select by role, label and text.
- Before finishing: `npm run lint` (oxlint) and `npm run build` (`tsc -b && vite build`) from `apps/web`.
