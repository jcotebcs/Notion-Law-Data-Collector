import { createNotionClient, handlePreflight, sendError, sendSuccess, validateRequired } from './utils.js';

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
    
    // Prepare basic page data structure
    const pageData = {
      parent: {
        database_id: databaseId
      },
      properties: properties
    };

    // Try to get data_source_id for multi-source databases (2025-09-03 API)
    try {
      const dbResponse = await notion.get(`/databases/${databaseId}`);
      const data_sources = dbResponse.data.data_sources;
      
      // Only add data_source_id if the database has data sources
      if (data_sources && data_sources.length > 0) {
        pageData.parent.data_source_id = data_sources[0].id;
        console.log(`Using data_source_id: ${data_sources[0].id} for multi-source database`);
      }
    } catch (dbError) {
      // If we can't fetch database info, continue without data_source_id
      // This handles cases where the database might not support the data_sources endpoint
      console.warn('Could not fetch database data sources, proceeding with standard database_id:', dbError.message);
    }

    const response = await notion.post('/pages', pageData);

    // Prepare response data with additional metadata
    const responseData = {
      id: response.data.id,
      url: response.data.url,
      created_time: response.data.created_time,
      properties: response.data.properties,
      api_version: '2025-09-03'
    };

    // Include data_source_id in response if it was used
    if (pageData.parent.data_source_id) {
      responseData.data_source_id = pageData.parent.data_source_id;
    }

    // Return success with created page info
    sendSuccess(res, responseData, 201);

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
      } else if (status === 429) {
        return sendError(res, new Error('Rate limit exceeded. Please try again later.'), 429);
      } else {
        return sendError(res, new Error(notionError.message || 'Notion API error'), status);
      }
    }
    
    // Handle other errors
    sendError(res, error);
  }
}
