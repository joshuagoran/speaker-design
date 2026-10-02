/** The entry with this id, or `undefined`. For ids from user input or a saved config, where "not found" is a real answer. */
export const byId = <T extends { id: string }>(table: readonly T[], id: string): T | undefined =>
  table.find((o) => o.id === id);

/** The entry with this id; throws when it is missing. For ids that come from the tables themselves (`what` names the table in the message). */
export const byIdOrThrow = <T extends { id: string }>(
  table: readonly T[],
  id: string,
  what: string,
): T => {
  const entry = byId(table, id);
  if (!entry) throw new Error(`${what}: no entry with id "${id}"`);
  return entry;
};
