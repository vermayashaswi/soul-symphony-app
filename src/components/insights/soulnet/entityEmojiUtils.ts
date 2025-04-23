
import twemoji from "twemoji";

/**
 * Map meaningful categories/entities to their most logical emoji (Unicode).
 * Same key list as before, but now with more precise Twemoji-mappable choices.
 */
const entityToEmoji: Record<string, string> = {
  family: "1F46A", // 👪 Family
  work: "1F4BC", // 💼 Briefcase
  friends: "1F91D", // 🤝 Handshake
  travel: "1F30D", // 🌍 Globe (Europe-Africa)
  music: "1F3B5", // 🎵 Musical Note
  school: "1F393", // 🎓 Graduation Cap
  health: "1FA7A", // 🩺 Stethoscope
  sports: "26BD", // ⚽ Soccer Ball
  love: "2764", // ❤️ Heart
  pet: "1F431", // 🐱 Cat Face (general pet)
  dog: "1F436", // 🐶 Dog Face
  cat: "1F431", // 🐱 Cat Face
  money: "1F4B0", // 💰 Money Bag
  food: "1F37D", // 🍽️ Fork and Knife with Plate
  art: "1F3A8", // 🎨 Artist Palette
  book: "1F4DA", // 📚 Books
  movie: "1F3AC", // 🎬 Clapper Board
  game: "1F3AE", // 🎮 Video Game
  shopping: "1F6CD", // 🛍️ Shopping Bags
  technology: "1F4BB", // 💻 Laptop
  nature: "1F33F", // 🌿 Herb (nature leaf)
  weather: "2601", // ☁️ Cloud
  fitness: "1F3CB", // 🏋️ Weight Lifter
  cooking: "1F468-200D-1F373", // 👨‍🍳 Man Cook (good fallback)
  reading: "1F4D6", // 📖 Open Book
  writing: "270D", // ✍️ Writing Hand
  photography: "1F4F7", // 📷 Camera
  dancing: "1F483", // 💃 Dancer
  singing: "1F3A4", // 🎤 Microphone
  playing: "1F3AF", // 🎯 Direct Hit
  // fallback:
  default: "1F464", // 👤 Bust in silhouette
};

/**
 * Given an entity/category, return the best unicode string, falling back if needed.
 */
function getTwemojiUnicodeForEntity(entity: string): string {
  const normalized = (entity || "").replace(/_/g, " ").toLowerCase();
  for (const key of Object.keys(entityToEmoji)) {
    if (normalized.includes(key)) return entityToEmoji[key];
  }
  return entityToEmoji["default"];
}

/**
 * Produces a Twemoji CDN image URL for a give Unicode sequence ("1F436" etc).
 * Twemoji uses dash-case lower, no "U+".
 */
function getTwemojiUrlFromUnicode(unicode: string) {
  // Twemoji expects lower-case, dash-separated code points, e.g. "1f436" or for ZWJ sequences "1f468-200d-1f373"
  const formatted = unicode.toLowerCase();
  return `https://cdn.jsdelivr.net/npm/twemoji@14.0.2/2/svg/${formatted}.svg`;
}

/**
 * Main utility to get Twemoji image URL for an entity label.
 */
export function getTwemojiUrlForEntity(entity: string): string {
  const unicode = getTwemojiUnicodeForEntity(entity);
  return getTwemojiUrlFromUnicode(unicode);
}

/**
 * Return best-fitting native emoji (as string) for fallback/plain use.
 */
export function getEmojiCharForEntity(entity: string): string {
  const unicode = getTwemojiUnicodeForEntity(entity);
  // Use Twemoji parse to get native emoji
  return twemoji.convert.fromCodePoint(unicode.replace(/-/g, " "));
}
