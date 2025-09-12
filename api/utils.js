import axios from 'axios';

// Load environment variables
const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_VERSION = '2022-06-28';
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