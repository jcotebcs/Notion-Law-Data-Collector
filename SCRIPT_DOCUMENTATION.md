# Notion Law Data Collector Script

This Python script (`script.py`) is the core component of the Notion Law Data Collector that fetches data from Notion databases and integrates with CourtListener for enhanced legal case information.

## Features

### Core Functionality
- ✅ **Notion API Integration**: Fetches all pages from a Notion database with automatic pagination
- ✅ **Data Processing**: Extracts and processes legal case fields (Case Name, Date, Court, Judge, Case Type, Status, Notes)
- ✅ **JSON Output**: Generates structured JSON files for frontend consumption
- ✅ **Error Handling**: Robust error handling with fallback data structures

### CourtListener Integration (New!)
- 🆕 **Case Search**: Automatically searches CourtListener for matching cases
- 🆕 **Enhanced Data**: Adds court records, docket numbers, and case URLs
- 🆕 **Statistics**: Tracks search success rates in summary data
- 🆕 **Optional**: Works with or without CourtListener API key

## Environment Variables

### Required
- `NOTION_TOKEN`: Your Notion integration token (starts with `secret_`)
- `NOTION_DATABASE_ID`: The 32-character database ID from your Notion database URL

### Optional
- `COURT_LISTENER_API_KEY`: CourtListener API token for enhanced case searches

## Data Fields Supported

The script automatically detects and processes these Notion database fields:

| Field Name | Notion Type | Description |
|------------|-------------|-------------|
| Case Name / Name | Title | The name/title of the case (required) |
| Date / Case Date | Date | Important date related to the case |
| Court | Rich Text | Name of the court handling the case |
| Judge | Rich Text | Name of the presiding judge |
| Case Type / Type | Select | Type/category of the case |
| Status | Select | Current status of the case |
| Notes | Rich Text | Additional case details and notes |

## Output Files

### `data/notion-data.json`
Complete dataset with:
- Database metadata and info
- All processed case entries
- CourtListener search results (if enabled)
- Processing metadata and timestamps

### `data/summary.json`
Statistical summary with:
- Total case counts
- Status and case type distributions
- CourtListener search statistics
- Recent cases list

## Usage

### Local Usage
```bash
# Set environment variables
export NOTION_TOKEN="secret_your_notion_token"
export NOTION_DATABASE_ID="your_32_character_database_id"
export COURT_LISTENER_API_KEY="your_courtlistener_key"  # Optional

# Run the script
python3 script.py
```

### GitHub Actions Usage
The script is automatically used by the GitHub Actions workflow (`.github/workflows/fetch-notion-data.yml`) which:
1. Runs every 30 minutes
2. Uses repository secrets for configuration
3. Commits updated data back to the repository
4. Serves data via GitHub Pages

## CourtListener Integration Details

When a CourtListener API key is provided, the script:

1. **Searches each case** using the case name as the query
2. **Retrieves up to 5 results** per case from CourtListener's opinion database
3. **Extracts relevant data** including:
   - Matching case names
   - Filing dates
   - Court information
   - Docket numbers
   - Direct URLs to cases
4. **Adds search metadata** including timestamps and result counts
5. **Generates statistics** on search success rates

### Example CourtListener Data Structure
```json
{
  "courtlistener_search": {
    "total_results": 15,
    "results": [
      {
        "case_name": "Smith v. Johnson",
        "date_filed": "2023-05-15",
        "court": "Supreme Court of California",
        "docket_number": "S123456",
        "url": "https://www.courtlistener.com/opinion/...",
        "cluster_id": 789456
      }
    ],
    "search_query": "Smith v. Johnson",
    "searched_at": "2024-01-15T10:30:00.000Z"
  }
}
```

## Error Handling

The script includes comprehensive error handling:
- **Connection errors**: Graceful handling of API failures
- **Missing data**: Safe extraction with empty defaults
- **Rate limiting**: Built-in retry logic for API requests
- **Validation**: Field validation and data type checking

## Compatibility

The script maintains backward compatibility with the existing frontend while adding new features:
- ✅ **Frontend Compatible**: Uses the same data structure expected by `index.html`
- ✅ **GitHub Actions Compatible**: Replaces inline Python code in workflow
- ✅ **Extensible**: Easy to add new data fields or integrations

## Requirements

- Python 3.8+
- `requests` library
- Valid Notion integration with database access
- Optional: CourtListener API access for enhanced features