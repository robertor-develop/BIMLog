# Build 193 — Pulse preservation and Original Lens retirement

The shared installer now preserves the existing direct-load tree in hash-bound rollback evidence, installs the verified Pulse-only bundle and Lens Next bundle, removes the retired direct-load Original Lens directory, and fails if that directory survives cutover.

The canonical staging script now includes the Pulse DLL and PDB. This closes a package defect where the source stage could contain only the Pulse manifest. Both years prove the accepted active topology and Original Lens absence in isolated upgrade simulations.

The currently installed 2021 direct-load directory was not changed in this source block. Its remediation remains a real installed-environment action, not a reason to falsify package acceptance.
