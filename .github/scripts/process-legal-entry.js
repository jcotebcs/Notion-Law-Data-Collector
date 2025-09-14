#!/usr/bin/env node

import { Octokit } from '@octokit/rest';
import axios from 'axios';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const NOTION_API_URL = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

async function createNotionPage(data) {
  const headers = {
    'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  };

  const payload = {
    parent: {
      database_id: process.env.NOTION_DATABASE_ID,
    },
    properties: {
      'Title': {
        title: [
          {
            text: {
              content: data.caseTitle || 'Untitled Case',
            },
          },
        ],
      },
      'Case Number': {
        rich_text: [
          {
            text: {
              content: data.caseNumber || '',
            },
          },
        ],
      },
      'Court': {
        rich_text: [
          {
            text: {
              content: data.court || '',
            },
          },
        ],
      },
      'Judge': {
        rich_text: [
          {
            text: {
              content: data.judge || '',
            },
          },
        ],
      },
      'Parties': {
        rich_text: [
          {
            text: {
              content: data.parties || '',
            },
          },
        ],
      },
      'Summary': {
        rich_text: [
          {
            text: {
              content: data.summary || '',
            },
          },
        ],
      },
      'Outcome': {
        rich_text: [
          {
            text: {
              content: data.outcome || '',
            },
          },
        ],
      },
    },
  };

  // Add date if provided
  if (data.caseDate) {
    payload.properties['Date'] = {
      date: {
        start: data.caseDate,
      },
    };
  }

  // Add status if provided
  if (data.status) {
    payload.properties['Status'] = {
      select: {
        name: data.status,
      },
    };
  }

  // Add case type if provided
  if (data.caseType) {
    payload.properties['Type'] = {
      select: {
        name: data.caseType,
      },
    };
  }

  // Add priority if provided
  if (data.priority) {
    payload.properties['Priority'] = {
      select: {
        name: data.priority,
      },
    };
  }

  // Add tags if provided
  if (data.tags) {
    const tagArray = data.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
    if (tagArray.length > 0) {
      payload.properties['Tags'] = {
        multi_select: tagArray.map(tag => ({ name: tag })),
      };
    }
  }

  try {
    const response = await axios.post(`${NOTION_API_URL}/pages`, payload, { headers });
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Error creating Notion page:', error.response?.data || error.message);
    return { success: false, error: error.response?.data || error.message };
  }
}

function parseIssueBody(body) {
  const data = {};
  
  // Parse the issue body for form data
  const lines = body.split('\n');
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip empty lines and headers
    if (!trimmedLine || trimmedLine.startsWith('#') || trimmedLine.startsWith('---') || trimmedLine.startsWith('*')) {
      continue;
    }
    
    // Look for patterns like "- **Field Name**: Value" or "**Field Name**: Value"
    const listFieldMatch = trimmedLine.match(/^-\s*\*\*(.+?)\*\*:\s*(.+)$/);
    if (listFieldMatch) {
      const [, field, value] = listFieldMatch;
      const fieldKey = field.toLowerCase().replace(/\s+/g, '');
      data[fieldKey] = value;
      continue;
    }
    
    // Look for patterns like "**Field Name**: Value" (without bullet)
    const boldFieldMatch = trimmedLine.match(/^\*\*(.+?)\*\*:\s*(.+)$/);
    if (boldFieldMatch) {
      const [, field, value] = boldFieldMatch;
      const fieldKey = field.toLowerCase().replace(/\s+/g, '');
      data[fieldKey] = value;
      continue;
    }
    
    // Look for patterns like "Field Name: Value"
    const simpleFieldMatch = trimmedLine.match(/^(.+?):\s*(.+)$/);
    if (simpleFieldMatch && !trimmedLine.includes('*')) {
      const [, field, value] = simpleFieldMatch;
      const fieldKey = field.toLowerCase().replace(/\s+/g, '');
      data[fieldKey] = value;
      continue;
    }
  }

  // Map common field variations to our expected field names
  const fieldMappings = {
    'casetitle': 'caseTitle',
    'title': 'caseTitle',
    'casenumber': 'caseNumber',
    'number': 'caseNumber',
    'court': 'court',
    'judge': 'judge',
    'date': 'caseDate',
    'casedate': 'caseDate',
    'status': 'status',
    'parties': 'parties',
    'partiesinvolved': 'parties',
    'type': 'caseType',
    'casetype': 'caseType',
    'summary': 'summary',
    'casesummary': 'summary',
    'outcome': 'outcome',
    'ruling': 'outcome',
    'tags': 'tags',
    'priority': 'priority',
    'databaseid': 'databaseId',
  };

  const mappedData = {};
  for (const [key, value] of Object.entries(data)) {
    const mappedKey = fieldMappings[key] || key;
    mappedData[mappedKey] = value;
  }

  return mappedData;
}

async function updateIssueWithResult(issueNumber, result) {
  const owner = process.env.GITHUB_REPOSITORY.split('/')[0];
  const repo = process.env.GITHUB_REPOSITORY.split('/')[1];

  let comment;
  if (result.success) {
    comment = `✅ **Legal case data successfully added to Notion!**
    
📄 **Notion Page**: [View in Notion](${result.data.url})
📅 **Created**: ${new Date(result.data.created_time).toLocaleString()}

This issue will be automatically closed.`;

    // Close the issue
    await octokit.rest.issues.update({
      owner,
      repo,
      issue_number: issueNumber,
      state: 'closed',
    });
  } else {
    comment = `❌ **Error adding legal case data to Notion**

**Error Details**: ${JSON.stringify(result.error, null, 2)}

Please check your data format and try again. Make sure your Notion database has the required properties and the integration has proper permissions.`;
  }

  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body: comment,
  });
}

async function main() {
  const issueNumber = process.env.INPUT_ISSUE_NUMBER || process.argv[2];
  const issueBody = process.env.INPUT_ISSUE_BODY || process.argv[3];
  
  if (!issueNumber || !issueBody) {
    console.error('Missing issue number or body');
    process.exit(1);
  }

  if (!process.env.NOTION_TOKEN || !process.env.NOTION_DATABASE_ID) {
    console.error('Missing required environment variables: NOTION_TOKEN, NOTION_DATABASE_ID');
    process.exit(1);
  }

  try {
    const parsedData = parseIssueBody(issueBody);
    console.log('Parsed data:', parsedData);
    
    const result = await createNotionPage(parsedData);
    console.log('Notion API result:', result);
    
    await updateIssueWithResult(parseInt(issueNumber), result);
    
    console.log('Process completed successfully');
  } catch (error) {
    console.error('Error processing legal entry:', error);
    
    await updateIssueWithResult(parseInt(issueNumber), {
      success: false,
      error: error.message,
    });
    
    process.exit(1);
  }
}

main();