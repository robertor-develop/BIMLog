// Only explicitly quoted, individually labelled historical lines are exempt.
// A historical heading must not hide subsequent current instructions.
export function executionContinuityProblems(text) {
  const active = text.split(/\r?\n/).filter((line) =>
    !/^> Historical\/superseded: /i.test(line)).join("\n").replace(/\s+/g, " ");
  const rules = [
    ["magic authorization phrase", /must (?:contain|say|include) the exact (?:words|phrase).*?I am asking you directly/i],
    ["repeat approval for recoverable failure", /(?:recoverable|repairable) (?:build|provider|browser|tool) failure[^.!]{0,120}(?:requires?|needs?|must obtain) (?:fresh|new|repeat(?:ed)?) (?:approval|authorization)/i],
    ["terminal recoverable failure", /(?:recoverable|repairable) (?:build|provider|browser|tool) failure[^.!]{0,100}(?:is|means|must be treated as) (?:a )?terminal (?:blocker|hold)/i],
  ];
  return rules.filter(([, pattern]) => pattern.test(active)).map(([name]) => name);
}

export function testExecutionContinuityPolicy() {
  const rejected = [
    "A release must contain the exact words I am asking you directly.",
    "A recoverable build failure requires new approval.",
    "A repairable provider failure needs fresh authorization.",
    "A recoverable browser failure is a terminal blocker.",
    "A repairable tool failure must be treated as a terminal hold.",
  ];
  for (const value of rejected) {
    if (!executionContinuityProblems(value).length) throw new Error("Continuity negative fixture accepted");
    if (executionContinuityProblems(`> Historical/superseded: ${value}`).length) throw new Error("Labelled historical quote rejected");
    if (!executionContinuityProblems(`## Historical/superseded\n${value}`).length) throw new Error("Historical heading hid active instruction");
    if (!executionContinuityProblems(`> Historical/superseded: prior evidence\n${value}`).length) throw new Error("Historical quote hid following instruction");
  }
  for (const value of [
    "Recoverable build failures require diagnosis, repair and retest, then continuation.",
    "New destructive out-of-scope actions require fresh authorization.",
    "Missing MFA requires user presence. Never bypass permissions or security restrictions.",
  ]) if (executionContinuityProblems(value).length) throw new Error("Legitimate boundary rejected");
  return 23;
}
