# BIMLog stabilization program control

Program: `BIMLog stabilization, completion, and release program — 120 builds`  
Branch: `codex/bimlog-stabilization-program-20260919`  
Authoritative base: `07d024ef3de739abb436da58fe29797af5304b8a`  
Remote: `https://github.com/robertor-develop/BIMLog.git`  
Canonical remote branch: `master`

This directory carries the durable execution ledger and report templates for
the 120-build stabilization program. The baseline evidence subdirectory
preserves the exact Build 001-004 reports and the machine-readable defect/risk
ledger used to establish this branch.

Release cadence:

- complete one bounded build at a time;
- push every five builds;
- publish every ten builds at the named milestone;
- run full authenticated visible-Chrome smoke after each publication;
- run focused Navisworks smoke whenever a block changes Lens Next Native or
  installers;
- never accumulate more than ten unpublished builds; and
- stop only for an actual failed test or production defect, fix it, and repeat
  the affected gates before continuing.

The program branch is not itself production. Provider publication remains the
proven BIMLog GitHub → Replit Shell → Replit Publish → authenticated Chrome
route. Replit Agents are prohibited.

