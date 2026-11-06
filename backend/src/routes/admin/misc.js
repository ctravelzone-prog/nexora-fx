// routes/admin/misc.js — admin content and reference data: static pages,
// blog posts, holidays, payment gateways, countries and staff.
// Pages: GET/PUT /pages/:slug and POST /pages. Blog: GET /blog, POST
// /blog, DELETE /blog/:id (admin-only; there is no public blog read
// endpoint and no blog edit endpoint). Holidays and payment gateways are
// stored in their tables and read by the Schedule page and the deposit
// screen. GET /countries and /staff are read-only reference lists.
const router = require('express').Router();
const { getDb } = require('../../models/database');
const { authAdmin } = require('../../middleware/auth');

// Pages
// GET /pages/:slug — one static page (title + content) by slug.
router.get('/pages/:slug', authAdmin, (req,res)=>{
  const p=getDb().prepare('SELECT * FROM pages WHERE slug=?').get(req.params.slug);
  res.json(p||{slug:req.params.slug,title:req.params.slug,content:''});
});
// PUT /pages/:slug — updates a static page's title/content.
router.put('/pages/:slug', authAdmin, (req,res)=>{
  const db=getDb();
  const {title,content}=req.body;
  const existing=db.prepare('SELECT id FROM pages WHERE slug=?').get(req.params.slug);
  if(existing) db.prepare('UPDATE pages SET title=COALESCE(?,title),content=?,updated_at=unixepoch() WHERE slug=?').run(title||null,content||'',req.params.slug);
  else db.prepare('INSERT INTO pages (title,slug,content) VALUES (?,?,?)').run(title||req.params.slug,req.params.slug,content||'');
  res.json({success:true});
});
// POST /pages — creates a static page (slug must be unique).
router.post('/pages', authAdmin, (req,res)=>{
  const db=getDb();const {title,slug,content}=req.body;
  if(!title||!slug) return res.status(400).json({error:'Title and slug required'});
  db.prepare('INSERT OR IGNORE INTO pages (title,slug,content) VALUES (?,?,?)').run(title,slug,content||'');
  res.json({success:true});
});

// Blog
// GET /blog — all blog posts, newest first.
router.get('/blog', authAdmin, (req,res)=>{
  res.json(getDb().prepare('SELECT * FROM blog_posts ORDER BY created_at DESC').all());
});
// POST /blog — creates a blog post (title, content, status).
router.post('/blog', authAdmin, (req,res)=>{
  const {title,content,excerpt,status}=req.body;
  if(!title) return res.status(400).json({error:'Title required'});
  const slug=title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const id=getDb().prepare('INSERT INTO blog_posts (title,slug,content,excerpt,status,author_id) VALUES (?,?,?,?,?,?)').run(title,slug+'-'+Date.now(),content||'',excerpt||'',status||'draft',req.adminId).lastInsertRowid;
  res.json({success:true,id});
});
// DELETE /blog/:id — deletes a blog post (404 when missing).
router.delete('/blog/:id', authAdmin, (req,res)=>{
  const info=getDb().prepare('DELETE FROM blog_posts WHERE id=?').run(req.params.id);
  if(!info.changes) return res.status(404).json({error:'Post not found'});
  res.json({success:true});
});

// Holidays
// GET /holidays — all holidays in the holidays table.
router.get('/holidays', authAdmin, (req,res)=>{
  res.json(getDb().prepare('SELECT * FROM holidays ORDER BY date DESC').all());
});
// POST /holidays — adds a holiday row.
router.post('/holidays', authAdmin, (req,res)=>{
  const {date,description}=req.body;
  if(!date) return res.status(400).json({error:'Date required'});
  getDb().prepare('INSERT OR IGNORE INTO holidays (date,description) VALUES (?,?)').run(date,description||'Market closed');
  res.json({success:true});
});

// Payment gateways
// GET /payment-gateways — payment gateway settings.
router.get('/payment-gateways', authAdmin, (req,res)=>{
  res.json(getDb().prepare('SELECT * FROM payment_gateways ORDER BY created_at DESC').all());
});
// POST /payment-gateways — saves payment gateway settings.
router.post('/payment-gateways', authAdmin, (req,res)=>{
  const {name}=req.body;
  if(!name) return res.status(400).json({error:'Name required'});
  const id=getDb().prepare('INSERT INTO payment_gateways (name,is_active) VALUES (?,0)').run(name).lastInsertRowid;
  res.json({success:true,id});
});

// Countries
// GET /countries — the countries reference list (read-only).
router.get('/countries', authAdmin, (req,res)=>{
  res.json(getDb().prepare('SELECT * FROM countries ORDER BY name').all());
});

// Staff (admin list)
// GET /staff — the admin staff list (read-only).
router.get('/staff', authAdmin, (req,res)=>{
  res.json(getDb().prepare('SELECT id,email,role,two_fa_enabled,created_at FROM admins').all());
});

module.exports = router;
