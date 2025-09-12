
# Notion Law Data Collector

A web application for collecting and organizing legal case data directly into your Notion database. This application features a serverless Node.js backend that handles Notion API interactions to resolve CORS issues, while maintaining a clean frontend interface.

## Architecture

- **Frontend**: Static HTML/CSS/JavaScript interface
- **Backend**: Serverless Node.js functions (Vercel/Railway/Render compatible)
- **API**: RESTful endpoints that proxy requests to Notion API
- **Deployment**: Serverless platform with environment variable configuration

## Features

- 📝 **Easy Data Entry**: Intuitive form for entering legal case information
- 🔗 **Secure Notion Integration**: Server-side API integration eliminates CORS issues
- 📱 **Responsive Design**: Works on desktop, tablet, and mobile devices
- 🔒 **Secure**: API keys managed via environment variables, no client-side exposure
- ⚡ **Fast**: Serverless architecture with static frontend
- 📊 **Recent Cases View**: See your latest entries at a glance
- 🚀 **Easy Deployment**: Deploy to Vercel, Railway, or Render with one click

## Live Demo

Deploy your own instance:
- **Vercel**: [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/jcotebcs/Notion-Law-Data-Collector)
- **Railway**: [![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template/notion-law-collector)
- **Render**: [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

## Quick Start

### Option 1: Deploy to Vercel (Recommended)

1. Click the "Deploy with Vercel" button above
2. Connect your GitHub account and fork the repository
3. Set the `NOTION_TOKEN` environment variable with your integration token
4. Deploy and access your application

### Option 2: Deploy to Railway

1. Click the "Deploy on Railway" button above
2. Connect your GitHub account
3. Set the `NOTION_TOKEN` environment variable
4. Deploy and access your application

### Option 3: Deploy to Render

1. Click the "Deploy to Render" button above
2. Connect your GitHub account
3. Set the `NOTION_TOKEN` environment variable
4. Deploy and access your application

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

Choose one of the deployment options above (Vercel, Railway, or Render) and:

1. Set the `NOTION_TOKEN` environment variable to your integration token
2. Deploy the application
3. Access your deployed application URL

### 4. Configure the Application

1. Open your deployed application in your browser
2. Paste your database ID in the "Database ID" field (the token is now handled server-side)
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

- **Server-side Processing**: API calls are handled server-side to eliminate CORS issues
- **Environment Variables**: Notion tokens are stored securely as environment variables
- **No Client Exposure**: API keys are never exposed to the client-side code
- **Secure Integration**: Direct connection to Notion's official API through serverless functions

## Local Development

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Setup
1. Clone this repository
2. Install dependencies: `npm install`
3. Create a `.env` file with your Notion token:
   ```
   NOTION_TOKEN=your_secret_token_here
   ```
4. Start the development server: `npm run dev`
5. Open http://localhost:3000

### Testing
Run the API validation test:
```bash
node test-api.js
```

## Development

This application is built with:
- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Backend**: Node.js serverless functions
- **API**: Notion API v2022-06-28 via @notionhq/client
- **Deployment**: Vercel/Railway/Render compatible

## Deployment Platforms

### Vercel
- Automatic deployment from GitHub
- Built-in environment variable management
- Serverless functions support

### Railway
- Git-based deployments
- Environment variable configuration
- Automatic HTTPS

### Render
- Static site + serverless functions
- Environment variable management  
- Custom domains

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the [MIT License](LICENSE).

## Support

If you encounter any issues:
1. Check that your Notion integration has the correct permissions
2. Verify your database ID is correct (32 characters)
3. Ensure your database has all the required properties
4. Check that the `NOTION_TOKEN` environment variable is set correctly
5. Verify your deployment platform environment variables
6. Check the browser console and server logs for error messages

For additional help, please open an issue on GitHub.

## Migration from Previous Version

If you were using the previous client-side version:
1. Deploy the new serverless version using one of the deployment options
2. Set up the `NOTION_TOKEN` environment variable instead of entering it in the UI
3. The database ID can still be entered in the frontend interface
4. All your existing Notion database structure remains compatible
