# B056-B060 publication identity repair

Replit publication `adb53e67` reached Live at P37. The 62-route authenticated desktop smoke, focused mobile/tablet Intake, Operations, APU and Lens Next checks, reload continuity, two-tab authentication, and zero-error console check passed.

The public health endpoint correctly prevented false acceptance by reporting source `2cd9134cfbbec43d1105f74e43997a093e36dc70`, not canonical candidate `05e4998f528c79a79079592e28f5b0c29d0faf1b`. GitHub first-parent history showed five consecutive `Published your App` commits, all with tree `0581d476c286125002ea3cab48f52c61f508fb98`, followed by the canonical candidate with the same tree.

Repair commit `c6104220fc8e18dad04192c931652a9ad75a7fc0` changes production assembly to apply the existing bounded chain verifier to local `HEAD` history before resolving source identity. It rejects invalid commits, changed wrapper trees and chains without a canonical non-wrapper. Focused behavior, TypeScript and deterministic production assembly pass. Full gate, push, republication and repeated live smoke remain required.
