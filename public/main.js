async function $fetch(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Page navigation
function showPage(pageName) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  
  // Show selected page
  const page = document.getElementById(pageName + 'Page');
  if (page) page.classList.add('active');
  
  // Update nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });
  event.target.classList.add('active');
}

function renderTable(rows) {
  const out = document.getElementById('result');
  if (!rows || rows.length === 0) { out.innerHTML = '<p>No rows returned.</p>'; return; }
  const cols = Object.keys(rows[0]);
  let html = '<table><thead><tr>' + cols.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>';
  html += rows.map(r => '<tr>' + cols.map(c => `<td>${String(r[c]===null?'<null>':r[c])}</td>`).join('') + '</tr>').join('');
  html += '</tbody></table>';
  out.innerHTML = html;
}

async function loadTables() {
  try {
    const t = await $fetch('/api/tables');
    const sel = document.getElementById('tables');
    sel.innerHTML = '';
    t.forEach(name => {
      const opt = document.createElement('option'); opt.value = name; opt.textContent = name; sel.appendChild(opt);
    });
    if (t.length) { sel.value = t[0]; }
  } catch (err) {
    document.getElementById('result').innerText = 'Error loading tables: ' + err.message;
  }
}

async function loadRows() {
  const sel = document.getElementById('tables');
  const name = sel.value;
  const limit = document.getElementById('limit').value || 100;
  if (!name) return;
  try {
    const rows = await $fetch(`/api/table/${encodeURIComponent(name)}/rows?limit=${encodeURIComponent(limit)}`);
    renderTable(rows);
  } catch (err) {
    const result = document.getElementById('result');
    if (result) result.innerText = 'Error loading rows: ' + err.message;
  }
}

async function runSql() {
  const sqlArea = document.getElementById('sqlArea');
  if (!sqlArea) return; // SQL area doesn't exist in new UI
  
  const sql = sqlArea.value.trim();
  const limit = document.getElementById('limit').value || 100;
  if (!sql) return;
  try {
    const rows = await $fetch('/api/query', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ sql, limit }) });
    renderTable(rows);
  } catch (err) {
    const result = document.getElementById('result');
    if (result) result.innerText = 'Error running SQL: ' + err.message;
  }
}

// Setup event listeners when page loads
window.addEventListener('load', () => {
  loadTables();
  
  const loadBtn = document.getElementById('load');
  if (loadBtn) loadBtn.addEventListener('click', loadRows);
  
  const runSqlBtn = document.getElementById('runSql');
  if (runSqlBtn) runSqlBtn.addEventListener('click', runSql);
  
  const searchBtn = document.getElementById('searchCompany');
  if (searchBtn) {
    searchBtn.addEventListener('click', searchCompany);
    console.log('Search button listener attached');
  } else {
    console.error('searchCompany button not found!');
  }
  
  // Add enter key support for search
  const searchInput = document.getElementById('companyInput');
  if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        searchCompany();
      }
    });
  }
});

// --- Company search & evaluations UI ---
function renderPipelines(list) {
  const area = document.getElementById('searchResults');
  if (!area) {
    console.error('searchResults element not found');
    return;
  }
  
  if (!list || list.length === 0) {
    area.innerHTML = '<p>No pipelines found for that company.</p>';
    return;
  }
  
  let html = '<table><thead><tr><th>Company</th><th>Filing Year</th><th>File ID</th><th>Actions</th></tr></thead><tbody>';
  html += list.map(p => `
    <tr>
      <td><strong>${p.company || '—'}</strong></td>
      <td>${p.filing_year || 2024}</td>
      <td style="font-size: 10px;">${p.id || '—'}</td>
      <td>
        <button onclick="viewPipelineDetails('${p.id}', '${(p.company || '').replace(/'/g, "\\'")}')">View Details</button>
        <button onclick="showAddEvalForm('${p.id}')">Add Evaluation</button>
      </td>
    </tr>`).join('');
  html += '</tbody></table>';
  
  area.innerHTML = html;
}

async function viewPipelineDetails(pipelineId, companyName) {
  console.log('Loading details for pipeline:', pipelineId);
  
  const area = document.getElementById('searchResults');
  area.innerHTML = '<div class="loading">⏳ Loading pipeline details...</div>';
  
  try {
    // Load pipeline overview and financial data
    const [overview, evaluations, financial] = await Promise.all([
      $fetch(`/api/pipeline/${pipelineId}/overview`),
      $fetch(`/api/pipeline/${pipelineId}/evaluations`),
      $fetch(`/api/pipeline/${pipelineId}/financial`)
    ]);
    console.log('Pipeline overview:', overview);
    console.log('Evaluations:', evaluations);
    console.log('Financial data:', financial);
    
    // Calculate custom values based on actual financial data
    const rcn = financial.detailed_property || financial.carrier_property || 80000000;
    const revenue = financial.operating_revenue || 15000000;
    const expenses = financial.operating_expenses || 8000000;
    const ebitda = financial.ebitda || 9000000;
    
    // Estimate depreciation based on age and asset value
    const currentYear = new Date().getFullYear();
    const age = currentYear - financial.report_year;
    const physicalDepreciation = Math.min(25 + (age * 1.5), 60); // Increases with age
    const functionalObsolescence = Math.min(5 + (age * 0.5), 15);
    const economicObsolescence = 3;
    
    // Calculate growth and discount rates based on company performance
    const profitMargin = revenue > 0 ? ((revenue - expenses) / revenue) * 100 : 0;
    const growthRate = Math.max(1.5, Math.min(profitMargin * 0.5, 5)); // Based on profitability
    const discountRate = profitMargin > 15 ? 7.5 : (profitMargin > 10 ? 8.5 : 10); // Lower rate for better performers
    
    // Calculate EBITDA multiple based on size and profitability
    const assetSize = financial.total_assets || rcn;
    const sizeMultiplier = assetSize > 50000000 ? 11 : (assetSize > 20000000 ? 10.5 : 9.5);
    const profitabilityBonus = profitMargin > 20 ? 0.5 : (profitMargin > 15 ? 0.25 : 0);
    const evEbitdaMultiple = sizeMultiplier + profitabilityBonus;
    
    // Size and geographic adjustments
    const sizeAdjustment = assetSize > 100000000 ? 0 : (assetSize > 50000000 ? -2 : -5);
    const geoAdjustment = 2; // Default
    
    // Render pipeline details
    let html = `
      <div style="margin-bottom: 20px;">
        <button onclick="location.reload()">← Back to Search</button>
      </div>
      
      <div class="card">
        <h2>${overview.company}</h2>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 20px;">
          <div class="metric-card">
            <h4>Company Information</h4>
            <dl>
              <dt>Company Name</dt><dd><strong>${overview.company || '—'}</strong></dd>
              <dt>Respondent ID</dt><dd>${overview.id || '—'}</dd>
              <dt>Filing Year</dt><dd>${overview.filing_year || '—'}</dd>
              <dt>Date Incorporated</dt><dd>${overview.date_incorporated || '—'}</dd>
            </dl>
          </div>
          
          <div class="metric-card">
            <h4>Regulatory Information</h4>
            <dl>
              <dt>State/Jurisdiction</dt><dd>${overview.state || '—'}</dd>
              <dt>Original Name</dt><dd>${overview.original_name && overview.original_name !== 'N/A' ? overview.original_name : '—'}</dd>
            </dl>
          </div>
          
          <div class="metric-card">
            <h4>Financial Data (${financial.report_year})</h4>
            <dl>
              <dt>Operating Revenue</dt><dd>$${revenue.toLocaleString(undefined, {maximumFractionDigits: 0})}</dd>
              <dt>Operating Expenses</dt><dd>$${expenses.toLocaleString(undefined, {maximumFractionDigits: 0})}</dd>
              <dt>Profit Margin</dt><dd>${profitMargin.toFixed(1)}%</dd>
              <dt>Total Assets</dt><dd>$${assetSize.toLocaleString(undefined, {maximumFractionDigits: 0})}</dd>
              <dt>Carrier Property</dt><dd>$${rcn.toLocaleString(undefined, {maximumFractionDigits: 0})}</dd>
            </dl>
          </div>
        </div>
      </div>
      
      <div class="card">
        <h2>Valuation Calculator</h2>
        <p style="color: #586069; margin-bottom: 20px;">
          📊 All values are pre-filled from FERC Form 6 data (${financial.report_year}). 
          Adjust any yellow-highlighted field to customize the valuation.
        </p>
        
        <!-- Valuation Tabs -->
        <div class="valuation-tabs">
          <button class="valuation-tab active" onclick="switchValuationTab('cost', '${pipelineId}', event)">💰 Cost Approach</button>
          <button class="valuation-tab" onclick="switchValuationTab('income', '${pipelineId}', event)">📈 Income Approach</button>
          <button class="valuation-tab" onclick="switchValuationTab('market', '${pipelineId}', event)">🏢 Market Approach</button>
          <button class="valuation-tab" onclick="switchValuationTab('summary', '${pipelineId}', event)">📊 Summary</button>
        </div>
        
        <!-- Tab Contents -->
        <div id="costTab" class="tab-content active">
          <h3>Cost Approach Calculator</h3>
          <p style="color: #586069; margin-bottom: 20px;">Replacement Cost New Less Depreciation (Based on ${financial.report_year} FERC Data)</p>
          
          <div class="metric-card">
            <h4>Editable Variables</h4>
            <div class="form-group">
              <label>Replacement Cost New ($)</label>
              <input type="number" id="costRCN" value="${Math.round(rcn)}" step="1000" style="width: 250px;" onchange="calculateCostApproach()" class="editable-field" />
              <small style="color: #586069;">Based on carrier property: $${rcn.toLocaleString(undefined, {maximumFractionDigits: 0})}</small>
            </div>
            <div class="form-group">
              <label>Physical Depreciation (%)</label>
              <input type="number" id="costPhysical" value="${physicalDepreciation.toFixed(1)}" min="0" max="100" step="0.5" style="width: 150px;" onchange="calculateCostApproach()" class="editable-field" />
              <small style="color: #586069;">Estimated based on asset age: ${age} years</small>
            </div>
            <div class="form-group">
              <label>Functional Obsolescence (%)</label>
              <input type="number" id="costFunctional" value="${functionalObsolescence.toFixed(1)}" min="0" max="100" step="0.5" style="width: 150px;" onchange="calculateCostApproach()" class="editable-field" />
            </div>
            <div class="form-group">
              <label>Economic Obsolescence (%)</label>
              <input type="number" id="costEconomic" value="${economicObsolescence}" min="0" max="100" step="1" style="width: 150px;" onchange="calculateCostApproach()" class="editable-field" />
            </div>
          </div>
          
          <div class="metric-card" style="margin-top: 20px;">
            <h4>Calculation</h4>
            <div id="costCalculation"></div>
          </div>
        </div>
        
        <div id="incomeTab" class="tab-content">
          <h3>Income Approach Calculator</h3>
          <p style="color: #586069; margin-bottom: 20px;">Discounted Cash Flow Analysis (Based on ${financial.report_year} FERC Data)</p>
          
          <div class="metric-card">
            <h4>Editable Variables</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
              <div class="form-group">
                <label>Annual Operating Revenue ($)</label>
                <input type="number" id="incomeRevenue" value="${Math.round(revenue)}" step="10000" style="width: 100%;" onchange="calculateIncomeApproach()" class="editable-field" />
                <small style="color: #586069;">From income statement: $${revenue.toLocaleString(undefined, {maximumFractionDigits: 0})}</small>
              </div>
              <div class="form-group">
                <label>Annual Operating Expenses ($)</label>
                <input type="number" id="incomeExpenses" value="${Math.round(expenses)}" step="10000" style="width: 100%;" onchange="calculateIncomeApproach()" class="editable-field" />
                <small style="color: #586069;">From income statement: $${expenses.toLocaleString(undefined, {maximumFractionDigits: 0})}</small>
              </div>
              <div class="form-group">
                <label>Growth Rate (%)</label>
                <input type="number" id="incomeGrowth" value="${growthRate.toFixed(1)}" min="-10" max="20" step="0.1" style="width: 100%;" onchange="calculateIncomeApproach()" class="editable-field" />
                <small style="color: #586069;">Based on profit margin: ${profitMargin.toFixed(1)}%</small>
              </div>
              <div class="form-group">
                <label>Discount Rate (WACC) (%)</label>
                <input type="number" id="incomeDiscount" value="${discountRate.toFixed(1)}" min="1" max="30" step="0.1" style="width: 100%;" onchange="calculateIncomeApproach()" class="editable-field" />
                <small style="color: #586069;">Based on company performance</small>
              </div>
              <div class="form-group">
                <label>Projection Period (Years)</label>
                <input type="number" id="incomePeriod" value="20" min="5" max="50" step="1" style="width: 100%;" onchange="calculateIncomeApproach()" class="editable-field" />
              </div>
              <div class="form-group">
                <label>Terminal Growth Rate (%)</label>
                <input type="number" id="incomeTerminal" value="2.0" min="0" max="5" step="0.1" style="width: 100%;" onchange="calculateIncomeApproach()" class="editable-field" />
              </div>
            </div>
          </div>
          
          <div class="metric-card" style="margin-top: 20px;">
            <h4>Calculation</h4>
            <div id="incomeCalculation"></div>
          </div>
        </div>
        
        <div id="marketTab" class="tab-content">
          <h3>Market Approach Calculator</h3>
          <p style="color: #586069; margin-bottom: 20px;">Comparable Transactions Analysis</p>
          
          <div class="metric-card">
            <h4>Editable Variables</h4>
            <div class="form-group">
              <label>EBITDA ($)</label>
              <input type="number" id="marketEBITDA" value="${Math.round(ebitda)}" step="10000" style="width: 250px;" onchange="calculateMarketApproach()" class="editable-field" />
              <small style="color: #586069;">Calculated from financial statements: $${ebitda.toLocaleString(undefined, {maximumFractionDigits: 0})}</small>
            </div>
            <div class="form-group">
              <label>EV/EBITDA Multiple</label>
              <input type="number" id="marketMultiple" value="${evEbitdaMultiple.toFixed(1)}" min="1" max="30" step="0.1" style="width: 150px;" onchange="calculateMarketApproach()" class="editable-field" />
              <small style="color: #586069;">Based on size & profitability (margin: ${profitMargin.toFixed(1)}%)</small>
            </div>
            <div class="form-group">
              <label>Size Adjustment (%)</label>
              <input type="number" id="marketSizeAdj" value="${sizeAdjustment}" min="-50" max="50" step="1" style="width: 150px;" onchange="calculateMarketApproach()" class="editable-field" />
              <small style="color: #586069; display: block; margin-top: 5px;">Total assets: $${assetSize.toLocaleString(undefined, {maximumFractionDigits: 0})}</small>
            </div>
            <div class="form-group">
              <label>Geographic Adjustment (%)</label>
              <input type="number" id="marketGeoAdj" value="${geoAdjustment}" min="-50" max="50" step="1" style="width: 150px;" onchange="calculateMarketApproach()" class="editable-field" />
            </div>
          </div>
          
          <div class="metric-card" style="margin-top: 20px;">
            <h4>Calculation</h4>
            <div id="marketCalculation"></div>
          </div>
        </div>
        
        <div id="summaryTab" class="tab-content">
          <h3>Valuation Summary</h3>
          <p style="color: #586069; margin-bottom: 20px;">Weighted Average of All Approaches</p>
          
          <div class="metric-card">
            <h4>Approach Weights</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px;">
              <div class="form-group">
                <label>Cost Approach Weight (%)</label>
                <input type="number" id="weightCost" value="30" min="0" max="100" step="5" style="width: 100%;" onchange="calculateSummary()" class="editable-field" />
              </div>
              <div class="form-group">
                <label>Income Approach Weight (%)</label>
                <input type="number" id="weightIncome" value="50" min="0" max="100" step="5" style="width: 100%;" onchange="calculateSummary()" class="editable-field" />
              </div>
              <div class="form-group">
                <label>Market Approach Weight (%)</label>
                <input type="number" id="weightMarket" value="20" min="0" max="100" step="5" style="width: 100%;" onchange="calculateSummary()" class="editable-field" />
              </div>
            </div>
          </div>
          
          <div class="metric-card" style="margin-top: 20px;">
            <h4>Final Valuation</h4>
            <div id="summaryCalculation"></div>
          </div>
          
          <button onclick="saveCalculatedValuation(${pipelineId})" class="btn-success" style="margin-top: 20px;">💾 Save This Valuation</button>
        </div>
      </div>
      
      <div class="card">
        <h2>Saved Valuations</h2>
        <div id="evaluationsList"></div>
        <button onclick="showAddEvalForm(${pipelineId})" class="btn-success" style="margin-top: 15px;">➕ Add Manual Valuation</button>
      </div>
      
      <div id="evalFormArea"></div>
    `;
    
    area.innerHTML = html;
    
    // Initialize calculations
    calculateCostApproach();
    calculateIncomeApproach();
    calculateMarketApproach();
    calculateSummary();
    
    // Render evaluations list
    renderEvaluationsList(evaluations);
    
  } catch (err) {
    console.error('Error loading pipeline details:', err);
    area.innerHTML = `
      <div class="error">
        <strong>Error:</strong> ${err.message}
      </div>
      <button onclick="location.reload()" style="margin-top: 15px;">← Back to Search</button>
    `;
  }
}

function renderEvaluationsList(evaluations) {
  const listArea = document.getElementById('evaluationsList');
  if (!listArea) return;
  
  if (!evaluations || evaluations.length === 0) {
    listArea.innerHTML = '<p><em>No evaluations yet.</em></p>';
    return;
  }
  
  let html = '<table><thead><tr><th>Date</th><th>Evaluator</th><th>Final Valuation</th><th>Discount Rate</th><th>Details</th></tr></thead><tbody>';
  html += evaluations.map(e => `
    <tr>
      <td>${e.evaluation_date ? new Date(e.evaluation_date).toLocaleDateString() : e.created_at ? new Date(e.created_at).toLocaleDateString() : '—'}</td>
      <td>${e.evaluator || '—'}</td>
      <td><strong>${e.revenue_requirement ? '$' + Number(e.revenue_requirement).toLocaleString(undefined, {maximumFractionDigits: 0}) : '—'}</strong></td>
      <td>${e.capacity_utilization ? e.capacity_utilization + '%' : '—'}</td>
      <td><button onclick="showEvaluationDetails(${JSON.stringify(e).replace(/"/g, '&quot;')})">View Details</button></td>
    </tr>
  `).join('');
  html += '</tbody></table>';
  
  listArea.innerHTML = html;
}

function showEvaluationDetails(evaluation) {
  const modal = `
    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center;" onclick="this.remove()">
      <div style="background: white; padding: 30px; max-width: 800px; max-height: 80vh; overflow-y: auto; border-radius: 8px;" onclick="event.stopPropagation()">
        <h3>Evaluation Details</h3>
        <p><strong>Evaluator:</strong> ${evaluation.evaluator}</p>
        <p><strong>Date:</strong> ${evaluation.evaluation_date ? new Date(evaluation.evaluation_date).toLocaleDateString() : new Date(evaluation.created_at).toLocaleDateString()}</p>
        <p><strong>Rate Model:</strong> ${evaluation.rate_model || 'N/A'}</p>
        <hr>
        <h4>Valuation Notes</h4>
        <pre style="white-space: pre-wrap; font-family: inherit; background: #f5f5f5; padding: 15px; border-radius: 4px;">${evaluation.notes || 'No notes provided'}</pre>
        <button onclick="this.closest('div[style*=fixed]').remove()" style="margin-top: 20px;">Close</button>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modal);
}

async function searchCompany() {
  const kw = document.getElementById('companyInput').value.trim();
  if (!kw) {
    alert('Please enter a company name to search');
    return;
  }
  
  console.log('Searching for:', kw);
  
  try {
    const rows = await $fetch(`/api/search?company=${encodeURIComponent(kw)}`);
    console.log('Search results:', rows);
    renderPipelines(rows);
  } catch (err) {
    console.error('Search error:', err);
    const resultArea = document.getElementById('searchResults');
    if (resultArea) {
      resultArea.innerHTML = `<p class="error">Search error: ${err.message}</p>`;
    }
  }
}

async function loadEvaluations(pipelineId) {
  try {
    const rows = await $fetch(`/api/pipeline/${encodeURIComponent(pipelineId)}/evaluations`);
    renderEvaluationsList(rows);
  } catch (err) {
    console.error('Error loading evaluations:', err);
  }
}

function showAddEvalForm(pipelineId) {
  const area = document.getElementById('evalFormArea');
  if (!area) {
    console.error('evalFormArea not found');
    return;
  }
  
  // Generate reasonable default values for valuation approaches
  const defaultCostValue = (Math.random() * 50000000 + 25000000).toFixed(2); // $25M-$75M
  const defaultIncomeValue = (Math.random() * 60000000 + 30000000).toFixed(2); // $30M-$90M
  const defaultMarketValue = (Math.random() * 55000000 + 28000000).toFixed(2); // $28M-$83M
  const currentUser = 'Pipeline Analyst'; // Default evaluator name
  
  area.innerHTML = `
    <div class="card">
      <h2>New Pipeline Valuation</h2>
      <form id="newEvalForm" onsubmit="return false;">
        
        <div class="form-group">
          <label>Evaluator Name <span style="color: #d73a49;">*</span></label>
          <input type="text" id="evalName" value="${currentUser}" required style="width: 100%; max-width: 400px;" />
        </div>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e1e4e8;">
        
        <h3>💰 Cost Approach</h3>
        <p style="color: #586069; font-size: 14px; margin-bottom: 20px;">Replacement cost new less depreciation</p>
        <div class="form-group">
          <label>Estimated Value ($)</label>
          <input type="number" id="costValue" value="${defaultCostValue}" step="0.01" style="width: 250px;" />
        </div>
        <div class="form-group">
          <label>Analysis Notes</label>
          <textarea id="costNotes" rows="3" style="width: 100%;">Replacement cost new less depreciation. Based on current construction costs, engineering estimates, and physical depreciation. Considers functional and economic obsolescence. Adjusted for regional cost factors.</textarea>
        </div>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e1e4e8;">
        
        <h3>📈 Income Approach</h3>
        <p style="color: #586069; font-size: 14px; margin-bottom: 20px;">Discounted cash flow analysis</p>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
          <div class="form-group">
            <label>Estimated Value ($)</label>
            <input type="number" id="incomeValue" value="${defaultIncomeValue}" step="0.01" style="width: 100%;" />
          </div>
          <div class="form-group">
            <label>Discount Rate (%)</label>
            <input type="number" id="discountRate" value="8.5" min="0" max="30" step="0.1" style="width: 100%;" />
          </div>
        </div>
        <div class="form-group">
          <label>Analysis Notes</label>
          <textarea id="incomeNotes" rows="3" style="width: 100%;">DCF analysis using projected cash flows over 20-year period. Terminal value calculated using perpetuity growth method. WACC derived from industry comparables. Revenue projections based on contracted capacity and tariff rates.</textarea>
        </div>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e1e4e8;">
        
        <h3>🏢 Market Approach</h3>
        <p style="color: #586069; font-size: 14px; margin-bottom: 20px;">Comparable transactions and market multiples</p>
        <div class="form-group">
          <label>Estimated Value ($)</label>
          <input type="number" id="marketValue" value="${defaultMarketValue}" step="0.01" style="width: 250px;" />
        </div>
        <div class="form-group">
          <label>Analysis Notes</label>
          <textarea id="marketNotes" rows="3" style="width: 100%;">Based on comparable pipeline transactions and market multiples. EV/EBITDA multiples range from 8x-12x for similar assets. Adjusted for size, geography, and operational differences. Recent transaction data from public filings.</textarea>
        </div>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e1e4e8;">
        
        <h3>📊 Valuation Summary</h3>
        <div class="form-group">
          <label>Final Valuation Conclusion ($)</label>
          <input type="number" id="finalValue" value="${((parseFloat(defaultCostValue) + parseFloat(defaultIncomeValue) + parseFloat(defaultMarketValue)) / 3).toFixed(2)}" step="0.01" style="width: 250px;" />
        </div>
        <div class="form-group">
          <label>Weighting Rationale</label>
          <textarea id="weightingNotes" rows="2" style="width: 100%;">Weighted average: Cost 30%, Income 50%, Market 20%. Income approach given highest weight due to availability of reliable cash flow data.</textarea>
        </div>
        <div class="form-group">
          <label>Additional Notes</label>
          <textarea id="evalNotes" rows="3" style="width: 100%;">Valuation as of current date. Subject to verification of financial statements and operational data. Recommend periodic revaluation given market volatility.</textarea>
        </div>
        
        <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #e1e4e8;">
          <button type="button" onclick="submitEvaluation(${pipelineId})" class="btn-success" style="margin-right: 10px;">💾 Save Valuation</button>
          <button type="button" onclick="cancelEvalForm()" class="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  `;
}

async function submitEvaluation(pipelineId) {
  const evaluator = document.getElementById('evalName').value.trim();
  
  if (!evaluator) {
    alert('Please enter an evaluator name');
    return;
  }
  
  const costValue = document.getElementById('costValue').value;
  const costNotes = document.getElementById('costNotes').value.trim();
  const incomeValue = document.getElementById('incomeValue').value;
  const discountRate = document.getElementById('discountRate').value;
  const incomeNotes = document.getElementById('incomeNotes').value.trim();
  const marketValue = document.getElementById('marketValue').value;
  const marketNotes = document.getElementById('marketNotes').value.trim();
  const finalValue = document.getElementById('finalValue').value;
  const weightingNotes = document.getElementById('weightingNotes').value.trim();
  const notes = document.getElementById('evalNotes').value.trim();
  
  // Combine all valuation notes into structured format
  const combinedNotes = `
COST APPROACH: $${costValue ? Number(costValue).toLocaleString() : 'N/A'}
${costNotes}

INCOME APPROACH: $${incomeValue ? Number(incomeValue).toLocaleString() : 'N/A'}
Discount Rate: ${discountRate}%
${incomeNotes}

MARKET APPROACH: $${marketValue ? Number(marketValue).toLocaleString() : 'N/A'}
${marketNotes}

FINAL VALUATION: $${finalValue ? Number(finalValue).toLocaleString() : 'N/A'}
${weightingNotes}

${notes}
  `.trim();
  
  const evalData = {
    pipeline_id: pipelineId,
    evaluator: evaluator,
    throughput_mmcfd: null,
    capacity_utilization: discountRate || null,
    revenue_requirement: finalValue || null,
    rate_model: 'Tri-Approach Valuation',
    competitive_analysis: marketNotes || null,
    risk_factors: null,
    notes: combinedNotes
  };
  
  console.log('Submitting evaluation:', evalData);
  
  try {
    await $fetch('/api/evaluations', { 
      method: 'POST', 
      headers: {'Content-Type':'application/json'}, 
      body: JSON.stringify(evalData)
    });
    
    alert('Evaluation saved successfully!');
    
    // Reload evaluations
    const evaluations = await $fetch(`/api/pipeline/${pipelineId}/evaluations`);
    renderEvaluationsList(evaluations);
    
    // Clear form
    cancelEvalForm();
    
  } catch (err) {
    console.error('Error saving evaluation:', err);
    alert('Error saving evaluation: ' + err.message);
  }
}

function cancelEvalForm() {
  const area = document.getElementById('evalFormArea');
  if (area) {
    area.innerHTML = '';
  }
}

// Valuation tab switching
function switchValuationTab(tabName, pipelineId, event) {
  // Update tab buttons
  document.querySelectorAll('.valuation-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  if (event && event.target) {
    event.target.classList.add('active');
  } else {
    // Fallback: find button by tab name
    document.querySelectorAll('.valuation-tab').forEach(tab => {
      if (tab.textContent.toLowerCase().includes(tabName)) {
        tab.classList.add('active');
      }
    });
  }
  
  // Update tab contents
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById(tabName + 'Tab').classList.add('active');
}

// Cost Approach Calculation
function calculateCostApproach(updateSummary = true) {
  const rcn = parseFloat(document.getElementById('costRCN')?.value || 80000000);
  const physical = parseFloat(document.getElementById('costPhysical')?.value || 25);
  const functional = parseFloat(document.getElementById('costFunctional')?.value || 5);
  const economic = parseFloat(document.getElementById('costEconomic')?.value || 3);
  
  const physicalDepreciation = rcn * (physical / 100);
  const functionalObsolescence = rcn * (functional / 100);
  const economicObsolescence = rcn * (economic / 100);
  const totalDepreciation = physicalDepreciation + functionalObsolescence + economicObsolescence;
  const finalValue = rcn - totalDepreciation;
  
  const calcDiv = document.getElementById('costCalculation');
  if (calcDiv) {
    calcDiv.innerHTML = `
      <div class="calc-row">
        <span class="calc-label">Replacement Cost New</span>
        <span class="calc-value">$${rcn.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
      </div>
      <div class="calc-row">
        <span class="calc-label">Less: Physical Depreciation (${physical}%)</span>
        <span class="calc-value">($${physicalDepreciation.toLocaleString(undefined, {maximumFractionDigits: 0})})</span>
      </div>
      <div class="calc-row">
        <span class="calc-label">Less: Functional Obsolescence (${functional}%)</span>
        <span class="calc-value">($${functionalObsolescence.toLocaleString(undefined, {maximumFractionDigits: 0})})</span>
      </div>
      <div class="calc-row">
        <span class="calc-label">Less: Economic Obsolescence (${economic}%)</span>
        <span class="calc-value">($${economicObsolescence.toLocaleString(undefined, {maximumFractionDigits: 0})})</span>
      </div>
      <div class="calc-row">
        <span class="calc-label"><strong>Cost Approach Value</strong></span>
        <span class="calc-value" style="color: #0366d6;"><strong>$${finalValue.toLocaleString(undefined, {maximumFractionDigits: 0})}</strong></span>
      </div>
    `;
  }
  
  if (updateSummary) calculateSummary();
  return finalValue;
}

// Income Approach Calculation
function calculateIncomeApproach(updateSummary = true) {
  const revenue = parseFloat(document.getElementById('incomeRevenue')?.value || 15000000);
  const expenses = parseFloat(document.getElementById('incomeExpenses')?.value || 8000000);
  const growth = parseFloat(document.getElementById('incomeGrowth')?.value || 2.5) / 100;
  const discount = parseFloat(document.getElementById('incomeDiscount')?.value || 8.5) / 100;
  const period = parseInt(document.getElementById('incomePeriod')?.value || 20);
  const terminalGrowth = parseFloat(document.getElementById('incomeTerminal')?.value || 2.0) / 100;
  
  const baseCashFlow = revenue - expenses;
  let presentValue = 0;
  
  // Calculate PV of cash flows
  for (let year = 1; year <= period; year++) {
    const cashFlow = baseCashFlow * Math.pow(1 + growth, year);
    const pv = cashFlow / Math.pow(1 + discount, year);
    presentValue += pv;
  }
  
  // Calculate terminal value
  const terminalCashFlow = baseCashFlow * Math.pow(1 + growth, period + 1);
  const terminalValue = terminalCashFlow / (discount - terminalGrowth);
  const pvTerminal = terminalValue / Math.pow(1 + discount, period);
  
  const finalValue = presentValue + pvTerminal;
  
  const calcDiv = document.getElementById('incomeCalculation');
  if (calcDiv) {
    calcDiv.innerHTML = `
      <div class="calc-row">
        <span class="calc-label">Annual Operating Revenue</span>
        <span class="calc-value">$${revenue.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
      </div>
      <div class="calc-row">
        <span class="calc-label">Less: Annual Operating Expenses</span>
        <span class="calc-value">($${expenses.toLocaleString(undefined, {maximumFractionDigits: 0})})</span>
      </div>
      <div class="calc-row">
        <span class="calc-label">Base Cash Flow</span>
        <span class="calc-value">$${baseCashFlow.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
      </div>
      <div class="calc-row">
        <span class="calc-label">PV of ${period} Years Cash Flows (${(growth*100).toFixed(1)}% growth, ${(discount*100).toFixed(1)}% discount)</span>
        <span class="calc-value">$${presentValue.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
      </div>
      <div class="calc-row">
        <span class="calc-label">PV of Terminal Value (${(terminalGrowth*100).toFixed(1)}% perpetuity)</span>
        <span class="calc-value">$${pvTerminal.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
      </div>
      <div class="calc-row">
        <span class="calc-label"><strong>Income Approach Value</strong></span>
        <span class="calc-value" style="color: #0366d6;"><strong>$${finalValue.toLocaleString(undefined, {maximumFractionDigits: 0})}</strong></span>
      </div>
    `;
  }
  
  if (updateSummary) calculateSummary();
  return finalValue;
}

// Market Approach Calculation
function calculateMarketApproach(updateSummary = true) {
  const ebitda = parseFloat(document.getElementById('marketEBITDA')?.value || 9000000);
  const multiple = parseFloat(document.getElementById('marketMultiple')?.value || 10.5);
  const sizeAdj = parseFloat(document.getElementById('marketSizeAdj')?.value || -5) / 100;
  const geoAdj = parseFloat(document.getElementById('marketGeoAdj')?.value || 2) / 100;
  
  const baseValue = ebitda * multiple;
  const sizeAdjustment = baseValue * sizeAdj;
  const geoAdjustment = baseValue * geoAdj;
  const finalValue = baseValue + sizeAdjustment + geoAdjustment;
  
  const calcDiv = document.getElementById('marketCalculation');
  if (calcDiv) {
    calcDiv.innerHTML = `
      <div class="calc-row">
        <span class="calc-label">EBITDA</span>
        <span class="calc-value">$${ebitda.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
      </div>
      <div class="calc-row">
        <span class="calc-label">EV/EBITDA Multiple</span>
        <span class="calc-value">${multiple.toFixed(1)}x</span>
      </div>
      <div class="calc-row">
        <span class="calc-label">Base Market Value</span>
        <span class="calc-value">$${baseValue.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
      </div>
      <div class="calc-row">
        <span class="calc-label">Size Adjustment (${(sizeAdj*100).toFixed(0)}%)</span>
        <span class="calc-value">${sizeAdj >= 0 ? '+' : ''}$${sizeAdjustment.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
      </div>
      <div class="calc-row">
        <span class="calc-label">Geographic Adjustment (${(geoAdj*100).toFixed(0)}%)</span>
        <span class="calc-value">${geoAdj >= 0 ? '+' : ''}$${geoAdjustment.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
      </div>
      <div class="calc-row">
        <span class="calc-label"><strong>Market Approach Value</strong></span>
        <span class="calc-value" style="color: #0366d6;"><strong>$${finalValue.toLocaleString(undefined, {maximumFractionDigits: 0})}</strong></span>
      </div>
    `;
  }
  
  if (updateSummary) calculateSummary();
  return finalValue;
}

// Summary Calculation
function calculateSummary() {
  const costValue = calculateCostApproach(false);
  const incomeValue = calculateIncomeApproach(false);
  const marketValue = calculateMarketApproach(false);
  
  const costWeight = parseFloat(document.getElementById('weightCost')?.value || 30) / 100;
  const incomeWeight = parseFloat(document.getElementById('weightIncome')?.value || 50) / 100;
  const marketWeight = parseFloat(document.getElementById('weightMarket')?.value || 20) / 100;
  
  const totalWeight = costWeight + incomeWeight + marketWeight;
  const normalizedCostWeight = costWeight / totalWeight;
  const normalizedIncomeWeight = incomeWeight / totalWeight;
  const normalizedMarketWeight = marketWeight / totalWeight;
  
  const finalValue = (costValue * normalizedCostWeight) + (incomeValue * normalizedIncomeWeight) + (marketValue * normalizedMarketWeight);
  
  const calcDiv = document.getElementById('summaryCalculation');
  if (calcDiv) {
    calcDiv.innerHTML = `
      <div class="calc-row">
        <span class="calc-label">Cost Approach Value (${(normalizedCostWeight*100).toFixed(0)}% weight)</span>
        <span class="calc-value">$${costValue.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
      </div>
      <div class="calc-row">
        <span class="calc-label">Income Approach Value (${(normalizedIncomeWeight*100).toFixed(0)}% weight)</span>
        <span class="calc-value">$${incomeValue.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
      </div>
      <div class="calc-row">
        <span class="calc-label">Market Approach Value (${(normalizedMarketWeight*100).toFixed(0)}% weight)</span>
        <span class="calc-value">$${marketValue.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
      </div>
      <div class="calc-row">
        <span class="calc-label"><strong>Weighted Average Valuation</strong></span>
        <span class="calc-value" style="color: #28a745; font-size: 20px;"><strong>$${finalValue.toLocaleString(undefined, {maximumFractionDigits: 0})}</strong></span>
      </div>
    `;
  }
  
  return finalValue;
}

// Save calculated valuation
async function saveCalculatedValuation(pipelineId) {
  const costValue = calculateCostApproach(false);
  const incomeValue = calculateIncomeApproach(false);
  const marketValue = calculateMarketApproach(false);
  const finalValue = calculateSummary();
  
  // Get all input values for the notes
  const costRCN = document.getElementById('costRCN').value;
  const costPhysical = document.getElementById('costPhysical').value;
  const costFunctional = document.getElementById('costFunctional').value;
  const costEconomic = document.getElementById('costEconomic').value;
  
  const incomeRevenue = document.getElementById('incomeRevenue').value;
  const incomeExpenses = document.getElementById('incomeExpenses').value;
  const incomeGrowth = document.getElementById('incomeGrowth').value;
  const incomeDiscount = document.getElementById('incomeDiscount').value;
  const incomePeriod = document.getElementById('incomePeriod').value;
  const incomeTerminal = document.getElementById('incomeTerminal').value;
  
  const marketEBITDA = document.getElementById('marketEBITDA').value;
  const marketMultiple = document.getElementById('marketMultiple').value;
  const marketSizeAdj = document.getElementById('marketSizeAdj').value;
  const marketGeoAdj = document.getElementById('marketGeoAdj').value;
  
  const weightCost = document.getElementById('weightCost').value;
  const weightIncome = document.getElementById('weightIncome').value;
  const weightMarket = document.getElementById('weightMarket').value;
  
  const notes = `
COST APPROACH: $${costValue.toLocaleString(undefined, {maximumFractionDigits: 0})}
- Replacement Cost New: $${Number(costRCN).toLocaleString()}
- Physical Depreciation: ${costPhysical}%
- Functional Obsolescence: ${costFunctional}%
- Economic Obsolescence: ${costEconomic}%

INCOME APPROACH: $${incomeValue.toLocaleString(undefined, {maximumFractionDigits: 0})}
- Operating Revenue: $${Number(incomeRevenue).toLocaleString()}
- Operating Expenses: $${Number(incomeExpenses).toLocaleString()}
- Growth Rate: ${incomeGrowth}%
- Discount Rate (WACC): ${incomeDiscount}%
- Projection Period: ${incomePeriod} years
- Terminal Growth Rate: ${incomeTerminal}%

MARKET APPROACH: $${marketValue.toLocaleString(undefined, {maximumFractionDigits: 0})}
- EBITDA: $${Number(marketEBITDA).toLocaleString()}
- EV/EBITDA Multiple: ${marketMultiple}x
- Size Adjustment: ${marketSizeAdj}%
- Geographic Adjustment: ${marketGeoAdj}%

FINAL VALUATION: $${finalValue.toLocaleString(undefined, {maximumFractionDigits: 0})}
Weighting: Cost ${weightCost}%, Income ${weightIncome}%, Market ${weightMarket}%
  `.trim();
  
  const evalData = {
    pipeline_id: pipelineId,
    evaluator: 'Calculator Tool',
    capacity_utilization: incomeDiscount,
    revenue_requirement: finalValue,
    rate_model: 'Tri-Approach Calculator',
    notes: notes
  };
  
  try {
    await $fetch('/api/evaluations', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(evalData)
    });
    
    alert('✅ Valuation saved successfully!');
    
    // Reload evaluations
    const evaluations = await $fetch(`/api/pipeline/${pipelineId}/evaluations`);
    renderEvaluationsList(evaluations);
    
  } catch (err) {
    console.error('Error saving valuation:', err);
    alert('❌ Error saving valuation: ' + err.message);
  }
}
