const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const DB_PATH = path.join(__dirname, 'ferc6_xblr.sqlite');
const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
  if (err) return console.error('open error', err.message);
});

function allAsync(sql) { return new Promise((res, rej) => db.all(sql, (e,r)=> e?rej(e):res(r))); }
(async ()=>{
  try {
    const tables = await allAsync("SELECT name, type, sql FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY name");
    console.log('Found tables/views:', tables.length);
    for (const t of tables) {
      console.log('\n---', t.name, t.type);
      if (t.sql) console.log('SQL:', t.sql.slice(0,400).replace(/\n/g,' '));
      try {
        const cols = await allAsync(`PRAGMA table_info("${t.name}")`);
        console.log('Columns:', cols.map(c=>`${c.name}:${c.type}`).join(', '));
        const sample = await allAsync(`SELECT * FROM "${t.name}" LIMIT 3`);
        console.log('Sample rows:', sample);
      } catch (e) {
        console.error('Error reading table', t.name, e.message);
      }
    }
  } catch (e) { console.error(e); }
  db.close();
})();
