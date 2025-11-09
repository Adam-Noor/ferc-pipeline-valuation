const sqlite3 = require('sqlite3').verbose();
const DB_PATH = 'C:\\Users\\Adam\\Downloads\\ferc6_dbf.sqlite\\ferc6_dbf.sqlite';

const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
});

// Get column info for f6_general_info
db.all("PRAGMA table_info(f6_general_info)", (err, columns) => {
  if (err) {
    console.error('Error:', err.message);
    db.close();
    return;
  }
  
  console.log('=== f6_general_info Columns ===');
  columns.forEach(col => {
    console.log(`${col.name} (${col.type})`);
  });
  
  // Get sample data
  console.log('\n=== Sample Row ===');
  db.get("SELECT * FROM f6_general_info LIMIT 1", (err, row) => {
    if (err) {
      console.error('Error:', err.message);
    } else {
      console.log(JSON.stringify(row, null, 2));
    }
    db.close();
  });
});
