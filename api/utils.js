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
  
  const client = axios.create({
    baseURL: NOTION_BASE_URL,
    headers: {
      'Authorization': `Bearer ${NOTION_API_KEY}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json'
    },
    timeout: 30000 // 30 second timeout
  });

  // Add response interceptor to log raw responses for debugging
  client.interceptors.response.use(
    (response) => {
      // Log successful responses in development
      if (process.env.NODE_ENV === 'development') {
        console.log('Notion API Response:', {
          status: response.status,
          headers: response.headers,
          data: typeof response.data === 'string' ? response.data.substring(0, 500) : response.data
        });
      }
      return response;
    },
    (error) => {
      // Log raw error responses to help debug HTML error pages
      if (error.response) {
        console.error('Notion API Error Response:', {
          status: error.response.status,
          statusText: error.response.statusText,
          headers: error.response.headers,
          data: typeof error.response.data === 'string' 
            ? error.response.data.substring(0, 500) 
            : error.response.data
        });
        
        // Check if response is HTML (common issue mentioned in problem statement)
        if (typeof error.response.data === 'string' && 
            (error.response.data.includes('<!DOCTYPE html>') || 
            error.response.data.includes('<html>'))) {
          console.error('⚠️  Received HTML response instead of JSON - this indicates an API gateway or proxy error');
          error.isHtmlResponse = true;
        }
      }
      return Promise.reject(error);
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'false');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
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
  
  // Enhanced error handling for HTML responses and other common issues
  let errorMessage = error.message || 'An unexpected error occurred';
  let finalStatusCode = statusCode;
  
  // Handle specific error cases mentioned in the problem statement
  if (error.isHtmlResponse) {
    errorMessage = 'Received HTML error page instead of JSON response. This may indicate API gateway issues or incorrect endpoint configuration.';
    finalStatusCode = 502; // Bad Gateway
  } else if (error.code === 'ECONNREFUSED') {
    errorMessage = 'Unable to connect to Notion API. Please check your internet connection and try again.';
    finalStatusCode = 503; // Service Unavailable
  } else if (error.code === 'ETIMEDOUT') {
    errorMessage = 'Request to Notion API timed out. Please try again.';
    finalStatusCode = 504; // Gateway Timeout
  } else if (error.response && error.response.status === 401) {
    errorMessage = 'Invalid Notion API key or insufficient permissions. Please check your integration setup.';
  } else if (error.response && error.response.status === 404) {
    errorMessage = 'Database not found or integration lacks access. Please verify your database ID and integration permissions.';
  }
  
  setCorsHeaders(res);
  res.status(finalStatusCode).json({
    error: true,
    message: errorMessage,
    statusCode: finalStatusCode,
    ...(process.env.NODE_ENV === 'development' && { 
      stack: error.stack,
      originalError: error.message,
      errorCode: error.code
    })
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
 * Safely handles Notion API calls with proper error handling
 * This helps prevent HTML error pages from being parsed as JSON
 */
export async function safeNotionRequest(notionClient, method, url, data = null) {
  try {
    console.log(`Making Notion API request: ${method.toUpperCase()} ${url}`);
    
    let response;
    switch (method.toLowerCase()) {
      case 'get':
        response = await notionClient.get(url);
        break;
      case 'post':
        response = await notionClient.post(url, data);
        break;
      case 'put':
        response = await notionClient.put(url, data);
        break;
      case 'delete':
        response = await notionClient.delete(url);
        break;
      default:
        throw new Error(`Unsupported HTTP method: ${method}. Supported methods are: GET, POST, PUT, DELETE`);
    }
    
    // Validate that we received a proper JSON response
    if (typeof response.data === 'string' && 
        (response.data.includes('<!DOCTYPE html>') || response.data.includes('<html>'))) {
      const error = new Error('Received HTML response instead of JSON from Notion API');
      error.isHtmlResponse = true;
      throw error;
    }
    
    return response;
    
  } catch (error) {
    // Log the raw error for debugging
    console.error('Notion API request failed:', {
      method,
      url,
      error: error.message,
      status: error.response?.status,
      isHtmlResponse: error.isHtmlResponse
    });
    
    throw error;
  }
}