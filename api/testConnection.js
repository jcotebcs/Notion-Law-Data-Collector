import { createNotionClient, handlePreflight, sendError, sendSuccess, validateRequired } from './utils.js';

/**
 * Test connection to Notion database
 * GET /api/testConnection?databaseId=xxx
 */
export default async function handler(req, res) {
  // Handle preflight requests
  if (handlePreflight(req, res)) {
    return;
  }

  try {
    // Only allow GET requests
    if (req.method !== 'GET') {
      return sendError(res, new Error(`Method ${req.method} not allowed`), 405);
    }

    // Validate required parameters
    const { databaseId } = req.query;
    if (!databaseId) {
      return sendError(res, new Error('Missing required parameter: databaseId'), 400);
    }

    // Clean and validate database ID format
    const cleanDbId = databaseId.replace(/-/g, '');
    if (!/^[a-f0-9]{32}$/i.test(cleanDbId)) {
      return sendError(res, new Error(`Invalid database ID format. Expected 32 hexadecimal characters, got: ${cleanDbId.length} characters`), 400);
    }

    console.log(`Testing connection to database: ${databaseId}`);

    // Create Notion client and make request
    const notion = createNotionClient();
    
    // Use the clean database ID without dashes for the API call
    const response = await notion.get(`/databases/${cleanDbId}`);

    // Check if response was successful
    if (response.status !== 200) {
      throw new Error(`Notion API returned status ${response.status}: ${response.statusText}`);
    }

    // Validate that we received the expected JSON structure
    if (!response.data || !response.data.id) {
      throw new Error('Invalid response format from Notion API');
    }

    console.log('Connection test successful');

    // Return success with database info
    sendSuccess(res, {
      id: response.data.id,
      title: response.data.title,
      properties: Object.keys(response.data.properties),
      created_time: response.data.created_time,
      last_edited_time: response.data.last_edited_time,
      connection_status: 'success',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Connection test failed:', error);

    // Handle specific error types with detailed messages
    if (error.isHtmlResponse) {
      return sendError(res, new Error('Received HTML instead of JSON from Notion API. This usually indicates an authentication problem or incorrect API endpoint. Please verify your NOTION_API_KEY.'), 502);
    }

    // Handle Notion API errors specifically
    if (error.response) {
      const status = error.response.status;
      const notionError = error.response.data;
      
      if (status === 401) {
        return sendError(res, new Error('Authentication failed. Please verify your NOTION_API_KEY is correct and has not expired.'), 401);
      } else if (status === 404) {
        return sendError(res, new Error('Database not found or integration lacks access. Please verify: 1) Database ID is correct, 2) Integration has access to the database, 3) Database exists and is not deleted.'), 404);
      } else if (status === 429) {
        return sendError(res, new Error('Rate limit exceeded. Please wait a moment before retrying.'), 429);
      } else if (status === 403) {
        return sendError(res, new Error('Access forbidden. Please ensure your integration has the correct permissions for this database.'), 403);
      } else {
        return sendError(res, new Error(`Notion API error (${status}): ${notionError?.message || 'Unknown error'}`), status);
      }
    }
    
    // Handle network and other errors
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return sendError(res, new Error('Network error: Unable to reach Notion API. Please check your internet connection.'), 503);
    }
    
    if (error.code === 'ETIMEDOUT') {
      return sendError(res, new Error('Request timeout: Notion API did not respond within 30 seconds.'), 408);
    }

    // Handle other errors with more context
    const errorMessage = error.message || 'An unexpected error occurred while testing the connection';
    sendError(res, new Error(`${errorMessage}. Please check the logs for more details.`));
  }
}