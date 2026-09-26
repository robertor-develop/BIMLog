# I010 bounded role-presentation repair — not block acceptance

Baseline 90519d084c4db7fdd436f46a012f687ae32f8b2e. Production remains 42d06df0566d37e73cf5edd65f94b002c6f74357 until separately verified publication.

Team presentation now uses configured member-role identities for filters, labels, pending invitations and the role editor. Legacy memberships remain searchable and visible, without offering inactive/unconfigured roles for new assignments. The guide describes configured roles rather than asserting unverified permissions. Failed edits keep the last persisted role visible. Project-admin transfer restrictions and all server authorization remain unchanged.

API and frontend typechecks pass. Real isolated invitation transaction tests and pure role-option assertions pass. Actual TeamTab Chrome fixture proves deduplication, English/Spanish labels, historical-role filtering and rejected-save preservation. Browser error/warning log empty. Screenshot capture times out: visual acceptance is not claimed. Fixture and detailed evidence are under F:/BIMLog/TestProof/identity-i010-role-ui-progress-20260926.md.

Full final-commit release test is still required. No native/installer change. This repair does not close I010: nine-project company-scope confirmation, approved sender configuration, actual recipient acceptance and full authenticated multi-role smoke remain open. No customer acceptance or production correction is inferred from local tests.
