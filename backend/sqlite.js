
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

class Database {
  constructor(filename) {
    this.filename = filename || ':memory:';
    this.dbPromise = open({ filename: this.filename, driver: sqlite3.Database });
  }
  async exec(sql){ return (await this.dbPromise).exec(sql); }
  async run(sql, params=[]){ return (await this.dbPromise).run(sql, params); }
  async get(sql, params=[]){ return (await this.dbPromise).get(sql, params); }
  async all(sql, params=[]){ return (await this.dbPromise).all(sql, params); }
}
module.exports = { Database };
