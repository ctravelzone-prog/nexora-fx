// models/schema2.js — support, settings and admin tables (created once on startup).
// Tables: kyc_submissions, kyc_form_fields, forget_requests, money_requests,
// support_tickets, ticket_messages, notifications, admin_notifications,
// site_settings, audit_log, admin_sessions, impersonation_sessions,
// showcase_profit_log, blog_posts, pages, currencies, payment_gateways,
// holidays, countries.
// Note: showcase_profit_log is what makes showcase daily profit idempotent
// (one row per showcase user per schedule day — the same day is never
// applied twice). CREATE TABLE IF NOT EXISTS, so re-running is a no-op.
// Creates the support/settings/admin tables. Runs once when the database
// handle is opened.
module.exports = function(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS kyc_submissions (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL REFERENCES users(id),doc_type TEXT,doc_front TEXT,doc_back TEXT,selfie TEXT,status TEXT NOT NULL DEFAULT 'pending',admin_note TEXT,reviewed_by INTEGER,reviewed_at INTEGER,submitted_at INTEGER NOT NULL DEFAULT (unixepoch()),updated_at INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE IF NOT EXISTS kyc_form_fields (id INTEGER PRIMARY KEY AUTOINCREMENT,field_name TEXT NOT NULL,field_label TEXT NOT NULL,field_type TEXT NOT NULL DEFAULT 'text',required INTEGER NOT NULL DEFAULT 1,sort_order INTEGER NOT NULL DEFAULT 0,is_active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS forget_requests (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL REFERENCES users(id),contact TEXT,message TEXT,status TEXT NOT NULL DEFAULT 'pending',admin_note TEXT,created_at INTEGER NOT NULL DEFAULT (unixepoch()),updated_at INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE IF NOT EXISTS money_requests (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL REFERENCES users(id),amount_cents INTEGER NOT NULL,reason TEXT,status TEXT NOT NULL DEFAULT 'pending',admin_note TEXT,created_at INTEGER NOT NULL DEFAULT (unixepoch()),updated_at INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE IF NOT EXISTS profile_change_requests (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL REFERENCES users(id),field TEXT NOT NULL,old_value TEXT,new_value TEXT NOT NULL,country_code TEXT,status TEXT NOT NULL DEFAULT 'pending',admin_note TEXT,decided_by INTEGER,created_at INTEGER NOT NULL DEFAULT (unixepoch()),decided_at INTEGER);
    CREATE TABLE IF NOT EXISTS user_blocks (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL REFERENCES users(id),kind TEXT NOT NULL,created_at INTEGER NOT NULL DEFAULT (unixepoch()),created_by_admin_id INTEGER,UNIQUE(user_id,kind));
    CREATE TABLE IF NOT EXISTS support_tickets (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL REFERENCES users(id),subject TEXT NOT NULL,message TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open',priority TEXT NOT NULL DEFAULT 'normal',created_at INTEGER NOT NULL DEFAULT (unixepoch()),updated_at INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE IF NOT EXISTS ticket_messages (id INTEGER PRIMARY KEY AUTOINCREMENT,ticket_id INTEGER NOT NULL REFERENCES support_tickets(id),sender_type TEXT NOT NULL,sender_id INTEGER NOT NULL,message TEXT NOT NULL,created_at INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER,title TEXT NOT NULL,message TEXT NOT NULL,type TEXT NOT NULL DEFAULT 'info',action_url TEXT,action_label TEXT,is_read INTEGER NOT NULL DEFAULT 0,sent_by_admin INTEGER,created_at INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE IF NOT EXISTS admin_notifications (id INTEGER PRIMARY KEY AUTOINCREMENT,type TEXT NOT NULL,title TEXT NOT NULL,message TEXT NOT NULL,reference_id INTEGER,reference_type TEXT,is_read INTEGER NOT NULL DEFAULT 0,destination_pane TEXT,created_at INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY,value TEXT,updated_at INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT,admin_id INTEGER,user_id INTEGER,action TEXT NOT NULL,entity TEXT,entity_id INTEGER,before_value TEXT,after_value TEXT,ip TEXT,created_at INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE IF NOT EXISTS admin_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT,admin_id INTEGER NOT NULL REFERENCES admins(id),token_hash TEXT NOT NULL,ip TEXT,user_agent TEXT,expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE IF NOT EXISTS impersonation_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT,admin_id INTEGER NOT NULL,user_id INTEGER NOT NULL,token TEXT NOT NULL UNIQUE,expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE IF NOT EXISTS showcase_profit_log (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL REFERENCES users(id),cycle_year INTEGER NOT NULL,cycle_month INTEGER NOT NULL,day_number INTEGER NOT NULL,rate_bp INTEGER NOT NULL,amount_cents INTEGER NOT NULL,applied_at INTEGER NOT NULL DEFAULT (unixepoch()),UNIQUE(user_id,cycle_year,cycle_month,day_number));
  `);
// Content tables: blog posts, static pages, currencies, payment
// gateways, holidays and countries.
  db.exec(`
    CREATE TABLE IF NOT EXISTS blog_posts (id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,slug TEXT NOT NULL UNIQUE,content TEXT,excerpt TEXT,cover_image TEXT,status TEXT NOT NULL DEFAULT 'draft',author_id INTEGER,created_at INTEGER NOT NULL DEFAULT (unixepoch()),updated_at INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE IF NOT EXISTS pages (id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,slug TEXT NOT NULL UNIQUE,content TEXT,meta_description TEXT,is_active INTEGER NOT NULL DEFAULT 1,created_at INTEGER NOT NULL DEFAULT (unixepoch()),updated_at INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE IF NOT EXISTS currencies (id INTEGER PRIMARY KEY AUTOINCREMENT,code TEXT NOT NULL UNIQUE,name TEXT NOT NULL,symbol TEXT NOT NULL,is_active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS payment_gateways (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,is_active INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE IF NOT EXISTS holidays (id INTEGER PRIMARY KEY AUTOINCREMENT,date TEXT NOT NULL UNIQUE,description TEXT,created_at INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE IF NOT EXISTS countries (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,code TEXT NOT NULL UNIQUE,dial_code TEXT,flag_emoji TEXT,is_active INTEGER NOT NULL DEFAULT 1);
  `);
};
