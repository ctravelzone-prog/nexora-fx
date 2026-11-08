// routes/kyc.js — user KYC submission (documents upload + status).
// GET /status returns the user's latest submission, the active form
// fields the admin configured, and whether KYC is currently required.
// POST /submit uploads the documents and the admin-configured fields and
// creates a pending kyc_submissions row; the admin reviews it in the
// admin panel. The four document fields go to the fixed kyc_submissions
// columns; every other active field's value (text, or the /uploads path
// for an extra file field) is stored as JSON in form_data. Required
// fields are validated server-side against the admin's current form.
// Rules: one open submission per user (a pending or approved submission
// blocks a second one). KYC is required before withdrawals can be used.
// Uploaded files are stored in the uploads dir (UPLOADS_DIR).
const router = require('express').Router();
const { getDb, getMainDb } = require('../models/database');
const { authImpersonation } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const { getUploadsDir, ensureUploadsDir } = require('../services/uploads');
ensureUploadsDir();
const storage = multer.diskStorage({
  destination:(req,file,cb)=>cb(null,getUploadsDir()),
  filename:(req,file,cb)=>cb(null,`kyc_${req.userId}_${Date.now()}_${file.fieldname}_${file.originalname}`)
});
const upload = multer({storage,limits:{fileSize:10*1024*1024}});

// GET /status — latest KYC submission + active form fields + whether
// KYC is enabled for this user (global switch OR an admin request to
// this user). Already-verified users are never asked again. The form
// definition is global (main DB) — the admin edits it in one place and
// every user (real or showcase) sees the same form.
router.get('/status', authImpersonation, (req,res)=>{
  const db=getDb();
  const kyc=db.prepare(`SELECT * FROM kyc_submissions WHERE user_id=? ORDER BY submitted_at DESC LIMIT 1`).get(req.userId);
  const fields=getMainDb().prepare(`SELECT * FROM kyc_form_fields WHERE is_active=1 ORDER BY sort_order`).all();
  const kycEnabled=getMainDb().prepare(`SELECT value FROM site_settings WHERE key='kyc_enabled'`).get();
  const reqUser=db.prepare('SELECT kyc_status,kyc_requested FROM users WHERE id=?').get(req.userId);
  const isVerified=(reqUser&&reqUser.kyc_status==='approved')||(kyc&&kyc.status==='approved');
  res.json({kyc:kyc||null,fields,kyc_enabled:isVerified?false:((kycEnabled?kycEnabled.value==='1':false)||!!(reqUser&&reqUser.kyc_requested))});
});

// POST /submit — uploads the documents and the admin-configured
// fields and creates a pending submission; also sets users.kyc_status
// to 'pending' and notifies the admin. Blocked when a submission is
// already pending or approved. upload.any() accepts any file fields
// because the form is dynamic — the admin may add file fields the route
// cannot know in advance.
router.post('/submit', authImpersonation, upload.any(), (req,res)=>{
  if(req.isImpersonation) return res.status(403).json({error:'Not allowed during Login as User session'});
  try{
    const {doc_type}=req.body;
    // req.db, not getDb(): multer can lose the AsyncLocalStorage context,
    // which would silently send a showcase user's KYC to the main DB.
    const db=req.db || getDb();
    const existing=db.prepare(`SELECT * FROM kyc_submissions WHERE user_id=? AND status IN ('pending','approved')`).get(req.userId);
    if(existing) return res.status(400).json({error:'KYC already submitted or approved'});
    const filesByName={};
    for(const f of (req.files||[])) filesByName[f.fieldname]=`/uploads/${f.filename}`;
    // The form definition is global (main DB); validate against it.
    const fields=getMainDb().prepare(`SELECT * FROM kyc_form_fields WHERE is_active=1 ORDER BY sort_order`).all();
    const FIXED=['doc_type','doc_front','doc_back','selfie'];
    for(const fld of fields){
      const hasFile=!!filesByName[fld.field_name];
      const hasText=typeof req.body[fld.field_name]==='string'&&req.body[fld.field_name].trim()!=='';
      if(fld.required&&!hasFile&&!hasText) return res.status(400).json({error:`${fld.field_label} is required`});
    }
    const front=filesByName.doc_front||null;
    const back=filesByName.doc_back||null;
    const selfie=filesByName.selfie||null;
    const formData={};
    for(const fld of fields){
      if(FIXED.includes(fld.field_name)) continue;
      if(fld.field_type==='file'){ if(filesByName[fld.field_name]) formData[fld.field_name]=filesByName[fld.field_name]; }
      else if(typeof req.body[fld.field_name]==='string'&&req.body[fld.field_name].trim()!=='') formData[fld.field_name]=req.body[fld.field_name].trim().slice(0,500);
    }
    const kycId=db.prepare(`INSERT INTO kyc_submissions (user_id,doc_type,doc_front,doc_back,selfie,form_data,status) VALUES (?,?,?,?,?,?,'pending')`)
      .run(req.userId,doc_type||'passport',front,back,selfie,JSON.stringify(formData)).lastInsertRowid;
    db.prepare(`UPDATE users SET kyc_status='pending' WHERE id=?`).run(req.userId);
    db.prepare('INSERT INTO admin_notifications (type,title,message,reference_id,reference_type,destination_pane) VALUES (?,?,?,?,?,?)')
      .run('kyc','KYC submitted',(()=>{const u=db.prepare('SELECT full_name,username FROM users WHERE id=?').get(req.userId);return u?`${u.full_name} (@${u.username}) submitted KYC documents`:`User #${req.userId} submitted KYC documents`;})(),kycId,'kyc','kyc');
    res.json({success:true,message:'KYC submitted. Under review.'});
  }catch(e){res.status(500).json({error:e.message});}
});

module.exports = router;
