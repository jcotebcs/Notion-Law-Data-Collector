
# Notion Law Data Collector

A static web application for collecting and organizing legal case data directly into your Notion database. This application runs entirely in the browser and is hosted on GitHub Pages.

## Features

- 📝 **Easy Data Entry**: Intuitive form for entering legal case information
- 🔗 **Direct Notion Integration**: Connects directly to your Notion database via API
- 📱 **Responsive Design**: Works on desktop, tablet, and mobile devices
- 🔒 **Secure**: All data is processed client-side, no server required
- ⚡ **Fast**: Static hosting means instant loading
- 📊 **Recent Cases View**: See your latest entries at a glance

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

### 3. Configure the Application

1. Open the application in your browser
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

- All data processing happens in your browser
- Your Notion token is stored locally in your browser only
- No data is sent to any third-party servers
- Direct connection to Notion's official API

## Browser Compatibility

This application works in all modern browsers that support:
- ES6+ JavaScript features
- Fetch API
- Local Storage
- CSS Grid and Flexbox

## Development

This is a static web application built with:
- HTML5
- CSS3 (with CSS Grid and Flexbox)
- Vanilla JavaScript (ES6+)
- Notion API v2022-06-28

To run locally:
1. Clone this repository
2. Serve the files using any static web server
3. For example: `python -m http.server 8000`

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
4. Check the browser console for any error messages

For additional help, please open an issue on GitHub.
