export const DISPLAY_NAME_MIN_LENGTH = 1;
export const DISPLAY_NAME_MAX_LENGTH = 80;

export class DisplayNameValidationError extends Error {
  constructor() { super("INVALID_DISPLAY_NAME"); }
}

export function normalizeDisplayName(value: unknown) {
  if (
    typeof value !== "string"
    || value !== value.trim()
    || value.length < DISPLAY_NAME_MIN_LENGTH
    || value.length > DISPLAY_NAME_MAX_LENGTH
    || /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new DisplayNameValidationError();
  }
  return value;
}
