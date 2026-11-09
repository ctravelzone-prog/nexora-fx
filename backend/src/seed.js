// seed.js — seeds the database with the demo content a fresh install needs.
// Runs on every server start (see app.js) and on `npm run seed`. Creates
// the Super Admin (admin@nexorafxuk, default password admin1234 unless
// ADMIN_PASSWORD_HASH is set), the demo user nexora_fx / demo1234 ($300
// Main Balance, $500 deposited, referral code NEXORA-FX), 3 traders,
// 7 countries, default KYC form fields, static pages, payment gateways,
// default site settings, and the current month's profit schedule.
// Seeding is idempotent: every insert checks first (or uses INSERT OR
// IGNORE), so re-running it on an existing database changes nothing.
require('dotenv').config();
const bcrypt = require('bcrypt');
const { getDb } = require('./models/database');
const { generateTraderPlans, traderPlansExist } = require('./services/profitService');

// Seeds the database (see the header for what is created). The function
// also creates the database handle and closes it when it runs standalone.
async function seed() {
  const db = getDb();
  // Super Admin
  if (!db.prepare(`SELECT id FROM admins WHERE role='Super Admin'`).get()) {
    const email = process.env.ADMIN_EMAIL || 'admin@nexorafxuk';
    let hash = process.env.ADMIN_PASSWORD_HASH;
    if (!hash || !hash.startsWith('$2')) {
      hash = await bcrypt.hash('admin1234', 12);
      console.log('[SEED] No ADMIN_PASSWORD_HASH set. Default password: admin1234 — CHANGE IMMEDIATELY');
    }
    db.prepare('INSERT INTO admins (email,password_hash,role) VALUES (?,?,?)').run(email, hash, 'Super Admin');
    console.log('[SEED] Super Admin:', email);
  }
  // Default settings
  const defs = {site_name:'Nexora Fx',hero_title:'Trade Smarter, Not Harder.',hero_subtitle:'Join thousands of traders worldwide. Start your journey today.',withdraw_early_fee_bp:'1500',withdraw_regular_fee_bp:'0',profit_target_bp:'1000',withdraw_lock_months:'3',profit_min_cents:'1000',referral_bp:'400',deposit_enabled:'1',withdraw_enabled:'1',kyc_enabled:'0',admin_2fa_enabled:'0',user_2fa_enabled:'0',maintenance_mode:'0',binance_wallet_address:'',binance_wallet_qr:'',footer_about:'Nexora Fx is a US-based copy trading platform.',announcement_bar:'',site_font:'Plus Jakarta Sans',site_loader:'1',error_title:'Page Not Found',error_message:'The page you are looking for does not exist.'};
  const ins=db.prepare('INSERT OR IGNORE INTO site_settings (key,value) VALUES (?,?)');
  db.transaction(e=>{for(const[k,v]of e)ins.run(k,v);})(Object.entries(defs));
  // Pages
  const pages=[['Terms & Conditions','terms','<h1>Terms</h1><p>Please read carefully.</p>'],['Privacy Policy','privacy','<h1>Privacy Policy</h1>'],['Risk Disclosure','risk','<h1>Risk Disclosure</h1><p>Trading involves risk. Copy trading does not guarantee profit.</p>'],['FAQ','faq','<h1>FAQ</h1>']];
  const insp=db.prepare('INSERT OR IGNORE INTO pages (title,slug,content) VALUES (?,?,?)');
  for(const p of pages) insp.run(...p);
  // Traders
  if(!db.prepare('SELECT COUNT(*) as c FROM traders').get().c){
    const ts=[['RioTraderBR','riotrader_br','🇧🇷',10.2,78.5,4.2,'Medium',10,842,'Smart Entries, Steady Growth'],['UKGoldenTrade','ukgoldentrade','🇬🇧',9.8,72.1,5.8,'Medium',10,634,'Gold scalping, tight risk control'],['AsiaFXPro','asiafx_pro','🇯🇵',10.5,81.2,3.9,'Low',20,1204,'Precision forex entries, Asia session']];
    const int2=db.prepare('INSERT INTO traders (name,username,flag_emoji,roi_percent,win_rate,drawdown,risk_level,min_copy_cents,followers,strategy) VALUES (?,?,?,?,?,?,?,?,?,?)');
    for(const t of ts) int2.run(t[0],t[1],t[2],t[3],t[4],t[5],t[6],t[7]*100,t[8],t[9]);
    console.log('[SEED] 3 sample traders created');
  }
  // Countries
  if(!db.prepare('SELECT COUNT(*) as c FROM countries').get().c){
    const cs=[['+44','GB','🇬🇧','United Kingdom'],['+1','US','🇺🇸','United States'],['+880','BD','🇧🇩','Bangladesh'],['+91','IN','🇮🇳','India'],['+92','PK','🇵🇰','Pakistan'],['+971','AE','🇦🇪','UAE'],['+234','NG','🇳🇬','Nigeria']];
    const inc=db.prepare('INSERT INTO countries (dial_code,code,flag_emoji,name) VALUES (?,?,?,?)');
    for(const c of cs) inc.run(...c);
  }
  // KYC fields
  if(!db.prepare('SELECT COUNT(*) as c FROM kyc_form_fields').get().c){
    const kf=[['full_name','Full Legal Name','text',1,1,null],['date_of_birth','Date of Birth','date',1,2,null],['nationality','Nationality','text',1,3,null],['country','Country of Residence','text',1,4,null],['address','Residential Address','textarea',1,5,null],['city','City','text',1,6,null],['postal_code','Postal / ZIP Code','text',0,7,null],['occupation','Occupation','text',0,8,null],['source_of_funds','Source of Funds','select',0,9,JSON.stringify([{value:'salary',label:'Salary'},{value:'business',label:'Business'},{value:'investments',label:'Investments'},{value:'savings',label:'Savings'},{value:'other',label:'Other'}])],['doc_type','Document Type','select',1,10,JSON.stringify([{value:'passport',label:'Passport'},{value:'id_card',label:'National ID'},{value:'driving_license',label:'Driving License'}])],['doc_number','Document Number','text',1,11,null],['doc_front','Document Front','file',1,12,null],['doc_back','Document Back','file',0,13,null],['selfie','Selfie with Document','file',1,14,null]];
    const ink=db.prepare('INSERT INTO kyc_form_fields (field_name,field_label,field_type,required,sort_order,field_options) VALUES (?,?,?,?,?,?)');
    for(const f of kf) ink.run(...f);
  }
  // Profit schedule
  const now=new Date();
  if(!traderPlansExist(now.getFullYear(),now.getMonth()+1)){
    generateTraderPlans(now.getFullYear(),now.getMonth()+1,1);
    console.log('[SEED] Profit schedule generated for current month');
  }
  // Demo user
  if(!db.prepare(`SELECT id FROM users WHERE username='nexora_fx'`).get()){
    const dh=await bcrypt.hash('demo1234',12);
    const uid=db.prepare('INSERT INTO users (full_name,username,email,password_hash,referral_code,email_verified) VALUES (?,?,?,?,?,1)').run('Nexora Demo','nexora_fx','demo@nexorafxuk',dh,'DEMO2026').lastInsertRowid;
    db.prepare('INSERT INTO balances (user_id,main_cents,total_deposited_cents,first_deposit_at) VALUES (?,?,?,?)').run(uid,30000,50000,Math.floor(Date.now()/1000)-8640000);
    console.log('[SEED] Demo user: nexora_fx / demo1234');
  }
  console.log('\n[SEED] Complete.');
  process.exit(0);
}

seed().catch(e=>{console.error('[SEED ERROR]',e.message);process.exit(1);});

