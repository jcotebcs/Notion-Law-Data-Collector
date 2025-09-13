import { createNotionClient, handlePreflight, sendError, sendSuccess, safeNotionRequest } from './utils.js';

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

    // Create Notion client
    const notion = createNotionClient();
    // First, fetch the database to get data_source_id (required for 2025-09-03 API)
    let dbResponse;
    try {
      dbResponse = await safeNotionRequest(notion, 'get', `/databases/${databaseId}`);
    } catch (err) {
      if (err.response && err.response.status === 404) {
        return sendError(res, new Error('Database not found or integration lacks access'), 404);
      } else if (err.response && err.response.status === 401) {
        return sendError(res, new Error('Invalid Notion API key'), 401);
      } else {
        return sendError(res, err, err.response?.status || 500);
      }
    }

    // Validate dbResponse and its data_sources
    if (!dbResponse.data || !dbResponse.data.data_sources) {
      return sendError(res, new Error('Failed to fetch database data sources'), 500);
    }
    const data_sources = dbResponse.data.data_sources;
    if (!data_sources || data_sources.length === 0) {
      return sendError(res, new Error('Database has no data sources available'), 400);
    }

    // Use the first data source for querying
    const data_source_id = data_sources[0].id;
    // Query the data source instead of the database directly
    const response = await notion.post(`/data_sources/${data_source_id}/query`, queryData);
    sendSuccess(res, {
      results: response.data.results,
      next_cursor: response.data.next_cursor,
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