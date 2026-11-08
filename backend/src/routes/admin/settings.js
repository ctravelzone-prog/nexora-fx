// routes/admin/settings.js — site settings, money settings, wallets,
// 2FA/KYC controls, media uploads, audit log and reports.
// The settings system is fully generic: GET / returns every site_settings
// row and POST / saves ANY key/value pairs (no whitelist), so new settings
// never need a backend change. GET /money and PUT /money are the Money
// Settings screen (Super Admin only, audit-logged). /deposit-wallet is
// the Binance Pay address + QR shown on the deposit screen. /2fa-control
// and /kyc-control are the admin/user 2FA switches and the KYC master
// switch. /logo, /favicon and /hero-image upload media (max 5 MB).
// GET /audit-log and /reports are read-only admin activity lists.
// Note: GET / (all settings) is public — the frontend loads its branding
// and rules from it; secrets must never be stored in site_settings.
const router = require('express').Router();
const { getDb } = require('../../models/database');
const { authAdmin, superAdminOnly } = require('../../middleware/auth');
const multer = require('multer');
const path = require('path');
const { getUploadsDir, ensureUploadsDir } = require('../../services/uploads');
ensureUploadsDir();
const upload = multer({storage:multer.diskStorage({destination:(req,file,cb)=>cb(null,getUploadsDir()),filename:(req,file,cb)=>cb(null,`${file.fieldname}_${Date.now()}_${file.originalname}`)}),limits:{fileSize:5*1024*1024}});

// Writes one site_settings key (insert or replace).
function setSetting(k,v){getDb().prepare('INSERT OR REPLACE INTO site_settings (key,value,updated_at) VALUES (?,?,unixepoch())').run(k,v);}
// Reads one site_settings value, or null when the key is missing.
function getSetting(k){const r=getDb().prepare('SELECT value FROM site_settings WHERE key=?').get(k);return r?r.value:null;}

// GET / — public, no auth. Returns every site_settings row as one
// JSON object (the frontend reads branding, money rules and flags).
router.get('/',(req,res)=>{const rows=getDb().prepare('SELECT key,value FROM site_settings').all();const s={};for(const r of rows)s[r.key]=r.value;res.json(s);});
// POST / — saves any settings keys from the body (generic: no
// whitelist). Values are stored as strings.
router.post('/',authAdmin,(req,res)=>{const db=getDb();const ins=db.prepare('INSERT OR REPLACE INTO site_settings (key,value,updated_at) VALUES (?,?,unixepoch())');db.transaction(e=>{for(const[k,v]of e)ins.run(k,String(v));})(Object.entries(req.body));res.json({success:true});});

// GET /money — the Money Settings values (fees, lock, profit target,
// profit minimum, referral rate, deposit/withdraw switches).
router.get('/money',authAdmin,(req,res)=>res.json({withdraw_early_fee_bp:getSetting('withdraw_early_fee_bp')||'1500',withdraw_regular_fee_bp:getSetting('withdraw_regular_fee_bp')||'0',profit_target_bp:getSetting('profit_target_bp')||'1000',withdraw_lock_months:getSetting('withdraw_lock_months')||'3',profit_min_cents:getSetting('profit_min_cents')||'1000',referral_bp:getSetting('referral_bp')||'400',deposit_enabled:getSetting('deposit_enabled')||'1',withdraw_enabled:getSetting('withdraw_enabled')||'1'}));

// PUT /money — Super Admin only. Saves the Money Settings values.
router.put('/money',authAdmin,superAdminOnly,(req,res)=>{
  const db=getDb();
  if(req.body.profit_target_bp!==undefined){
    const pb=parseInt(req.body.profit_target_bp);
    if(isNaN(pb)||pb<0||pb>10000) return res.status(400).json({error:'Profit target must be 0-100%'});
    req.body.profit_target_bp=String(pb);
  }
  const oldTarget=getSetting('profit_target_bp');
  for(const[k,v]of Object.entries(req.body)){
    if(v!==undefined){const old=getSetting(k);setSetting(k,String(v));db.prepare('INSERT INTO audit_log (admin_id,action,entity,before_value,after_value) VALUES (?,?,?,?,?)').run(req.adminId,'money_setting_change',k,old,String(v));}
  }
  // Changing the global profit target rebalances the current month's remaining days
  if(req.body.profit_target_bp!==undefined&&parseInt(req.body.profit_target_bp)!==parseInt(oldTarget||'1000')){
    try{
      const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dhaka',year:'numeric',month:'numeric'}).formatToParts(new Date());
      const y=parseInt(parts.find(p=>p.type==='year').value),m=parseInt(parts.find(p=>p.type==='month').value);
      const {retargetSchedule}=require('../../services/profitService');
      retargetSchedule(y,m,parseInt(req.body.profit_target_bp));
    }catch(_){}
  }
  res.json({success:true});
});

// GET /deposit-wallet — the Binance Pay address and QR shown to users
// on the deposit screen.
router.get('/deposit-wallet',authAdmin,(req,res)=>res.json({address:getSetting('binance_wallet_address'),qr:getSetting('binance_wallet_qr')}));
// POST /deposit-wallet — Super Admin only. Saves the Binance Pay
// address and uploads a new QR image (multipart, max 5 MB).
router.post('/deposit-wallet',authAdmin,superAdminOnly,upload.single('qr'),(req,res)=>{
  const{address}=req.body;const db=getDb();
  if(address){const old=getSetting('binance_wallet_address');setSetting('binance_wallet_address',address);db.prepare('INSERT INTO audit_log (admin_id,action,before_value,after_value) VALUES (?,?,?,?)').run(req.adminId,'change_deposit_wallet',old,address);}
  if(req.file)setSetting('binance_wallet_qr',`/uploads/${req.file.filename}`);
  res.json({success:true});
});

// GET /2fa-control — whether admin 2FA and user 2FA are enabled.
router.get('/2fa-control',authAdmin,(req,res)=>res.json({admin_2fa_enabled:getSetting('admin_2fa_enabled')||'0',user_2fa_enabled:getSetting('user_2fa_enabled')||'0'}));
// PUT /2fa-control — Super Admin only. Turns the admin/user 2FA
// switches on or off.
router.put('/2fa-control',authAdmin,superAdminOnly,(req,res)=>{
  const{admin_2fa_enabled,user_2fa_enabled}=req.body;const db=getDb();
  if(admin_2fa_enabled!==undefined){const old=getSetting('admin_2fa_enabled');setSetting('admin_2fa_enabled',admin_2fa_enabled?'1':'0');db.prepare('INSERT INTO audit_log (admin_id,action,before_value,after_value) VALUES (?,?,?,?)').run(req.adminId,'2fa_control:admin',old,admin_2fa_enabled?'1':'0');}
  if(user_2fa_enabled!==undefined){const old=getSetting('user_2fa_enabled');setSetting('user_2fa_enabled',user_2fa_enabled?'1':'0');db.prepare('INSERT INTO audit_log (admin_id,action,before_value,after_value) VALUES (?,?,?,?)').run(req.adminId,'2fa_control:user',old,user_2fa_enabled?'1':'0');}
  res.json({success:true});
});

// GET /kyc-control — the global KYC switch, the KYC form fields, and
// the users currently asked individually for KYC.
router.get('/kyc-control',authAdmin,(req,res)=>{const fields=getDb().prepare('SELECT * FROM kyc_form_fields ORDER BY sort_order').all();res.json({kyc_enabled:getSetting('kyc_enabled')||'0',fields,requested_users:getDb().prepare('SELECT id,full_name,username,kyc_status FROM users WHERE kyc_requested=1 AND is_showcase=0 ORDER BY full_name').all()});});
// PUT /kyc-control — Super Admin only. Turns the global KYC switch on
// or off. Turning it on notifies only unverified, non-pending users
// (verified and pending users are excluded).
router.put('/kyc-control',authAdmin,superAdminOnly,(req,res)=>{const{kyc_enabled}=req.body;if(kyc_enabled!==undefined){const old=getSetting('kyc_enabled');const newVal=kyc_enabled?'1':'0';setSetting('kyc_enabled',newVal);if(newVal==='1'&&old!=='1'){const db=getDb();const targets=db.prepare("SELECT id FROM users WHERE is_showcase=0 AND kyc_status NOT IN ('approved','pending')").all();const ins=db.prepare('INSERT INTO notifications (user_id,title,message,type,action_url,action_label,sent_by_admin) VALUES (?,?,?,?,?,?,?)');const hasUnread=(uid)=>db.prepare("SELECT id FROM notifications WHERE user_id=? AND title='KYC Verification Required' AND is_read=0").get(uid);db.transaction(us=>{for(const u of us){if(!hasUnread(u.id))ins.run(u.id,'KYC Verification Required','Please complete your KYC verification to unlock withdrawals.','action_required','/kyc','Complete KYC \u2192',req.adminId);}})(targets);}}res.json({success:true});});
// POST /kyc-control/request — Super Admin only. Asks ONE user for KYC
// (sets their kyc_requested flag + Action Required notification).
// Refused for showcase accounts, approved users, users with a pending
// submission, or users already requested (already_requested).
router.post('/kyc-control/request',authAdmin,superAdminOnly,(req,res)=>{const db=getDb();const user=db.prepare('SELECT * FROM users WHERE id=? AND is_showcase=0').get(req.body.user_id);if(!user)return res.status(404).json({error:'User not found'});if(user.kyc_status==='approved')return res.status(400).json({error:'User already KYC verified'});const pending=db.prepare("SELECT id FROM kyc_submissions WHERE user_id=? AND status='pending'").get(user.id);if(pending)return res.status(400).json({error:'User already submitted KYC. Review it in KYC Control.'});if(user.kyc_requested)return res.json({success:true,already_requested:true});db.prepare('UPDATE users SET kyc_requested=1,updated_at=unixepoch() WHERE id=?').run(user.id);db.prepare('INSERT INTO notifications (user_id,title,message,type,action_url,action_label,sent_by_admin) VALUES (?,?,?,?,?,?,?)').run(user.id,'KYC Verification Required','Please complete your KYC verification to unlock withdrawals.','action_required','/kyc','Complete KYC \u2192',req.adminId);db.prepare('INSERT INTO audit_log (admin_id,user_id,action) VALUES (?,?,?)').run(req.adminId,user.id,'kyc_request_single');res.json({success:true});});
// POST /kyc-control/cancel — Super Admin only. Removes one user's KYC
// request (clears their kyc_requested flag).
router.post('/kyc-control/cancel',authAdmin,superAdminOnly,(req,res)=>{const db=getDb();const user=db.prepare('SELECT * FROM users WHERE id=? AND is_showcase=0').get(req.body.user_id);if(!user)return res.status(404).json({error:'User not found'});const pending=db.prepare("SELECT id FROM kyc_submissions WHERE user_id=? AND status='pending'").get(user.id);if(pending)return res.status(400).json({error:'User KYC is under review. Review it in KYC Control instead of cancelling.'});db.prepare('UPDATE users SET kyc_requested=0,updated_at=unixepoch() WHERE id=?').run(user.id);
db.prepare('INSERT INTO audit_log (admin_id,user_id,action) VALUES (?,?,?)').run(req.adminId,user.id,'kyc_request_cancelled');res.json({success:true});});

// KYC form builder (v117) — Super Admin only. The KYC form is defined by
// kyc_form_fields; the user form renders the active fields in sort order.
// The four document fields (doc_type, doc_front, doc_back, selfie) are
// structural — they can be edited and toggled but never deleted, because
// the submit route stores them in fixed kyc_submissions columns.
const KYC_FIELD_TYPES=['text','textarea','date','number','tel','email','select','file'];
const KYC_CORE_FIELDS=['doc_type','doc_front','doc_back','selfie'];
// Normalises select options from any shape the admin UI may send: a JSON
// array, a JSON string of one, or one option per line ("label" or
// "value | label"). Returns [{value,label}] or null.
function parseFieldOptions(raw){
  if(!raw) return null;
  if(Array.isArray(raw)) return raw.map(o=>typeof o==='string'?{value:o,label:o}:(o&&o.value?{value:o.value,label:o.label||o.value}:null)).filter(Boolean);
  if(typeof raw==='string'){
    const t=raw.trim();
    if(t.startsWith('[')){try{const arr=JSON.parse(t);if(Array.isArray(arr))return parseFieldOptions(arr);}catch(_){}}
    return t.split('\n').map(l=>l.trim()).filter(Boolean).map(l=>{const p=l.split('|').map(x=>x.trim());return p.length>1?{value:p[0],label:p[1]}:{value:p[0],label:p[0]};});
  }
  return null;
}
// POST /kyc-control/fields — add a form field.
router.post('/kyc-control/fields',authAdmin,superAdminOnly,(req,res)=>{
  const {field_name,field_label,field_type,required,field_options}=req.body||{};
  const name=typeof field_name==='string'?field_name.trim().toLowerCase().replace(/[^a-z0-9_]/g,''):'';
  if(!name||!/^[a-z][a-z0-9_]*$/.test(name)) return res.status(400).json({error:'Field name must start with a letter and use only lowercase letters, numbers and _'});
  if(!field_label||!String(field_label).trim()) return res.status(400).json({error:'Field label is required'});
  if(!KYC_FIELD_TYPES.includes(field_type)) return res.status(400).json({error:'Invalid field type'});
  const db=getDb();
  if(db.prepare('SELECT id FROM kyc_form_fields WHERE field_name=?').get(name)) return res.status(400).json({error:'A field with this name already exists'});
  const opts=field_type==='select'?JSON.stringify(parseFieldOptions(field_options)||[]):null;
  if(field_type==='select'&&JSON.parse(opts).length===0) return res.status(400).json({error:'Select fields need at least one option (one per line)'});
  const maxOrder=db.prepare('SELECT COALESCE(MAX(sort_order),0) as m FROM kyc_form_fields').get().m;
  const id=db.prepare('INSERT INTO kyc_form_fields (field_name,field_label,field_type,required,sort_order,field_options,is_active) VALUES (?,?,?,?,?,?,1)').run(name,String(field_label).trim(),field_type,required?1:0,maxOrder+1,opts).lastInsertRowid;
  res.json({success:true,id});
});
// PUT /kyc-control/fields/:id — edit label/type/required/options/active.
router.put('/kyc-control/fields/:id',authAdmin,superAdminOnly,(req,res)=>{
  const db=getDb();
  const f=db.prepare('SELECT * FROM kyc_form_fields WHERE id=?').get(req.params.id);
  if(!f) return res.status(404).json({error:'Field not found'});
  const {field_label,field_type,required,field_options,is_active}=req.body||{};
  if(field_label!==undefined&&!String(field_label).trim()) return res.status(400).json({error:'Field label is required'});
  if(field_type!==undefined&&!KYC_FIELD_TYPES.includes(field_type)) return res.status(400).json({error:'Invalid field type'});
  const type=field_type||f.field_type;
  const opts=type==='select'?JSON.stringify(parseFieldOptions(field_options!==undefined?field_options:f.field_options)||[]):null;
  if(type==='select'&&JSON.parse(opts).length===0) return res.status(400).json({error:'Select fields need at least one option (one per line)'});
  db.prepare('UPDATE kyc_form_fields SET field_label=?,field_type=?,required=?,field_options=?,is_active=? WHERE id=?').run(
    field_label!==undefined?String(field_label).trim():f.field_label,
    type,
    required!==undefined?(required?1:0):f.required,
    opts,
    is_active!==undefined?(is_active?1:0):f.is_active,
    f.id);
  res.json({success:true});
});
// DELETE /kyc-control/fields/:id — delete a field (never the 4 core ones).
router.delete('/kyc-control/fields/:id',authAdmin,superAdminOnly,(req,res)=>{
  const db=getDb();
  const f=db.prepare('SELECT * FROM kyc_form_fields WHERE id=?').get(req.params.id);
  if(!f) return res.status(404).json({error:'Field not found'});
  if(KYC_CORE_FIELDS.includes(f.field_name)) return res.status(400).json({error:'The document fields cannot be deleted — turn them off instead'});
  db.prepare('DELETE FROM kyc_form_fields WHERE id=?').run(f.id);
  res.json({success:true});
});
// POST /kyc-control/fields/:id/move — move a field up or down in the form.
router.post('/kyc-control/fields/:id/move',authAdmin,superAdminOnly,(req,res)=>{
  const {direction}=req.body||{};
  if(!['up','down'].includes(direction)) return res.status(400).json({error:'Direction must be up or down'});
  const db=getDb();
  const f=db.prepare('SELECT * FROM kyc_form_fields WHERE id=?').get(req.params.id);
  if(!f) return res.status(404).json({error:'Field not found'});
  const other=direction==='up'
    ? db.prepare('SELECT * FROM kyc_form_fields WHERE sort_order<? ORDER BY sort_order DESC LIMIT 1').get(f.sort_order)
    : db.prepare('SELECT * FROM kyc_form_fields WHERE sort_order>? ORDER BY sort_order ASC LIMIT 1').get(f.sort_order);
  if(!other) return res.json({success:true,moved:false});
  db.prepare('UPDATE kyc_form_fields SET sort_order=? WHERE id=?').run(other.sort_order,f.id);
  db.prepare('UPDATE kyc_form_fields SET sort_order=? WHERE id=?').run(f.sort_order,other.id);
  res.json({success:true,moved:true});
});

// POST /logo — Super Admin only. Uploads the site logo (max 5 MB) and
// saves its URL as logo_url.
router.post('/logo',authAdmin,superAdminOnly,upload.single('logo'),(req,res)=>{if(!req.file)return res.status(400).json({error:'No file'});setSetting('logo_url',`/uploads/${req.file.filename}`);res.json({success:true,url:`/uploads/${req.file.filename}`});});
// POST /favicon — Super Admin only. Uploads the favicon (max 5 MB) and
// saves its URL as favicon_url.
router.post('/favicon',authAdmin,superAdminOnly,upload.single('favicon'),(req,res)=>{if(!req.file)return res.status(400).json({error:'No file'});setSetting('favicon_url',`/uploads/${req.file.filename}`);res.json({success:true,url:`/uploads/${req.file.filename}`});});
// POST /hero-image — Super Admin only. Uploads the landing hero image
// (max 5 MB) and saves its URL as hero_image_url.
router.post('/hero-image',authAdmin,superAdminOnly,upload.single('hero'),(req,res)=>{if(!req.file)return res.status(400).json({error:'No file'});setSetting('hero_image_url',`/uploads/${req.file.filename}`);res.json({success:true,url:`/uploads/${req.file.filename}`});});

// GET /audit-log — the admin audit log (who did what, when), newest
// first. Paged with ?limit= / ?offset=.
router.get('/audit-log',authAdmin,(req,res)=>{const{limit=100,offset=0}=req.query;res.json(getDb().prepare('SELECT al.*,a.email as admin_email FROM audit_log al LEFT JOIN admins a ON al.admin_id=a.id ORDER BY al.created_at DESC LIMIT ? OFFSET ?').all(parseInt(limit),parseInt(offset)));});

// GET /reports — admin reports (see the route body for the report
// content).
router.get('/reports',authAdmin,(req,res)=>{
  const db=getDb();
  res.json({
    total_deposit:db.prepare(`SELECT COALESCE(SUM(amount_cents),0) as t FROM deposits WHERE status='approved'`).get().t,
    total_withdraw:db.prepare(`SELECT COALESCE(SUM(net_cents),0) as t FROM withdrawals WHERE status='paid'`).get().t,
    total_profit_paid:db.prepare(`SELECT COALESCE(SUM(amount_cents),0) as t FROM transactions WHERE type='daily_pnl' AND amount_cents>0`).get().t,
    total_referral_paid:db.prepare(`SELECT COALESCE(SUM(commission_cents),0) as t FROM referrals WHERE status='paid'`).get().t,
    new_users:db.prepare('SELECT COUNT(*) as c FROM users WHERE is_showcase=0').get().c,
    active_copies:db.prepare(`SELECT COUNT(*) as c FROM copies WHERE status='active'`).get().c
  });
});

module.exports = router;
