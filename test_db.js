const sqlite3 = require('sqlite3').verbose();
const DB_PATH = 'C:\\Users\\Adam\\Downloads\\ferc6_dbf.sqlite\\ferc6_dbf.sqlite';

const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('Connected to database:', DB_PATH);
});

// List tables
db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name", (err, tables) => {
  if (err) {
    console.error('Error listing tables:', err.message);
    process.exit(1);
  }
  
  console.log('\n=== Available Tables ===');
  console.log(tables.map(t => t.name).join('\n'));
  
  // Check if f6_general_info exists
  const hasGeneralInfo = tables.find(t => t.name === 'f6_general_info');
  if (hasGeneralInfo) {
    console.log('\n=== Testing f6_general_info ===');
    db.all("SELECT COUNT(*) as count FROM f6_general_info", (err, result) => {
      if (err) {
        console.error('Error counting rows:', err.message);
      } else {
        console.log('Total rows:', result[0].count);
      }
      
      // Sample query
      db.all(`
        SELECT 
          respondent_name,
          pipeline_system_name,
          filing_year,
          COUNT(*) as count
        FROM f6_general_info 
        GROUP BY respondent_name
        LIMIT 10
      `, (err, companies) => {
        if (err) {
          console.error('Error:', err.message);
        } else {
          console.log('\n=== Sample Companies ===');
          companies.forEach(c => {
            console.log(`${c.respondent_name} (${c.count} filings)`);
          });
        }
        db.close();
      });
    });
  } else {
    console.log('\n⚠️  f6_general_info table not found!');
    db.close();
  }
});
