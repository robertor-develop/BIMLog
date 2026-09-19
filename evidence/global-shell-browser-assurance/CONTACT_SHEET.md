# Build 045 global-shell visual regression set

The screenshots below were generated in Chrome from the actual production `Navbar`, `MasterSidebar`, and `RouteState` components. Only authentication and route data are controlled evidence fixtures; this is not a production publication receipt.

| View | Evidence |
| --- | --- |
| Desktop dashboard, expanded navigation | [desktop-dashboard.png](desktop-dashboard.png) |
| Desktop dashboard, collapsed navigation | [desktop-collapsed.png](desktop-collapsed.png) |
| Desktop administration | [desktop-administration.png](desktop-administration.png) |
| Desktop access denied | [desktop-denied.png](desktop-denied.png) |
| Desktop service error | [desktop-error.png](desktop-error.png) |
| Exact 390px mobile dashboard | [mobile-dashboard.png](mobile-dashboard.png) |
| Exact 390px mobile navigation | [mobile-navigation.png](mobile-navigation.png) |

Automated result: `PASS` — seven screenshots, desktop `1440x800`, mobile `390x844`, no page errors, no horizontal overflow, one `h1` per state, desktop resize/collapse verified, and mobile modal/Escape/focus-restoration behavior verified.

Manual inspection also corrected three defects before this evidence was accepted: missing trigger focus restoration, mobile content covered by the navigation trigger, and the global header covering the drawer Close control. A persisted desktop-collapsed preference no longer hides labels in the mobile drawer.
