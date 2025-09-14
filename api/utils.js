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
 * Creates axios instance configured for Notion API
 */
export function createNotionClient() {
  validateNotionConfig();
  
  return axios.create({
    baseURL: NOTION_BASE_URL,
    headers: {
      'Authorization': `Bearer ${NOTION_API_KEY}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json'
    },
    timeout: 30000 // 30 second timeout
  });
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

/**
 * Safe wrapper for Notion API requests with enhanced error handling
 * Handles HTML responses and provides consistent error formatting
 */
export async function safeNotionRequest(notionClient, method, endpoint, data = null) {
  try {
    let response;
    
    switch (method.toLowerCase()) {
      case 'get':
        response = await notionClient.get(endpoint);
        break;
      case 'post':
        response = await notionClient.post(endpoint, data);
        break;
      case 'put':
        response = await notionClient.put(endpoint, data);
        break;
      case 'delete':
        response = await notionClient.delete(endpoint);
        break;
      default:
        throw new Error(`Unsupported HTTP method: ${method}`);
    }
    
    return response;
    
  } catch (error) {
    // Check if the response is HTML instead of JSON
    if (error.response && error.response.data) {
      const responseData = error.response.data;
      
      // Detect HTML responses (API gateway/proxy errors)
      if (typeof responseData === 'string' && responseData.includes('<!DOCTYPE')) {
        const htmlError = new Error('Received HTML error page instead of JSON response. This may indicate API gateway issues or incorrect endpoint configuration.');
        htmlError.isHtmlResponse = true;
        htmlError.response = error.response;
        throw htmlError;
      }
    }
    
    // Re-throw the original error for normal API error handling
    throw error;
  }
}