/**
 * Create an error with an MCP classification hint.
 */
export function createTypedError(code, message) {
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

/**
 * Create an InternalError typed error.
 */
export function internalError(message) {
  return createTypedError('InternalError', message);
}
