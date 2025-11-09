const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('C:\\Users\\Adam\\Downloads\\ferc6_dbf.sqlite\\ferc6_dbf.sqlite', sqlite3.OPEN_READONLY);

// Get a specific company to test with
db.get("SELECT respondent_id, company_name, report_year FROM f6_general_info WHERE rowid = 1", [], (err, company) => {
  if (err) {
    console.error(err);
    db.close();
    return;
  }
  
  console.log('Testing with company:', company);
  const { respondent_id, report_year } = company;
  
  // Get income statement data
  console.log('\n=== Income Statement Data ===');
  db.all(`SELECT row_number, current_yr FROM f6_income_stmnt 
          WHERE respondent_id = ? AND report_year = ? 
          ORDER BY row_number LIMIT 20`, 
    [respondent_id, report_year], 
    (err, rows) => {
      if (err) console.error(err);
      else console.log(rows);
      
      // Get balance sheet data
      console.log('\n=== Balance Sheet Data ===');
      db.all(`SELECT row_number, bal_end_prev_yr FROM f6_comp_bal_sheet 
              WHERE respondent_id = ? AND report_year = ? 
              ORDER BY row_number LIMIT 20`, 
        [respondent_id, report_year], 
        (err, rows) => {
          if (err) console.error(err);
          else console.log(rows);
          
          // Get carrier property data
          console.log('\n=== Carrier Property Data ===');
          db.all(`SELECT row_number, bal_end_yr FROM f6_carrier_property 
                  WHERE respondent_id = ? AND report_year = ? 
                  ORDER BY row_number LIMIT 20`, 
            [respondent_id, report_year], 
            (err, rows) => {
              if (err) console.error(err);
              else console.log(rows);
              
              db.close();
            });
        });
    });
});
