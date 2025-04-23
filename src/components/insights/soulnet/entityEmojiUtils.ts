
/**
 * Utility functions for mapping entity (category) names to appropriate OpenMoji unicode, and retrieving SVGs.
 * Uses the openmoji package.
 */
import { openmojis } from "openmoji";

/**
 * Basic mapping of common categories to OpenMoji unicode codes.
 * Add more mappings as you want to support more categories/entities!
 */
const entityToEmoji: Record<string, string> = {
  family: "1F46A", // 👪
  work: "1F4BC", // 💼
  friends: "1F91D", // 🤝
  travel: "1F30D", // 🌍
  music: "1F3B5", // 🎵
  school: "1F393", // 🎓
  health: "1F489", // 💉
  sports: "26BD", // ⚽
  love: "2764", // ❤️
  pet: "1F436", // 🐶
  dog: "1F436", // 🐶
  cat: "1F431", // 🐱
  money: "1F4B0", // 💰
  food: "1F37D", // 🍽️
  art: "1F3A8", // 🎨
  // fallback:
  default: "1F464", // 👤
};

export function getOpenMojiUnicodeForEntity(entity: string) {
  const normalized = (entity || "").replace(/_/g, " ").toLowerCase();
  for (const key of Object.keys(entityToEmoji)) {
    if (normalized.includes(key)) {
      return entityToEmoji[key];
    }
  }
  return entityToEmoji["default"];
}

/**
 * Returns SVG markup (string) for a given OpenMoji unicode.
 * @param unicode eg "1F4B0" (uppercase, no prefix)
 */
export function getOpenMojiSvg(unicode: string) {
  const match = openmojis.find((om) => om.hexcode === unicode);
  return match ? match.svg : undefined;
}
