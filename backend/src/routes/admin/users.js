// routes/admin/users.js — admin user management, including showcase accounts.
// Users: GET / (list), GET /:id (detail), DELETE /:id (Super Admin only,
// full cascade), PUT /:id/toggle-active, POST /:id/add-balance,
// POST /:id/set-temp-password and /revoke-temp-password, POST /:id/login-as
// (impersonation), POST /:id/profit-target (per-user profit target).
// Showcase accounts (demo accounts): GET /showcase/list, POST
// /showcase/create, PUT /showcase/:id, DELETE /showcase/:id.
// Showcase accounts live in the SEPARATE showcase database (same table
// names) — never in the main DB, never in the admin dashboard / ledger.
// They are fully functional (login, copy, deposit, withdraw, profit).
// Rules: showcase money lives in showcase_*_cents display fields on the
// users row, never in real balances, and never appears in admin totals.
// The demo user nexora_fx and showcase users cannot be deleted here
// (showcase accounts have their own delete route).
const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getDb, getShowcaseDb } = require('../../models/database');
const { USERNAME_RE } = require('../../services/usernameService');
const { authAdmin, superAdminOnly } = require('../../middleware/auth');
const { adminAddBalance } = require('../../services/withdrawService');

// GET / — all real users (showcase accounts excluded), newest first.
router.get('/', authAdmin, (req,res)=>{
  const db=getDb(); const {search,kyc_status,limit=50,offset=0}=req.query;
  let q='SELECT u.*,b.main_cents,b.copy_cents,b.profit_cents,b.total_deposited_cents FROM users u LEFT JOIN balances b ON u.id=b.user_id WHERE u.is_showcase=0';
  const p=[];
  if(search){q+=' AND (u.full_name LIKE ? OR u.username LIKE ? OR u.email LIKE ?)';const s=`%${search}%`;p.push(s,s,s);}
  if(kyc_status){q+=` AND u.kyc_status='${kyc_status}'`;}
  q+=' ORDER BY u.created_at DESC LIMIT ? OFFSET ?';p.push(parseInt(limit),parseInt(offset));
  res.json(db.prepare(q).all(...p));
});

// GET /:id — one user's detail (profile, balances, copies, tickets).
router.get('/:id', authAdmin, (req,res)=>{
  const db=getDb();
  const user=db.prepare('SELECT u.*,b.main_cents,b.copy_cents,b.profit_cents,b.total_deposited_cents,b.total_withdrawn_cents FROM users u LEFT JOIN balances b ON u.id=b.user_id WHERE u.id=?').get(req.params.id);
  if(!user) return res.status(404).json({error:'User not found'});
  const copies=db.prepare(`SELECT c.*,t.name as trader_name FROM copies c JOIN traders t ON c.trader_id=t.id WHERE c.user_id=? AND c.status='active'`).all(user.id);
  res.json({...user,copies});
});

// Delete a user (fake/spam accounts). Super Admin only. Removes the user AND all
// their data in one transaction: balances, copies (+ daily PnL), deposits,
// withdrawals, transactions, tickets (+ messages), referrals, KYC, forget/money
// requests, notifications, sessions and audit rows. Demo/showcase accounts are
// protected (they are intentional demo data, not fake users).
// DELETE /:id — Super Admin only. Permanently deletes a real user and
// ALL their data (balances, copies, deposits, withdrawals, transactions,
// tickets, referrals, KYC, notifications) in one transaction. Refused
// for showcase users (400) and for the demo user nexora_fx (400).
router.delete('/:id', authAdmin, superAdminOnly, (req,res)=>{
  const db=getDb();
  const u=db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if(!u) return res.status(404).json({error:'User not found'});
  if(u.is_showcase) return res.status(400).json({error:'Showcase/demo users cannot be deleted'});
  if(u.username==='nexora_fx') return res.status(400).json({error:'The demo account cannot be deleted'});
  const del=db.transaction(()=>{
    const id=u.id;
    db.prepare('DELETE FROM daily_pnl_log WHERE user_id=?').run(id);
    db.prepare('DELETE FROM copies WHERE user_id=?').run(id);
    db.prepare('DELETE FROM ticket_messages WHERE ticket_id IN (SELECT id FROM support_tickets WHERE user_id=?)').run(id);
    db.prepare('DELETE FROM support_tickets WHERE user_id=?').run(id);
    db.prepare('DELETE FROM referrals WHERE referrer_user_id=? OR referred_user_id=?').run(id,id);
    db.prepare('DELETE FROM transactions WHERE user_id=?').run(id);
    db.prepare('DELETE FROM deposits WHERE user_id=?').run(id);
    db.prepare('DELETE FROM withdrawals WHERE user_id=?').run(id);
    db.prepare('DELETE FROM kyc_submissions WHERE user_id=?').run(id);
    db.prepare('DELETE FROM forget_requests WHERE user_id=?').run(id);
    db.prepare('DELETE FROM money_requests WHERE user_id=?').run(id);
    db.prepare('DELETE FROM notifications WHERE user_id=?').run(id);
    db.prepare('DELETE FROM impersonation_sessions WHERE user_id=?').run(id);
    db.prepare('DELETE FROM audit_log WHERE user_id=?').run(id);
    db.prepare('DELETE FROM balances WHERE user_id=?').run(id);
    db.prepare('UPDATE users SET referred_by_user_id=NULL WHERE referred_by_user_id=?').run(id);
    db.prepare('DELETE FROM users WHERE id=?').run(id);
  });
  try{ del(); res.json({success:true,deleted_user_id:u.id}); }
  catch(e){ res.status(500).json({error:'Delete failed: '+e.message}); }
});

// PUT /:id/toggle-active — disables or re-enables a user account.
// Disabled users cannot log in.
router.put('/:id/toggle-active', authAdmin, (req,res)=>{
  const db=getDb(); const u=db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if(!u) return res.status(404).json({error:'Not found'});
  db.prepare('UPDATE users SET is_active=?,updated_at=unixepoch() WHERE id=?').run(u.is_active?0:1,u.id);
  db.prepare('INSERT INTO audit_log (admin_id,user_id,action) VALUES (?,?,?)').run(req.adminId,u.id,`user ${u.is_active?'disabled':'enabled'}`);
  res.json({success:true});
});

// POST /:id/add-balance — adds money to a user's Main or Profit
// Balance (via withdrawService.adminAddBalance, audit-logged).
router.post('/:id/add-balance', authAdmin, (req,res)=>{
  try{
    const {amount,type,reason}=req.body;
    if(!amount) return res.status(400).json({error:'Amount required'});
    adminAddBalance(parseInt(req.params.id),Math.round(parseFloat(amount)*100),type||'main',req.adminId,reason);
    const db=getDb();
    db.prepare('INSERT INTO notifications (user_id,title,message,type) VALUES (?,?,?,?)')
      .run(parseInt(req.params.id),'Balance added',`Nexora FX added $${parseFloat(amount).toFixed(2)} to your ${(type||'main')==='profit'?'Profit':'Main'} Balance.`+(reason?` ${reason}`:''),'success');
    res.json({success:true});
  }catch(e){res.status(500).json({error:e.message});}
});

// POST /:id/set-temp-password — Super Admin only. Sets a one-time
// temporary password for the user (24h, one use; works as the current
// password on change-password).
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

// POST /:id/revoke-temp-password — Super Admin only. Revokes the
// user's temporary password (if any).
router.post('/:id/revoke-temp-password', authAdmin, superAdminOnly, (req,res)=>{
  const db=getDb();
  db.prepare(`UPDATE users SET temp_password_hash=NULL,temp_password_status='revoked',temp_password_used=0,temp_password_expires=NULL WHERE id=?`).run(req.params.id);
  db.prepare('INSERT INTO audit_log (admin_id,user_id,action) VALUES (?,?,?)').run(req.adminId,req.params.id,'temp_password_revoked');
  res.json({success:true});
});

// POST /:id/login-as — Super Admin only. Creates a 30-minute
// impersonation JWT for the user's account (recorded in
// impersonation_sessions) so the admin can view the site as that user.
// Write routes refuse impersonation tokens.
router.post('/:id/login-as', authAdmin, superAdminOnly, (req,res)=>{
  const db=getDb(); const user=db.prepare('SELECT * FROM users WHERE id=? AND is_active=1 AND is_showcase=0').get(req.params.id);
  if(!user) return res.status(404).json({error:'User not found'});
  const exp=Math.floor(Date.now()/1000)+1800;
  const jwtToken=jwt.sign({type:'impersonation',userId:user.id,adminId:req.adminId},process.env.JWT_SECRET,{expiresIn:'30m'});
  db.prepare('INSERT INTO impersonation_sessions (admin_id,user_id,token,expires_at) VALUES (?,?,?,?)').run(req.adminId,user.id,jwtToken,exp);
  db.prepare('INSERT INTO audit_log (admin_id,user_id,action) VALUES (?,?,?)').run(req.adminId,user.id,'login_as_user');
  res.json({token:jwtToken,user:{id:user.id,full_name:user.full_name,username:user.username}});
});

// POST /:id/profit-target — Super Admin only. Sets a per-user profit
// target (bp): that user's daily rates scale by target/global. An empty
// value clears it back to the global target.
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

// GET /showcase/list — all showcase (demo) accounts, newest first.
// Reads the SHOWCASE database (the main DB holds no showcase users).
router.get('/showcase/list', authAdmin, (req,res)=>res.json(getShowcaseDb().prepare('SELECT * FROM users WHERE is_showcase=1 ORDER BY created_at DESC').all()));

// POST /showcase/create — Super Admin only. Creates a showcase account
// with display balances (main/copy/profit/withdraw cents) and a password.
// Showcase accounts CAN log in and do everything a real user can (copy,
// deposit, withdraw, profit) — their data lives in the separate showcase
// database and never appears in the admin dashboard or ledger.
router.post('/showcase/create', authAdmin, superAdminOnly, async (req,res)=>{
  try{
    const {full_name,username,email,password,main_cents,copy_cents,profit_cents,withdraw_cents}=req.body;
    if(!full_name||!username||!email||!password) return res.status(400).json({error:'Required'});
    if(!USERNAME_RE.test(username)) return res.status(400).json({error:'Username can only use lowercase letters, numbers, - and _'});
    const hash=await bcrypt.hash(password,12); const rc=Math.random().toString(36).substring(2,10).toUpperCase();
    const uid=getShowcaseDb().prepare('INSERT INTO users (full_name,username,email,password_hash,referral_code,is_showcase,showcase_main_cents,showcase_copy_cents,showcase_profit_cents,showcase_withdraw_cents,email_verified) VALUES (?,?,?,?,?,1,?,?,?,?,1)')
      .run(full_name,username,email,hash,rc,main_cents||0,copy_cents||0,profit_cents||0,withdraw_cents||0).lastInsertRowid;
    res.json({success:true,id:uid});
  }catch(e){res.status(500).json({error:e.message});}
});

// Edit a showcase account (name, username, email, display balances, optional new password).
// PUT /showcase/:id — Super Admin only. Edits a showcase account
// (name, username, email, display balances, optional new password).
// A real user id returns 404 — this route cannot touch real users.
router.put('/showcase/:id', authAdmin, superAdminOnly, async (req,res)=>{
  try{
    const db=getShowcaseDb();
    const u=db.prepare('SELECT * FROM users WHERE id=? AND is_showcase=1').get(req.params.id);
    if(!u) return res.status(404).json({error:'Showcase account not found'});
    const {full_name,username,email,password,main_cents,copy_cents,profit_cents,withdraw_cents}=req.body;
    if(username && username!==u.username){
      if(!USERNAME_RE.test(username)) return res.status(400).json({error:'Username can only use lowercase letters, numbers, - and _'});
      if(db.prepare('SELECT id FROM users WHERE username=?').get(username)) return res.status(400).json({error:'Username already taken'});
    }
    if(email && email.toLowerCase()!==u.email.toLowerCase() && db.prepare('SELECT id FROM users WHERE LOWER(email)=LOWER(?)').get(email))
      return res.status(400).json({error:'Email already registered'});
    const sets=[], vals=[];
    if(full_name!==undefined){sets.push('full_name=?');vals.push(full_name);}
    if(username!==undefined){sets.push('username=?');vals.push(username);}
    if(email!==undefined){sets.push('email=?');vals.push(email.toLowerCase());}
    if(main_cents!==undefined){sets.push('showcase_main_cents=?');vals.push(Math.round(main_cents)||0);}
    if(copy_cents!==undefined){sets.push('showcase_copy_cents=?');vals.push(Math.round(copy_cents)||0);}
    if(profit_cents!==undefined){sets.push('showcase_profit_cents=?');vals.push(Math.round(profit_cents)||0);}
    if(withdraw_cents!==undefined){sets.push('showcase_withdraw_cents=?');vals.push(Math.round(withdraw_cents)||0);}
    if(password){ if(String(password).length<8) return res.status(400).json({error:'Password min 8 chars'}); sets.push('password_hash=?'); vals.push(await bcrypt.hash(password,12)); }
    if(!sets.length) return res.status(400).json({error:'Nothing to update'});
    sets.push('updated_at=unixepoch()');
    db.prepare(`UPDATE users SET ${sets.join(',')} WHERE id=?`).run(...vals, u.id);
    res.json({success:true});
  }catch(e){res.status(500).json({error:e.message});}
});

// Delete a showcase account (+ its display-profit log; showcase accounts hold no
// real balances/copies, so there is nothing real to cascade — the delete route
// for real users stays blocked for showcase).
// DELETE /showcase/:id — Super Admin only. Deletes a showcase account
// (and its showcase profit log + notifications). Real users are never
// touched by this route.
router.delete('/showcase/:id', authAdmin, superAdminOnly, (req,res)=>{
  const db=getShowcaseDb();
  const u=db.prepare('SELECT * FROM users WHERE id=? AND is_showcase=1').get(req.params.id);
  if(!u) return res.status(404).json({error:'Showcase account not found'});
  // Child-first (FK order): showcase users can hold copies, deposits,
  // withdrawals and transactions in the showcase DB now.
  const del=db.transaction(()=>{
    db.prepare('DELETE FROM ticket_messages WHERE ticket_id IN (SELECT id FROM support_tickets WHERE user_id=?)').run(u.id);
    db.prepare('DELETE FROM forget_request_messages WHERE request_id IN (SELECT id FROM forget_requests WHERE user_id=?)').run(u.id);
    db.prepare('DELETE FROM daily_pnl_log WHERE user_id=?').run(u.id);
    db.prepare('DELETE FROM copies WHERE user_id=?').run(u.id);
    db.prepare('DELETE FROM deposits WHERE user_id=?').run(u.id);
    db.prepare('DELETE FROM withdrawals WHERE user_id=?').run(u.id);
    db.prepare('DELETE FROM transactions WHERE user_id=?').run(u.id);
    db.prepare('DELETE FROM notifications WHERE user_id=?').run(u.id);
    db.prepare('DELETE FROM kyc_submissions WHERE user_id=?').run(u.id);
    db.prepare('DELETE FROM money_requests WHERE user_id=?').run(u.id);
    db.prepare('DELETE FROM profile_change_requests WHERE user_id=?').run(u.id);
    db.prepare('DELETE FROM support_tickets WHERE user_id=?').run(u.id);
    db.prepare('DELETE FROM forget_requests WHERE user_id=?').run(u.id);
    db.prepare('DELETE FROM referrals WHERE referrer_user_id=? OR referred_user_id=?').run(u.id,u.id);
    db.prepare('DELETE FROM user_blocks WHERE user_id=?').run(u.id);
    db.prepare('DELETE FROM showcase_profit_log WHERE user_id=?').run(u.id);
    db.prepare('DELETE FROM balances WHERE user_id=?').run(u.id);
    db.prepare('DELETE FROM users WHERE id=?').run(u.id);
  });
  try{ del(); res.json({success:true,deleted_user_id:u.id}); }
  catch(e){ res.status(500).json({error:'Delete failed: '+e.message}); }
});

module.exports = router;
