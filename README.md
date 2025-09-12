
# Notion Law Data Collector

A web application for collecting and organizing legal case data directly into your Notion database. This application uses a serverless backend to securely connect with Notion's API, solving CORS (Cross-Origin Resource Sharing) restrictions that prevent direct browser-to-API connections.

## Features

- 📝 **Easy Data Entry**: Intuitive form for entering legal case information
- 🔗 **Secure Notion Integration**: Connects to your Notion database via serverless backend
- 📱 **Responsive Design**: Works on desktop, tablet, and mobile devices
- 🔒 **CORS-Free**: Backend proxy eliminates browser CORS restrictions
- ⚡ **Fast**: Serverless deployment with instant scaling
- 📊 **Recent Cases View**: See your latest entries at a glance

## Architecture

This application consists of:
- **Frontend**: Static HTML/CSS/JavaScript hosted on GitHub Pages or Vercel
- **Backend**: Serverless Node.js functions (deployed on Vercel) that proxy requests to Notion API
- **Database**: Your existing Notion database

The serverless backend solves the CORS issue by making server-side requests to Notion's API, where CORS restrictions don't apply.

## Live Demo

Visit the application at: [https://jcotebcs.github.io/Notion-Law-Data-Collector/](https://jcotebcs.github.io/Notion-Law-Data-Collector/)

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

### 3. Deploy the Backend (Required)

**Option A: Deploy to Vercel (Recommended)**

1. Fork this repository to your GitHub account
2. Sign up for a free [Vercel account](https://vercel.com)
3. Connect your GitHub account to Vercel
4. Import your forked repository
5. Add environment variable in Vercel dashboard:
   - Variable: `NOTION_API_KEY` 
   - Value: Your Notion integration token (starts with `secret_`)
6. Deploy the project
7. Note your deployment URL (e.g., `https://your-app.vercel.app`)

**Option B: Deploy to Other Platforms**

The backend can also be deployed to:
- Railway
- Render
- Netlify Functions
- AWS Lambda

### 4. Configure the Application

1. Open the application at your deployment URL
2. Paste your integration token in the "Notion Integration Token" field
3. Paste your database ID in the "Database ID" field
4. Click "Test Connection" to verify everything works
5. Start adding case data!

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

- **Frontend Security**: Your Notion token is stored locally in your browser only
- **Backend Security**: API calls are processed server-side through secure serverless functions
- **No Third-Party Data Sharing**: Data flows only between your browser, our backend, and Notion's official API
- **Environment Variables**: Sensitive data like API keys are managed through secure environment variables
- **HTTPS**: All communications are encrypted in transit

## Development

This application consists of:

**Frontend:**
- HTML5
- CSS3 (with CSS Grid and Flexbox)  
- Vanilla JavaScript (ES6+)

**Backend:**
- Node.js serverless functions
- Vercel deployment platform
- Notion API v2022-06-28

**Local Development:**

1. Clone this repository
2. Install dependencies: `npm install`
3. Create `.env.local` file with: `NOTION_API_KEY=your_secret_token`
4. Run locally: `npm run dev` (requires Vercel CLI)
5. Frontend will be available at `http://localhost:3000`

**Environment Variables:**
- `NOTION_API_KEY`: Your Notion integration token (required for backend)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Technical Details

### CORS Solution

This application solves Notion API's CORS restrictions through a serverless backend architecture:

1. **Problem**: Browsers block direct requests to Notion API due to CORS policy
2. **Solution**: Serverless functions act as a proxy, making server-side requests where CORS doesn't apply
3. **Endpoints**:
   - `/api/notion/test-connection` - Tests database connectivity
   - `/api/notion/create-page` - Creates new case entries
   - `/api/notion/query-database` - Retrieves recent cases

### API Flow

```
Browser → Serverless Function → Notion API → Response → Browser
```

This eliminates CORS issues while maintaining security and functionality.

## License

This project is open source and available under the [MIT License](LICENSE).

## Support

If you encounter any issues:

1. **Backend Issues**: Ensure your deployment has the `NOTION_API_KEY` environment variable set
2. **CORS Errors**: Make sure you're using the deployed backend URL, not localhost for production
3. **Notion Integration**: Check that your integration has the correct permissions
4. **Database Setup**: Verify your database ID is correct (32 characters)
5. **Properties**: Ensure your database has all the required properties
6. **Console Errors**: Check the browser console for any error messages

For additional help, please open an issue on GitHub.
