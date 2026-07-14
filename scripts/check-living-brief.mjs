import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const livingBriefRoot = path.join(repoRoot, "living-brief");

const requiredDocuments = [
  "AUDIT.md",
  "CLAUDE.md",
  "ECOSYSTEM_DOCTRINE.md",
  "OPEN_LOOP.md",
  "PLATFORM.md",
  "PLUGIN.md",
  "QUALITY.md",
  "REPORT_DESIGN_SYSTEM.md",
  "STANDARDS_REGISTER.md",
  "STATUS.md",
  "VISION.md",
];

const requiredClaudeReferences = [
  "ECOSYSTEM_DOCTRINE.md",
  "QUALITY.md",
  "STANDARDS_REGISTER.md",
  "STATUS.md",
  "OPEN_LOOP.md",
  "AUDIT.md",
];

const doctrineReferenceDocuments = [
  "QUALITY.md",
  "VISION.md",
  "PLUGIN.md",
  "REPORT_DESIGN_SYSTEM.md",
];

const acceptedStandardsHosts = new Set([
  "iso.org",
  "www.iso.org",
  "committee.iso.org",
  "www.committee.iso.org",
  "buildingsmart.org",
  "www.buildingsmart.org",
  "technical.buildingsmart.org",
  "www.technical.buildingsmart.org",
  "nibs.org",
  "www.nibs.org",
]);

const errors = [];
let internalLinkCount = 0;
let standardsLinkCount = 0;

function report(file, message) {
  errors.push(`${file}: ${message}`);
}

function relativeName(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join("/");
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function listFiles(root) {
  if (!fs.existsSync(root)) return [];

  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(entryPath));
    else if (entry.isFile()) files.push(entryPath);
  }
  return files;
}

function markdownDocuments() {
  return listFiles(livingBriefRoot).filter(
    (filePath) => path.extname(filePath).toLowerCase() === ".md",
  );
}

function markdownLinks(text) {
  const links = [];
  const lines = text.split(/\r?\n/);
  let fence = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (fence === marker) fence = null;
      else if (fence === null) fence = marker;
      continue;
    }
    if (fence !== null) continue;

    const pattern = /!?\[[^\]]*\]\(([^)\n]+)\)/g;
    let match;
    while ((match = pattern.exec(line)) !== null) {
      let destination = match[1].trim();
      if (destination.startsWith("<") && destination.endsWith(">")) {
        destination = destination.slice(1, -1);
      } else {
        destination = destination.split(/\s+/)[0];
      }
      links.push({ destination, line: index + 1 });
    }
  }

  return links;
}

function headingAnchors(text) {
  const anchors = new Set();
  const occurrences = new Map();
  const lines = text.split(/\r?\n/);
  let fence = null;

  for (const line of lines) {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (fence === marker) fence = null;
      else if (fence === null) fence = marker;
      continue;
    }
    if (fence !== null) continue;

    const headingMatch = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
    if (!headingMatch) continue;

    const slug = headingMatch[1]
      .replace(/<[^>]*>/g, "")
      .replace(/[`*_~]/g, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .trim()
      .replace(/\s+/g, "-");
    const priorCount = occurrences.get(slug) ?? 0;
    occurrences.set(slug, priorCount + 1);
    anchors.add(priorCount === 0 ? slug : `${slug}-${priorCount}`);
  }

  return anchors;
}

function decodeLinkPart(value, sourceFile, line) {
  try {
    return decodeURIComponent(value);
  } catch {
    report(sourceFile, `line ${line} has invalid URL encoding in link '${value}'`);
    return null;
  }
}

function validateInternalLinks(documents) {
  const anchorCache = new Map();

  for (const sourcePath of documents) {
    const sourceFile = relativeName(sourcePath);
    const text = readText(sourcePath);

    for (const { destination, line } of markdownLinks(text)) {
      if (!destination || destination.startsWith("/")) continue;
      if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(destination)) continue;

      const hashIndex = destination.indexOf("#");
      const rawPath = hashIndex >= 0 ? destination.slice(0, hashIndex) : destination;
      const rawAnchor = hashIndex >= 0 ? destination.slice(hashIndex + 1) : "";
      const pathWithoutQuery = rawPath.split("?")[0];
      const decodedPath = decodeLinkPart(pathWithoutQuery, sourceFile, line);
      if (decodedPath === null) continue;

      const targetPath = decodedPath
        ? path.resolve(path.dirname(sourcePath), decodedPath)
        : sourcePath;
      const relativeTarget = path.relative(livingBriefRoot, targetPath);
      const targetsLivingBriefMarkdown =
        path.extname(targetPath).toLowerCase() === ".md" &&
        relativeTarget !== "" &&
        relativeTarget !== ".." &&
        !relativeTarget.startsWith(`..${path.sep}`) &&
        !path.isAbsolute(relativeTarget);
      const sameDocumentAnchor = decodedPath === "" && rawAnchor !== "";

      if (!targetsLivingBriefMarkdown && !sameDocumentAnchor) continue;
      internalLinkCount += 1;

      if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()) {
        report(sourceFile, `line ${line} links to missing file '${destination}'`);
        continue;
      }

      if (!rawAnchor) continue;
      const decodedAnchor = decodeLinkPart(rawAnchor, sourceFile, line);
      if (decodedAnchor === null) continue;

      let anchors = anchorCache.get(targetPath);
      if (!anchors) {
        anchors = headingAnchors(readText(targetPath));
        anchorCache.set(targetPath, anchors);
      }
      if (!anchors.has(decodedAnchor)) {
        report(
          sourceFile,
          `line ${line} links to missing heading '#${decodedAnchor}' in ${relativeName(targetPath)}`,
        );
      }
    }
  }
}

function validateProhibitedContent(files) {
  const prohibitedPhrases = [
    "STOP. DO NOT TOUCH ANYTHING",
    "DO NOT START ANY PLAN",
  ];
  const prohibitedStandards = [/ISO\s+22092/i, /ISO\s+23455/i];

  for (const filePath of files) {
    const file = relativeName(filePath);
    const buffer = fs.readFileSync(filePath);
    if (buffer.includes(0)) continue;
    const text = buffer.toString("utf8");

    for (const phrase of prohibitedPhrases) {
      if (text.toLowerCase().includes(phrase.toLowerCase())) {
        report(file, `contains prohibited phrase '${phrase}'`);
      }
    }
    for (const pattern of prohibitedStandards) {
      if (pattern.test(file)) report(file, `path contains prohibited identifier '${file.match(pattern)[0]}'`);
      if (pattern.test(text)) report(file, `contains prohibited identifier '${text.match(pattern)[0]}'`);
    }
  }
}

function validateActiveDocument(fileName, futurePattern, description) {
  const filePath = path.join(livingBriefRoot, fileName);
  if (!fs.existsSync(filePath)) return;
  const text = readText(filePath);
  if (!/^Status:\s*Active\b/im.test(text)) {
    report(`living-brief/${fileName}`, `${description} must declare an active status`);
  }
  if (futurePattern.test(text)) {
    report(`living-brief/${fileName}`, `${description} is described as a future document`);
  }
}

function validateRequiredReferences() {
  const claudePath = path.join(livingBriefRoot, "CLAUDE.md");
  if (fs.existsSync(claudePath)) {
    const text = readText(claudePath);
    for (const reference of requiredClaudeReferences) {
      if (!text.includes(reference)) {
        report("living-brief/CLAUDE.md", `must reference ${reference}`);
      }
    }
  }

  for (const fileName of doctrineReferenceDocuments) {
    const filePath = path.join(livingBriefRoot, fileName);
    if (!fs.existsSync(filePath)) continue;
    if (!readText(filePath).includes("ECOSYSTEM_DOCTRINE.md")) {
      report(`living-brief/${fileName}`, "must reference ECOSYSTEM_DOCTRINE.md");
    }
  }
}

function validateStandardsLinks() {
  const fileName = "living-brief/STANDARDS_REGISTER.md";
  const filePath = path.join(livingBriefRoot, "STANDARDS_REGISTER.md");
  if (!fs.existsSync(filePath)) return;
  const text = readText(filePath);
  const urlPattern = /\b[a-zA-Z][a-zA-Z\d+.-]*:\/\/[^\s<>"')\]]+/g;
  const urls = text.match(urlPattern) ?? [];

  for (const value of urls) {
    let url;
    try {
      url = new URL(value);
    } catch {
      report(fileName, `contains invalid external URL '${value}'`);
      continue;
    }

    standardsLinkCount += 1;
    if (url.protocol !== "https:") {
      report(fileName, `external URL must use HTTPS: ${value}`);
    }
    const host = url.hostname.toLowerCase();
    if (!acceptedStandardsHosts.has(host)) {
      report(fileName, `external URL uses unapproved domain '${host}': ${value}`);
    }
  }

  for (const { destination, line } of markdownLinks(text)) {
    if (/^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(destination)) continue;
    if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(destination)) {
      report(fileName, `line ${line} external link must use HTTPS: ${destination}`);
      continue;
    }
    if (
      !destination.startsWith("#") &&
      !destination.startsWith("./") &&
      !destination.startsWith("../") &&
      !destination.split(/[?#]/)[0].toLowerCase().endsWith(".md")
    ) {
      report(fileName, `line ${line} link must be a relative Markdown file or HTTPS URL: ${destination}`);
    }
  }
}

if (!fs.existsSync(livingBriefRoot) || !fs.statSync(livingBriefRoot).isDirectory()) {
  console.error("Living Brief integrity check failed:");
  console.error("living-brief: required directory is missing");
  process.exit(1);
}

for (const fileName of requiredDocuments) {
  const filePath = path.join(livingBriefRoot, fileName);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    report(`living-brief/${fileName}`, "required document is missing");
  }
}

const documents = markdownDocuments();
const allLivingBriefFiles = listFiles(livingBriefRoot);

validateInternalLinks(documents);
validateProhibitedContent(allLivingBriefFiles);
validateActiveDocument(
  "ECOSYSTEM_DOCTRINE.md",
  /ECOSYSTEM_DOCTRINE\.md[^\r\n]{0,120}\bwill be (?:added|created)\b/i,
  "ecosystem doctrine",
);
validateActiveDocument(
  "STANDARDS_REGISTER.md",
  /STANDARDS_REGISTER\.md[^\r\n]{0,120}\bwill be (?:added|created)\b/i,
  "standards register",
);
validateRequiredReferences();
validateStandardsLinks();

if (errors.length > 0) {
  console.error(`Living Brief integrity check failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Living Brief integrity check passed: ${requiredDocuments.length} required documents, ` +
    `${internalLinkCount} internal links, ${standardsLinkCount} standards links.`,
);
