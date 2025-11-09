const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('C:\\Users\\Adam\\Downloads\\ferc6_dbf.sqlite\\ferc6_dbf.sqlite', sqlite3.OPEN_READONLY);

console.log('\n=== Checking f6_income_stmnt (Income Statement) ===');
db.all("PRAGMA table_info(f6_income_stmnt)", [], (err, cols) => {
  if (err) console.error(err);
  else {
    console.log('Columns:', cols.map(c => c.name).join(', '));
    
    // Get sample data
    db.all("SELECT * FROM f6_income_stmnt LIMIT 5", [], (err, rows) => {
      if (err) console.error(err);
      else console.log('Sample rows:', rows.length);
      
      console.log('\n=== Checking f6_comp_bal_sheet (Balance Sheet) ===');
      db.all("PRAGMA table_info(f6_comp_bal_sheet)", [], (err, cols) => {
        if (err) console.error(err);
        else {
          console.log('Columns:', cols.map(c => c.name).join(', '));
          
          db.all("SELECT * FROM f6_comp_bal_sheet LIMIT 5", [], (err, rows) => {
            if (err) console.error(err);
            else console.log('Sample rows:', rows.length);
            
            console.log('\n=== Checking f6_stats_oper (Operating Statistics) ===');
            db.all("PRAGMA table_info(f6_stats_oper)", [], (err, cols) => {
              if (err) console.error(err);
              else {
                console.log('Columns:', cols.map(c => c.name).join(', '));
                
                db.all("SELECT * FROM f6_stats_oper LIMIT 5", [], (err, rows) => {
                  if (err) console.error(err);
                  else console.log('Sample rows:', rows.length);
                  
                  console.log('\n=== Checking f6_carrier_property (Property/Assets) ===');
                  db.all("PRAGMA table_info(f6_carrier_property)", [], (err, cols) => {
                    if (err) console.error(err);
                    else {
                      console.log('Columns:', cols.map(c => c.name).join(', '));
                      
                      db.all("SELECT * FROM f6_carrier_property LIMIT 5", [], (err, rows) => {
                        if (err) console.error(err);
                        else console.log('Sample rows:', rows.length);
                        
                        db.close();
                      });
                    }
                  });
                });
              }
            });
          });
        }
      });
    });
  }
});
