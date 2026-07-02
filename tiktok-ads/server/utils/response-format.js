let SdkMcpError = null;
let SdkErrorCode = null;

try {
  const sdkTypes = await import('@modelcontextprotocol/sdk/types.js');
  SdkMcpError = sdkTypes.McpError;
  SdkErrorCode = sdkTypes.ErrorCode;
} catch {
  // SDK may be absent in minimal test environments.
}

/**
 * Format a successful tool result payload in MCP text content structure.
 * @param {{ summary: string, data: any, metadata?: Record<string, unknown> }} payload
 * @returns {import('@modelcontextprotocol/sdk/types.js').CallToolResult}
 */
export function formatSuccess({ summary, data, metadata = {} }) {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        success: true,
        summary,
        data,
        metadata: {
          rowCount: Array.isArray(data) ? data.length : undefined,
          warnings: [],
          ...metadata
        }
      }, null, 2)
    }]
  };
}

function createMcpStyleError(code, message) {
  if (SdkMcpError && SdkErrorCode && SdkErrorCode[code]) {
    return new SdkMcpError(SdkErrorCode[code], message);
  }

  const error = new Error(message);
  error.code = code;
  return error;
}

/**
 * Convert thrown errors into MCP-compatible typed errors.
 * @param {unknown} error
 * @throws {Error}
 */
export function formatError(error) {
  const message = error?.message || String(error) || 'Unknown error';
  const explicitCode = error?.mcpCode === 'InvalidParams' || error?.code === 'InvalidParams'
    ? 'InvalidParams'
    : error?.mcpCode === 'InternalError' || error?.code === 'InternalError'
      ? 'InternalError'
      : null;

  if (explicitCode) {
    throw createMcpStyleError(explicitCode, message);
  }

  throw createMcpStyleError('InternalError', message);
}
