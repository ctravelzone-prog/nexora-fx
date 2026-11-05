// admin/settings.js — site settings, money, KYC, 2FA, logo, audit, reports
const router = require('express').Router();
const { getDb } = require('../../models/database');
const { authAdmin, superAdminOnly } = require('../../middleware/auth');
const multer = require('multer');
const path = require('path');
const upload = multer({storage:multer.diskStorage({destination:(req,file,cb)=>cb(null,path.join(__dirname,'../../../uploads')),filename:(req,file,cb)=>cb(null,`${file.fieldname}_${Date.now()}_${file.originalname}`)}),limits:{fileSize:5*1024*1024}});

function setSetting(k,v){getDb().prepare('INSERT OR REPLACE INTO site_settings (key,value,updated_at) VALUES (?,?,unixepoch())').run(k,v);}
function getSetting(k){const r=getDb().prepare('SELECT value FROM site_settings WHERE key=?').get(k);return r?r.value:null;}

router.get('/',(req,res)=>{const rows=getDb().prepare('SELECT key,value FROM site_settings').all();const s={};for(const r of rows)s[r.key]=r.value;res.json(s);});
router.post('/',authAdmin,(req,res)=>{const db=getDb();const ins=db.prepare('INSERT OR REPLACE INTO site_settings (key,value,updated_at) VALUES (?,?,unixepoch())');db.transaction(e=>{for(const[k,v]of e)ins.run(k,String(v));})(Object.entries(req.body));res.json({success:true});});

router.get('/money',authAdmin,(req,res)=>res.json({withdraw_early_fee_bp:getSetting('withdraw_early_fee_bp')||'1500',withdraw_regular_fee_bp:getSetting('withdraw_regular_fee_bp')||'0',profit_target_bp:getSetting('profit_target_bp')||'1000',withdraw_lock_months:getSetting('withdraw_lock_months')||'3',profit_min_cents:getSetting('profit_min_cents')||'1000',referral_bp:getSetting('referral_bp')||'400',deposit_enabled:getSetting('deposit_enabled')||'1',withdraw_enabled:getSetting('withdraw_enabled')||'1'}));

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

router.get('/deposit-wallet',authAdmin,(req,res)=>res.json({address:getSetting('binance_wallet_address'),qr:getSetting('binance_wallet_qr')}));
router.post('/deposit-wallet',authAdmin,superAdminOnly,upload.single('qr'),(req,res)=>{
  const{address}=req.body;const db=getDb();
  if(address){const old=getSetting('binance_wallet_address');setSetting('binance_wallet_address',address);db.prepare('INSERT INTO audit_log (admin_id,action,before_value,after_value) VALUES (?,?,?,?)').run(req.adminId,'change_deposit_wallet',old,address);}
  if(req.file)setSetting('binance_wallet_qr',`/uploads/${req.file.filename}`);
  res.json({success:true});
});

router.get('/2fa-control',authAdmin,(req,res)=>res.json({admin_2fa_enabled:getSetting('admin_2fa_enabled')||'0',user_2fa_enabled:getSetting('user_2fa_enabled')||'0'}));
router.put('/2fa-control',authAdmin,superAdminOnly,(req,res)=>{
  const{admin_2fa_enabled,user_2fa_enabled}=req.body;const db=getDb();
  if(admin_2fa_enabled!==undefined){const old=getSetting('admin_2fa_enabled');setSetting('admin_2fa_enabled',admin_2fa_enabled?'1':'0');db.prepare('INSERT INTO audit_log (admin_id,action,before_value,after_value) VALUES (?,?,?,?)').run(req.adminId,'2fa_control:admin',old,admin_2fa_enabled?'1':'0');}
  if(user_2fa_enabled!==undefined){const old=getSetting('user_2fa_enabled');setSetting('user_2fa_enabled',user_2fa_enabled?'1':'0');db.prepare('INSERT INTO audit_log (admin_id,action,before_value,after_value) VALUES (?,?,?,?)').run(req.adminId,'2fa_control:user',old,user_2fa_enabled?'1':'0');}
  res.json({success:true});
});

router.get('/kyc-control',authAdmin,(req,res)=>{const fields=getDb().prepare('SELECT * FROM kyc_form_fields ORDER BY sort_order').all();res.json({kyc_enabled:getSetting('kyc_enabled')||'0',fields,requested_users:getDb().prepare('SELECT id,full_name,username,kyc_status FROM users WHERE kyc_requested=1 AND is_showcase=0 ORDER BY full_name').all()});});
router.put('/kyc-control',authAdmin,superAdminOnly,(req,res)=>{const{kyc_enabled}=req.body;if(kyc_enabled!==undefined){const old=getSetting('kyc_enabled');const newVal=kyc_enabled?'1':'0';setSetting('kyc_enabled',newVal);if(newVal==='1'&&old!=='1'){const db=getDb();const targets=db.prepare("SELECT id FROM users WHERE is_showcase=0 AND kyc_status NOT IN ('approved','pending')").all();const ins=db.prepare('INSERT INTO notifications (user_id,title,message,type,action_url,action_label,sent_by_admin) VALUES (?,?,?,?,?,?,?)');const hasUnread=(uid)=>db.prepare("SELECT id FROM notifications WHERE user_id=? AND title='KYC Verification Required' AND is_read=0").get(uid);db.transaction(us=>{for(const u of us){if(!hasUnread(u.id))ins.run(u.id,'KYC Verification Required','Please complete your KYC verification to unlock withdrawals.','action_required','/kyc','Complete KYC \u2192',req.adminId);}})(targets);}}res.json({success:true});});
router.post('/kyc-control/request',authAdmin,superAdminOnly,(req,res)=>{const db=getDb();const user=db.prepare('SELECT * FROM users WHERE id=? AND is_showcase=0').get(req.body.user_id);if(!user)return res.status(404).json({error:'User not found'});if(user.kyc_status==='approved')return res.status(400).json({error:'User already KYC verified'});const pending=db.prepare("SELECT id FROM kyc_submissions WHERE user_id=? AND status='pending'").get(user.id);if(pending)return res.status(400).json({error:'User already submitted KYC. Review it in KYC Control.'});if(user.kyc_requested)return res.json({success:true,already_requested:true});db.prepare('UPDATE users SET kyc_requested=1,updated_at=unixepoch() WHERE id=?').run(user.id);db.prepare('INSERT INTO notifications (user_id,title,message,type,action_url,action_label,sent_by_admin) VALUES (?,?,?,?,?,?,?)').run(user.id,'KYC Verification Required','Please complete your KYC verification to unlock withdrawals.','action_required','/kyc','Complete KYC \u2192',req.adminId);db.prepare('INSERT INTO audit_log (admin_id,user_id,action) VALUES (?,?,?)').run(req.adminId,user.id,'kyc_request_single');res.json({success:true});});
router.post('/kyc-control/cancel',authAdmin,superAdminOnly,(req,res)=>{const db=getDb();const user=db.prepare('SELECT * FROM users WHERE id=? AND is_showcase=0').get(req.body.user_id);if(!user)return res.status(404).json({error:'User not found'});const pending=db.prepare("SELECT id FROM kyc_submissions WHERE user_id=? AND status='pending'").get(user.id);if(pending)return res.status(400).json({error:'User KYC is under review. Review it in KYC Control instead of cancelling.'});db.prepare('UPDATE users SET kyc_requested=0,updated_at=unixepoch() WHERE id=?').run(user.id);db.prepare('INSERT INTO audit_log (admin_id,user_id,action) VALUES (?,?,?)').run(req.adminId,user.id,'kyc_request_cancelled');res.json({success:true});});

router.post('/logo',authAdmin,superAdminOnly,upload.single('logo'),(req,res)=>{if(!req.file)return res.status(400).json({error:'No file'});setSetting('logo_url',`/uploads/${req.file.filename}`);res.json({success:true,url:`/uploads/${req.file.filename}`});});
router.post('/favicon',authAdmin,superAdminOnly,upload.single('favicon'),(req,res)=>{if(!req.file)return res.status(400).json({error:'No file'});setSetting('favicon_url',`/uploads/${req.file.filename}`);res.json({success:true,url:`/uploads/${req.file.filename}`});});
router.post('/hero-image',authAdmin,superAdminOnly,upload.single('hero'),(req,res)=>{if(!req.file)return res.status(400).json({error:'No file'});setSetting('hero_image_url',`/uploads/${req.file.filename}`);res.json({success:true,url:`/uploads/${req.file.filename}`});});

router.get('/audit-log',authAdmin,(req,res)=>{const{limit=100,offset=0}=req.query;res.json(getDb().prepare('SELECT al.*,a.email as admin_email FROM audit_log al LEFT JOIN admins a ON al.admin_id=a.id ORDER BY al.created_at DESC LIMIT ? OFFSET ?').all(parseInt(limit),parseInt(offset)));});

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
