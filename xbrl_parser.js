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

// Get detailed information from XBRL file including all non-zero fields
async function getDetailedInfo(fileId) {
  const filePath = path.join(XBRL_FOLDER, fileId);
  
  if (!fs.existsSync(filePath)) {
    throw new Error('Company file not found');
  }

  try {
    const xmlContent = fs.readFileSync(filePath, 'utf-8');
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(xmlContent);
    
    let xbrl = result['xbrli:xbrl'] || result['xbrl'] || result['xbrli'] || result;
    
    if (!xbrl || Object.keys(xbrl).length === 0) {
      return null;
    }

    const fileName = path.basename(filePath);
    const companyName = fileName
      .replace(/_form6_Q4_\d+\.xbrl$/, '')
      .replace(/_/g, ' ')
      .replace(/,/g, '');

    // Extract all values grouped by category
    const details = {
      company_name: companyName,
      file_name: fileName,
      pipelines: [],
      states: new Set(),
      total_miles: 0,
      financial_data: {},
      operational_data: {},
      asset_data: {}
    };

    // Helper to get all values from an element (not just current year)
    const getAllValues = (elementName) => {
      const elements = xbrl[elementName];
      if (!elements || !Array.isArray(elements)) return [];
      
      return elements
        .map(elem => {
          const value = elem._ ? parseFloat(elem._) : null;
          const context = elem.$?.contextRef || '';
          const unitRef = elem.$?.unitRef || '';
          return { value, context, unitRef };
        })
        .filter(item => item.value !== null && item.value !== 0);
    };

    // Helper to get text values (non-numeric)
    const getTextValues = (elementName) => {
      const elements = xbrl[elementName];
      if (!elements || !Array.isArray(elements)) return [];
      
      return elements
        .map(elem => {
          const value = elem._ ? String(elem._).trim() : null;
          const context = elem.$?.contextRef || '';
          return { value, context };
        })
        .filter(item => item.value && item.value !== '' && item.value !== '0');
    };

    // Extract pipeline information with more detail
    const pipelineNames = getTextValues('ferc:PipelineSystemName');
    const pipelineIds = getTextValues('ferc:PipelineSystemIdentifier');
    const pipelineMiles = getAllValues('ferc:MilesOfPipeline');
    const pipelineStates = getTextValues('ferc:StateOrTerritory');
    
    // Build comprehensive pipeline list
    if (pipelineNames.length > 0) {
      pipelineNames.forEach((p, i) => {
        const pipeline = {
          name: p.value,
          id: pipelineIds[i] ? pipelineIds[i].value : `Pipeline ${i + 1}`,
          miles: null,
          states: []
        };
        
        // Try to find miles for this pipeline based on context
        const milesForPipeline = pipelineMiles.filter(m => m.context === p.context);
        if (milesForPipeline.length > 0) {
          pipeline.miles = milesForPipeline[0].value;
        }
        
        // Try to find states for this pipeline based on context
        const statesForPipeline = pipelineStates.filter(s => s.context === p.context);
        if (statesForPipeline.length > 0) {
          pipeline.states = statesForPipeline.map(s => s.value);
        }
        
        details.pipelines.push(pipeline);
      });
    }

    // Calculate total miles from all sources
    let milesSum = 0;
    if (pipelineMiles.length > 0) {
      // Sum all unique mile values
      const uniqueMiles = new Set(pipelineMiles.map(m => m.value));
      milesSum = Array.from(uniqueMiles).reduce((sum, val) => sum + val, 0);
    }
    
    // Also check for total miles field
    const totalMilesField = getAllValues('ferc:TotalMilesOfPipeline');
    if (totalMilesField.length > 0) {
      details.total_miles = totalMilesField[0].value;
    } else if (milesSum > 0) {
      details.total_miles = milesSum;
    }

    // Extract all states from various fields
    const allStateFields = [
      ...getTextValues('ferc:StateOrTerritory'),
      ...getTextValues('ferc:StateOfIncorporation'),
      ...getTextValues('ferc:StateName')
    ];
    allStateFields.forEach(s => {
      if (s.value && s.value.length <= 3) { // State codes are 2-3 chars
        details.states.add(s.value);
      }
    });

    // Company contact info
    const contactFields = {
      'ferc:AddressOfPrincipalOfficeAtEndOfPeriod': 'Principal Office',
      'ferc:NameOfContactPerson': 'Contact Person',
      'ferc:TitleOfContactPerson': 'Contact Title',
      'ferc:TelephoneOfContactPerson': 'Contact Phone',
      'ferc:AddressOfContactPerson': 'Contact Address',
      'ferc:IncorporationDate': 'Incorporation Date',
      'ferc:SpecialLawRespondentIncorporatedUnder': 'Incorporation Law',
      'ferc:PreviousName': 'Previous Name'
    };
    
    details.company_info = {};
    for (const [key, label] of Object.entries(contactFields)) {
      const values = getTextValues(key);
      if (values.length > 0 && values[0].value) {
        details.company_info[label] = values[0].value;
      }
    }

    // Revenue breakdown - only non-zero values
    const revenueFields = {
      'ferc:TrunkRevenues': 'Trunk Revenues',
      'ferc:GatheringRevenues': 'Gathering Revenues',
      'ferc:DeliveryRevenues': 'Delivery Revenues',
      'ferc:OperatingRevenues': 'Operating Revenues',
      'ferc:AllowanceOilRevenue': 'Allowance Oil Revenue',
      'ferc:StorageAndDemurrageRevenue': 'Storage & Demurrage',
      'ferc:RentalRevenue': 'Rental Revenue',
      'ferc:IncidentalRevenue': 'Incidental Revenue',
      'ferc:GatheringTrunkAndDeliveryRevenues': 'Total GT&D Revenues'
    };

    details.revenues = {};
    for (const [key, label] of Object.entries(revenueFields)) {
      const values = getAllValues(key);
      if (values.length > 0 && values[0].value !== 0) {
        details.revenues[label] = values[0].value;
      }
    }

    // Operating expenses breakdown
    const operatingExpFields = {
      'ferc:OperationsAndMaintenanceExpensesOil': 'O&M Expenses',
      'ferc:SalariesAndWagesOperationsAndMaintenance': 'O&M Salaries & Wages',
      'ferc:MaterialsAndSuppliesOperationsAndMaintenance': 'O&M Materials & Supplies',
      'ferc:OutsideServicesOperationsAndMaintenance': 'O&M Outside Services',
      'ferc:OperatingFuelAndPowerOperationsAndMaintenance': 'Fuel & Power',
      'ferc:RentalsOperationsAndMaintenance': 'O&M Rentals',
      'ferc:OilLossesAndShortagesOperationsAndMaintenance': 'Oil Losses',
      'ferc:OtherExpensesOperationsAndMaintenance': 'O&M Other Expenses'
    };

    details.operating_expenses = {};
    for (const [key, label] of Object.entries(operatingExpFields)) {
      const values = getAllValues(key);
      if (values.length > 0 && values[0].value !== 0) {
        details.operating_expenses[label] = values[0].value;
      }
    }

    // General expenses breakdown
    const generalExpFields = {
      'ferc:GeneralExpensesOil': 'Total General Expenses',
      'ferc:SalariesAndWagesGeneralExpense': 'General Salaries & Wages',
      'ferc:MaterialsAndSuppliesGeneralExpense': 'General Materials',
      'ferc:OutsideServicesGeneralExpense': 'General Outside Services',
      'ferc:DepreciationAndAmortizationGeneralExpense': 'Depreciation & Amortization',
      'ferc:DepreciationExpenseForAssetRetirementCosts': 'Asset Retirement Depreciation',
      'ferc:InsuranceGeneralExpense': 'Insurance',
      'ferc:RentalsGeneralExpense': 'General Rentals',
      'ferc:PipelineTaxesGeneralExpense': 'Pipeline Taxes',
      'ferc:AccretionExpense': 'Accretion Expense',
      'ferc:OtherExpensesGeneralExpense': 'General Other Expenses'
    };

    details.general_expenses = {};
    for (const [key, label] of Object.entries(generalExpFields)) {
      const values = getAllValues(key);
      if (values.length > 0 && values[0].value !== 0) {
        details.general_expenses[label] = values[0].value;
      }
    }

    // Income statement items
    const incomeFields = {
      'ferc:OperatingExpenses': 'Total Operating Expenses',
      'ferc:NetCarrierOperatingIncome': 'Net Carrier Operating Income',
      'ferc:OrdinaryIncomeBeforeFederalIncomeTaxes': 'Income Before Taxes',
      'ferc:FederalIncomeTaxesOnIncomeFromContinuingOperations': 'Federal Income Taxes',
      'ferc:ProvisionForDeferredTaxes': 'Deferred Taxes',
      'ferc:IncomeLossFromContinuingOperations': 'Income from Continuing Ops',
      'ferc:NetIncomeLoss': 'Net Income (Loss)',
      'ferc:ComprehensiveIncomeLoss': 'Comprehensive Income',
      'ferc:InterestExpense': 'Interest Expense',
      'ferc:InterestAndDividendIncome': 'Interest & Dividend Income',
      'ferc:MiscellaneousIncome': 'Miscellaneous Income'
    };

    details.financial_data = {};
    for (const [key, label] of Object.entries(incomeFields)) {
      const values = getAllValues(key);
      if (values.length > 0 && values[0].value !== 0) {
        details.financial_data[label] = values[0].value;
      }
    }

    // Asset data - only non-zero values
    const assetFields = {
      'ferc:CarrierProperty': 'Carrier Property (Gross)',
      'ferc:CarrierPropertyNet': 'Carrier Property (Net)',
      'ferc:Assets': 'Total Assets',
      'ferc:CarrierPropertyTrunkLines': 'Trunk Lines Property',
      'ferc:CarrierPropertyGatheringLines': 'Gathering Lines Property',
      'ferc:AccruedDepreciationCarrierProperty': 'Accumulated Depreciation',
      'ferc:CurrentAssets': 'Current Assets',
      'ferc:CashAndCashEquivalents': 'Cash',
      'ferc:AccountsReceivable': 'Accounts Receivable',
      'ferc:ReceivablesFromAffiliatedCompanies': 'Receivables from Affiliates',
      'ferc:OilInventory': 'Oil Inventory',
      'ferc:MaterialAndSupplies': 'Materials & Supplies',
      'ferc:Prepayments': 'Prepayments',
      'ferc:OtherCurrentAssets': 'Other Current Assets',
      'ferc:OtherDeferredCharges': 'Other Deferred Charges',
      'ferc:ConstructionWorkInProgressGeneralCarrierProperty': 'Construction WIP'
    };

    details.asset_data = {};
    for (const [key, label] of Object.entries(assetFields)) {
      const values = getAllValues(key);
      if (values.length > 0 && values[0].value !== 0) {
        details.asset_data[label] = values[0].value;
      }
    }

    // Liability & Equity data
    const liabilityFields = {
      'ferc:Liabilities': 'Total Liabilities',
      'ferc:LiabilitiesAndStockholdersEquity': 'Total Liab & Equity',
      'ferc:CurrentLiabilities': 'Current Liabilities',
      'ferc:NoncurrentLiabilities': 'Non-Current Liabilities',
      'ferc:AccountsPayable': 'Accounts Payable',
      'ferc:PayablesToAffiliatedCompanies': 'Payables to Affiliates',
      'ferc:TaxesPayable': 'Taxes Payable',
      'ferc:LongTermDebt': 'Long-Term Debt',
      'ferc:LongTermDebtPayableAfterOneYear': 'LT Debt (After 1 Yr)',
      'ferc:LongTermDebtPayableWithinOneYear': 'LT Debt (Within 1 Yr)',
      'ferc:AssetRetirementObligations': 'Asset Retirement Obligations',
      'ferc:OtherNoncurrentLiabilities': 'Other Non-Current Liabilities',
      'ferc:StockholdersEquity': 'Stockholders Equity',
      'ferc:CapitalStock': 'Capital Stock',
      'ferc:AdditionalPaidInCapital': 'Additional Paid-In Capital',
      'ferc:UnappropriatedRetainedIncome': 'Retained Earnings'
    };

    details.liabilities_equity = {};
    for (const [key, label] of Object.entries(liabilityFields)) {
      const values = getAllValues(key);
      if (values.length > 0 && values[0].value !== 0) {
        details.liabilities_equity[label] = values[0].value;
      }
    }

    // Cash flow data
    const cashFlowFields = {
      'ferc:NetCashProvidedByUsedInOperatingActivities': 'Cash from Operations',
      'ferc:CashFlowsProvidedFromUsedInInvestmentActivities': 'Cash from Investing',
      'ferc:CashFlowsProvidedFromUsedInFinancingActivities': 'Cash from Financing',
      'ferc:NetIncreaseDecreaseInCashAndCashEquivalents': 'Net Change in Cash',
      'ferc:DepreciationAndDepletion': 'Depreciation & Depletion',
      'ferc:Amortization': 'Amortization',
      'ferc:DeferredIncomeTaxesNet': 'Deferred Income Taxes',
      'ferc:NetIncreaseDecreaseInReceivablesOperatingActivities': 'Change in Receivables',
      'ferc:NetIncreaseDecreaseInPayablesAndAccruedExpensesOperatingActivities': 'Change in Payables',
      'ferc:GrossAdditionsToCarrierPropertyInvestmentActivities': 'Capital Expenditures',
      'ferc:CashOutflowsForPlant': 'Cash Outflows for Plant'
    };

    details.cash_flow = {};
    for (const [key, label] of Object.entries(cashFlowFields)) {
      const values = getAllValues(key);
      if (values.length > 0 && values[0].value !== 0) {
        details.cash_flow[label] = values[0].value;
      }
    }

    // Operational data - only non-zero values
    const operationalFields = {
      'ferc:NumberOfBarrelsReceived': 'Barrels Received',
      'ferc:NumberOfBarrelsDeliveredOut': 'Barrels Delivered',
      'ferc:NumberOfBarrelsReceivedOnGatheringLines': 'Barrels Received (Gathering)',
      'ferc:NumberOfBarrelsReceivedOnTrunkLines': 'Barrels Received (Trunk)',
      'ferc:NumberOfBarrelsDeliveredOutOnGatheringLines': 'Barrels Delivered (Gathering)',
      'ferc:NumberOfBarrelsDeliveredOutOnTrunkLines': 'Barrels Delivered (Trunk)',
      'ferc:NumberOfBarrelMiles': 'Total Barrel-Miles',
      'ferc:NumberOfBarrelMilesOnTrunkLinesOfCrudeOil': 'Barrel-Miles (Crude)',
      'ferc:NumberOfBarrelMilesOnTrunkLinesOfOilProducts': 'Barrel-Miles (Products)',
      'ferc:AverageNumberOfEmployees': 'Employees (Average)',
      'ferc:ThroughputVolume': 'Throughput Volume',
      'ferc:PipelineCapacity': 'Pipeline Capacity'
    };

    details.operational_data = {};
    for (const [key, label] of Object.entries(operationalFields)) {
      const values = getAllValues(key);
      if (values.length > 0 && values[0].value !== 0) {
        details.operational_data[label] = values[0].value;
      }
    }

    // Rate base and return data
    const rateBaseFields = {
      'ferc:ReturnOnRateBase': 'Return on Rate Base',
      'ferc:DebtComponentReturnOnRateBase': 'Debt Component Return',
      'ferc:EquityComponentReturnOnRateBase': 'Equity Component Return',
      'ferc:IncomeTaxAllowance': 'Income Tax Allowance',
      'ferc:CompositeTaxRate': 'Composite Tax Rate',
      'ferc:OriginalCostIncludedInRateBase': 'Original Cost in Rate Base',
      'ferc:TrendedOriginalCostRateBase': 'Trended Original Cost Rate Base',
      'ferc:AccumulatedNetDeferredEarningsIncludedInRateBase': 'Deferred Earnings in Rate Base',
      'ferc:WeightedAverageCostOfCapitalRateOfReturn': 'WACC',
      'ferc:RealCostOfStockholdersEquityRateOfReturn': 'Cost of Equity',
      'ferc:CostOfLongTermDebtCapitalRateOfReturn': 'Cost of Debt',
      'ferc:AdjustedCapitalStructureRatioForLongTermDebtRateOfReturn': 'Debt Ratio',
      'ferc:AdjustedCapitalStructureRatioForStockholdersEquityRateOfReturn': 'Equity Ratio'
    };

    details.rate_base = {};
    for (const [key, label] of Object.entries(rateBaseFields)) {
      const values = getAllValues(key);
      if (values.length > 0 && values[0].value !== 0) {
        details.rate_base[label] = values[0].value;
      }
    }

    // Extract detailed pipeline segments with start/end points
    // Note: We can access contexts if needed, but we'll rely on extracting values directly

    // Extract pipeline start/end points and sizes
    const startPoints = getTextValues('ferc:PipelineStartPoint');
    const endPoints = getTextValues('ferc:PipelineEndPoint');
    const gatheringMiles = getAllValues('ferc:MilesOfGatheringLinesOperated');
    const gatheringSizes = getAllValues('ferc:SizeOfGatheringLinesOperated');
    const trunkCrudeMiles = getAllValues('ferc:MilesOfTrunkLinesForCrudeOilOperated');
    const trunkCrudeSizes = getAllValues('ferc:SizeOfTrunkLinesForCrudeOilOperated');
    const trunkProductMiles = getAllValues('ferc:MilesOfTrunkLinesForProductsOperated');
    const trunkProductSizes = getAllValues('ferc:SizeOfTrunkLinesForProductsOperated');

    // Build detailed pipeline segments
    if (startPoints.length > 0) {
      details.pipeline_segments = startPoints.map((start, i) => {
        const segment = {
          start_point: start.value,
          end_point: endPoints[i] ? endPoints[i].value : 'Unknown',
          gathering_miles: null,
          gathering_diameter: null,
          trunk_crude_miles: null,
          trunk_crude_diameter: null,
          trunk_product_miles: null,
          trunk_product_diameter: null
        };

        // Find matching data by context
        const gatheringMilesMatch = gatheringMiles.filter(m => m.context === start.context);
        const gatheringSizesMatch = gatheringSizes.filter(m => m.context === start.context);
        const trunkCrudeMilesMatch = trunkCrudeMiles.filter(m => m.context === start.context);
        const trunkCrudeSizesMatch = trunkCrudeSizes.filter(m => m.context === start.context);
        const trunkProductMilesMatch = trunkProductMiles.filter(m => m.context === start.context);
        const trunkProductSizesMatch = trunkProductSizes.filter(m => m.context === start.context);

        if (gatheringMilesMatch.length > 0) segment.gathering_miles = gatheringMilesMatch[0].value;
        if (gatheringSizesMatch.length > 0) segment.gathering_diameter = gatheringSizesMatch[0].value;
        if (trunkCrudeMilesMatch.length > 0) segment.trunk_crude_miles = trunkCrudeMilesMatch[0].value;
        if (trunkCrudeSizesMatch.length > 0) segment.trunk_crude_diameter = trunkCrudeSizesMatch[0].value;
        if (trunkProductMilesMatch.length > 0) segment.trunk_product_miles = trunkProductMilesMatch[0].value;
        if (trunkProductSizesMatch.length > 0) segment.trunk_product_diameter = trunkProductSizesMatch[0].value;

        return segment;
      });

      // Calculate detailed mile totals
      details.total_gathering_miles = gatheringMiles.reduce((sum, m) => sum + m.value, 0);
      details.total_trunk_crude_miles = trunkCrudeMiles.reduce((sum, m) => sum + m.value, 0);
      details.total_trunk_products_miles = trunkProductMiles.reduce((sum, m) => sum + m.value, 0);
      details.total_miles = details.total_gathering_miles + details.total_trunk_crude_miles + details.total_trunk_products_miles;
    }

    // Convert Set to Array for states
    details.states = Array.from(details.states);

    return details;
  } catch (error) {
    console.error(`Error getting detailed info for ${filePath}:`, error.message);
    return null;
  }
}

module.exports = {
  searchCompanies,
  getCompanyFinancials,
  parseXBRLFile,
  getXBRLFiles,
  getDetailedInfo
};
