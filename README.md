
# Notion Law Data Collector

A web application for collecting and organizing legal case data directly into your Notion database. This application features a React-like frontend with a serverless Node.js backend to resolve CORS restrictions and ensure secure API communication.

## Features

- 📝 **Easy Data Entry**: Intuitive form for entering legal case information
- 🔗 **Direct Notion Integration**: Connects securely to your Notion database via serverless API
- 📱 **Responsive Design**: Works on desktop, tablet, and mobile devices
- 🔒 **Secure**: API keys stored server-side, protected from client exposure
- ⚡ **Fast**: Serverless backend with optimized performance
- 📊 **Recent Cases View**: See your latest entries at a glance
- 🌐 **CORS-Free**: No browser restrictions when accessing Notion API

## Architecture

This application uses a **serverless architecture** to resolve CORS (Cross-Origin Resource Sharing) issues:

```
Frontend (HTML/CSS/JS) → Serverless Backend → Notion API
```

### Why Serverless Backend?

The original version made direct browser requests to Notion API, which caused CORS errors. The serverless backend acts as a secure proxy:

- **Resolves CORS**: Backend makes API calls on behalf of frontend
- **Secure**: Notion API keys stored as environment variables on server
- **Scalable**: Serverless functions auto-scale with demand
- **Cost-Effective**: Only pay for actual usage

## Deployment Guide

### 🚀 NEW: AWS Lambda Deployment (Recommended for Production)

For the most secure and scalable deployment, use our new AWS Lambda implementation with Python 3.9+ and GitHub Actions for automated deployment.

**Key Benefits:**
- ✅ **Enhanced Security**: API tokens stored in AWS Secrets Manager
- ✅ **Latest Notion API**: Uses Notion API version 2025-09-03 with multi-source database support
- ✅ **Automated Deployment**: Full CI/CD with GitHub Actions
- ✅ **Error Analysis**: Built-in troubleshooting for "Unexpected token '<'" errors
- ✅ **Comprehensive Testing**: Unit and integration tests included

📖 **[Complete AWS Lambda Setup Guide](AWS_LAMBDA_DEPLOYMENT.md)**

**Quick Start:**
1. Run `./scripts/setup-aws.sh` to configure AWS resources
2. Add GitHub Secrets (AWS credentials and ARNs)
3. Push to main branch to trigger automated deployment

---

### Quick Deploy to Vercel (Alternative)

1. **Fork this repository** to your GitHub account

2. **Deploy to Vercel:**
   - Visit [vercel.com](https://vercel.com)
   - Click "New Project" and import your forked repository
   - Vercel will automatically detect the configuration

3. **Set Environment Variable:**
   - In Vercel dashboard, go to Project Settings > Environment Variables
   - Add: `NOTION_API_KEY` = `your_notion_integration_token`
   - Redeploy the project

4. **Get your Notion API key:**
   - Visit [Notion Integrations](https://www.notion.so/my-integrations)
   - Create a new integration
   - Copy the "Internal Integration Token"

### Deploy to Railway

1. **Fork this repository** to your GitHub account

2. **Deploy to Railway:**
   - Visit [railway.app](https://railway.app)
   - Click "Deploy from GitHub repo"
   - Select your forked repository

3. **Set Environment Variable:**
   - In Railway dashboard, go to Variables tab
   - Add: `NOTION_API_KEY` = `your_notion_integration_token`

### Deploy to Render

1. **Fork this repository** to your GitHub account

2. **Create Web Service:**
   - Visit [render.com](https://render.com)
   - Click "New" > "Web Service"
   - Connect your forked repository
   - Set build command: `npm install`
   - Set start command: `npm start`

3. **Set Environment Variable:**
   - In service settings, add environment variable
   - `NOTION_API_KEY` = `your_notion_integration_token`

### Verification

After deployment:
1. Visit your deployed URL
2. Enter a database ID in the configuration section
3. Click "Test Connection" - should work without CORS errors
4. If connection fails, check that your environment variable is set correctly

### Database Setup

Before using the application, you need to:

1. **Create a Notion Integration** at [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. **Create a database** in Notion with the required properties (see Setup Instructions)
3. **Share the database** with your integration
4. **Copy the database ID** from the URL

The database ID is the 32-character string in your database URL:
`https://notion.so/workspace/DATABASE_ID?v=...`

## Local Development

### Prerequisites

- Node.js 18+ 
- npm or yarn
- A Notion integration token

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/jcotebcs/Notion-Law-Data-Collector.git
   cd Notion-Law-Data-Collector
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env and add your NOTION_API_KEY
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   ```
   http://localhost:3000
   ```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NOTION_API_KEY` | Your Notion integration token (starts with `secret_`) | Yes |
| `NODE_ENV` | Environment (`development` or `production`) | No |

## API Endpoints

The serverless backend provides three main endpoints:

### `GET /api/testConnection`

Tests connection to Notion database.

**Parameters:**
- `databaseId` (query): The Notion database ID

**Response:**
```json
{
  "error": false,
  "data": {
    "id": "database-id",
    "title": [...],
    "properties": ["Title", "Case Number", ...],
    "created_time": "...",
    "last_edited_time": "..."
  }
}
```

### `POST /api/createPage`

Creates a new page in the Notion database.

**Body:**
```json
{
  "databaseId": "your-database-id",
  "properties": {
    "Title": {
      "title": [{"text": {"content": "Case Title"}}]
    },
    // ... other properties
  }
}
```

**Response:**
```json
{
  "error": false,
  "data": {
    "id": "page-id",
    "url": "notion-page-url",
    "created_time": "...",
    "properties": {...}
  }
}
```

### `POST /api/queryDatabase`

Queries the Notion database for existing pages.

**Body:**
```json
{
  "databaseId": "your-database-id",
  "sorts": [...],
  "page_size": 5,
  "filter": {...} // optional
}
```

**Response:**
```json
{
  "error": false,
  "data": {
    "results": [...],
    "next_cursor": "...",
    "has_more": false
  }
}
```

## Setup Instructions

### 1. Create a Notion Integration

1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. Click "New integration"
3. Give it a name like "Law Data Collector"
4. Select the workspace where your database will be
5. Copy the "Internal Integration Token" (starts with `secret_`)

### 2. Create a Notion Database

1. Create a new page in Notion
2. Add a database with these properties:
   - **Title** (Title) - Case title
   - **Case Number** (Rich Text) - Case reference number
   - **Court** (Rich Text) - Court name
   - **Judge** (Rich Text) - Judge name
   - **Date** (Date) - Case date
   - **Status** (Select) - Case status (Pending, Active, Closed, Appeal)
   - **Parties** (Rich Text) - Parties involved
   - **Type** (Select) - Case type (Civil, Criminal, Family, etc.)
   - **Summary** (Rich Text) - Case summary
   - **Outcome** (Rich Text) - Case outcome or ruling
   - **Tags** (Multi-select) - Case tags
   - **Priority** (Select) - Priority level (Low, Medium, High, Urgent)

3. Share the database with your integration:
   - Click the "Share" button on your database page
   - Click "Invite" and search for your integration name
   - Give it "Edit" permissions

4. Copy the database ID from the URL (32-character string)

### 3. Deploy the Application

Choose one of the deployment options above (Vercel, Railway, or Render) and set the `NOTION_API_KEY` environment variable.

### 4. Configure the Application

1. Open your deployed application in the browser
2. Paste your database ID in the "Database ID" field
3. Click "Test Connection" to verify everything works
4. Start adding case data!

## Data Fields

The application supports the following case data fields:

- **Case Title** (Required) - The name/title of the case
- **Case Number** - Official case reference number
- **Court** - Name of the court handling the case
- **Judge** - Name of the presiding judge
- **Case Date** - Important date related to the case
- **Status** - Current status (Pending, Active, Closed, Appeal)
- **Parties Involved** - Plaintiff vs Defendant information
- **Case Type** - Type of case (Civil, Criminal, Family, Corporate, Constitutional, Administrative)
- **Case Summary** - Brief description of the case
- **Outcome/Ruling** - Court decision or current status
- **Tags** - Comma-separated tags for categorization
- **Priority** - Priority level (Low, Medium, High, Urgent)

## Security & Privacy

- **Enhanced Security**: Notion API keys stored securely on the server, never exposed to browsers
- **Data Privacy**: Only database IDs are stored locally in your browser
- **No Third-Party Storage**: No data is stored or cached by the application
- **Direct API Connection**: Secure server-to-server communication with Notion

## Technology Stack

**Frontend:**
- HTML5
- CSS3 (with CSS Grid and Flexbox)
- Vanilla JavaScript (ES6+)

**Backend:**
- Node.js 18+
- Express.js
- Axios for HTTP requests
- CORS middleware
- Notion API v2025-09-03

**Deployment:**
- Serverless functions (Vercel, Railway, Render)
- Environment-based configuration
- Auto-scaling infrastructure

## Browser Compatibility

This application works in all modern browsers that support:
- ES6+ JavaScript features
- Fetch API
- Local Storage
- CSS Grid and Flexbox

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Install dependencies (`npm install`)
4. Set up your `.env` file with `NOTION_API_KEY`
5. Make your changes
6. Test thoroughly (`npm run dev`)
7. Commit your changes (`git commit -m 'Add amazing feature'`)
8. Push to the branch (`git push origin feature/amazing-feature`)
9. Open a Pull Request

## Troubleshooting

### Fixing "Unexpected token '<'" Error

This common error occurs when HTML is returned instead of JSON. Our AWS Lambda implementation resolves this by:

1. **Eliminating CORS Issues**: Server-side API calls bypass browser restrictions
2. **Proper Authentication**: Secure token management via AWS Secrets Manager
3. **Correct API Endpoints**: Validated endpoints for Notion API 2025-09-03
4. **Enhanced Error Handling**: Detailed error analysis and troubleshooting

**For immediate troubleshooting:**
- Ensure you're using the deployed version (not opening HTML files directly)
- Check that your Notion integration has database access
- Verify your API token is correctly formatted (starts with `secret_`)

**Complete troubleshooting guide:** [AWS Lambda Deployment Guide](AWS_LAMBDA_DEPLOYMENT.md#error-analysis-and-troubleshooting)

---

### Common Issues

**CORS Errors:**
- This should no longer occur with the serverless backend
- If you see CORS errors, ensure you're using the deployed version, not opening `index.html` directly

**Connection Failed:**
- Verify your `NOTION_API_KEY` is set correctly in your deployment environment
- Check that your database ID is exactly 32 characters
- Ensure your Notion integration has access to the database

**Database Not Found:**
- Verify the database ID in the URL
- Make sure you've shared the database with your integration
- Check that the integration has "Edit" permissions

**API Errors:**
- Check the browser console for detailed error messages
- Verify all required database properties exist
- Ensure property types match what the application expects

### Getting Help

1. Check the browser console for error messages
2. Verify your Notion integration setup
3. Test your integration using the "Test Connection" button
4. Open an issue on GitHub with details about your problem

## License

This project is open source and available under the [MIT License](LICENSE).

## Acknowledgments

- Built for the legal community to streamline case data management
- Powered by Notion's robust API and database capabilities
- Designed with privacy and security as top priorities
