
import twemoji from "twemoji";

/**
 * Map meaningful categories/entities to their most logical emoji (Unicode).
 * Same key list as before, but now with more precise Twemoji-mappable choices.
 */
const entityToEmoji: Record<string, string> = {
  // Life aspects
  "Mental Health": "1F9E0", // 🧠 Brain
  "Romantic Relationships": "2764", // ❤️ Heart
  "Family": "1F46A", // 👪 Family
  "Money & Finance": "1F4B0", // 💰 Money Bag
  "Self & Identity": "1F464", // 👤 Bust in Silhouette
  "Friendships & Social Circle": "1F465", // 👥 Multiple Busts
  "Sleep & Rest": "1F6CC", // 🛌 Person in Bed
  "Education & Learning": "1F4DA", // 📚 Books
  "Celebration & Achievement": "1F389", // 🎉 Party Popper
  "Health & Wellness": "1FA7A", // 🩺 Stethoscope
  "Career & Workplace": "1F4BC", // 💼 Briefcase
  "Body & Health": "1F3CB", // 🏋️ Person Lifting Weights
  
  // Common categories
  "family": "1F46A", // 👪 Family
  "work": "1F4BC", // 💼 Briefcase
  "friends": "1F91D", // 🤝 Handshake
  "travel": "1F30D", // 🌍 Globe (Europe-Africa)
  "music": "1F3B5", // 🎵 Musical Note
  "school": "1F393", // 🎓 Graduation Cap
  "health": "1FA7A", // 🩺 Stethoscope
  "sports": "26BD", // ⚽ Soccer Ball
  "love": "2764", // ❤️ Heart
  "pet": "1F431", // 🐱 Cat Face (general pet)
  "dog": "1F436", // 🐶 Dog Face
  "cat": "1F431", // 🐱 Cat Face
  "money": "1F4B0", // 💰 Money Bag
  "food": "1F37D", // 🍽️ Fork and Knife with Plate
  "art": "1F3A8", // 🎨 Artist Palette
  "book": "1F4DA", // 📚 Books
  "movie": "1F3AC", // 🎬 Clapper Board
  "game": "1F3AE", // 🎮 Video Game
  "shopping": "1F6CD", // 🛍️ Shopping Bags
  "technology": "1F4BB", // 💻 Laptop
  "nature": "1F33F", // 🌿 Herb (nature leaf)
  "weather": "2601", // ☁️ Cloud
  "fitness": "1F3CB", // 🏋️ Weight Lifter
  "cooking": "1F373", // 🍳 Cooking
  "reading": "1F4D6", // 📖 Open Book
  "writing": "270D", // ✍️ Writing Hand
  "photography": "1F4F7", // 📷 Camera
  "dancing": "1F483", // 💃 Dancer
  "singing": "1F3A4", // 🎤 Microphone
  "playing": "1F3AF", // 🎯 Direct Hit
  
  // fallback:
  "default": "1F464", // 👤 Bust in silhouette
};

/**
 * Given an entity/category, return the best unicode string, falling back if needed.
 */
function getTwemojiUnicodeForEntity(entity: string): string {
  // First try exact match
  if (entityToEmoji[entity]) {
    return entityToEmoji[entity];
  }

  // Then try normalized match
  const normalized = (entity || "").replace(/_/g, " ").toLowerCase();
  
  // Try matching part of the entity name with our keys
  for (const key of Object.keys(entityToEmoji)) {
    if (normalized.includes(key.toLowerCase())) {
      return entityToEmoji[key];
    }
  }

  return entityToEmoji["default"];
}

/**
 * Produces a Twemoji CDN image URL for a given Unicode sequence
 */
function getTwemojiUrlFromUnicode(unicode: string) {
  // Format the unicode value for the CDN URL
  const formatted = unicode.toLowerCase();
  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${formatted}.svg`;
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
