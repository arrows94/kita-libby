require('dotenv').config();
const { Database } = require('./sqlite');
const db = new Database(process.env.DB_FILE || './data.sqlite');
module.exports = db;
