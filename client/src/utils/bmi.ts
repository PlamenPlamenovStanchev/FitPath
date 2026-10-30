/**
 * Calculates BMI from kilograms and centimeters, rounded to one decimal place.
 * This is an informational calculation only and does not provide medical advice.
 */
export function calculateBmi(weightKg: number, heightCm: number): number {
  if (
    !Number.isFinite(weightKg) ||
    !Number.isFinite(heightCm) ||
    weightKg <= 0 ||
    heightCm <= 0
  ) {
    throw new RangeError("Weight and height must be positive, finite numbers.");
  }

  const heightMeters = heightCm / 100;
  const bmi = weightKg / (heightMeters * heightMeters);

  if (!Number.isFinite(bmi)) {
    throw new RangeError(
      "BMI could not be calculated from the supplied values.",
    );
  }

  return Math.round(bmi * 10) / 10;
}
