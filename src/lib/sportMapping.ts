// Maps Strava sport_type to FIT sport type IDs
export function mapStravaSportToFit(stravaSportType: string): number {
  const normalized = stravaSportType.toLowerCase().replace(/\s+/g, "");

  // Cycling variants
  if (
    normalized.includes("ride") ||
    normalized.includes("cycling") ||
    normalized.includes("bike") ||
    normalized.includes("gravel") ||
    normalized.includes("mountain") ||
    normalized.includes("velomobile")
  ) {
    return 2; // Cycling
  }

  // E-bike variants
  if (normalized.includes("ebike") || normalized.includes("e-bike")) {
    return 21; // E-Biking
  }

  // Running variants
  if (
    normalized.includes("run") ||
    normalized.includes("trail") ||
    normalized.includes("track")
  ) {
    return 1; // Running
  }

  // Walking/Hiking
  if (normalized.includes("walk")) {
    return 11; // Walking
  }
  if (normalized.includes("hike")) {
    return 17; // Hiking
  }

  // Swimming
  if (normalized.includes("swim")) {
    return 5; // Swimming
  }

  // Rowing
  if (normalized.includes("row") || normalized.includes("kayak") || normalized.includes("canoe")) {
    return 15; // Rowing
  }

  // Training/Workout
  if (
    normalized.includes("workout") ||
    normalized.includes("crossfit") ||
    normalized.includes("yoga") ||
    normalized.includes("gym")
  ) {
    return 10; // Training
  }

  // Default to generic
  return 0; // Other/Generic
}
