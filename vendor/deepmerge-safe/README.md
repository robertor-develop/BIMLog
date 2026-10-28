# BIMLog deepmerge security backport

This package preserves the public CommonJS behavior of upstream `deepmerge` 4.3.1 while rejecting the prototype-control keys `__proto__`, `constructor`, and `prototype` at every object merge boundary. It is used only through the root pnpm override for the SendGrid helper dependency.

The backport exists because the 2026 advisory `GHSA-gcqx-w48m-w2h4` identifies upstream releases through 4.3.1 as affected while the public registry has no 4.3.2 release. The package keeps a non-upstream version suffix and must not be represented as an upstream release.
