// routes/support.js — user support tickets.
// GET /tickets lists the user's tickets; POST /tickets opens one (the
// first message is stored as a ticket_messages row and the admin is
// notified); GET /tickets/:id returns a ticket with all its messages;
// POST /tickets/:id/reply adds a user message and reopens the ticket.
// Rule: a closed ticket cannot be replied to. All write routes refuse
// impersonation sessions (admin 'Login as User').
const router = require('express').Router();
const { getDb } = require('../models/database');
const { authImpersonation } = require('../middleware/auth');

// GET /tickets — the user's tickets, newest first.
router.get('/tickets', authImpersonation, (req,res)=>{
  res.json(getDb().prepare('SELECT * FROM support_tickets WHERE user_id=? ORDER BY created_at DESC').all(req.userId));
});

// POST /tickets — opens a ticket. Body: subject, message, optional
// priority. Side effects: support_tickets row (status 'open') + first
// ticket_messages row + admin notification.
router.post('/tickets', authImpersonation, (req,res)=>{
  if(req.isImpersonation) return res.status(403).json({error:'Not allowed during Login as User session'});
  const {subject,message,priority}=req.body;
  if(!subject||!message) return res.status(400).json({error:'Subject and message required'});
  const db=getDb();
  const tid=db.prepare(`INSERT INTO support_tickets (user_id,subject,message,priority,status) VALUES (?,?,?,?,'open')`)
    .run(req.userId,subject,message,priority||'normal').lastInsertRowid;
  db.prepare('INSERT INTO ticket_messages (ticket_id,sender_type,sender_id,message) VALUES (?,?,?,?)').run(tid,'user',req.userId,message);
  db.prepare('INSERT INTO admin_notifications (type,title,message,reference_id,reference_type,destination_pane) VALUES (?,?,?,?,?,?)')
    .run('ticket',`New support ticket: ${subject}`,(()=>{const u=db.prepare('SELECT full_name,username FROM users WHERE id=?').get(req.userId);return u?`From ${u.full_name} (@${u.username})`:`From user #${req.userId}`;})(),tid,'ticket','tickets');
  res.json({success:true,id:tid});
});

// GET /tickets/:id — one ticket with its full message thread. A user
// can only open their own tickets (404 otherwise).
router.get('/tickets/:id', authImpersonation, (req,res)=>{
  const db=getDb();
  const ticket=db.prepare('SELECT * FROM support_tickets WHERE id=? AND user_id=?').get(req.params.id,req.userId);
  if(!ticket) return res.status(404).json({error:'Ticket not found'});
  const messages=db.prepare('SELECT * FROM ticket_messages WHERE ticket_id=? ORDER BY created_at').all(ticket.id);
  res.json({...ticket,messages});
});

// POST /tickets/:id/reply — adds a user message and sets the ticket
// back to 'open'. Refused when the ticket is closed.
router.post('/tickets/:id/reply', authImpersonation, (req,res)=>{
  if(req.isImpersonation) return res.status(403).json({error:'Not allowed during Login as User session'});
  const {message}=req.body;
  if(!message) return res.status(400).json({error:'Message required'});
  const db=getDb();
  const ticket=db.prepare('SELECT * FROM support_tickets WHERE id=? AND user_id=?').get(req.params.id,req.userId);
  if(!ticket) return res.status(404).json({error:'Ticket not found'});
  if(ticket.status==='closed') return res.status(400).json({error:'Ticket is closed'});
  db.prepare('INSERT INTO ticket_messages (ticket_id,sender_type,sender_id,message) VALUES (?,?,?,?)').run(ticket.id,'user',req.userId,message);
  db.prepare(`UPDATE support_tickets SET status='open',updated_at=unixepoch() WHERE id=?`).run(ticket.id);
  res.json({success:true});
});

module.exports = router;
