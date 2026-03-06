const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./backend/data.sqlite');

db.serialize(() => {
    // Generate 60 test books
    const stmt = db.prepare(`INSERT INTO books (id, title, authors, category, categories, description, isbn, color1, color2, color3, cover, views, created_at, updated_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    for (let i = 1; i <= 60; i++) {
        const id = `test-book-${i}`;
        const title = `Test Book ${i}`;
        const authors = JSON.stringify(['Author ' + i]);
        const categories = JSON.stringify(['Category A', 'Category B']);
        stmt.run(id, title, authors, '', categories, 'A test description', '1234567890', 'red', 'blue', '', '', 0, new Date().toISOString(), new Date().toISOString());
    }
    stmt.finalize();

    console.log("60 books inserted.");
});
