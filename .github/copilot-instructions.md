# Copilot Instructions for Pipeline Valuation Web App

## Project Overview
This is a web application for exploring and analyzing FERC pipeline data stored in SQLite. The app consists of:
- Express.js backend (`server.js`)
- Static frontend (`public/index.html`, `public/main.js`)
- Two SQLite databases:
  - Main FERC database (`ferc6_dbf.sqlite`) - read-only access
  - Application database (`app_data.sqlite`) - stores user evaluations

## Key Architecture Patterns

### Database Architecture
- Main FERC DB is accessed read-only, located at `C:\Users\Adam\Downloads\ferc6_dbf.sqlite`
- App DB (`app_data.sqlite`) created automatically with two tables:
  ```sql
  pipelines(id, name, company, description)
  evaluations(id, pipeline_id, evaluator, notes, created_at)
  ```

### API Design Pattern
RESTful endpoints under `/api`:
- `GET /api/tables` - List available tables
- `GET /api/table/:name/rows` - Get rows from a table
- `GET /api/search?company=...` - Search pipelines
- `GET /api/pipeline/:id/evaluations` - Get evaluations
- `POST /api/evaluations` - Create evaluation

### Frontend Architecture
- Single page app with vanilla JavaScript
- Direct DOM manipulation for UI updates
- Utility function `$fetch()` wraps fetch API with error handling
- Table rendering via innerHTML with sanitized data

## Development Workflows

### Local Development
1. Install dependencies: `npm install`
2. Start server: `npm start`
3. Access UI: http://localhost:3000

### Database Access
- FERC DB queries should target specific tables like `f6_general_info`
- Always use parameterized queries to prevent SQL injection
- Custom SQL via UI is intentionally limited to read-only operations

### Error Handling Pattern
- Backend: Express error middleware catches and formats errors
- Frontend: Failed API calls show error messages in result area
- DB connection errors fallback to in-memory SQLite when needed

## Project-Specific Conventions

### Code Organization
- Backend logic centralized in `server.js`
- Frontend code split between structure (`index.html`) and behavior (`main.js`)
- API response format standardized to `{error: string}` for errors

### Query Patterns
Example of proper FERC DB query:
```javascript
const q = `
  SELECT DISTINCT
    rowid as id,
    respondent_name as company,
    pipeline_system_name as name
  FROM f6_general_info 
  WHERE lower(respondent_name) LIKE ?
  ORDER BY filing_year DESC`;
```

### Security Considerations
- FERC DB opened in READONLY mode
- Custom SQL validated against dangerous operations
- File paths sanitized in table/row APIs

## Integration Points
- Frontend JavaScript integration via `/api` endpoints
- SQLite3 Node.js driver for database access
- Static file serving from `public/` directory

## Development Tips
- Use the browser dev tools network panel to debug API calls
- Check server console for detailed DB connection status
- Test search with known company names from f6_general_info table