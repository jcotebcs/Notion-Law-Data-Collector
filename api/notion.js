/**
 * Unified Notion API Handler for Multi-Platform Deployment
 * Supports Vercel, Netlify, Railway, and Render
 * Handles all Notion API operations with proper CORS and error handling
 */

import axios from 'axios';

// Environment configuration
const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_VERSION = process.env.NOTION_VERSION || '2022-06-28';
const DEBUG = process.env.DEBUG === 'true';

/**
 * Enhanced logging function
 */
function log(...args) {
  if (DEBUG) {
    console.log('[Notion API]', new Date().toISOString(), ...args);
  }
}

/**
 * Handle CORS preflight requests
 */
function handleCORS(req, res) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
  };

  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }

  return false;
}

/**
 * Send error response with proper formatting
 */
function sendError(res, error, statusCode = 500) {
  log('Error:', error.message || error);
  
  const errorResponse = {
    success: false,
    error: error.message || 'An unknown error occurred',
    code: statusCode,
    timestamp: new Date().toISOString(),
  };

  res.status(statusCode).json(errorResponse);
}

/**
 * Send success response with proper formatting
 */
function sendSuccess(res, data, statusCode = 200) {
  log('Success:', data);
  
  const successResponse = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };

  res.status(statusCode).json(successResponse);
}

/**
 * Create Notion API client
 */
function createNotionClient() {
  if (!NOTION_API_KEY) {
    throw new Error('NOTION_API_KEY environment variable is required');
  }

  return axios.create({
    baseURL: 'https://api.notion.com/v1',
    headers: {
      'Authorization': `Bearer ${NOTION_API_KEY}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    timeout: 30000, // 30 seconds timeout
  });
}

/**
 * Safe Notion API request with error handling
 */
async function safeNotionRequest(client, method, url, data = null) {
  try {
    const config = { method, url };
    if (data) {
      config.data = data;
    }
    
    log(`Making ${method.toUpperCase()} request to ${url}`, data ? 'with data' : '');
    const response = await client.request(config);
    log('Request successful:', response.status);
    return response;
  } catch (error) {
    log('Request failed:', error.message);
    
    // Handle HTML responses (API gateway/proxy errors)
    if (error.response && typeof error.response.data === 'string' && error.response.data.includes('<html>')) {
      const htmlError = new Error('Received HTML error page instead of JSON response. This may indicate API gateway issues or incorrect endpoint configuration.');
      htmlError.isHtmlResponse = true;
      throw htmlError;
    }
    
    throw error;
  }
}

/**
 * Test connection to Notion database
 */
async function testConnection(req, res) {
  log('Testing connection with query:', req.query);
  
  try {
    // Extract database ID from query parameters
    const { databaseId } = req.query;
    
    if (!databaseId) {
      return sendError(res, new Error('Missing required parameter: databaseId'), 400);
    }

    // Validate database ID format (should be 32 characters without dashes)
    const cleanDatabaseId = databaseId.replace(/-/g, '');
    if (!/^[a-f0-9]{32}$/i.test(cleanDatabaseId)) {
      return sendError(res, new Error('Invalid database ID format'), 400);
    }

    // Create Notion client and test connection
    const notion = createNotionClient();
    const response = await safeNotionRequest(notion, 'get', `/databases/${cleanDatabaseId}`);

    // Check if database has required structure
    const database = response.data;
    if (!database.properties) {
      return sendError(res, new Error('Database has no properties'), 400);
    }

    // Return success with database info
    sendSuccess(res, {
      id: database.id,
      title: database.title,
      properties: Object.keys(database.properties),
      created_time: database.created_time,
      last_edited_time: database.last_edited_time,
      url: database.url,
    });

  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      if (status === 401) {
        return sendError(res, new Error('Invalid Notion API key'), 401);
      } else if (status === 404) {
        return sendError(res, new Error('Database not found or integration lacks access'), 404);
      } else {
        const notionError = error.response.data;
        return sendError(res, new Error(notionError.message || 'Notion API error'), status);
      }
    }
    
    sendError(res, error);
  }
}

/**
 * Create a new page in Notion database
 */
async function createPage(req, res) {
  log('Creating page with body:', req.body);
  
  try {
    const { databaseId, properties } = req.body;
    
    if (!databaseId || !properties) {
      return sendError(res, new Error('Missing required fields: databaseId, properties'), 400);
    }

    // Validate database ID format
    const cleanDatabaseId = databaseId.replace(/-/g, '');
    if (!/^[a-f0-9]{32}$/i.test(cleanDatabaseId)) {
      return sendError(res, new Error('Invalid database ID format'), 400);
    }

    // Validate that Title property exists
    if (!properties.Title) {
      return sendError(res, new Error('Title property is required'), 400);
    }

    // Create Notion client
    const notion = createNotionClient();
    
    // Create page data
    const pageData = {
      parent: {
        database_id: cleanDatabaseId,
      },
      properties: properties,
    };

    const response = await safeNotionRequest(notion, 'post', '/pages', pageData);

    // Return success with created page info
    sendSuccess(res, {
      id: response.data.id,
      url: response.data.url,
      created_time: response.data.created_time,
      properties: response.data.properties,
    }, 201);

  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      if (status === 401) {
        return sendError(res, new Error('Invalid Notion API key'), 401);
      } else if (status === 404) {
        return sendError(res, new Error('Database not found or integration lacks access'), 404);
      } else if (status === 400) {
        const notionError = error.response.data;
        return sendError(res, new Error(notionError.message || 'Invalid request data'), 400);
      } else {
        const notionError = error.response.data;
        return sendError(res, new Error(notionError.message || 'Notion API error'), status);
      }
    }
    
    sendError(res, error);
  }
}

/**
 * Query database for recent entries
 */
async function queryDatabase(req, res) {
  log('Querying database with query:', req.query, 'body:', req.body);
  
  try {
    // Support both GET and POST requests
    const databaseId = req.query.databaseId || req.body?.databaseId;
    const pageSize = parseInt(req.query.pageSize || req.body?.pageSize || '10');
    
    if (!databaseId) {
      return sendError(res, new Error('Missing required parameter: databaseId'), 400);
    }

    // Validate database ID format
    const cleanDatabaseId = databaseId.replace(/-/g, '');
    if (!/^[a-f0-9]{32}$/i.test(cleanDatabaseId)) {
      return sendError(res, new Error('Invalid database ID format'), 400);
    }

    // Create Notion client
    const notion = createNotionClient();
    
    // Query database with recent entries
    const queryData = {
      page_size: Math.min(pageSize, 100), // Limit to 100 entries max
      sorts: [
        {
          property: 'Created time',
          direction: 'descending',
        },
      ],
    };

    const response = await safeNotionRequest(notion, 'post', `/databases/${cleanDatabaseId}/query`, queryData);

    // Format response data
    const results = response.data.results.map(page => ({
      id: page.id,
      url: page.url,
      created_time: page.created_time,
      last_edited_time: page.last_edited_time,
      properties: page.properties,
    }));

    sendSuccess(res, {
      results,
      has_more: response.data.has_more,
      next_cursor: response.data.next_cursor,
      total_count: results.length,
    });

  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      if (status === 401) {
        return sendError(res, new Error('Invalid Notion API key'), 401);
      } else if (status === 404) {
        return sendError(res, new Error('Database not found or integration lacks access'), 404);
      } else {
        const notionError = error.response.data;
        return sendError(res, new Error(notionError.message || 'Notion API error'), status);
      }
    }
    
    sendError(res, error);
  }
}

/**
 * Main handler function that routes requests to appropriate functions
 */
async function handler(req, res) {
  log(`${req.method} ${req.url}`);
  
  // Handle CORS
  if (handleCORS(req, res)) {
    return;
  }

  try {
    // Determine the endpoint based on URL path or action parameter
    const path = req.url?.split('?')[0] || '';
    const action = req.query?.action || req.body?.action;
    
    // Route to appropriate function
    if (path.includes('testConnection') || action === 'testConnection') {
      if (req.method !== 'GET') {
        return sendError(res, new Error(`Method ${req.method} not allowed for testConnection`), 405);
      }
      return await testConnection(req, res);
    } 
    else if (path.includes('createPage') || action === 'createPage') {
      if (req.method !== 'POST') {
        return sendError(res, new Error(`Method ${req.method} not allowed for createPage`), 405);
      }
      return await createPage(req, res);
    } 
    else if (path.includes('queryDatabase') || action === 'queryDatabase') {
      if (!['GET', 'POST'].includes(req.method)) {
        return sendError(res, new Error(`Method ${req.method} not allowed for queryDatabase`), 405);
      }
      return await queryDatabase(req, res);
    } 
    else {
      // Default: return API information
      sendSuccess(res, {
        name: 'Notion Law Data Collector API',
        version: '1.0.0',
        endpoints: {
          testConnection: 'GET /api/notion?action=testConnection&databaseId=xxx',
          createPage: 'POST /api/notion with {action: "createPage", databaseId: "xxx", properties: {...}}',
          queryDatabase: 'GET /api/notion?action=queryDatabase&databaseId=xxx',
        },
        status: 'healthy',
      });
    }

  } catch (error) {
    log('Handler error:', error);
    sendError(res, error);
  }
}

// Export for different platforms
export default handler;

// For Netlify Functions
export { handler };