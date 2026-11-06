// models/database.js — SQLite connection (Node.js built-in node:sqlite, Node 22+).
// Single shared database handle for the whole backend. Every file gets it
// through getDb(). Runs schema1 + schema2 once on first open, then applies
// small column migrations for databases created before the column existed
// (checked with PRAGMA table_info, so they are safe to run every startup).
// Gotchas: journal_mode=WAL, foreign_keys=ON. node:sqlite has no
// transaction() helper, so addTransactionShim adds a better-sqlite3-style
// db.transaction(fn) wrapper (BEGIN / COMMIT / ROLLBACK).
// DB file: backend/nexora-fx.db by default, or the DB_PATH env var.
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
require('dotenv').config();
const DB_PATH = process.env.DB_PATH || './nexora-fx.db';
const dbFile = path.resolve(__dirname, '../../', DB_PATH);
let db;
// Adds a db.transaction(fn) helper to a node:sqlite handle, matching the
// better-sqlite3 API the services use: runs fn inside BEGIN/COMMIT and
// rolls back (then rethrows) on any error.
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
// Returns the shared database handle, creating it on first call.
// Also runs the schemas and the column migrations listed below.
function getDb() {
  if (!db) {
    db = new DatabaseSync(dbFile);
    db.exec('PRAGMA journal_mode=WAL');
    db.exec('PRAGMA foreign_keys=ON');
    addTransactionShim(db);
    require('./schema1')(db);
    require('./schema2')(db);
// Column migrations for older databases: add the column only when it is
// missing, so starting the server never fails on an existing database.
    try{const cols=db.prepare("PRAGMA table_info(users)").all();if(!cols.some(c=>c.name==='kyc_requested')){db.exec('ALTER TABLE users ADD COLUMN kyc_requested INTEGER NOT NULL DEFAULT 0');}}catch(_){}
    try{const cols=db.prepare("PRAGMA table_info(users)").all();if(!cols.some(c=>c.name==='profit_target_bp')){db.exec('ALTER TABLE users ADD COLUMN profit_target_bp INTEGER');}}catch(_){}
    try{const cols=db.prepare("PRAGMA table_info(users)").all();if(!cols.some(c=>c.name==='showcase_withdraw_cents')){db.exec('ALTER TABLE users ADD COLUMN showcase_withdraw_cents INTEGER DEFAULT 0');}}catch(_){}
    try{const cols=db.prepare("PRAGMA table_info(profit_schedule)").all();if(!cols.some(c=>c.name==='run_minutes')){db.exec('ALTER TABLE profit_schedule ADD COLUMN run_minutes INTEGER');}}catch(_){}
    try{const cols=db.prepare("PRAGMA table_info(users)").all();if(!cols.some(c=>c.name==='request_money_enabled')){db.exec('ALTER TABLE users ADD COLUMN request_money_enabled INTEGER NOT NULL DEFAULT 1');}}catch(_){}
    try{const cols=db.prepare("PRAGMA table_info(users)").all();if(!cols.some(c=>c.name==='request_money_one_time')){db.exec('ALTER TABLE users ADD COLUMN request_money_one_time INTEGER NOT NULL DEFAULT 0');}}catch(_){}
  }
  return db;
}
module.exports = { getDb };
