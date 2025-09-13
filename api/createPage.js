import { createNotionClient, handlePreflight, sendError, sendSuccess, safeNotionRequest } from './utils.js';

/**
 * Create a new page in Notion database
 * POST /api/createPage
 */
export default async function handler(req, res) {
  // Handle preflight requests
  if (handlePreflight(req, res)) {
    return;
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return sendError(res, new Error(`Method ${req.method} not allowed`), 405);
    }

    // Validate required fields
    const { databaseId, properties } = req.body;
    if (!databaseId || !properties) {
      return sendError(res, new Error('Missing required fields: databaseId, properties'), 400);
    }

    // Validate database ID format
    if (!/^[a-f0-9]{32}$/i.test(databaseId.replace(/-/g, ''))) {
      return sendError(res, new Error('Invalid database ID format'), 400);
    }

    // Validate that Title property exists
    if (!properties.Title) {
      return sendError(res, new Error('Title property is required'), 400);
    }

    // Create Notion client and make request using safe handler
    const notion = createNotionClient();
    
    const pageData = {
      parent: {
        database_id: databaseId
      },
      properties: properties
    };

    const response = await safeNotionRequest(notion, 'post', '/pages', pageData);

    // Return success with created page info
    sendSuccess(res, {
      id: response.data.id,
      url: response.data.url,
      created_time: response.data.created_time,
      properties: response.data.properties
    }, 201);

  } catch (error) {
    // Handle Notion API errors specifically
    if (error.response) {
      const status = error.response.status;
      const notionError = error.response.data;
      
      if (status === 401) {
        return sendError(res, new Error('Invalid Notion API key'), 401);
      } else if (status === 404) {
        return sendError(res, new Error('Database not found or integration lacks access'), 404);
      } else if (status === 400) {
        return sendError(res, new Error(notionError.message || 'Invalid request data'), 400);
      } else {
        return sendError(res, new Error(notionError.message || 'Notion API error'), status);
      }
    }
    
    // Handle other errors
    sendError(res, error);
  }
}