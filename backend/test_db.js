const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data.sqlite');

db.all("SELECT count(*) as count FROM books", (err, rows) => {
    console.log(rows);
});
