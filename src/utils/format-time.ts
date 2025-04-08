
/**
 * Formats a time in milliseconds or seconds to a string in the format "MM:SS"
 * @param time - The time to format, in milliseconds or seconds
 * @param inSeconds - Whether the time is already in seconds
 * @returns A string in the format "MM:SS"
 */
export function formatTime(time: number, inSeconds = true): string {
  // If time is already in seconds, use it directly, otherwise convert from ms
  const totalSeconds = inSeconds ? time : Math.floor(time / 1000);
  
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const formattedMinutes = String(minutes).padStart(2, "0");
  const formattedSeconds = String(seconds).padStart(2, "0");

  return `${formattedMinutes}:${formattedSeconds}`;
}
