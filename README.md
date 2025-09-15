# Notion Law Data Collector

A GitHub Actions-powered application for collecting and organizing legal case data from your Notion database. This solution eliminates CORS issues by using GitHub Actions to fetch data and serve it as static files through GitHub Pages.

## Features

- 📝 **Easy Data Viewing**: Clean, intuitive interface for viewing legal case information
- 🔄 **Automated Data Sync**: GitHub Actions fetches data from Notion every 30 minutes
- 🚫 **No CORS Issues**: Data served as static JSON files, no direct browser-to-Notion API calls
- 📱 **Responsive Design**: Works perfectly on desktop, tablet, and mobile devices  
- ⚡ **GitHub Pages Ready**: Deploy automatically with GitHub Actions
- 📊 **Real-time Data**: View your latest Notion database entries
- 🎯 **Zero Client Dependencies**: Pure HTML, CSS, and JavaScript solution
- 🔒 **Secure**: API credentials stored as GitHub repository secrets

## Quick Start

1. **Fork this repository**
2. **Enable GitHub Pages** in repository settings (choose GitHub Actions as source)
3. **Configure Repository Secrets** (see setup instructions below)
4. **Wait for GitHub Actions** to run and fetch your data
5. **Visit your GitHub Pages URL** to view your data

## GitHub Actions Workflow

The application uses a GitHub Actions workflow (`.github/workflows/fetch-notion-data.yml`) that:

- Runs every 30 minutes automatically
- Can be triggered manually from the Actions tab
- Fetches data from your Notion database using the API
- Processes and stores data as JSON files in the `/data` directory
- Commits the updated files back to the repository
- Makes data available through GitHub Pages

## Setup Instructions

### 1. Create a Notion Integration

1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. Click "New integration"
3. Give it a name like "Law Data Collector"
4. Select the workspace where your database is located
5. Copy the "Internal Integration Token" (starts with `secret_`)

### 2. Get Your Database ID

1. Open your Notion database
2. Copy the URL from your browser
3. Extract the 32-character database ID from the URL
   - Example: `https://notion.so/yourworkspace/40c4cef5c8cd4cb4891a35c3710df6e9?v=...`
   - Database ID: `40c4cef5c8cd4cb4891a35c3710df6e9`

### 3. Share Database with Integration

1. In your Notion database, click the "..." menu
2. Select "Add connections"
3. Find and select your integration
4. Grant the integration access to the database

### 4. Configure Repository Secrets

1. In your forked repository, go to Settings → Secrets and variables → Actions
2. Add these repository secrets:

   **NOTION_TOKEN**: Your Notion integration token (from step 1)
   ```
   secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

   **NOTION_DATABASE_ID**: Your database ID (from step 2)
   ```
   40c4cef5c8cd4cb4891a35c3710df6e9
   ```

### 5. Enable GitHub Actions and Pages

1. Go to the **Actions** tab and enable workflows if prompted
2. Go to **Settings → Pages**
3. Under "Source", select "GitHub Actions"
4. The workflow will run automatically and deploy your site

### 6. Use the Application

1. Wait for the first workflow run to complete (check the Actions tab)
2. Visit your GitHub Pages URL (usually `https://yourusername.github.io/Notion-Law-Data-Collector`)
3. The application will automatically load your Notion data
4. Use "Refresh Data" button to reload the latest data

## Data Fields

The application supports these case data fields from your Notion database:

- **Case Name** - The name/title of the case (title property)
- **Date/Case Date** - Important date related to the case (date property)
- **Court** - Name of the court handling the case (rich text)
- **Judge** - Name of the presiding judge (rich text)
- **Case Type** - Type of case (select property)
- **Status** - Current status (select property)
- **Notes** - Additional case details (rich text)

## How It Works

### Data Flow
1. **GitHub Actions Workflow** runs on schedule or manual trigger
2. **Fetches data** from Notion API using repository secrets
3. **Processes and formats** the data for the frontend
4. **Saves JSON files** to `/data` directory
5. **Commits changes** back to repository
6. **GitHub Pages serves** the updated static files
7. **Frontend loads** data from local JSON files (no CORS issues)

### File Structure
```
/data/
├── notion-data.json    # Complete database entries with metadata
└── summary.json        # Summary information and status
```

## Why This Approach?

This GitHub Actions approach solves several problems:

- ✅ **No CORS Issues**: Data fetched server-side, served as static files
- ✅ **Secure**: API credentials never exposed to browsers
- ✅ **Automatic Updates**: Data refreshes every 30 minutes
- ✅ **Version Control**: Data changes are tracked in git history
- ✅ **No External Dependencies**: Everything runs on GitHub infrastructure
- ✅ **Cost Effective**: Free for public repositories

## Browser Compatibility

This application works in all modern browsers that support:
- ES6+ JavaScript features
- Fetch API
- Local Storage
- CSS Grid and Flexbox

## Troubleshooting

### Common Issues

**Workflow Fails with Authentication Error:**
- Verify your `NOTION_TOKEN` secret is correct and starts with `secret_`
- Ensure your `NOTION_DATABASE_ID` is exactly 32 characters
- Check that your integration has access to the database

**No Data Showing:**
- Check the Actions tab for workflow run status
- Verify that the workflow completed successfully
- Make sure GitHub Pages is enabled and source is set to "GitHub Actions"

**Data Not Updating:**
- Workflow runs every 30 minutes automatically
- You can manually trigger it from the Actions tab
- Check the last commit to see when data was updated

**Database Not Found:**
- Verify the database ID from the URL
- Make sure you've shared the database with your integration
- Check that the integration has "Read" permissions

### Manual Workflow Trigger

1. Go to the **Actions** tab in your repository
2. Click on "Fetch Notion Data" workflow
3. Click "Run workflow" button
4. Select the main branch and click "Run workflow"

## Contributing

1. Fork the repository
2. Make your changes to the workflow or frontend code
3. Test thoroughly with your own Notion database
4. Submit a pull request

## License

This project is open source and available under the [MIT License](LICENSE).

## Acknowledgments

- Built for the legal community to streamline case data management
- Powered by Notion's robust API and GitHub Actions
- Designed to eliminate CORS issues while maintaining simplicity