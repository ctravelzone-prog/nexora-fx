// referral.js — referral routes
const router = require('express').Router();
const { getDb } = require('../models/database');
const { authImpersonation } = require('../middleware/auth');

// GET /api/referral/referred-users
router.get('/referred-users', authImpersonation, (req,res)=>{
  const db=getDb();
  const users=db.prepare(`SELECT u.id,u.full_name,u.username,u.email,u.created_at,r.deposit_amount_cents,r.commission_cents,r.status,r.paid_at
    FROM referrals r JOIN users u ON r.referred_user_id=u.id
    WHERE r.referrer_user_id=? ORDER BY r.created_at DESC`).all(req.userId);
  res.json(users);
});

// GET /api/referral/commissions
router.get('/commissions', authImpersonation, (req,res)=>{
  const db=getDb();
  const comms=db.prepare(`SELECT r.*,u.full_name,u.username FROM referrals r JOIN users u ON r.referred_user_id=u.id WHERE r.referrer_user_id=? ORDER BY r.created_at DESC`).all(req.userId);
  const total=comms.reduce((a,c)=>a+c.commission_cents,0);
  res.json({commissions:comms,total_cents:total});
});

// GET /api/referral/link
router.get('/link', authImpersonation, (req,res)=>{
  const db=getDb();
  const user=db.prepare('SELECT referral_code FROM users WHERE id=?').get(req.userId);
  const siteUrl=process.env.SITE_URL||'http://localhost:3000';
  res.json({code:user.referral_code,link:`${siteUrl}/register?ref=${user.referral_code}`});
});

// GET /api/referral/friends
router.get('/friends', authImpersonation, (req,res)=>{
  const db=getDb();
  const friends=db.prepare(`SELECT u.id,u.full_name,u.username,u.created_at FROM referrals r JOIN users u ON r.referred_user_id=u.id WHERE r.referrer_user_id=? ORDER BY r.created_at DESC`).all(req.userId);
  res.json(friends);
});

module.exports = router;
