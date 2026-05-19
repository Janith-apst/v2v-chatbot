export type Intent =
  | { type: "stop" }
  | { type: "cancel" }
  | { type: "repeat" }
  | { type: "help" }
  | { type: "speakSlower" }
  | { type: "speakFaster" }
  | { type: "whatCanISay" }
  | { type: "nearMe" }

const PATTERNS: Array<[RegExp, Intent]> = [
  // Multi-word phrases first so "stop talking" wins over "stop".
  [/\b(stop\s+(?:talking|speaking)|be\s+quiet|silence)\b/, { type: "stop" }],
  [/\b(cancel(?:\s+that)?|never\s*mind|forget\s+it)\b/, { type: "cancel" }],
  [/\b(repeat\s+that|repeat\s+(?:the\s+)?last|say\s+(?:that|it)\s+again|repeat)\b/, { type: "repeat" }],
  [/\b(speak\s+slower|slow\s+down|talk\s+slower)\b/, { type: "speakSlower" }],
  [/\b(speak\s+faster|speed\s+up|talk\s+faster)\b/, { type: "speakFaster" }],
  [/\b(what\s+can\s+i\s+say|list\s+commands?|show\s+commands?)\b/, { type: "whatCanISay" }],
  // "Nearest/closest/near me/around here" — covers the common phrasings for
  // proximity queries on the venue dataset.
  [/\b(near(?:est)?\s+(?:me|here|by|to\s+me)|closest(?:\s+to\s+me)?|around\s+(?:me|here))\b/, { type: "nearMe" }],
  [/\b(help)\b/, { type: "help" }],
  [/\b(stop)\b/, { type: "stop" }],
]

export function parse(input: string): Intent | null {
  if (!input) return null
  const text = input.toLowerCase().trim()
  if (!text) return null
  for (const [pattern, intent] of PATTERNS) {
    if (pattern.test(text)) return intent
  }
  return null
}
