/**
 * The error codes a save can fail with when the store refuses the write: the artifact database's and Firebase's.
 * The saved-designs store compares an error's `code` with these to say "no write access" instead of "try again".
 */
export const WRITE_DENIED_CODES: ReadonlySet<string> = new Set([
  "invalid_argument", // artifact database
  "permission-denied", // Firebase
]);
