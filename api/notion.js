const { Client } = require('@notionhq/client');

// CORS headers
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

module.exports = async (req, res) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ success: true });
  }

  // Set CORS headers
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  try {
    const { action, databaseId, data } = req.body;

    // Get the Notion token from environment variable
    const notionToken = process.env.NOTION_TOKEN;
    
    if (!notionToken) {
      return res.status(500).json({ 
        error: 'Server configuration error',
        message: 'Notion token not configured on server. Please contact administrator.' 
      });
    }

    // Initialize Notion client with the environment token
    const notion = new Client({
      auth: notionToken,
      notionVersion: '2022-06-28'
    });

    switch (action) {
      case 'testConnection':
        return await handleTestConnection(notion, databaseId, res);
      
      case 'createPage':
        return await handleCreatePage(notion, databaseId, data, res);
      
      case 'queryDatabase':
        return await handleQueryDatabase(notion, databaseId, res);
      
      default:
        return res.status(400).json({ 
          error: 'Invalid action',
          message: 'Action must be one of: testConnection, createPage, queryDatabase' 
        });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message || 'An unexpected error occurred'
    });
  }
};

async function handleTestConnection(notion, databaseId, res) {
  if (!databaseId) {
    return res.status(400).json({ 
      error: 'Database ID is required',
      message: 'Please provide a valid database ID' 
    });
  }

  try {
    const database = await notion.databases.retrieve({
      database_id: databaseId
    });

    return res.status(200).json({
      success: true,
      database: {
        id: database.id,
        title: database.title[0]?.plain_text || 'Untitled',
        url: database.url
      }
    });
  } catch (error) {
    return res.status(400).json({
      error: 'Connection failed',
      message: error.message || 'Failed to connect to database'
    });
  }
}

async function handleCreatePage(notion, databaseId, data, res) {
  if (!databaseId) {
    return res.status(400).json({ 
      error: 'Database ID is required',
      message: 'Please provide a valid database ID' 
    });
  }

  if (!data) {
    return res.status(400).json({ 
      error: 'Data is required',
      message: 'Please provide data for the new page' 
    });
  }

  try {
    const properties = buildNotionProperties(data);
    
    const response = await notion.pages.create({
      parent: {
        database_id: databaseId
      },
      properties: properties
    });

    return res.status(200).json({
      success: true,
      page: {
        id: response.id,
        url: response.url
      }
    });
  } catch (error) {
    return res.status(400).json({
      error: 'Failed to create page',
      message: error.message || 'Failed to create page in database'
    });
  }
}

async function handleQueryDatabase(notion, databaseId, res) {
  if (!databaseId) {
    return res.status(400).json({ 
      error: 'Database ID is required',
      message: 'Please provide a valid database ID' 
    });
  }

  try {
    const response = await notion.databases.query({
      database_id: databaseId,
      sorts: [
        {
          timestamp: 'created_time',
          direction: 'descending'
        }
      ],
      page_size: 5
    });

    return res.status(200).json({
      success: true,
      results: response.results
    });
  } catch (error) {
    return res.status(400).json({
      error: 'Failed to query database',
      message: error.message || 'Failed to query database'
    });
  }
}

function buildNotionProperties(data) {
  const properties = {
    'Title': {
      title: [
        {
          text: {
            content: data.title || 'Untitled Case'
          }
        }
      ]
    }
  };

  // Add other properties if they exist and have values
  if (data.caseNumber) {
    properties['Case Number'] = {
      rich_text: [
        {
          text: {
            content: data.caseNumber
          }
        }
      ]
    };
  }

  if (data.court) {
    properties['Court'] = {
      rich_text: [
        {
          text: {
            content: data.court
          }
        }
      ]
    };
  }

  if (data.judge) {
    properties['Judge'] = {
      rich_text: [
        {
          text: {
            content: data.judge
          }
        }
      ]
    };
  }

  if (data.date) {
    properties['Date'] = {
      date: {
        start: data.date
      }
    };
  }

  if (data.status) {
    properties['Status'] = {
      select: {
        name: data.status
      }
    };
  }

  if (data.parties) {
    properties['Parties'] = {
      rich_text: [
        {
          text: {
            content: data.parties
          }
        }
      ]
    };
  }

  if (data.type) {
    properties['Type'] = {
      select: {
        name: data.type
      }
    };
  }

  if (data.summary) {
    properties['Summary'] = {
      rich_text: [
        {
          text: {
            content: data.summary
          }
        }
      ]
    };
  }

  if (data.outcome) {
    properties['Outcome'] = {
      rich_text: [
        {
          text: {
            content: data.outcome
          }
        }
      ]
    };
  }

  if (data.tags) {
    const tagArray = data.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
    if (tagArray.length > 0) {
      properties['Tags'] = {
        multi_select: tagArray.map(tag => ({ name: tag }))
      };
    }
  }

  if (data.priority) {
    properties['Priority'] = {
      select: {
        name: data.priority
      }
    };
  }

  return properties;
}