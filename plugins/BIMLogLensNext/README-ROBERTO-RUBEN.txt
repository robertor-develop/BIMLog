BIMLog Lens Next for Navisworks Manage 2025
Release: v1.05.N09-P03

THIS IS THE RUBEN 2025 FIELD-TEST PACKAGE.

INSTALL
1. Extract the entire ZIP to one folder.
2. Close every Navisworks window.
3. Double-click INSTALL-BIMLOG-LENS-NEXT-2025.bat.
4. Approve the Windows administrator prompt.
5. Keep the result window open and confirm INSTALL COMPLETED.
6. Start Navisworks Manage 2025 and open BIMLog Lens Next.

IMPORTANT
- This installs BIMLogLensNext2025.bundle only.
- It does not delete, replace, or modify Original BIMLog Lens.
- Do not copy individual DLL files by hand.
- Do not run the 2021 package in Navisworks 2025.
- Internet access and an authorized BIMLog account are required.

UNINSTALL / ROLLBACK
Close Navisworks, then run UNINSTALL-BIMLOG-LENS-NEXT-2025.bat.
The uninstall is recoverable: it renames the installed bundle instead of deleting it.

PACKAGE VERIFICATION
The ZIP is accompanied by a .sha256 file. The installer validates every packaged
file against manifest.json before it writes to Autodesk's plugin directory.

TEST STATUS
Automated core and Navisworks 2025 adapter tests passed during packaging.
Real Navisworks Manage 2025 field acceptance by Ruben is still required.
