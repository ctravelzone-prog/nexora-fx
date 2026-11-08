// models/database.js — SQLite connections (Node.js built-in node:sqlite, Node 22+).
// TWO databases with the SAME tables:
//  - Main DB (getMainDb / getDb outside a request): real users + all system
//    data. Default DB_PATH.
//  - Showcase DB (getShowcaseDb): showcase/demo accounts ONLY (is_showcase=1),
//    in a separate file so showcase data never mixes with real users, never
//    shows in the admin dashboard / ledger, and survives a real-user wipe.
//    Same file folder, '-showcase' before '.db' (override with SHOWCASE_DB_PATH).
// Request routing uses AsyncLocalStorage: the auth middleware sets the
// current request's DB (main or showcase) from the JWT's isShowcase flag,
// and getDb() returns that DB. Outside a request (background jobs, CLI,
// scheduler) getDb() returns the main DB. Global settings (site_settings)
// always read the main DB via getMainDb().
// Traders are shared public data: getShowcaseDb() copies the traders table
// from the main DB on first open (and syncShowcaseTraders() re-syncs after
// an admin trader change) so showcase copies can JOIN traders and the
// copies.trader_id FK stays valid in the showcase file.
// Gotchas: journal_mode=WAL, foreign_keys=ON. node:sqlite has no
// transaction() helper, so addTransactionShim adds a better-sqlite3-style
// db.transaction(fn) wrapper (BEGIN / COMMIT / ROLLBACK).
const { DatabaseSync } = require('node:sqlite');
const { AsyncLocalStorage } = require('node:async_hooks');
const path = require('path');
require('dotenv').config();
const DB_PATH = process.env.DB_PATH || './nexora-fx.db';
const dbFile = path.resolve(__dirname, '../../', DB_PATH);
const showcaseFile = process.env.SHOWCASE_DB_PATH
  ? path.resolve(__dirname, '../../', process.env.SHOWCASE_DB_PATH)
  : dbFile.replace(/\.db$/, '-showcase.db');
const als = new AsyncLocalStorage();
let db;   // main handle (lazy)
let scDb; // showcase handle (lazy)
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
// Column migrations for older databases: add the column only when it is
// missing, so starting the server never fails on an existing database.
function applyMigrations(handle) {
    // KYC form builder (v117): form_data holds the submitted values of
    // the admin-configured (dynamic) fields as JSON; field_options holds a
    // select field's options as JSON [{value,label}].
    try{const cols=handle.prepare("PRAGMA table_info(kyc_submissions)").all();if(!cols.some(c=>c.name==='form_data')){handle.exec('ALTER TABLE kyc_submissions ADD COLUMN form_data TEXT');}}catch(_){}
    try{const cols=handle.prepare("PRAGMA table_info(kyc_form_fields)").all();if(!cols.some(c=>c.name==='field_options')){handle.exec('ALTER TABLE kyc_form_fields ADD COLUMN field_options TEXT');}}catch(_){}
    // One-time backfill of the full standard KYC form (v117). Inserts any
    // missing default field by field_name and sets the canonical order and
    // select options, then sets the flag so it never runs again (an admin
    // who deletes a field will not see it come back on restart).
    try{
      const flag=handle.prepare("SELECT value FROM site_settings WHERE key='kyc_fields_v117'").get();
      if(!flag||flag.value!=='1'){
        const defs=[
          ['full_name','Full Legal Name','text',1,1,null],
          ['date_of_birth','Date of Birth','date',1,2,null],
          ['nationality','Nationality','text',1,3,null],
          ['country','Country of Residence','text',1,4,null],
          ['address','Residential Address','textarea',1,5,null],
          ['city','City','text',1,6,null],
          ['postal_code','Postal / ZIP Code','text',0,7,null],
          ['occupation','Occupation','text',0,8,null],
          ['source_of_funds','Source of Funds','select',0,9,JSON.stringify([{value:'salary',label:'Salary'},{value:'business',label:'Business'},{value:'investments',label:'Investments'},{value:'savings',label:'Savings'},{value:'other',label:'Other'}])],
          ['doc_type','Document Type','select',1,10,JSON.stringify([{value:'passport',label:'Passport'},{value:'id_card',label:'National ID'},{value:'driving_license',label:'Driving License'}])],
          ['doc_number','Document Number','text',1,11,null],
          ['doc_front','Document Front','file',1,12,null],
          ['doc_back','Document Back','file',0,13,null],
          ['selfie','Selfie with Document','file',1,14,null],
        ];
        const hasStmt=handle.prepare('SELECT id FROM kyc_form_fields WHERE field_name=?');
        const ins=handle.prepare('INSERT INTO kyc_form_fields (field_name,field_label,field_type,required,sort_order,field_options) VALUES (?,?,?,?,?,?)');
        const upd=handle.prepare('UPDATE kyc_form_fields SET sort_order=?,field_options=? WHERE field_name=?');
        for(const d of defs){
          if(!hasStmt.get(d[0])) ins.run(...d);
          upd.run(d[4],d[5],d[0]);
        }
        handle.prepare("INSERT OR REPLACE INTO site_settings (key,value) VALUES ('kyc_fields_v117','1')").run();
      }
    }catch(_){}
    // Website visitor analytics (v116): one row per page view. visitor_id
    // is a random per-device ID (cookie + localStorage); distinct IDs are
    // unique visitors. Only the main DB is written to — the showcase copy
    // of this table stays empty.
    try{handle.exec('CREATE TABLE IF NOT EXISTS visits (id INTEGER PRIMARY KEY AUTOINCREMENT, visitor_id TEXT NOT NULL, path TEXT NOT NULL, visited_at INTEGER NOT NULL)');handle.exec('CREATE INDEX IF NOT EXISTS idx_visits_time ON visits(visited_at)');handle.exec('CREATE INDEX IF NOT EXISTS idx_visits_visitor ON visits(visitor_id)');}catch(_){}
    try{const cols=handle.prepare("PRAGMA table_info(users)").all();if(!cols.some(c=>c.name==='kyc_requested')){handle.exec('ALTER TABLE users ADD COLUMN kyc_requested INTEGER NOT NULL DEFAULT 0');}}catch(_){}
    try{const cols=handle.prepare("PRAGMA table_info(users)").all();if(!cols.some(c=>c.name==='profit_target_bp')){handle.exec('ALTER TABLE users ADD COLUMN profit_target_bp INTEGER');}}catch(_){}
    try{const cols=handle.prepare("PRAGMA table_info(users)").all();if(!cols.some(c=>c.name==='showcase_withdraw_cents')){handle.exec('ALTER TABLE users ADD COLUMN showcase_withdraw_cents INTEGER DEFAULT 0');}}catch(_){}
    try{const cols=handle.prepare("PRAGMA table_info(profit_schedule)").all();if(!cols.some(c=>c.name==='run_minutes')){handle.exec('ALTER TABLE profit_schedule ADD COLUMN run_minutes INTEGER');}}catch(_){}
    try{const cols=handle.prepare("PRAGMA table_info(users)").all();if(!cols.some(c=>c.name==='request_money_enabled')){handle.exec('ALTER TABLE users ADD COLUMN request_money_enabled INTEGER NOT NULL DEFAULT 1');}}catch(_){}
    try{const cols=handle.prepare("PRAGMA table_info(users)").all();if(!cols.some(c=>c.name==='request_money_one_time')){handle.exec('ALTER TABLE users ADD COLUMN request_money_one_time INTEGER NOT NULL DEFAULT 0');}}catch(_){}
    try{const cols=handle.prepare("PRAGMA table_info(balances)").all();if(!cols.some(c=>c.name==='referral_transferred_cents')){handle.exec('ALTER TABLE balances ADD COLUMN referral_transferred_cents INTEGER NOT NULL DEFAULT 0');}}catch(_){}
    try{const cols=handle.prepare("PRAGMA table_info(forget_requests)").all();if(!cols.some(c=>c.name==='access_token')){handle.exec('ALTER TABLE forget_requests ADD COLUMN access_token TEXT');}}catch(_){}
    // Admin profile (v99): display name + profile picture for the admin
    // panel header. Name defaults to 'Admin' for existing rows.
    try{const cols=handle.prepare("PRAGMA table_info(admins)").all();if(!cols.some(c=>c.name==='name')){handle.exec("ALTER TABLE admins ADD COLUMN name TEXT NOT NULL DEFAULT 'Admin'");}}catch(_){}
    try{const cols=handle.prepare("PRAGMA table_info(admins)").all();if(!cols.some(c=>c.name==='profile_pic')){handle.exec('ALTER TABLE admins ADD COLUMN profile_pic TEXT');}}catch(_){}
    // One-time backfill for the referral transfer feature (v88): referral
    // money earned BEFORE v88 was already added straight to Profit, so
    // mark it transferred — otherwise it could be transferred a second
    // time. Runs once (site_settings flag); new earnings stay transferable.
    // (A no-op on the empty showcase DB — kept here so both files share
    // the same schema shape.)
    try{
      const cols=handle.prepare("PRAGMA table_info(balances)").all();
      if(cols.some(c=>c.name==='referral_transferred_cents')){
        const flag=handle.prepare("SELECT value FROM site_settings WHERE key='referral_transfer_migrated'").get();
        if(!flag||flag.value!=='1'){
          handle.exec('UPDATE balances SET referral_transferred_cents=referral_cents');
          handle.prepare("INSERT OR REPLACE INTO site_settings (key,value) VALUES ('referral_transfer_migrated','1')").run();
        }
      }
    }catch(_){}
}
// Opens one database file: WAL + FKs + transaction shim + both schemas +
// the column migrations. Used for the main DB and the showcase DB.
function openDb(file) {
  const handle = new DatabaseSync(file);
  handle.exec('PRAGMA journal_mode=WAL');
  handle.exec('PRAGMA foreign_keys=ON');
  addTransactionShim(handle);
  require('./schema1')(handle);
  require('./schema2')(handle);
  applyMigrations(handle);
  return handle;
}
// Main database (real users + system data). Created on first call.
function getMainDb() {
  if (!db) db = openDb(dbFile);
  return db;
}
// Showcase database (showcase accounts only). Created on first call; the
// traders table is synced from the main DB so showcase copies can JOIN
// traders and their trader_id FK stays valid.
function getShowcaseDb() {
  if (!scDb) {
    scDb = openDb(showcaseFile);
    try { syncShowcaseTraders(); } catch (_) {}
  }
  return scDb;
}
// Copies the traders table (shared public data) from the main DB into the
// showcase DB. INSERT OR REPLACE (upsert) by id, so it adds new traders
// and updates edited ones; a trader deleted from the main DB stays in the
// showcase file (harmless — showcase copies pointing at it keep working).
// Column list is read live so a future schema change cannot break it.
function syncShowcaseTraders() {
  const main = getMainDb();
  const sc = getShowcaseDb();
  const cols = main.prepare('PRAGMA table_info(traders)').all().map(c => c.name);
  if (!cols.length) return;
  const rows = main.prepare('SELECT * FROM traders ORDER BY id').all();
  const ins = sc.prepare('INSERT OR REPLACE INTO traders (' + cols.join(',') + ') VALUES (' + cols.map(() => '?').join(',') + ')');
  sc.transaction(() => { for (const r of rows) ins.run(...cols.map(c => r[c])); })();
}
// Returns the database for the current request: the showcase DB when the
// auth middleware set it in the AsyncLocalStorage store, otherwise the
// main DB (background jobs, CLI, public routes, admin requests).
function getDb() {
  const store = als.getStore();
  if (store && store.db) return store.db;
  return getMainDb();
}
// Runs fn with the given database as the request database (used by
// non-request code that must touch the showcase DB, e.g. the admin
// approving a showcase deposit, or the profit pass). Returns fn's value.
function runWithDb(dbHandle, fn) {
  return als.run({ db: dbHandle }, fn);
}
module.exports = { getDb, getMainDb, getShowcaseDb, runWithDb, syncShowcaseTraders, als };
