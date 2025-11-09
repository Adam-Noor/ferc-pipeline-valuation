const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

const XBRL_FOLDER = path.join(__dirname, 'Ferc Current data xlbr');

// Parse a single XBRL file and extract financial data
async function parseXBRLFile(filePath) {
  try {
    const xmlContent = fs.readFileSync(filePath, 'utf-8');
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(xmlContent);
    
    // Try different XBRL root element formats
    let xbrl = result['xbrli:xbrl'] || result['xbrl'] || result['xbrli'] || result;
    
    // If still no valid XBRL structure, check if it's nested
    if (!xbrl || Object.keys(xbrl).length === 0) {
      console.error(`[XBRL Parser] Invalid XBRL structure in ${path.basename(filePath)}`);
      console.error(`[XBRL Parser] Root keys:`, Object.keys(result));
      return null;
    }
    
    // Extract company name from filename
    const fileName = path.basename(filePath);
    const companyName = fileName
      .replace(/_form6_Q4_\d+\.xbrl$/, '')
      .replace(/_/g, ' ')
      .replace(/,/g, '');
    
    // Helper function to extract value from XBRL element
    const getValue = (elementName) => {
      const elements = xbrl[elementName];
      if (!elements || !Array.isArray(elements)) return null;
      
      // Find the current year value - try multiple context patterns
      for (const elem of elements) {
        const contextRef = elem.$?.contextRef;
        if (contextRef && (
          contextRef === 'C1' || 
          contextRef === 'C2' || 
          contextRef.includes('Current') ||
          contextRef.includes('2024')
        )) {
          const value = elem._;
          return value ? parseFloat(value) : null;
        }
      }
      
      // If no context match, try to get any value from the first element
      if (elements.length > 0 && elements[0]._) {
        return parseFloat(elements[0]._) || null;
      }
      
      return null;
    };
    
    // Extract key financial metrics
    const data = {
      company_name: companyName,
      file_name: fileName,
      
      // Operating revenues
      trunk_revenues: getValue('ferc:TrunkRevenues') || 0,
      gathering_revenues: getValue('ferc:GatheringRevenues') || 0,
      delivery_revenues: getValue('ferc:DeliveryRevenues') || 0,
      
      // Operating expenses
      operation_expenses: getValue('ferc:OperationExpense') || 0,
      maintenance_expenses: getValue('ferc:MaintenanceExpense') || 0,
      
      // Assets
      carrier_property: getValue('ferc:CarrierProperty') || 0,
      total_assets: getValue('ferc:AssetsAndOtherDebits') || 0,
      
      // Net income
      net_income: getValue('ferc:NetIncome') || getValue('ferc:NetOperatingIncome') || 0,
    };
    
    // Calculate totals
    data.operating_revenue = data.trunk_revenues + data.gathering_revenues + data.delivery_revenues;
    data.operating_expenses = data.operation_expenses + data.maintenance_expenses;
    data.ebitda = data.operating_revenue - data.operating_expenses;
    
    return data;
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error.message);
    return null;
  }
}

// Get list of all XBRL files
function getXBRLFiles() {
  if (!fs.existsSync(XBRL_FOLDER)) {
    console.error('XBRL folder not found:', XBRL_FOLDER);
    return [];
  }
  
  const files = fs.readdirSync(XBRL_FOLDER);
  return files
    .filter(f => f.endsWith('.xbrl') && f !== 'rssfeed')
    .map(f => path.join(XBRL_FOLDER, f));
}

// Search for companies by name
async function searchCompanies(searchTerm) {
  const files = getXBRLFiles();
  const results = [];
  
  const searchLower = searchTerm.toLowerCase();
  
  for (const file of files) {
    const fileName = path.basename(file);
    const companyName = fileName
      .replace(/_form6_Q4_\d+\.xbrl$/, '')
      .replace(/_/g, ' ')
      .replace(/,/g, '');
    
    if (companyName.toLowerCase().includes(searchLower)) {
      results.push({
        id: fileName,
        company: companyName,
        file: file
      });
    }
  }
  
  return results;
}

// Get financial data for a specific company
async function getCompanyFinancials(fileId) {
  const filePath = path.join(XBRL_FOLDER, fileId);
  
  if (!fs.existsSync(filePath)) {
    throw new Error('Company file not found');
  }
  
  return await parseXBRLFile(filePath);
}

module.exports = {
  searchCompanies,
  getCompanyFinancials,
  parseXBRLFile,
  getXBRLFiles
};
