const path = require('path');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const xbrlParser = require('./xbrl_parser');
const app = express();
const PORT = process.env.PORT || 3000;

// Global error handlers
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

console.log('Starting server with XBRL data from: Ferc Current data xlbr/');

const fs = require('fs');

// Application-local DB to store evaluations only
const APP_DB_PATH = path.join(__dirname, 'app_data.sqlite');
const appDb = new sqlite3.Database(APP_DB_PATH, (err) => {
  if (err) return console.error('Failed to open app DB', err.message);
  console.log('Opened app DB at', APP_DB_PATH);
});

// Create app tables for pipeline evaluations and financial metrics
appDb.serialize(() => {
  // Main pipeline evaluations table
  appDb.run(`CREATE TABLE IF NOT EXISTS pipelines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ferc_id TEXT NOT NULL,
    name TEXT NOT NULL,
    company TEXT NOT NULL,
    system_type TEXT,
    filing_year INTEGER,
    description TEXT,
    last_updated DATETIME DEFAULT (datetime('now'))
  )`);

  // Detailed pipeline evaluations
  appDb.run(`CREATE TABLE IF NOT EXISTS evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pipeline_id TEXT NOT NULL,
    evaluator TEXT NOT NULL,
    evaluation_date DATETIME DEFAULT (datetime('now')),
    throughput_mmcfd DECIMAL(10,2),
    capacity_utilization DECIMAL(5,2),
    revenue_requirement DECIMAL(12,2),
    rate_model TEXT,
    competitive_analysis TEXT,
    market_share DECIMAL(5,2),
    financial_metrics TEXT,
    risk_factors TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT (datetime('now'))
  )`);
  
  // Add missing columns if they don't exist (for backwards compatibility)
  appDb.run(`ALTER TABLE evaluations ADD COLUMN evaluation_date DATETIME DEFAULT (datetime('now'))`, () => {});
  appDb.run(`ALTER TABLE evaluations ADD COLUMN created_at DATETIME DEFAULT (datetime('now'))`, () => {});

  // Financial metrics tracking
  appDb.run(`CREATE TABLE IF NOT EXISTS financial_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pipeline_id INTEGER NOT NULL,
    year INTEGER NOT NULL,
    operating_revenue DECIMAL(12,2),
    operating_expenses DECIMAL(12,2),
    net_income DECIMAL(12,2),
    rate_base DECIMAL(12,2),
    return_on_equity DECIMAL(5,2),
    debt_ratio DECIMAL(5,2),
    cost_of_service DECIMAL(12,2),
    FOREIGN KEY(pipeline_id) REFERENCES pipelines(id)
  )`);
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Test endpoint
app.get('/api/test', (req, res) => {
  console.log('[TEST] Request received');
  res.json({ message: 'Hello World' });
});

// Old database endpoints removed - now using XBRL files
// These endpoints are no longer needed with XBRL data source

// --- New endpoints to support company search, pipelines and evaluations ---

// Search pipelines by company keyword using XBRL files
app.get('/api/search', async (req, res) => {
  console.log('[SEARCH] Request received:', req.query);
  const company = (req.query.company || '').trim();
  if (!company) {
    console.log('[SEARCH] No company param');
    return res.status(400).json({ error: 'company query param required' });
  }
  
  try {
    console.log('[SEARCH] Calling searchCompanies with:', company);
    const results = await xbrlParser.searchCompanies(company);
    console.log(`[SEARCH] Found ${results.length} results for search: "${company}"`);
    console.log('[SEARCH] First result:', results[0]);
    console.log('[SEARCH] Sending response...');
    res.json(results);
    console.log('[SEARCH] Response sent successfully');
  } catch (err) {
    console.error('[SEARCH] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get financial data for a specific pipeline using XBRL
app.get('/api/pipeline/:id/financial', async (req, res) => {
  const fileId = req.params.id;
  console.log(`[FINANCIAL] Request for file: ${fileId}`);
  
  try {
    const financials = await xbrlParser.getCompanyFinancials(fileId);
    
    if (!financials) {
      console.error(`[FINANCIAL] Parser returned null for ${fileId}`);
      return res.status(404).json({ error: 'Pipeline not found' });
    }
    
    console.log(`[FINANCIAL] Successfully parsed ${fileId}`);
    
    // Return data in expected format
    res.json({
      company_name: financials.company_name,
      report_year: 2024,
      operating_revenue: financials.operating_revenue,
      operating_expenses: financials.operating_expenses,
      net_income: financials.net_income,
      ebitda: financials.ebitda,
      total_assets: financials.total_assets,
      carrier_property: financials.carrier_property,
      detailed_property: financials.carrier_property
    });
  } catch (err) {
    console.error(`[FINANCIAL] Error for ${fileId}:`, err);
    res.status(500).json({ error: err.message });
  }
});

// Get evaluations for a pipeline
app.get('/api/pipeline/:id/evaluations', (req, res) => {
  const fileId = req.params.id;
  appDb.all('SELECT * FROM evaluations WHERE pipeline_id = ? ORDER BY evaluation_date DESC', [fileId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Create an evaluation for a pipeline
app.post('/api/evaluations', (req, res) => {
  const { pipeline_id, evaluator, notes } = req.body || {};
  if (!pipeline_id) return res.status(400).json({ error: 'pipeline_id required' });
  appDb.run('INSERT INTO evaluations (pipeline_id, evaluator, notes) VALUES (?,?,?)', [pipeline_id, evaluator || null, notes || null], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID });
  });
});

// Express error handler
app.use((err, req, res, next) => {
  console.error('Express error:', err);
  res.status(500).json({ error: 'Server error', detail: err.message });
});

// Pipeline Details API - using XBRL data
app.get('/api/pipeline/:id/overview', async (req, res) => {
  const fileId = req.params.id;
  console.log(`[OVERVIEW] Request for file: ${fileId}`);
  
  try {
    const financials = await xbrlParser.getCompanyFinancials(fileId);
    
    if (!financials) {
      console.error(`[OVERVIEW] Parser returned null for ${fileId}`);
      return res.status(404).json({ error: 'Pipeline not found' });
    }
    
    console.log(`[OVERVIEW] Successfully parsed ${fileId}`);
    
    // Return overview data
    res.json({
      id: fileId,
      company: financials.company_name,
      name: financials.company_name,
      filing_year: 2024,
      date_incorporated: 'N/A',
      state: 'N/A',
      original_name: 'N/A'
    });
  } catch (err) {
    console.error(`[OVERVIEW] Error for ${fileId}:`, err);
    res.status(500).json({ error: err.message });
  }
});

// Detailed company information from XBRL
app.get('/api/pipeline/:id/details', async (req, res) => {
  const fileId = req.params.id;
  console.log(`[DETAILS] Request for file: ${fileId}`);
  
  try {
    const details = await xbrlParser.getDetailedInfo(fileId);
    
    if (!details) {
      console.error(`[DETAILS] Parser returned null for ${fileId}`);
      return res.status(404).json({ error: 'Details not found' });
    }
    
    console.log(`[DETAILS] Successfully parsed ${fileId}`);
    res.json(details);
  } catch (err) {
    console.error(`[DETAILS] Error for ${fileId}:`, err);
    res.status(500).json({ error: err.message });
  }
});

// Financial Metrics API
app.get('/api/pipeline/:id/financials', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    // Get financial metrics from app database
    appDb.all(`
      SELECT 
        year,
        operating_revenue,
        operating_expenses,
        net_income,
        rate_base,
        return_on_equity,
        debt_ratio,
        cost_of_service
      FROM financial_metrics 
      WHERE pipeline_id = ?
      ORDER BY year DESC
    `, [id], (err, metrics) => {
      if (err) return res.status(500).json({ error: err.message });
      
      // Transform into year-based structure
      const years = [...new Set(metrics.map(m => m.year))];
      const metricsMap = metrics.reduce((acc, m) => {
        acc[m.year] = m;
        return acc;
      }, {});
      
      res.json({ years, metrics: metricsMap });
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
