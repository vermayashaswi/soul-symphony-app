
/**
 * Utility functions for mapping entity (category) names to appropriate emoji characters.
 * This implementation avoids using the openmoji package which has Node.js dependencies.
 */

/**
 * Basic mapping of common categories to emoji unicode characters
 */
const entityToEmoji: Record<string, string> = {
  family: "👪", // family
  work: "💼", // briefcase
  friends: "🤝", // handshake
  travel: "🌍", // globe
  music: "🎵", // musical note
  school: "🎓", // graduation cap
  health: "🩺", // stethoscope
  sports: "⚽", // soccer ball
  love: "❤️", // heart
  pet: "🐾", // paw prints
  dog: "🐶", // dog
  cat: "🐱", // cat
  money: "💰", // money bag
  food: "🍽️", // plate with cutlery
  art: "🎨", // artist palette
  book: "📚", // books
  movie: "🎬", // clapper board
  game: "🎮", // video game
  shopping: "🛍️", // shopping bags
  technology: "💻", // laptop
  nature: "🌿", // leaf
  weather: "☁️", // cloud
  fitness: "🏋️", // weight lifter
  cooking: "👨‍🍳", // cook
  reading: "📖", // book
  writing: "✍️", // writing hand
  photography: "📷", // camera
  dancing: "💃", // dancer
  singing: "🎤", // microphone
  playing: "🎯", // direct hit
  // fallback:
  default: "👤", // bust in silhouette
};

/**
 * Gets the emoji for a given entity name by checking if any key in our mapping
 * is contained within the entity string.
 */
export function getEmojiForEntity(entity: string): string {
  const normalized = (entity || "").replace(/_/g, " ").toLowerCase();
  for (const key of Object.keys(entityToEmoji)) {
    if (normalized.includes(key)) {
      return entityToEmoji[key];
    }
  }
  return entityToEmoji["default"];
}
