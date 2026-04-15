export const FLAVOR_TEXT_ENABLED = false;

const TEXT_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bvi\*+\w*/gi, "voi ei"],
  [/\bvi+ttu+\b/gi, "voi ei"],
  [/\bperkele\b/gi, "voi ei"],
  [/\bsaatana\b/gi, "voi ei"],
  [/\bpaska\b/gi, "voi ei"],
  [/\bdoping[a-z]*\b/gi, "teho"],
  [/\bhemofarm\b/gi, "huoltoauto"],
  [/\bepo\b/gi, "varuste"],
  [/\bkuolema\b/gi, "loppu"],
  [/\bköyhi[a-z]*\b/gi, "hiihtäjiä"],
  [/\bsomalia-suomi-snow\b/gi, "talvilatu forever"],
  [/\bintegraatio\b/gi, "yhteispeli"],
  [/\s{2,}/g, " "]
];

export const sanitizePlayerFacingText = (value: string): string => {
  let out = String(value || "");
  for (const [pattern, replacement] of TEXT_REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  return out.trim();
};
