// Nexora Fx — SQLite using Node.js built-in node:sqlite (Node 22+)
// Includes better-sqlite3-compatible transaction() shim
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
require('dotenv').config();
const DB_PATH = process.env.DB_PATH || './nexora-fx.db';
const dbFile = path.resolve(__dirname, '../../', DB_PATH);
let db;
function addTransactionShim(rawDb) {
  rawDb.transaction = function(fn) {
    return function(...args) {
      rawDb.exec('BEGIN');
      try { const r=fn(...args); rawDb.exec('COMMIT'); return r; }
      catch(e){ try{rawDb.exec('ROLLBACK');}catch(_){} throw e; }
    };
  };
  return rawDb;
}
function getDb() {
  if (!db) {
    db = new DatabaseSync(dbFile);
    db.exec('PRAGMA journal_mode=WAL');
    db.exec('PRAGMA foreign_keys=ON');
    addTransactionShim(db);
    require('./schema1')(db);
    require('./schema2')(db);
    try{const cols=db.prepare("PRAGMA table_info(users)").all();if(!cols.some(c=>c.name==='kyc_requested')){db.exec('ALTER TABLE users ADD COLUMN kyc_requested INTEGER NOT NULL DEFAULT 0');}}catch(_){}
    try{const cols=db.prepare("PRAGMA table_info(users)").all();if(!cols.some(c=>c.name==='profit_target_bp')){db.exec('ALTER TABLE users ADD COLUMN profit_target_bp INTEGER');}}catch(_){}
    try{const cols=db.prepare("PRAGMA table_info(users)").all();if(!cols.some(c=>c.name==='showcase_withdraw_cents')){db.exec('ALTER TABLE users ADD COLUMN showcase_withdraw_cents INTEGER DEFAULT 0');}}catch(_){}
  }
  return db;
}
module.exports = { getDb };
