// routes/admin/dashboard.js — admin dashboard totals and notifications.
// GET /dashboard returns user counts, total Main / Copy / Profit balances,
// total deposits and withdrawals, today's counts, recent users and recent
// deposits/withdrawals. The /notifications routes list, mark read and
// send admin notifications (to all users or to one user).
// Rule: showcase accounts (is_showcase=1) are excluded from EVERY total
// here — their display money must never appear in admin figures.
const router = require('express').Router();
const { getDb, getMainDb } = require('../../models/database');
const { authAdmin } = require('../../middleware/auth');

// GET /dashboard — all dashboard numbers + recent users/deposits/
// withdrawals. Totals count real users only (is_showcase=0).
router.get('/dashboard', authAdmin, (req,res)=>{
  const db=getDb();
  const totalUsers=db.prepare(`SELECT COUNT(*) as c FROM users WHERE is_showcase=0`).get().c;
  const newThisWeek=db.prepare(`SELECT COUNT(*) as c FROM users WHERE is_showcase=0 AND created_at > unixepoch()-604800`).get().c;
  const totalDeposit=db.prepare(`SELECT COALESCE(SUM(amount_cents),0) as s FROM deposits WHERE status='approved'`).get().s;
  const totalWithdraw=db.prepare(`SELECT COALESCE(SUM(net_cents),0) as s FROM withdrawals WHERE status='paid'`).get().s;
  const pendingDep=db.prepare(`SELECT COUNT(*) as c, COALESCE(SUM(amount_cents),0) as s FROM deposits WHERE status='pending'`).get();
  const pendingWd=db.prepare(`SELECT COUNT(*) as c, COALESCE(SUM(amount_cents),0) as s FROM withdrawals WHERE status='pending'`).get();
  const pendingKyc=db.prepare(`SELECT COUNT(*) as c FROM kyc_submissions WHERE status='pending'`).get().c;
  const openTickets=db.prepare(`SELECT COUNT(*) as c FROM support_tickets WHERE status='open'`).get().c;
  const highTickets=db.prepare(`SELECT COUNT(*) as c FROM support_tickets WHERE status='open' AND priority='high'`).get().c;
  const totalMain=db.prepare(`SELECT COALESCE(SUM(b.main_cents),0) as s FROM balances b JOIN users u ON b.user_id=u.id WHERE u.is_showcase=0`).get().s;
  const totalCopy=db.prepare(`SELECT COALESCE(SUM(b.copy_cents),0) as s FROM balances b JOIN users u ON b.user_id=u.id WHERE u.is_showcase=0`).get().s;
  const totalProfit=db.prepare(`SELECT COALESCE(SUM(amount_cents),0) as s FROM transactions WHERE type='daily_pnl' AND amount_cents>0`).get().s;
  const todayPnl=db.prepare(`SELECT COALESCE(SUM(amount_cents),0) as s FROM transactions WHERE type='daily_pnl' AND created_at > unixepoch()-86400`).get().s;
  const totalRef=db.prepare(`SELECT COALESCE(SUM(commission_cents),0) as s FROM referrals WHERE status='paid'`).get().s;
  const deposits=db.prepare(`SELECT 'deposit' as atype,d.id,d.amount_cents,d.created_at,u.full_name,u.username FROM deposits d JOIN users u ON d.user_id=u.id WHERE u.is_showcase=0 ORDER BY d.created_at DESC LIMIT 5`).all();
  const withdraws=db.prepare(`SELECT 'withdrawal' as atype,w.id,w.amount_cents,w.created_at,w.status,u.full_name,u.username FROM withdrawals w JOIN users u ON w.user_id=u.id WHERE u.is_showcase=0 ORDER BY w.created_at DESC LIMIT 5`).all();
  const newUsers=db.prepare(`SELECT 'new_user' as atype,u.id,u.full_name,u.username,u.created_at FROM users u WHERE u.is_showcase=0 ORDER BY u.created_at DESC LIMIT 5`).all();
  const kycs=db.prepare(`SELECT 'kyc' as atype,k.id,k.submitted_at as created_at,u.full_name,u.username FROM kyc_submissions k JOIN users u ON k.user_id=u.id ORDER BY k.submitted_at DESC LIMIT 5`).all();
  const activity=[...deposits,...withdraws,...newUsers,...kycs].sort((a,b)=>b.created_at-a.created_at).slice(0,15);
  res.json({stats:{totalUsers,newThisWeek,totalDeposit,totalWithdraw,pendingDepCount:pendingDep.c,pendingDepAmount:pendingDep.s,pendingWdCount:pendingWd.c,pendingWdAmount:pendingWd.s,pendingKyc,openTickets,highTickets,totalMain,totalCopy,totalProfit,todayPnl,totalRef},activity});
});

// GET /visitors — website visitor stats (v116, main DB only).
// "Today" and the daily breakdown use Asia/Dhaka midnight (UTC+6, no
// DST): a visitor_id counts once per period, so one device is one unique
// visitor no matter how many pages it opens.
router.get('/visitors', authAdmin, (req, res) => {
  const db = getMainDb();
  const now = Math.floor(Date.now() / 1000);
  const todayStart = Math.floor((now + 21600) / 86400) * 86400 - 21600;
  const weekStart = todayStart - 6 * 86400;
  const totalViews = db.prepare('SELECT COUNT(*) as c FROM visits').get().c;
  const totalUnique = db.prepare('SELECT COUNT(DISTINCT visitor_id) as c FROM visits').get().c;
  const todayViews = db.prepare('SELECT COUNT(*) as c FROM visits WHERE visited_at >= ?').get(todayStart).c;
  const todayUnique = db.prepare('SELECT COUNT(DISTINCT visitor_id) as c FROM visits WHERE visited_at >= ?').get(todayStart).c;
  const weekViews = db.prepare('SELECT COUNT(*) as c FROM visits WHERE visited_at >= ?').get(weekStart).c;
  const weekUnique = db.prepare('SELECT COUNT(DISTINCT visitor_id) as c FROM visits WHERE visited_at >= ?').get(weekStart).c;
  const topPages = db.prepare('SELECT path, COUNT(*) as views FROM visits GROUP BY path ORDER BY views DESC LIMIT 5').all();
  const daily = db.prepare('SELECT CAST((visited_at + 21600) / 86400 AS INTEGER) as daynum, COUNT(*) as views, COUNT(DISTINCT visitor_id) as unique_visitors FROM visits WHERE visited_at >= ? GROUP BY daynum ORDER BY daynum DESC').all(weekStart).map(r => ({
    date: new Date(r.daynum * 86400 * 1000).toISOString().slice(0, 10),
    views: r.views,
    unique: r.unique_visitors
  }));
  res.json({ totalViews, totalUnique, todayViews, todayUnique, weekViews, weekUnique, topPages, daily });
});

// GET /notifications — admin notifications, newest first, enriched
// with the related user's name, username and email.
router.get('/notifications', authAdmin, (req,res)=>{
  const db=getDb();
  let notifs=db.prepare('SELECT * FROM admin_notifications ORDER BY created_at DESC LIMIT 100').all();
  const userOf=(id)=>id?db.prepare('SELECT full_name,username,email FROM users WHERE id=?').get(id):null;
  const resolveUser=(n)=>{try{
    if(n.reference_type==='user') return userOf(n.reference_id);
    if(n.reference_type==='deposit'){const r=db.prepare('SELECT user_id FROM deposits WHERE id=?').get(n.reference_id);return r?userOf(r.user_id):null;}
    if(n.reference_type==='withdrawal'){const r=db.prepare('SELECT user_id FROM withdrawals WHERE id=?').get(n.reference_id);return r?userOf(r.user_id):null;}
    if(n.reference_type==='kyc'){const r=db.prepare('SELECT user_id FROM kyc_submissions WHERE id=?').get(n.reference_id);return r?userOf(r.user_id):null;}
    if(n.reference_type==='ticket'){const r=db.prepare('SELECT user_id FROM support_tickets WHERE id=?').get(n.reference_id);return r?userOf(r.user_id):null;}
    if(n.reference_type==='forget_request'){const r=db.prepare('SELECT user_id FROM forget_requests WHERE id=?').get(n.reference_id);return r?userOf(r.user_id):null;}
    if(n.reference_type==='profile_request'){const r=db.prepare('SELECT user_id FROM profile_change_requests WHERE id=?').get(n.reference_id);return r?userOf(r.user_id):null;}
    return null;}catch(e){return null;}};
  notifs=notifs.map(n=>{const u=resolveUser(n);return {...n,user_name:u?u.full_name:null,user_username:u?u.username:null,user_email:u?u.email:null};});
  const unread=notifs.filter(n=>!n.is_read).length;
  const deposits=notifs.filter(n=>n.type==='deposit'&&!n.is_read).length;
  const withdrawals=notifs.filter(n=>n.type==='withdraw'&&!n.is_read).length;
  const kyc=notifs.filter(n=>n.type==='kyc'&&!n.is_read).length;
  const tickets=notifs.filter(n=>n.type==='ticket'&&!n.is_read).length;
  const messages=notifs.filter(n=>n.type==='ticket_reply'&&!n.is_read).length;
  const newUsers=notifs.filter(n=>n.type==='new_user'&&!n.is_read).length;
  const moneyRequests=notifs.filter(n=>n.type==='money_request'&&!n.is_read).length;
  const forgetRequests=notifs.filter(n=>n.type==='forget_request'&&!n.is_read).length;
  const profileRequests=notifs.filter(n=>n.type==='profile_request'&&!n.is_read).length;
  res.json({notifications:notifs,unread,badges:{deposits,withdrawals,kyc,tickets,messages,newUsers,moneyRequests,forgetRequests,profileRequests,finance:deposits+withdrawals,support:tickets+messages}});
});

// PUT /notifications/read-all — marks all admin notifications read.
router.put('/notifications/read-all', authAdmin, (req,res)=>{
  getDb().prepare('UPDATE admin_notifications SET is_read=1').run();
  res.json({success:true});
});
// PUT /notifications/:id/read — marks one admin notification read.
router.put('/notifications/:id/read', authAdmin, (req,res)=>{
  getDb().prepare('UPDATE admin_notifications SET is_read=1 WHERE id=?').run(req.params.id);
  res.json({success:true});
});

// POST /notifications/send — sends a notification to all users or to
// one user (creates a notifications row; the admin panel shows it).
router.post('/notifications/send', authAdmin, (req,res)=>{
  const {user_id,title,message,type,action_url,action_label}=req.body;
  if(!title||!message) return res.status(400).json({error:'Title and message required'});
  const db=getDb();
  if(user_id){
    db.prepare('INSERT INTO notifications (user_id,title,message,type,action_url,action_label,sent_by_admin) VALUES (?,?,?,?,?,?,?)')
      .run(user_id,title,message,type||'info',action_url||null,action_label||null,req.adminId);
  } else {
    const users=db.prepare(`SELECT id FROM users WHERE is_showcase=0`).all();
    const ins=db.prepare('INSERT INTO notifications (user_id,title,message,type,action_url,action_label,sent_by_admin) VALUES (?,?,?,?,?,?,?)');
    db.transaction(us=>{for(const u of us)ins.run(u.id,title,message,type||'info',action_url||null,action_label||null,req.adminId);})(users);
  }
  res.json({success:true});
});

module.exports = router;
