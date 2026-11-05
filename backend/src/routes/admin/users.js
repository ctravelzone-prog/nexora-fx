// admin/users.js — user management
const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../../models/database');
const { authAdmin, superAdminOnly } = require('../../middleware/auth');
const { adminAddBalance } = require('../../services/withdrawService');

router.get('/', authAdmin, (req,res)=>{
  const db=getDb(); const {search,kyc_status,limit=50,offset=0}=req.query;
  let q='SELECT u.*,b.main_cents,b.copy_cents,b.profit_cents,b.total_deposited_cents FROM users u LEFT JOIN balances b ON u.id=b.user_id WHERE u.is_showcase=0';
  const p=[];
  if(search){q+=' AND (u.full_name LIKE ? OR u.username LIKE ? OR u.email LIKE ?)';const s=`%${search}%`;p.push(s,s,s);}
  if(kyc_status){q+=` AND u.kyc_status='${kyc_status}'`;}
  q+=' ORDER BY u.created_at DESC LIMIT ? OFFSET ?';p.push(parseInt(limit),parseInt(offset));
  res.json(db.prepare(q).all(...p));
});

router.get('/:id', authAdmin, (req,res)=>{
  const db=getDb();
  const user=db.prepare('SELECT u.*,b.main_cents,b.copy_cents,b.profit_cents,b.total_deposited_cents,b.total_withdrawn_cents FROM users u LEFT JOIN balances b ON u.id=b.user_id WHERE u.id=?').get(req.params.id);
  if(!user) return res.status(404).json({error:'User not found'});
  const copies=db.prepare(`SELECT c.*,t.name as trader_name FROM copies c JOIN traders t ON c.trader_id=t.id WHERE c.user_id=? AND c.status='active'`).all(user.id);
  res.json({...user,copies});
});

router.put('/:id/toggle-active', authAdmin, (req,res)=>{
  const db=getDb(); const u=db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if(!u) return res.status(404).json({error:'Not found'});
  db.prepare('UPDATE users SET is_active=?,updated_at=unixepoch() WHERE id=?').run(u.is_active?0:1,u.id);
  db.prepare('INSERT INTO audit_log (admin_id,user_id,action) VALUES (?,?,?)').run(req.adminId,u.id,`user ${u.is_active?'disabled':'enabled'}`);
  res.json({success:true});
});

router.post('/:id/add-balance', authAdmin, (req,res)=>{
  try{
    const {amount,type,reason}=req.body;
    if(!amount) return res.status(400).json({error:'Amount required'});
    adminAddBalance(parseInt(req.params.id),Math.round(parseFloat(amount)*100),type||'main',req.adminId,reason);
    res.json({success:true});
  }catch(e){res.status(500).json({error:e.message});}
});

router.post('/:id/set-temp-password', authAdmin, superAdminOnly, async (req,res)=>{
  try{
    const {temp_password}=req.body;
    if(!temp_password||temp_password.length<8) return res.status(400).json({error:'Password must be at least 8 characters'});
    const db=getDb(); const user=db.prepare('SELECT id,full_name FROM users WHERE id=?').get(req.params.id);
    if(!user) return res.status(404).json({error:'User not found'});
    const hash=await bcrypt.hash(temp_password,12);
    db.prepare(`UPDATE users SET temp_password_hash=?,temp_password_expires=?,temp_password_used=0,temp_password_status='active' WHERE id=?`)
      .run(hash,Math.floor(Date.now()/1000)+86400,user.id);
    db.prepare('INSERT INTO notifications (user_id,title,message,type) VALUES (?,?,?,?)')
      .run(user.id,'Temporary Password Set','A temporary password has been set. Log in with it and set a new permanent password immediately.','action_required');
    db.prepare('INSERT INTO audit_log (admin_id,user_id,action) VALUES (?,?,?)').run(req.adminId,user.id,'temp_password_set');
    res.json({success:true});
  }catch(e){res.status(500).json({error:e.message});}
});

router.post('/:id/revoke-temp-password', authAdmin, superAdminOnly, (req,res)=>{
  const db=getDb();
  db.prepare(`UPDATE users SET temp_password_hash=NULL,temp_password_status='revoked',temp_password_used=0,temp_password_expires=NULL WHERE id=?`).run(req.params.id);
  db.prepare('INSERT INTO audit_log (admin_id,user_id,action) VALUES (?,?,?)').run(req.adminId,req.params.id,'temp_password_revoked');
  res.json({success:true});
});

router.post('/:id/login-as', authAdmin, superAdminOnly, (req,res)=>{
  const db=getDb(); const user=db.prepare('SELECT * FROM users WHERE id=? AND is_active=1 AND is_showcase=0').get(req.params.id);
  if(!user) return res.status(404).json({error:'User not found'});
  const exp=Math.floor(Date.now()/1000)+1800;
  const jwtToken=jwt.sign({type:'impersonation',userId:user.id,adminId:req.adminId},process.env.JWT_SECRET,{expiresIn:'30m'});
  db.prepare('INSERT INTO impersonation_sessions (admin_id,user_id,token,expires_at) VALUES (?,?,?,?)').run(req.adminId,user.id,jwtToken,exp);
  db.prepare('INSERT INTO audit_log (admin_id,user_id,action) VALUES (?,?,?)').run(req.adminId,user.id,'login_as_user');
  res.json({token:jwtToken,user:{id:user.id,full_name:user.full_name,username:user.username}});
});

router.post('/:id/profit-target', authAdmin, superAdminOnly, (req,res)=>{
  const db=getDb(); const user=db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if(!user) return res.status(404).json({error:'User not found'});
  if(user.is_showcase) return res.status(400).json({error:'Showcase user has no profit target'});
  const {profit_target_bp}=req.body||{};
  let val=null;
  if(profit_target_bp!==null&&profit_target_bp!==undefined&&profit_target_bp!==''){
    val=parseInt(profit_target_bp);
    if(isNaN(val)||val<0||val>10000) return res.status(400).json({error:'Profit target must be 0-100%'});
  }
  db.prepare('UPDATE users SET profit_target_bp=? WHERE id=?').run(val,user.id);
  db.prepare('INSERT INTO audit_log (admin_id,user_id,action,before_value,after_value) VALUES (?,?,?,?,?)').run(req.adminId,user.id,'set_profit_target',String(user.profit_target_bp),String(val));
  res.json({success:true,profit_target_bp:val});
});

router.get('/showcase/list', authAdmin, (req,res)=>res.json(getDb().prepare('SELECT * FROM users WHERE is_showcase=1 ORDER BY created_at DESC').all()));

router.post('/showcase/create', authAdmin, superAdminOnly, async (req,res)=>{
  try{
    const {full_name,username,email,password,main_cents,copy_cents,profit_cents}=req.body;
    if(!full_name||!username||!email||!password) return res.status(400).json({error:'Required'});
    const hash=await bcrypt.hash(password,12); const rc=Math.random().toString(36).substring(2,10).toUpperCase();
    const uid=getDb().prepare('INSERT INTO users (full_name,username,email,password_hash,referral_code,is_showcase,showcase_main_cents,showcase_copy_cents,showcase_profit_cents,email_verified) VALUES (?,?,?,?,?,1,?,?,?,1)')
      .run(full_name,username,email,hash,rc,main_cents||0,copy_cents||0,profit_cents||0).lastInsertRowid;
    res.json({success:true,id:uid});
  }catch(e){res.status(500).json({error:e.message});}
});

module.exports = router;
