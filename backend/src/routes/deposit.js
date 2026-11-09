// routes/deposit.js — user deposits via Binance Pay (manual admin approval).
// POST / submits a deposit: the user pays USDT in the Binance app and sends
// the Transaction ID + amount. Creates a deposits row (status 'pending'),
// a pending transactions row so the deposit shows in History right away,
// and an admin notification. The money is credited to Main Balance only
// when an admin approves it (see moneyService.applyDeposit).
// GET /history lists the user's deposits; GET /wallet returns the admin's
// Binance Pay address + QR code (both come from site settings, never from
// a static file).
const router = require('express').Router();
const { getDb, getMainDb } = require('../models/database');
const { authImpersonation } = require('../middleware/auth');
const { getSetting } = require('../services/moneyHelpers');
const { tryAutoDeposit, isTxRefUsed } = require('../services/autoPayments');

// POST / — submit a deposit. Body: txid, amount (dollars). Side effects:
// deposits row (pending) + pending transactions row (reference DEP-<id>)
// + admin notification. Nothing is credited until an admin approves.
router.post('/', authImpersonation, async (req,res)=>{
  if(req.isImpersonation) return res.status(403).json({error:'Not allowed during Login as User session'});
  try{
    const {txid,amount,method}=req.body;
    if(!txid||!amount) return res.status(400).json({error:'Transaction ID and amount are required'});
    const apiMethod = method === 'bep20' ? 'bep20' : 'binance_pay';
    // Normalise the reference: TxHashes are case-insensitive hex, Order
    // IDs are trimmed. The duplicate guard compares this exact string.
    const ref = apiMethod === 'bep20' ? String(txid).trim().toLowerCase() : String(txid).trim();
    if (apiMethod === 'bep20' && !/^0x[0-9a-fA-F]{64}$/.test(ref)) return res.status(400).json({error:'Invalid transaction hash'});
    const amountCents=Math.round(parseFloat(amount)*100);
    if(isNaN(amountCents)||amountCents<=0) return res.status(400).json({error:'Invalid amount'});
    const db=getDb();
    // Global switch (Money Settings) + per-user block (User Access Controls).
    if(getSetting('deposit_enabled','1')==='0') return res.status(403).json({error:'Deposits are currently disabled'});
    if(db.prepare("SELECT id FROM user_blocks WHERE user_id=? AND kind='deposit'").get(req.userId)) return res.status(403).json({error:'Deposits are disabled for your account'});
    // Duplicate guard: one reference can only ever credit once.
    if(isTxRefUsed(ref, db)) return res.status(400).json({error:'This transaction reference was already submitted'});
    const depId=db.prepare(`INSERT INTO deposits (user_id,amount_cents,txid,method,status) VALUES (?,?,?,?,'pending')`)
      .run(req.userId,amountCents,ref, apiMethod === 'bep20' ? 'BEP20' : 'Binance Pay').lastInsertRowid;
    // Pending row in History right away (same pattern as withdraws): the user
    // sees 'Deposit — Pending' until the admin approves or rejects it.
    db.prepare('INSERT INTO transactions (user_id,type,amount_cents,fee_cents,net_cents,direction,status,reference,reason,formula) VALUES (?,?,?,0,?,?,?,?,?,?)')
      .run(req.userId,'deposit',amountCents,amountCents,'in','pending',`DEP-${depId}`,'Deposit submitted — awaiting approval',`Main += $${(amountCents/100).toFixed(2)} (on approval)`);
    getMainDb().prepare('INSERT INTO admin_notifications (type,title,message,reference_id,reference_type,destination_pane) VALUES (?,?,?,?,?,?)')
      .run('deposit',`Deposit request — $${(amountCents/100).toFixed(2)}`,(()=>{const u=db.prepare('SELECT full_name,username FROM users WHERE id=?').get(req.userId);return u?`${u.full_name} (@${u.username}) · TxID: ${ref}`:`TxID: ${ref}`;})(),depId,req.isShowcase?'showcase_deposit':'deposit','deposits');
    // Auto deposit (v122): verify + credit immediately when the master
    // toggle and this rail are ON and the config is set. Anything else
    // (OFF, unconfigured, verify failed) leaves the deposit pending for
    // manual review — the failure is recorded in payment_attempts.
    let auto = null;
    try {
      auto = await tryAutoDeposit({ userId: req.userId, depositId: depId, method: apiMethod, txRef: ref, amountCents, db });
    } catch (e) {
      console.error('[deposit] auto verify threw:', e?.message || e);
      auto = { auto: false, reason: 'api-error' };
    }
    if (auto && auto.auto) {
      return res.json({success:true,auto_approved:true,message:'Deposit verified and credited to your Main Balance.',id:depId});
    }
    const why = auto && auto.reason === 'geo-blocked'
      ? 'Binance Pay check is blocked from this server — your deposit is pending for admin review. You can also pay with BEP20 USDT.'
      : 'Deposit submitted. Awaiting approval.';
    res.json({success:true,auto_approved:false,message:why,id:depId});
  }catch(e){res.status(500).json({error:e.message});}
});

// GET /history — the user's deposits, newest first (all statuses).
router.get('/history', authImpersonation, (req,res)=>{
  res.json(getDb().prepare('SELECT * FROM deposits WHERE user_id=? ORDER BY created_at DESC').all(req.userId));
});

// GET /wallet — the Binance Pay address and QR the admin set in
// Site Settings (empty when the admin has not set them yet).
router.get('/wallet', (req,res)=>{
  const db=getDb();
  const addr=db.prepare(`SELECT value FROM site_settings WHERE key='binance_wallet_address'`).get();
  const qr=db.prepare(`SELECT value FROM site_settings WHERE key='binance_wallet_qr'`).get();
  const bep=db.prepare(`SELECT value FROM site_settings WHERE key='bep20_address'`).get();
  res.json({address:addr?addr.value:null,qr:qr?qr.value:null,bep20_address:bep?bep.value:null});
});

module.exports = router;
