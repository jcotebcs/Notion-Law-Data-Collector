import axios from 'axios';

// Load environment variables
const NOTION_VERSION = '2022-06-28';
const NOTION_BASE_URL = 'https://api.notion.com/v1';

/**
 * Get current API key from environment
 */
function getNotionApiKey() {
  return process.env.NOTION_API_KEY;
}

/**
 * Validates that the Notion API key is configured
 */
export function validateNotionConfig() {
  const NOTION_API_KEY = getNotionApiKey();
  
  if (!NOTION_API_KEY) {
    throw new Error('NOTION_API_KEY environment variable is not configured');
  }
  
  // Validate API key format (should start with 'secret_')
  if (!NOTION_API_KEY.startsWith('secret_')) {
    throw new Error('Invalid NOTION_API_KEY format. Key should start with "secret_"');
  }
}

/**
 * Enhanced error handler for detecting HTML responses
 */
function createErrorHandler() {
  return (error) => {
    // Log the full error for debugging
    console.error('Notion API Error Details:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      headers: error.response?.headers,
      responseType: typeof error.response?.data,
      responsePreview: typeof error.response?.data === 'string' 
        ? error.response.data.substring(0, 200) + '...'
        : error.response?.data
    });

    // Check if we received HTML instead of JSON
    if (error.response?.data && typeof error.response.data === 'string') {
      const responseText = error.response.data.toLowerCase();
      if (responseText.includes('<!doctype') || responseText.includes('<html')) {
        const enhancedError = new Error('Received HTML response instead of JSON from Notion API. This usually indicates an authentication issue, wrong endpoint, or rate limiting.');
        enhancedError.originalError = error;
        enhancedError.response = error.response;
        enhancedError.isHtmlResponse = true;
        throw enhancedError;
      }
    }

    // Check for common Notion API errors
    if (error.response?.status === 401) {
      const authError = new Error('Authentication failed. Please check your NOTION_API_KEY.');
      authError.originalError = error;
      authError.response = error.response;
      throw authError;
    }

    if (error.response?.status === 404) {
      const notFoundError = new Error('Database not found or integration lacks access. Please verify the database ID and ensure your integration has access to the database.');
      notFoundError.originalError = error;
      notFoundError.response = error.response;
      throw notFoundError;
    }

    if (error.response?.status === 429) {
      const rateLimitError = new Error('Rate limit exceeded. Please wait before making more requests.');
      rateLimitError.originalError = error;
      rateLimitError.response = error.response;
      throw rateLimitError;
    }

    // Re-throw the original error if no specific handling
    throw error;
  };
}

/**
 * Creates axios instance configured for Notion API with enhanced error handling
 */
export function createNotionClient() {
  validateNotionConfig();
  
  const NOTION_API_KEY = getNotionApiKey();
  
  const client = axios.create({
    baseURL: NOTION_BASE_URL,
    headers: {
      'Authorization': `Bearer ${NOTION_API_KEY}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
      'User-Agent': 'Notion-Law-Data-Collector/1.0.0'
    },
    timeout: 30000, // 30 second timeout
    validateStatus: (status) => {
      // Accept all status codes to handle them manually
      return status < 500; // Only reject network errors, not HTTP errors
    }
  });

  // Add request interceptor for logging
  client.interceptors.request.use(
    (config) => {
      console.log('Notion API Request:', {
        method: config.method?.toUpperCase(),
        url: config.url,
        baseURL: config.baseURL,
        headers: {
          ...config.headers,
          'Authorization': config.headers.Authorization ? '[REDACTED]' : undefined
        }
      });
      return config;
    },
    (error) => {
      console.error('Request setup error:', error);
      return Promise.reject(error);
    }
  );

  // Add response interceptor for logging and error handling
  client.interceptors.response.use(
    (response) => {
      console.log('Notion API Response:', {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers['content-type'],
        dataType: typeof response.data
      });
      return response;
    },
    createErrorHandler()
  );

  return client;
}

/**
 * Sets CORS headers for the response
 */
export function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

/**
 * Handles preflight OPTIONS requests
 */
export function handlePreflight(req, res) {
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    res.status(204).end();
    return true;
  }
  return false;
}

/**
 * Validates required fields in request body
 */
export function validateRequired(body, fields) {
  const missing = fields.filter(field => !body[field]);
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
}

/**
 * Standardized error response with enhanced debugging
 */
export function sendError(res, error, statusCode = 500) {
  console.error('API Error:', {
    message: error.message,
    stack: error.stack,
    originalError: error.originalError?.message,
    statusCode,
    timestamp: new Date().toISOString()
  });
  
  setCorsHeaders(res);
  
  // Create response object with debugging info
  const response = {
    error: true,
    message: error.message || 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
    statusCode
  };

  // Add debugging information in development
  if (process.env.NODE_ENV === 'development') {
    response.debug = {
      stack: error.stack,
      originalError: error.originalError?.message,
      isHtmlResponse: error.isHtmlResponse || false
    };
  }

  // Add troubleshooting tips for common errors
  if (error.message.includes('HTML instead of JSON')) {
    response.troubleshooting = [
      'Verify your NOTION_API_KEY is correct and starts with "secret_"',
      'Ensure the database ID is exactly 32 hexadecimal characters',
      'Check that your integration has access to the database',
      'Verify the database exists and is not deleted'
    ];
  } else if (error.message.includes('Authentication failed')) {
    response.troubleshooting = [
      'Check that NOTION_API_KEY environment variable is set',
      'Verify the API key starts with "secret_"',
      'Ensure the integration is active and not expired',
      'Confirm the API key has not been regenerated'
    ];
  } else if (error.message.includes('Database not found')) {
    response.troubleshooting = [
      'Verify the database ID is correct (32 characters)',
      'Ensure the database is shared with your integration',
      'Check that the database exists and is accessible',
      'Confirm your integration has read permissions'
    ];
  }

  res.status(statusCode).json(response);
}

/**
 * Standardized success response
 */
export function sendSuccess(res, data, statusCode = 200) {
  setCorsHeaders(res);
  res.status(statusCode).json({
    error: false,
    data
  });
}