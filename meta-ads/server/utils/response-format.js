let SdkMcpError = null;
let SdkErrorCode = null;

try {
  const sdkTypes = await import('@modelcontextprotocol/sdk/types.js');
  SdkMcpError = sdkTypes.McpError;
  SdkErrorCode = sdkTypes.ErrorCode;
} catch {
  // SDK may be absent in minimal test environments.
}

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

export function formatError(error) {
  const message = error?.message || String(error) || 'Unknown error';

  if (message.includes('required') || message.includes('Invalid')) {
    throw createMcpStyleError('InvalidParams', message);
  }

  if (message.includes('Unauthorized') || message.includes('access token') || message.includes('access_token')) {
    throw createMcpStyleError('InvalidParams', message);
  }

  throw createMcpStyleError('InternalError', message);
}
