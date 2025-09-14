import axios from 'axios';

// Load environment variables
const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_VERSION = '2025-09-03';
const NOTION_BASE_URL = 'https://api.notion.com/v1';

/**
 * Validates that the Notion API key is configured
 */
export function validateNotionConfig() {
  if (!NOTION_API_KEY) {
    throw new Error('NOTION_API_KEY environment variable is not configured');
  }
}

/**
 * Checks if response content appears to be HTML instead of JSON
 */
export function isHtmlResponse(data, headers) {
  // Check content-type header first
  const contentType = headers?.['content-type'] || '';
  if (contentType.toLowerCase().includes('text/html')) {
    return true;
  }
  
  // Check if response data contains HTML tags
  if (typeof data === 'string') {
    const htmlIndicators = ['<html', '<head', '<body', '<!doctype', '<!DOCTYPE'];
    const lowerData = data.toLowerCase();
    return htmlIndicators.some(indicator => lowerData.includes(indicator));
  }
  
  return false;
}

/**
 * Creates helpful error message when HTML is received instead of JSON
 */
export function createHtmlErrorMessage(data, status) {
  let message = 'Notion API returned HTML instead of JSON';
  
  if (status === 401) {
    message += ' - this usually indicates an authentication error. Please verify your Notion API key is correct.';
  } else if (status === 404) {
    message += ' - this usually indicates an incorrect endpoint or the resource was not found.';
  } else if (status >= 500) {
    message += ' - this indicates a server error on Notion\'s side.';
  }
  
  // Try to extract title from HTML for additional context
  if (typeof data === 'string') {
    const titleMatch = data.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      message += ` Server response: "${titleMatch[1].trim()}"`;
    }
  }
  
  return message;
}

/**
 * Creates axios instance configured for Notion API
 */
export function createNotionClient() {
  validateNotionConfig();
  
  const client = axios.create({
    baseURL: NOTION_BASE_URL,
    headers: {
      'Authorization': `Bearer ${NOTION_API_KEY}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
      'Accept': 'application/json' // Explicitly request JSON
    },
    timeout: 30000, // 30 second timeout
    validateStatus: function (status) {
      // Don't throw for any status code, we'll handle errors ourselves
      return true;
    }
  });
  
  // Add response interceptor to handle HTML responses
  client.interceptors.response.use(
    (response) => {
      // Check if we received HTML when expecting JSON
      if (isHtmlResponse(response.data, response.headers)) {
        const error = new Error(createHtmlErrorMessage(response.data, response.status));
        error.response = response;
        error.isHtmlResponse = true;
        throw error;
      }
      
      // For successful responses, ensure we have JSON
      if (response.status >= 200 && response.status < 300) {
        return response;
      }
      
      // For error responses, throw an error
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
      error.response = response;
      throw error;
    },
    (error) => {
      // Handle network errors and other axios errors
      if (error.response && isHtmlResponse(error.response.data, error.response.headers)) {
        error.message = createHtmlErrorMessage(error.response.data, error.response.status);
        error.isHtmlResponse = true;
      }
      throw error;
    }
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
 * Standardized error response
 */
export function sendError(res, error, statusCode = 500) {
  console.error('API Error:', error);
  
  setCorsHeaders(res);
  res.status(statusCode).json({
    error: true,
    message: error.message || 'An unexpected error occurred',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
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