// routes/referral.js — referral info for the logged-in user, plus the
// referral-to-Profit transfer.
// GET /referred-users (people who signed up with my code), /commissions
// (each referral row plus the total earned), /link (my referral code and
// full register link), /friends (same list, minimal fields).
// POST /transfer — moves referral bonus into Profit Balance (Total PnL).
// Rule: the commission is a one-time 4% of the referred user's FIRST
// deposit only — never on profit, never recurring. It is paid by
// moneyService.payRef into the REFERRAL balance when the admin approves
// that first deposit; the user transfers it to Profit when they want it.
// Available to transfer = referral_cents - referral_transferred_cents
// (earnings from before v88 were already added to Profit, so the
// one-time migration marks them transferred).
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

// POST /api/referral/transfer — move referral bonus to Profit Balance.
// Body {amount} in dollars. The amount leaves the referral balance and
// lands in Profit (Total PnL), where it can be withdrawn like other
// profit. Only the available referral balance can be moved.
router.post('/transfer', authImpersonation, (req,res)=>{
  try{
    const amountCents=Math.round(Number(req.body.amount)*100);
    if(!amountCents||amountCents<=0) return res.status(400).json({error:'Enter an amount above $0'});
    const db=getDb();
    const out=db.transaction(()=>{
      const bal=db.prepare('SELECT referral_cents,referral_transferred_cents FROM balances WHERE user_id=?').get(req.userId);
      const avail=Math.max(0,(bal?bal.referral_cents:0)-(bal?bal.referral_transferred_cents||0:0));
      if(amountCents>avail) throw new Error('Only $'+(avail/100).toFixed(2)+' referral bonus is available to transfer');
      db.prepare('UPDATE balances SET referral_transferred_cents=referral_transferred_cents+?,profit_cents=profit_cents+?,updated_at=unixepoch() WHERE user_id=?').run(amountCents,amountCents,req.userId);
      db.prepare(`INSERT INTO transactions (user_id,type,amount_cents,fee_cents,net_cents,direction,status,reference,reason,formula) VALUES (?,'referral_transfer',?,0,?,'in','completed',?,'Referral transfer to Profit Balance',?)`)
        .run(req.userId,amountCents,amountCents,'REF-TFR-'+Date.now(),'Referral -= $'+(amountCents/100).toFixed(2)+'; Profit += $'+(amountCents/100).toFixed(2));
      return {available_cents:avail-amountCents};
    })();
    const nb=db.prepare('SELECT profit_cents FROM balances WHERE user_id=?').get(req.userId);
    res.json({success:true,available_cents:out.available_cents,profit_cents:nb?nb.profit_cents:0});
  }catch(e){res.status(400).json({error:e.message});}
});

// GET /api/referral/friends
router.get('/friends', authImpersonation, (req,res)=>{
  const db=getDb();
  const friends=db.prepare(`SELECT u.id,u.full_name,u.username,u.created_at FROM referrals r JOIN users u ON r.referred_user_id=u.id WHERE r.referrer_user_id=? ORDER BY r.created_at DESC`).all(req.userId);
  res.json(friends);
});

module.exports = router;
