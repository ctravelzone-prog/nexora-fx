// kyc.js — KYC routes (clean template literals)
const router = require('express').Router();
const { getDb } = require('../models/database');
const { authImpersonation } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const storage = multer.diskStorage({
  destination:(req,file,cb)=>cb(null,path.join(__dirname,'../../uploads')),
  filename:(req,file,cb)=>cb(null,`kyc_${req.userId}_${Date.now()}_${file.originalname}`)
});
const upload = multer({storage,limits:{fileSize:10*1024*1024}});

router.get('/status', authImpersonation, (req,res)=>{
  const db=getDb();
  const kyc=db.prepare(`SELECT * FROM kyc_submissions WHERE user_id=? ORDER BY submitted_at DESC LIMIT 1`).get(req.userId);
  const fields=db.prepare(`SELECT * FROM kyc_form_fields WHERE is_active=1 ORDER BY sort_order`).all();
  const kycEnabled=db.prepare(`SELECT value FROM site_settings WHERE key='kyc_enabled'`).get();
  const reqUser=db.prepare('SELECT kyc_status,kyc_requested FROM users WHERE id=?').get(req.userId);
  const isVerified=(reqUser&&reqUser.kyc_status==='approved')||(kyc&&kyc.status==='approved');
  res.json({kyc:kyc||null,fields,kyc_enabled:isVerified?false:((kycEnabled?kycEnabled.value==='1':false)||!!(reqUser&&reqUser.kyc_requested))});
});

router.post('/submit', authImpersonation, upload.fields([{name:'doc_front'},{name:'doc_back'},{name:'selfie'}]), (req,res)=>{
  if(req.isImpersonation) return res.status(403).json({error:'Not allowed during Login as User session'});
  try{
    const {doc_type}=req.body;
    const db=getDb();
    const existing=db.prepare(`SELECT * FROM kyc_submissions WHERE user_id=? AND status IN ('pending','approved')`).get(req.userId);
    if(existing) return res.status(400).json({error:'KYC already submitted or approved'});
    const front=req.files&&req.files.doc_front?`/uploads/${req.files.doc_front[0].filename}`:null;
    const back=req.files&&req.files.doc_back?`/uploads/${req.files.doc_back[0].filename}`:null;
    const selfie=req.files&&req.files.selfie?`/uploads/${req.files.selfie[0].filename}`:null;
    const kycId=db.prepare(`INSERT INTO kyc_submissions (user_id,doc_type,doc_front,doc_back,selfie,status) VALUES (?,?,?,?,?,'pending')`)
      .run(req.userId,doc_type||'passport',front,back,selfie).lastInsertRowid;
    db.prepare(`UPDATE users SET kyc_status='pending' WHERE id=?`).run(req.userId);
    db.prepare('INSERT INTO admin_notifications (type,title,message,reference_id,reference_type,destination_pane) VALUES (?,?,?,?,?,?)')
      .run('kyc','KYC submitted',(()=>{const u=db.prepare('SELECT full_name,username FROM users WHERE id=?').get(req.userId);return u?`${u.full_name} (@${u.username}) submitted KYC documents`:`User #${req.userId} submitted KYC documents`;})(),kycId,'kyc','kyc');
    res.json({success:true,message:'KYC submitted. Under review.'});
  }catch(e){res.status(500).json({error:e.message});}
});

module.exports = router;
