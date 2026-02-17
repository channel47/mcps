import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

/**
 * Format successful tool response
 * @param {Object} options
 * @param {string} options.summary - Human-readable summary
 * @param {Array} options.data - Result data
 * @param {Object} [options.metadata] - Additional metadata
 * @returns {Object} MCP-formatted response
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
          rowCount: data.length,
          warnings: [],
          ...metadata
        }
      }, null, 2)
    }]
  };
}

/**
 * Format and throw error as MCP error
 * @param {Error} error - Original error
 * @throws {McpError} Always throws
 */
export function formatError(error) {
  // Extract error message - handle various error object structures
  let message = '';

  if (typeof error === 'string') {
    message = error;
  } else if (error?.message) {
    message = error.message;
  } else if (error?.details && typeof error.details === 'string') {
    message = error.details;
  } else if (error?.failures && Array.isArray(error.failures)) {
    // Google Ads API error structure: extract failure messages
    const failures = error.failures.map(f => {
      if (typeof f === 'string') return f;
      if (f?.message) return f.message;
      if (f?.error_message) return f.error_message;
      if (f?.errors) {
        return f.errors.map(e => e?.message || e?.error_message || JSON.stringify(e)).join('; ');
      }
      return JSON.stringify(f);
    }).filter(Boolean).join('; ');
    message = failures || 'Google Ads API error (see failures array)';
  } else if (error?.errors && Array.isArray(error.errors)) {
    // Alternative Google Ads error structure
    const errors = error.errors.map(e => {
      if (typeof e === 'string') return e;
      if (e?.message) return e.message;
      if (e?.error_message) return e.error_message;
      return JSON.stringify(e);
    }).filter(Boolean).join('; ');
    message = errors || 'Google Ads API error (see errors array)';
  } else if (error?.toString && typeof error.toString === 'function') {
    // Try toString() method
    const str = error.toString();
    if (str && str !== '[object Object]') {
      message = str;
    }
  }

  // If still no message, try to serialize the error object
  if (!message) {
    try {
      const errorProps = Object.getOwnPropertyNames(error);
      const errorObj = {};
      errorProps.forEach(prop => {
        try {
          // Handle circular references and complex objects
          const value = error[prop];
          if (value !== null && typeof value === 'object') {
            if (Array.isArray(value)) {
              errorObj[prop] = value.map(v =>
                typeof v === 'object' ? JSON.stringify(v) : v
              );
            } else {
              errorObj[prop] = JSON.stringify(value);
            }
          } else {
            errorObj[prop] = value;
          }
        } catch (propError) {
          errorObj[prop] = `[Could not serialize: ${propError.message}]`;
        }
      });
      const serialized = JSON.stringify(errorObj, null, 2);
      if (serialized && serialized !== '{}') {
        message = serialized;
      }
    } catch (e) {
      // Serialization failed, continue with empty message
    }
  }

  // If message is still empty, use a fallback
  if (!message || message === '{}' || message === '[object Object]') {
    message = `Unknown error type: ${error?.constructor?.name || typeof error} - check server logs for details`;
  }

  // Map to appropriate MCP error codes
  if (message.includes('required') || message.includes('Invalid')) {
    throw new McpError(ErrorCode.InvalidParams, message);
  }

  if (message.includes('RATE_LIMIT') || message.includes('quota')) {
    throw new McpError(
      ErrorCode.InternalError,
      'Google Ads API rate limit exceeded. Please try again in a few moments.'
    );
  }

  if (message.includes('AUTHENTICATION') || message.includes('credentials') || message.includes('auth')) {
    throw new McpError(
      ErrorCode.InternalError,
      'Authentication failed. Please check your Google Ads credentials.'
    );
  }

  // Generic error - include all available details
  const errorName = error?.name && error.name !== 'Error' ? `${error.name}: ` : '';
  const errorCode = error?.code ? ` (code: ${error.code})` : '';

  throw new McpError(
    ErrorCode.InternalError,
    `${errorName}${message}${errorCode}`
  );
}
