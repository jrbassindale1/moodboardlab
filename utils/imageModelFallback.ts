export const IMAGE_MODEL_FALLBACK_WARNING =
  'We are still early in this. We had to fall back to a less capable AI image model because of usage restrictions. Check back tomorrow if you are not happy with the results.';

const toRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;

const asBoolean = (value: unknown): boolean =>
  value === true || value === 'true' || value === 1 || value === '1';

export const isImageModelFallbackUsed = (response: unknown): boolean => {
  const root = toRecord(response);
  if (!root) return false;
  const meta = toRecord(root.meta);

  return (
    asBoolean(root.imageFallbackUsed) ||
    asBoolean(root.image_fallback_used) ||
    asBoolean(root.fallbackUsed) ||
    asBoolean(meta?.imageFallbackUsed) ||
    asBoolean(meta?.image_fallback_used) ||
    asBoolean(meta?.fallbackUsed)
  );
};
