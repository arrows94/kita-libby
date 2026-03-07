const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./backend/data.sqlite');

db.all("SELECT * FROM books LIMIT 1", (err, rows) => {
    console.log(rows);
});
