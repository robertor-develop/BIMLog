# UX Less-Is-More Build 17 consolidated acceptance

## Frozen source under test

- Build 16 evidence HEAD: `cfed1bc35a58f1af84f3da7155d8e81aae1eb152`
- Build 13 implementation: `c0e66b12dee4a25bbbda19f55ff07f74a906d5d2`
- Build 14 implementation: `29b78cc80f1ebefc6638982c8dac0c5a49aed776`
- Build 15 implementation: `d4cb585186aa782c21a16ed337a9a6ff6238a920`
- Build 16 implementation: `933f6e178cfb426b3f27d0e343bf673ef5b935f7`

## Passing evidence

- Focused contracts: 85/85 PASS across workspace width, application route splitting, project-workspace route splitting, core accessibility, responsive accessibility, persistent sidebar behavior, homepage truth, public product truth, and Build 16 metadata/payload behavior.
- Frontend TypeScript: PASS.
- Exact 390x844 browser matrix: 12/12 routes have the primary main target, skip link, zero unlabeled buttons, and no horizontal overflow.
- Desktop 1440x900 browser matrix: 12/12 routes have the same four properties.
- Public route metadata: Home, Features, Pricing, About, and Contact expose the expected unique titles, descriptions, canonical URLs, and Open Graph titles.
- Homepage workflow interaction: `See the product workflow` opens the real Features route.
- Build output: `ProjectDetail` remains 14.90 KB; `SubmittalsTab` remains 164.16 KB; the unchanged XLSX parser remains isolated as a 499.55 KB on-demand chunk; no greater-than-500 KB warning is emitted.
- Local Chrome performance trace, unthrottled: LCP 734 ms; CLS 0.00. Field Core Web Vitals are unavailable for localhost, so these are lab measurements only.
- Lighthouse mobile: Best Practices 100; SEO 100.

## Failed gate

- Lighthouse mobile Accessibility: 96, therefore consolidated Build 17 acceptance is FAIL.
- Contrast failures: two primary-on-tinted homepage badges measure 4.32:1; six decorative step numbers at 0.4 opacity measure 1.76:1; the red validation-example heading measures 3.63:1; two red field labels on tinted backgrounds measure 3.41:1.
- Agentic Browsing 67 is reported separately and is not a Build 17 product acceptance criterion; its only failed audit is the optional `llms.txt` recommendation.

## Boundary and next action

No product source, business workflow, permission, Native behavior, database, schema, version, push, publication, deployment, or production state changed in Build 17. The narrow next action is a homepage contrast correction followed by the same Lighthouse and responsive matrix. Builds 13–16 remain local accepted candidates; the group is not ready for integration or publication until the accessibility gate passes.
