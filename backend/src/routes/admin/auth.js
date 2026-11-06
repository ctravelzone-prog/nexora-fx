// routes/admin/auth.js — admin login and admin profile.
// POST /login checks email + bcrypt password against the admins table and
// returns an admin JWT (7 days). POST /change-password changes the
// logged-in admin's own password. GET /me returns the logged-in admin's
// profile (id, name, email, role). Admin accounts are separate from user
// accounts (separate admins table) and are seeded by seed.js.
const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { getDb } = require('../../models/database');
const { authAdmin, superAdminOnly } = require('../../middleware/auth');

// Signs an admin JWT (type 'admin'). All admin tokens expire in 7 days.
function mkAdminToken(adminId){
  return jwt.sign({type:'admin',adminId},process.env.JWT_SECRET,{expiresIn:'7d'});
}

// POST /login — admin sign-in. Body: email, password. Returns the
// admin JWT + profile on success; 401 on a wrong email or password.
router.post('/login', async (req,res)=>{
  try{
    const {email,password,totp_code}=req.body;
    if(!email||!password) return res.status(400).json({error:'Email and password required'});
    const db=getDb();
    const admin=db.prepare('SELECT * FROM admins WHERE email=?').get(email);
    if(!admin||!await bcrypt.compare(password,admin.password_hash))
      return res.status(401).json({error:"Credentials doesn't match"});
    const g2=db.prepare(`SELECT value FROM site_settings WHERE key='admin_2fa_enabled'`).get();
    if(g2&&g2.value==='1'&&admin.two_fa_enabled){
      if(!totp_code) return res.json({require_2fa:true});
      const {totp}=require('otplib');
      if(!totp.verify({token:totp_code,secret:admin.two_fa_secret})) return res.status(401).json({error:'Invalid 2FA code'});
    }
    db.prepare('INSERT INTO audit_log (admin_id,action) VALUES (?,?)').run(admin.id,'admin_login');
    res.json({token:mkAdminToken(admin.id),admin:{id:admin.id,email:admin.email,role:admin.role}});
  }catch(e){res.status(500).json({error:e.message});}
});

// POST /change-password — the logged-in admin changes their own
// password (current password required, new password min 8 chars).
router.post('/change-password', authAdmin, async (req,res)=>{
  try{
    const {current_password,new_password,confirm_password}=req.body;
    if(!current_password||!new_password||!confirm_password) return res.status(400).json({error:'All fields required'});
    if(new_password.length<8) return res.status(400).json({error:'Password must be at least 8 characters'});
    if(new_password!==confirm_password) return res.status(400).json({error:'Passwords do not match'});
    const db=getDb();
    const admin=db.prepare('SELECT * FROM admins WHERE id=?').get(req.adminId);
    if(!await bcrypt.compare(current_password,admin.password_hash)) return res.status(400).json({error:'Current password is incorrect'});
    const hash=await bcrypt.hash(new_password,12);
    db.prepare('UPDATE admins SET password_hash=?,updated_at=unixepoch() WHERE id=?').run(hash,req.adminId);
    db.prepare('INSERT INTO audit_log (admin_id,action) VALUES (?,?)').run(req.adminId,'admin password changed');
    res.json({success:true,message:'Password changed successfully'});
  }catch(e){res.status(500).json({error:e.message});}
});

// GET /me — the logged-in admin's profile (requires an admin token).
router.get('/me', authAdmin, (req,res)=>{
  const {id,email,role,two_fa_enabled}=req.admin;
  res.json({id,email,role,two_fa_enabled});
});

module.exports = router;
