---
name: Lens Viewpoints report design
description: Monochrome formal-statement design rules for the Lens Viewpoints PDF and how it differs from the clash-detection PDF
---

The Lens Viewpoints PDF report (clash_reports.ts, route POST .../lens-viewpoints/report) must look like a formal engineering/financial statement: dark navy section-header bars only, white content, light-grey alternating rows, black text. NO priority/status colors (render as plain text), monochrome health score (navy number, no green/yellow/red).

**Why:** User explicitly rejected the colorful badge/heatmap style; reference is a financial statement.

**How to apply:** Use the `sectionBar()` helper + `NAVY` const. Health-score metrics with a zero denominator are EXCLUDED from the average (null) and shown as "n/a", never counted as 100%.

There are TWO separate report PDFs in clash_reports.ts. The Lens report is ~724-1157. The clash-detection report PDF (~1338+, with preview block ~1411-1505 using report.p1Count + LP color maps) is a DIFFERENT report and is intentionally still colored. Do not change it when working on Lens design.
