import { createNotionClient, handlePreflight, sendError, sendSuccess } from './utils.js';

/**
 * Query a Notion database
 * POST /api/queryDatabase
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
    const { databaseId } = req.body;
    if (!databaseId) {
      return sendError(res, new Error('Missing required field: databaseId'), 400);
    }

    // Validate database ID format
    if (!/^[a-f0-9]{32}$/i.test(databaseId.replace(/-/g, ''))) {
      return sendError(res, new Error('Invalid database ID format'), 400);
    }

    // Extract query parameters with defaults
    const queryData = {
      sorts: req.body.sorts || [
        {
          timestamp: 'created_time',
          direction: 'descending'
        }
      ],
      page_size: req.body.page_size || 5,
      ...(req.body.filter && { filter: req.body.filter }),
      ...(req.body.start_cursor && { start_cursor: req.body.start_cursor })
    };

    // Create Notion client and make request
    const notion = createNotionClient();
    const response = await notion.post(`/databases/${databaseId}/query`, queryData);

    // Return success with query results
    sendSuccess(res, {
      results: response.data.results,
      next_cursor: response.data.next_cursor,
      has_more: response.data.has_more,
      type: response.data.type,
      page_or_database: response.data.page_or_database
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
      } else if (status === 400) {
        return sendError(res, new Error(notionError.message || 'Invalid query parameters'), 400);
      } else {
        return sendError(res, new Error(notionError.message || 'Notion API error'), status);
      }
    }
    
    // Handle other errors
    sendError(res, error);
  }
}