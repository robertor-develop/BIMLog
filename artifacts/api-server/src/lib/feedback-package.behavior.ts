import assert from "node:assert/strict";
import AdmZip from "adm-zip";
import fs from "node:fs";
import { buildFeedbackPackage, FeedbackPackageError } from "./feedback-package";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
const crypto = await import("node:crypto"); const hash = crypto.createHash("sha256").update(png).digest("hex");
const feedback = { id: 7, stableId: "FB-TEST", feedbackType: "bug", priority: "high", module: "RFI", pageUrl: "/projects/4/rfis", message: "The button does not save.", status: "triaged", version: 2, targetRelease: "next", dispositionReason: "Investigating", customerVisible: true, createdAt: new Date("2026-08-18T12:00:00Z"), updatedAt: new Date("2026-08-18T13:00:00Z"), resolvedAt: null, submitter: { id: 9, name: "Customer", email: "customer@example.test" }, project: { id: 4, name: "Tower", code: "T-1" } };
const events = [{ id: 1, eventType: "created", beforeState: null, afterState: { status: "new" }, reason: null, createdAt: feedback.createdAt }, { id: 2, eventType: "internal_note", beforeState: null, afterState: { secret: "internal" }, reason: "do not expose", createdAt: feedback.updatedAt }];
const asset = { id: 3, kind: "screenshot", safeName: "screen.png", mediaType: "image/png", byteSize: png.length, sha256: hash, scanState: "clean", scannedAt: feedback.createdAt, createdAt: feedback.createdAt, bytes: png };
const built = await buildFeedbackPackage({ feedback, events, assets: [asset], visibility: "customer", baseUrl: "https://bimlog.test" });
const zip = new AdmZip(built.archive); assert.deepEqual(zip.getEntries().map(entry => entry.entryName).sort(), ["FB-TEST-feedback.pdf", "evidence/000003-screen.png", "manifest.json"]);
const manifest = JSON.parse(built.manifest.toString("utf8")); assert.equal(manifest.release, "v1.60.35.09-F"); assert.equal(manifest.feedback.submitter.email, null); assert.equal(manifest.history.length, 1); assert.equal(manifest.evidence[0].secureDownloadUrl, "https://bimlog.test/api/v1/feedback/7/assets/3/download"); assert.match(built.pdf.toString("latin1"), /^%PDF-/);
await assert.rejects(() => buildFeedbackPackage({ feedback, events, assets: [{ ...asset, sha256: "0".repeat(64) }], visibility: "internal", baseUrl: "https://bimlog.test" }), (error: unknown) => error instanceof FeedbackPackageError && error.code === "PACKAGE_INTEGRITY");
const route = fs.readFileSync(new URL("../routes/feedback.ts", import.meta.url), "utf8");
assert.match(route, /captureBundleId.*\["original", "marked"\]/s); assert.match(route, /consumed\.length===1.*feedbackId===id.*captureRole\)!==captureRole/s); assert.match(route, /FEEDBACK_CAPTURE_BUNDLE_CONSUMED/); assert.match(route, /captureBundleId: screenshotBundle \? captureBundleId : null/); assert.match(route, /packageSource\(id, "customer", user\)/); assert.match(route, /feedback\/admin\/:id\/assets\/:assetId\/download/);
assert.match(route, /feedback\/admin\/follow-up\.csv/); assert.match(route, /LEFT JOIN LATERAL.*feedback_audit_events/s); assert.match(route, /feedback-follow-up-v1\.60\.35\.09-F\.csv/); assert.match(route, /FEEDBACK_PACKAGE_MAX_EVENTS \+ 1/);
console.log(JSON.stringify({ status: "PASS", tests: ["canonical-manifest", "human-pdf", "embedded-image", "zip-evidence", "customer-redaction", "secure-link", "fail-closed-integrity", "atomic-two-role-capture-bundle", "customer-authority-recheck", "internal-secure-download"] }));
