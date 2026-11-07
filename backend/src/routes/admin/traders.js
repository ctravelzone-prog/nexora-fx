// routes/admin/traders.js — admin management of copy traders.
// GET / lists all traders (including hidden ones). POST / creates one
// (avatar upload, win rate, flag, ROI, risk level). PUT /:id edits one.
// PUT /:id/toggle-hidden hides or shows a trader. DELETE /:id removes a
// trader (refused while users still copy them). GET /copies/active lists
// all active copies; POST /copies/:id/stop force-stops one copy.
// Rule: traders are ranked by win rate on the user side; the Top 5 tier
// frames are assigned automatically by rank, never by the admin.
const router = require('express').Router();
const { getDb } = require('../../models/database');
const { authAdmin } = require('../../middleware/auth');
const { stopCopy } = require('../../services/copyService');
const multer = require('multer');
const path = require('path');
const { getUploadsDir, ensureUploadsDir } = require('../../services/uploads');
ensureUploadsDir();
const upload = multer({storage:multer.diskStorage({destination:(req,file,cb)=>cb(null,getUploadsDir()),filename:(req,file,cb)=>cb(null,`trader_${Date.now()}_${file.originalname}`)}),limits:{fileSize:5*1024*1024}});

// GET / — all traders (including hidden), newest first.
router.get('/', authAdmin, (req,res)=>res.json(getDb().prepare('SELECT * FROM traders ORDER BY created_at DESC').all()));

// POST / — creates a trader (name, username, avatar upload, flag,
// ROI, win rate, risk level, minimum copy amount).
router.post('/', authAdmin, upload.single('avatar'), (req,res)=>{
  const {name,username,flag_emoji,verified,roi_percent,win_rate,drawdown,risk_level,min_copy,followers,strategy}=req.body;
  if(!name||!username) return res.status(400).json({error:'Name and username required'});
  const db=getDb();
  if(db.prepare('SELECT id FROM traders WHERE username=?').get(username)) return res.status(400).json({error:'Username already taken. Use another username.'});
  const avatar=req.file?`/uploads/${req.file.filename}`:null;
  const id=db.prepare('INSERT INTO traders (name,username,avatar,flag_emoji,verified,roi_percent,win_rate,drawdown,risk_level,min_copy_cents,followers,strategy) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(name,username,avatar,flag_emoji||'🇬🇧',(verified==='1'||verified==='true'||verified===1)?1:0,parseFloat(roi_percent||10),parseFloat(win_rate||75),parseFloat(drawdown||5),risk_level||'Medium',Math.round(parseFloat(min_copy||10)*100),parseInt(followers||0),strategy||null).lastInsertRowid;
  res.json({success:true,id});
});

// PUT /:id — edits a trader (all fields optional; avatar upload
// replaces the picture).
router.put('/:id', authAdmin, upload.single('avatar'), (req,res)=>{
  const {name,username,flag_emoji,verified,roi_percent,win_rate,drawdown,risk_level,min_copy,followers,strategy}=req.body;
  const db=getDb(); const t=db.prepare('SELECT * FROM traders WHERE id=?').get(req.params.id);
  if(!t) return res.status(404).json({error:'Trader not found'});
  if(username&&username!==t.username&&db.prepare('SELECT id FROM traders WHERE username=?').get(username)) return res.status(400).json({error:'Username already taken. Use another username.'});
  const avatar=req.file?`/uploads/${req.file.filename}`:t.avatar;
  const ver=verified===undefined?t.verified:((verified==='1'||verified==='true'||verified===1)?1:0);
  db.prepare('UPDATE traders SET name=?,username=?,avatar=?,flag_emoji=?,verified=?,roi_percent=?,win_rate=?,drawdown=?,risk_level=?,min_copy_cents=?,followers=?,strategy=? WHERE id=?')
    .run(name||t.name,username||t.username,avatar,flag_emoji||t.flag_emoji,ver,roi_percent!==undefined&&roi_percent!==''?parseFloat(roi_percent):t.roi_percent,win_rate!==undefined&&win_rate!==''?parseFloat(win_rate):t.win_rate,drawdown!==undefined&&drawdown!==''?parseFloat(drawdown):t.drawdown,risk_level||t.risk_level,min_copy?Math.round(parseFloat(min_copy)*100):t.min_copy_cents,followers!==undefined&&followers!==''?parseInt(followers):t.followers,strategy!==undefined?strategy:t.strategy,req.params.id);
  res.json({success:true});
});

// PUT /:id/toggle-hidden — hides a trader from users (or shows them
// again). Hidden traders keep their existing copies.
router.put('/:id/toggle-hidden', authAdmin, (req,res)=>{
  const db=getDb(); const t=db.prepare('SELECT * FROM traders WHERE id=?').get(req.params.id);
  if(!t) return res.status(404).json({error:'Trader not found'});
  db.prepare('UPDATE traders SET is_hidden=? WHERE id=?').run(t.is_hidden?0:1,t.id);
  res.json({success:true});
});

// DELETE /:id — removes a trader. Refused (400) while any user still
// has an active copy of them.
router.delete('/:id', authAdmin, (req,res)=>{
  const db=getDb();
  const trader=db.prepare('SELECT * FROM traders WHERE id=?').get(req.params.id);
  if(!trader) return res.status(404).json({error:'Trader not found'});
  const active=db.prepare("SELECT COUNT(*) as c FROM copies WHERE trader_id=? AND status='active'").get(req.params.id).c;
  if(active>0) return res.status(400).json({error:'Trader has active copies. Stop all copies first, then delete.'});
  db.prepare('DELETE FROM traders WHERE id=?').run(req.params.id);
  res.json({success:true});
});

// GET /copies/active — every active copy with user and trader names.
router.get('/copies/active', authAdmin, (req,res)=>{
  res.json(getDb().prepare(`SELECT c.*,u.full_name,u.username,t.name as trader_name FROM copies c JOIN users u ON c.user_id=u.id JOIN traders t ON c.trader_id=t.id WHERE c.status='active' AND u.is_showcase=0 ORDER BY c.created_at DESC`).all());
});

// POST /copies/:id/stop — force-stops one copy (principal + profit
// return to the user's Main Balance).
router.post('/copies/:id/stop', authAdmin, (req,res)=>{
  try{
    const db=getDb();
    const copy=db.prepare(`SELECT * FROM copies WHERE id=? AND status='active'`).get(req.params.id);
    if(!copy) return res.status(404).json({error:'Active copy not found'});
    const result=stopCopy(copy.user_id,copy.id);
    db.prepare('INSERT INTO audit_log (admin_id,user_id,action) VALUES (?,?,?)').run(req.adminId,copy.user_id,`admin_stop_copy:${copy.id}`);
    res.json({success:true,...result});
  }catch(e){res.status(500).json({error:e.message});}
});

module.exports = router;
