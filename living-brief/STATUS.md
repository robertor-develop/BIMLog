# STATUS.md — Current Build State

Updated manually after each feature ships. Reflects the real state of the platform.

## Last updated
- 2026-06-14

## What works
- Core platform: auth (JWT), projects, project members/roles, admin panel, super admin.
- Coordination modules: RFIs, submittals, transmittals, change orders, meeting minutes,
  schedule, clash reports (with Navisworks plugin sync), lens viewpoints, files/documents,
  naming conventions, directory, reports, dashboard briefing, intelligence, agents.
- Lens viewpoints list: manual refresh banner (10s polling was removed).
- Living Brief system: four docs in `/living-brief`, served via `/api/v1/living-brief/*`,
  password gate (default BIMAI360, stored hashed), eligibility (super admin or granted),
  F5 intercept to open the brief for eligible admins, super-admin password/access controls.
- PLATFORM.md auto-regenerates on every api-server build.

## What is broken / known issues
- None currently tracked. Add entries here as they are found.

## What is next
- Expand the agent system toward the 5-layer architecture described in VISION.md.
- Wire department-head and CEO-level briefings to the three audiences.

## What Ruben needs
- Reliable, current project coordination intelligence in the field.

## Active bugs
- None currently tracked.
