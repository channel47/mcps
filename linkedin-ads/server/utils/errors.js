function createTypedError(code, message) {
  const error = new Error(message);
  error.mcpCode = code;
  return error;
}

/**
 * Create an InvalidParams typed error.
 */
export function invalidParamsError(message) {
  return createTypedError('InvalidParams', message);
}
