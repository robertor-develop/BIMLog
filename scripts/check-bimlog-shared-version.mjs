import { readFile } from "node:fs/promises";

const versionFile = new URL("../bimlog-shared-version.json", import.meta.url);
const state = JSON.parse(await readFile(versionFile, "utf8"));
const pattern = /^v1\.05\.N(\d{2})-P(\d{2})$/;
const match = pattern.exec(state.version);

if (!match) throw new Error(`Invalid BIMLog shared version: ${state.version}`);
if (state.lensNextCounterOwner !== "BIMLog MAIN 04 / Lens Next") throw new Error("N counter owner is invalid");
if (state.platformCounterOwner !== "MAIN 00 / Platform, Job Intake and APU") throw new Error("P counter owner is invalid");

if (state.adoption === "FIRST_SHARED_FORMAT_ADOPTION") {
  if (state.version !== "v1.05.N01-P01") {
    throw new Error("First shared-format adoption must be v1.05.N01-P01");
  }
  if (!state.legacySourceVersion || pattern.test(state.legacySourceVersion)) {
    throw new Error("First adoption must record a legacy source version without deriving counters from it");
  }
}

const previous = process.env.BIMLOG_PREVIOUS_SHARED_VERSION;
const owner = process.env.BIMLOG_VERSION_OWNER;
if (previous || owner) {
  if (!previous || !owner) throw new Error("Set both BIMLOG_PREVIOUS_SHARED_VERSION and BIMLOG_VERSION_OWNER");
  const prior = pattern.exec(previous);
  if (!prior) throw new Error(`Invalid previous shared version: ${previous}`);
  const [, previousN, previousP] = prior;
  const [, currentN, currentP] = match;
  if (owner === "N") {
    if (currentP !== previousP || Number(currentN) !== Number(previousN) + 1) {
      throw new Error("Lens Next must increment only N and preserve P");
    }
  } else if (owner === "P") {
    if (currentN !== previousN || Number(currentP) !== Number(previousP) + 1) {
      throw new Error("Platform/APU must increment only P and preserve N");
    }
  } else {
    throw new Error("BIMLOG_VERSION_OWNER must be N or P");
  }
}

console.log(`BIMLog shared version gate PASS: ${state.version}`);
