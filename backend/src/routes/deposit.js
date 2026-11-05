// deposit.js — deposit routes (clean template literals)
const router = require('express').Router();
const { getDb } = require('../models/database');
const { authImpersonation } = require('../middleware/auth');

router.post('/', authImpersonation, (req,res)=>{
  if(req.isImpersonation) return res.status(403).json({error:'Not allowed during Login as User session'});
  try{
    const {txid,amount}=req.body;
    if(!txid||!amount) return res.status(400).json({error:'Transaction ID and amount are required'});
    const amountCents=Math.round(parseFloat(amount)*100);
    if(isNaN(amountCents)||amountCents<=0) return res.status(400).json({error:'Invalid amount'});
    const db=getDb();
    const depId=db.prepare(`INSERT INTO deposits (user_id,amount_cents,txid,method,status) VALUES (?,?,?,'Binance Pay','pending')`)
      .run(req.userId,amountCents,txid).lastInsertRowid;
    db.prepare('INSERT INTO admin_notifications (type,title,message,reference_id,reference_type,destination_pane) VALUES (?,?,?,?,?,?)')
      .run('deposit',`Deposit request — $${(amountCents/100).toFixed(2)}`,(()=>{const u=db.prepare('SELECT full_name,username FROM users WHERE id=?').get(req.userId);return u?`${u.full_name} (@${u.username}) · TxID: ${txid}`:`TxID: ${txid}`;})(),depId,'deposit','deposits');
    res.json({success:true,message:'Deposit submitted. Awaiting admin approval.',id:depId});
  }catch(e){res.status(500).json({error:e.message});}
});

router.get('/history', authImpersonation, (req,res)=>{
  res.json(getDb().prepare('SELECT * FROM deposits WHERE user_id=? ORDER BY created_at DESC').all(req.userId));
});

router.get('/wallet', (req,res)=>{
  const db=getDb();
  const addr=db.prepare(`SELECT value FROM site_settings WHERE key='binance_wallet_address'`).get();
  const qr=db.prepare(`SELECT value FROM site_settings WHERE key='binance_wallet_qr'`).get();
  res.json({address:addr?addr.value:null,qr:qr?qr.value:null});
});

module.exports = router;
