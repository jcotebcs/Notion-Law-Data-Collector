#!/usr/bin/env python3
"""
Notion Law Data Collector Script with CourtListener Integration

This script fetches data from a Notion database using the Notion API and saves it as JSON files.
It also includes functionality to search CourtListener API for case information.
It is designed to be used in a GitHub Actions workflow, but can be run locally with appropriate environment variables.

Requirements:
- Python 3.8+
- requests library (pip install requests)
- NOTION_TOKEN environment variable: Notion integration token
- NOTION_DATABASE_ID environment variable: Notion database ID
- Optional: COURT_LISTENER_API_KEY environment variable for CourtListener searches

Data Fields Supported:
- Case Name (title)
- Date/Case Date (date)
- Court (rich_text)
- Judge (rich_text)
- Case Type (select)
- Status (select)
- Notes (rich_text)

CourtListener Search:
- Searches for cases by name using CourtListener API
- Adds search results to case data

Usage:
python script.py
"""

import os
import json
import requests
from datetime import datetime

# Configuration
NOTION_TOKEN = os.getenv('NOTION_TOKEN')
NOTION_DATABASE_ID = os.getenv('NOTION_DATABASE_ID')
COURT_LISTENER_API_KEY = os.getenv('COURT_LISTENER_API_KEY')

if not NOTION_TOKEN or not NOTION_DATABASE_ID:
    raise ValueError("NOTION_TOKEN and NOTION_DATABASE_ID environment variables must be set.")

headers = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28"
}

def fetch_notion_data():
    """Fetch all pages from the Notion database."""
    url = f"https://api.notion.com/v1/databases/{NOTION_DATABASE_ID}/query"
    data = {"page_size": 100}  # Notion max page_size is 100
    all_results = []

    while True:
        response = requests.post(url, headers=headers, json=data)
        response.raise_for_status()
        results = response.json()
        all_results.extend(results['results'])

        if not results.get('has_more'):
            break

        data['start_cursor'] = results['next_cursor']

    return all_results

def process_page(page):
    """Process a single Notion page into a dictionary with supported fields."""
    properties = page.get('properties', {})

    processed = {
        'id': page['id'],
        'created_time': page['created_time'],
        'last_edited_time': page['last_edited_time'],
        'case_name': '',
        'case_date': None,
        'court': '',
        'judge': '',
        'case_type': '',
        'status': '',
        'notes': '',
        'courtlistener_search': None  # Will be populated if API key available
    }

    # Case Name - Title property (try multiple field names)
    for field_name in ['Case Name', 'Name']:
        title_prop = properties.get(field_name, {}).get('title', [])
        if title_prop:
            processed['case_name'] = title_prop[0].get('plain_text', '')
            break

    # Date/Case Date - Date property (try multiple field names)
    for field_name in ['Date', 'Case Date']:
        date_prop = properties.get(field_name, {}).get('date')
        if date_prop:
            processed['case_date'] = {
                'start': date_prop.get('start'),
                'end': date_prop.get('end')
            }
            break

    # Court - Rich text
    court_prop = properties.get('Court', {}).get('rich_text', [])
    processed['court'] = ' '.join([rt.get('plain_text', '') for rt in court_prop])

    # Judge - Rich text
    judge_prop = properties.get('Judge', {}).get('rich_text', [])
    processed['judge'] = ' '.join([rt.get('plain_text', '') for rt in judge_prop])

    # Case Type - Select (try multiple field names)
    for field_name in ['Case Type', 'Type']:
        type_prop = properties.get(field_name, {}).get('select')
        if type_prop:
            processed['case_type'] = type_prop.get('name', '')
            break

    # Status - Select
    status_prop = properties.get('Status', {}).get('select')
    if status_prop:
        processed['status'] = status_prop.get('name', '')

    # Notes - Rich text
    notes_prop = properties.get('Notes', {}).get('rich_text', [])
    processed['notes'] = '\n'.join([rt.get('plain_text', '') for rt in notes_prop])

    return processed

def search_courtlistener_cases(case_name, api_key):
    """
    Search for cases in CourtListener API using the case name.
    
    Returns the first 5 relevant results or None if no API key.
    """
    if not api_key:
        return None
    
    url = "https://www.courtlistener.com/api/rest/v3/search/"
    params = {
        'q': case_name,
        'type': 'o',  # opinions
        'format': 'json',
        'fields': 'caseName,dateFiled,court,docketNumber,absolute_url,cluster',
        'page_size': 5
    }
    headers = {
        'Authorization': f'Token {api_key}'
    }
    
    try:
        response = requests.get(url, params=params, headers=headers)
        response.raise_for_status()
        data = response.json()
        
        if 'results' in data:
            # Process results to extract relevant information
            processed_results = []
            for result in data['results']:
                processed_result = {
                    'case_name': result.get('caseName', ''),
                    'date_filed': result.get('dateFiled'),
                    'court': result.get('court', {}).get('full_name', '') if result.get('court') else '',
                    'docket_number': result.get('docketNumber'),
                    'url': result.get('absolute_url'),
                    'cluster_id': result.get('cluster', {}).get('id') if result.get('cluster') else None
                }
                processed_results.append(processed_result)
            
            return {
                'total_results': data.get('count', 0),
                'results': processed_results,
                'search_query': case_name,
                'searched_at': datetime.utcnow().isoformat()
            }
        else:
            return None
    except requests.exceptions.RequestException as e:
        print(f"Error searching CourtListener for '{case_name}': {e}")
        return None

def generate_summary(cases):
    """Generate a summary JSON with statistics."""
    total_cases = len(cases)
    statuses = {}
    case_types = {}
    courtlistener_searches = 0
    successful_searches = 0
    
    for case in cases:
        status = case['status']
        if status:
            statuses[status] = statuses.get(status, 0) + 1
        ctype = case['case_type']
        if ctype:
            case_types[ctype] = case_types.get(ctype, 0) + 1
        
        if case.get('courtlistener_search'):
            courtlistener_searches += 1
            if case['courtlistener_search'].get('results'):
                successful_searches += 1

    summary = {
        'last_updated': datetime.utcnow().isoformat(),
        'total_cases': total_cases,
        'status_distribution': statuses,
        'case_type_distribution': case_types,
        'courtlistener_searches': {
            'total_searches': courtlistener_searches,
            'successful_searches': successful_searches,
            'search_rate': round((successful_searches / courtlistener_searches * 100) if courtlistener_searches > 0 else 0, 2)
        },
        'recent_cases': [case['case_name'] for case in sorted(cases, key=lambda x: x['case_date']['start'] if x['case_date'] and x['case_date']['start'] else '0000-00-00', reverse=True)][:5] if cases else []
    }

    return summary

def main():
    # Ensure data directory exists
    os.makedirs('data', exist_ok=True)
    
    try:
        print("Fetching data from Notion...")
        
        # First, get database info for metadata
        db_url = f"https://api.notion.com/v1/databases/{NOTION_DATABASE_ID}"
        db_response = requests.get(db_url, headers=headers)
        db_response.raise_for_status()
        database_info = db_response.json()
        
        pages = fetch_notion_data()
        print(f"Fetched {len(pages)} pages.")

        cases = [process_page(page) for page in pages]
        
        # Perform CourtListener searches if API key available
        if COURT_LISTENER_API_KEY:
            print("Searching CourtListener for case information...")
            for case in cases:
                if case['case_name'].strip():  # Only search if case name exists
                    print(f"  Searching for: {case['case_name']}")
                    search_results = search_courtlistener_cases(case['case_name'], COURT_LISTENER_API_KEY)
                    case['courtlistener_search'] = search_results
                    if search_results:
                        print(f"    Found {len(search_results.get('results', []))} results")
        else:
            print("CourtListener API key not found. Skipping case searches.")

        # Create the data structure that matches the existing frontend expectations
        output_data = {
            'lastUpdated': datetime.utcnow().isoformat(),
            'status': 'success',
            'databaseInfo': {
                'id': database_info.get('id'),
                'title': database_info.get('title', [{}])[0].get('plain_text', 'Notion Database'),
                'url': database_info.get('url', ''),
                'total_entries': len(cases)
            },
            'entries': cases,  # The processed cases with all fields
            'metadata': {
                'version': '2.0',
                'source': 'notion-law-data-collector-script',
                'fetchedAt': datetime.utcnow().isoformat(),
                'features': {
                    'courtlistener_integration': COURT_LISTENER_API_KEY is not None,
                    'pagination_support': True
                }
            }
        }

        # Save full data in the format expected by frontend
        with open('data/notion-data.json', 'w') as f:
            json.dump(output_data, f, indent=2)

        # Generate and save summary
        summary = generate_summary(cases)
        with open('data/summary.json', 'w') as f:
            json.dump(summary, f, indent=2)

        print("Data saved to JSON files.")
        print(f"✅ Successfully processed {len(cases)} cases")
        if COURT_LISTENER_API_KEY:
            searches = sum(1 for case in cases if case.get('courtlistener_search'))
            successful = sum(1 for case in cases if case.get('courtlistener_search', {}).get('results'))
            print(f"📊 CourtListener searches: {searches} total, {successful} successful")
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        
        # Create error file that matches frontend expectations
        error_data = {
            'lastUpdated': datetime.utcnow().isoformat(),
            'status': 'error',
            'error': str(e),
            'databaseInfo': {'title': 'Error', 'total_entries': 0},
            'entries': [],
            'metadata': {
                'version': '2.0',
                'source': 'notion-law-data-collector-script',
                'fetchedAt': datetime.utcnow().isoformat()
            }
        }
        
        with open('data/notion-data.json', 'w') as f:
            json.dump(error_data, f, indent=2)
            
        # Create empty summary on error
        error_summary = {
            'last_updated': datetime.utcnow().isoformat(),
            'total_cases': 0,
            'status_distribution': {},
            'case_type_distribution': {},
            'courtlistener_searches': {
                'total_searches': 0,
                'successful_searches': 0,
                'search_rate': 0
            },
            'recent_cases': []
        }
        
        with open('data/summary.json', 'w') as f:
            json.dump(error_summary, f, indent=2)
            
        raise

if __name__ == '__main__':
    main()