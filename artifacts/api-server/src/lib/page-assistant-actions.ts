export type AssistantAction = "explain" | "locate" | "missing";

const words = (value: string) => value.toLocaleLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").match(/[a-z0-9]{3,}/g) || [];

export function classifyAssistantAction(question: string): AssistantAction {
  if (/\b(where|show me|donde|muestrame|ubica)\b/i.test(question.normalize("NFD").replace(/\p{Diacritic}/gu, ""))) return "locate";
  if (/\b(missing|required|falta|obligatori|pendiente)\b/i.test(question)) return "missing";
  return "explain";
}

export function locateVisibleControl(question: string, controls: string[], focusedControl: string | null): string | null {
  const query = new Set(words(question).filter(word => !["where", "show", "donde", "muestrame", "control"].includes(word)));
  const ranked = controls.map(label => ({ label, score: words(label).filter(word => query.has(word)).length })).sort((a, b) => b.score - a.score);
  if (ranked[0]?.score > 0) return ranked[0].label;
  // A generic “show me the next control” must not inherit an arbitrary focused
  // optional field. Return no match unless the question names the control.
  return null;
}
