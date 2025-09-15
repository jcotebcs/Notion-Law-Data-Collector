
# Notion Law Data Collector

A simple, clean GitHub Pages application for collecting and organizing legal case data directly into your Notion database. This is a single HTML file solution that works immediately on GitHub Pages without any server dependencies.

## Features

- 📝 **Easy Data Entry**: Clean, intuitive form for entering legal case information
- 🔗 **Direct Notion Integration**: Browser-based API calls directly to Notion
- 📱 **Responsive Design**: Works perfectly on desktop, tablet, and mobile devices  
- ⚡ **Instant Deploy**: Works immediately on GitHub Pages - no configuration needed
- 📊 **Recent Entries**: View your recent submissions stored locally
- 🎯 **Zero Dependencies**: Single HTML file with embedded CSS and JavaScript
- 🚀 **GitHub Pages Ready**: Deploy in seconds with just a git push

## Quick Start

1. **Fork this repository**
2. **Enable GitHub Pages** in repository settings (choose main branch)
3. **Visit your GitHub Pages URL** (usually `https://yourusername.github.io/Notion-Law-Data-Collector`)
4. **Get your Notion API key** from [Notion Integrations](https://www.notion.so/my-integrations)
5. **Enter your API key and database ID** in the app
6. **Start collecting data!**

## Why This Approach?

This simplified version removes all the complexity of serverless functions, deployment configurations, and CORS proxies. Instead:

- ✅ **Single File**: Everything embedded in one HTML file
- ✅ **No Server**: Direct browser-to-Notion API communication
- ✅ **No Build Step**: No npm, no dependencies, no compilation
- ✅ **Instant Deploy**: Works immediately on any static hosting
- ✅ **Easy Maintenance**: One file to understand and modify

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
   - **Case Name** (Title) - Main case identifier
   - **Date** (Date) - Case date
   - **Court** (Rich Text) - Court name
   - **Judge** (Rich Text) - Judge name
   - **Case Type** (Select) - Civil, Criminal, Family, Administrative
   - **Status** (Select) - Pending, Active, Closed
   - **Notes** (Rich Text) - Case details

3. Share the database with your integration:
   - Click the "Share" button on your database page
   - Click "Invite" and search for your integration name
   - Give it "Edit" permissions

4. Copy the database ID from the URL (32-character string)

### 3. Use the Application

1. Open your GitHub Pages site
2. Enter your Notion API key (will be saved locally)
3. Enter your database ID
4. Click "Test Connection" to verify
5. Start adding case data!

## Data Fields

The application supports these case data fields:

- **Case Name** (Required) - The name/title of the case
- **Case Date** - Important date related to the case
- **Court** - Name of the court handling the case
- **Judge** - Name of the presiding judge
- **Case Type** - Type of case (Civil, Criminal, Family, Administrative)
- **Status** - Current status (Pending, Active, Closed)
- **Notes** - Additional case details

## Browser Compatibility

This application works in all modern browsers that support:
- ES6+ JavaScript features
- Fetch API
- Local Storage
- CSS Grid and Flexbox

## Security & Privacy

- **Client-Side Only**: No server to compromise
- **Local Storage**: API keys stored in browser's local storage
- **Direct API**: Secure HTTPS communication with Notion
- **No Third-Party**: No data passes through external services

## Troubleshooting

### Common Issues

**CORS Errors:**
- This shouldn't occur with modern browsers and HTTPS
- Ensure you're accessing via GitHub Pages, not opening the file directly

**Connection Failed:**
- Verify your API key starts with `secret_`
- Check that your database ID is exactly 32 characters
- Ensure your integration has access to the database

**Database Not Found:**
- Verify the database ID from the URL
- Make sure you've shared the database with your integration
- Check that the integration has "Edit" permissions

### Getting Help

1. Check the browser console for error messages
2. Verify your Notion integration setup
3. Test your integration using the "Test Connection" button
4. Open an issue on GitHub with details about your problem

## Contributing

1. Fork the repository
2. Make your changes to `index.html`
3. Test thoroughly by opening the file in a browser
4. Submit a pull request

## License

This project is open source and available under the [MIT License](LICENSE).

## Acknowledgments

- Built for the legal community to streamline case data management
- Powered by Notion's robust API and database capabilities
- Designed with simplicity and ease-of-use as top priorities
