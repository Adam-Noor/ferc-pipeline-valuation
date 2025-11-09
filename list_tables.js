const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('C:\\Users\\Adam\\Downloads\\ferc6_dbf.sqlite\\ferc6_dbf.sqlite', sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    return;
  }
  
  db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", [], (err, rows) => {
    if (err) {
      console.error('Error querying tables:', err);
      db.close();
      return;
    }
    
    console.log('Tables in FERC database:');
    rows.forEach(row => {
      console.log('  -', row.name);
    });
    
    db.close();
  });
});
