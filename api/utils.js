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
 * Safe Notion API request handler that manages data source logic for 2025-09-03 API
 * @param {Object} notion - Notion client instance
 * @param {string} method - HTTP method ('get', 'post', 'put', 'delete')
 * @param {string} endpoint - API endpoint (e.g., '/databases/{id}/query')
 * @param {Object} data - Request data for POST/PUT requests
 * @returns {Promise<Object>} - Axios response object
 */
export async function safeNotionRequest(notion, method, endpoint, data = null) {
  // Check if this is a database query operation that needs data source handling
  const isDatabaseQuery = endpoint.includes('/databases/') && endpoint.includes('/query');
  
  if (isDatabaseQuery) {
    // Extract database ID from endpoint
    const dbIdMatch = endpoint.match(/\/databases\/([^\/]+)\/query/);
    if (!dbIdMatch) {
      throw new Error('Invalid database query endpoint format');
    }
    
    const databaseId = dbIdMatch[1];
    
    // First, fetch the database to get data_source_id (required for 2025-09-03 API)
    const dbResponse = await notion.get(`/databases/${databaseId}`);
    const data_sources = dbResponse.data.data_sources;
    
    if (!data_sources || data_sources.length === 0) {
      throw new Error('Database has no data sources available');
    }
    
    // Use the first data source for querying
    const data_source_id = data_sources[0].id;
    
    // Query the data source instead of the database directly
    return await notion[method](`/data_sources/${data_source_id}/query`, data);
  }
  
  // For non-database-query operations, make the request directly
  if (data !== null) {
    return await notion[method](endpoint, data);
  } else {
    return await notion[method](endpoint);
  }
}