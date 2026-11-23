export const FEATURE_FLAG_KEY_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

export function normalizeFeatureFlagKey(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidFeatureFlagKey(value: string): boolean {
  const key = normalizeFeatureFlagKey(value);
  return key.length >= 3 && key.length <= 120 && FEATURE_FLAG_KEY_PATTERN.test(key);
}
