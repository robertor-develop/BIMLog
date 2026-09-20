# Build 074 - Verified Lens Next upgrade installer

The dual-year installer now performs a preserve-first upgrade:

- verifies every packaged file before mutation;
- stores hash-verified rollback evidence outside the Autodesk load root;
- retires `BIMLog.bundle`, the previous same-year Lens Next bundle, and stale same-year staging/rollback bundles from the load root;
- installs exactly one `BIMLogLensNext<year>.bundle`;
- validates the Autodesk manifest, native DLL, and exact Navisworks series after cutover;
- restores preserved bundles if cutover fails; and
- supports an H-root simulation that exercises first-install and repeated-upgrade behavior without touching the live Autodesk directory.

The package manifest now declares that Original Lens is not preserved as a loadable product. Its bytes remain available only in hash-verified external rollback evidence.
