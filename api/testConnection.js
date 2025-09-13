import { createNotionClient, handlePreflight, sendError, sendSuccess, safeNotionRequest } from './utils.js';

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

    // Validate database ID format (should be 32 characters)
    if (!/^[a-f0-9]{32}$/i.test(databaseId.replace(/-/g, ''))) {
      return sendError(res, new Error('Invalid database ID format'), 400);
    }

    // Create Notion client and make request using safe handler
    const notion = createNotionClient();
    const response = await safeNotionRequest(notion, 'get', `/databases/${databaseId}`);

    // Return success with database info
    sendSuccess(res, {
      id: response.data.id,
      title: response.data.title,
      properties: Object.keys(response.data.properties),
      created_time: response.data.created_time,
      last_edited_time: response.data.last_edited_time
    });

  } catch (error) {
    // Handle Notion API errors specifically
    if (error.response) {
      const status = error.response.status;
      const notionError = error.response.data;
      
      if (status === 401) {
        return sendError(res, new Error('Invalid Notion API key'), 401);
      } else if (status === 404) {
        return sendError(res, new Error('Database not found or integration lacks access'), 404);
      } else {
        return sendError(res, new Error(notionError.message || 'Notion API error'), status);
      }
    }
    
    // Handle other errors
    sendError(res, error);
  }
}