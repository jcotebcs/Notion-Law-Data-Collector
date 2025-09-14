import { createNotionClient, handlePreflight, sendError, sendSuccess, validateRequired, safeNotionRequest } from './utils.js';

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

    // Create Notion client
    const notion = createNotionClient();
    
    // First, fetch the database to get data_source_id (required for 2025-09-03 API)
    let dbResponse;
    try {
      dbResponse = await safeNotionRequest(notion, 'get', `/databases/${databaseId}`);
    } catch (err) {
      // Handle HTML responses (API gateway/proxy errors)
      if (err.isHtmlResponse) {
        return sendError(res, new Error('Received HTML error page instead of JSON response. This may indicate API gateway issues or incorrect endpoint configuration.'), 502);
      }
      
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
    
    // Use the first data source (adapt if multiple sources needed)
    const data_source_id = data_sources[0].id;
    
    const pageData = {
      parent: {
        type: "data_source_id",
        data_source_id: data_source_id
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
