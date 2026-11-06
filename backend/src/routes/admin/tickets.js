// routes/admin/tickets.js — admin side of support tickets.
// GET / lists all tickets with user name/username, newest first. GET /:id
// returns one ticket with its message thread. POST /:id/reply adds an
// admin message (and marks the ticket 'answered'). PUT /:id/status
// closes or reopens a ticket.
// Rule: closed tickets disappear from the USER's ticket list but stay
// visible here, so the admin can reopen them.
const router = require('express').Router();
const { getDb } = require('../../models/database');
const { authAdmin } = require('../../middleware/auth');

// GET / — all support tickets with user name/username, newest first.
router.get('/', authAdmin, (req,res)=>{
  const db=getDb(); const {status,limit=50,offset=0}=req.query;
  let q=`SELECT t.*,u.full_name,u.username FROM support_tickets t JOIN users u ON t.user_id=u.id`;
  const p=[];
  if(status){q+=` WHERE t.status='${status}'`;}
  q+=` ORDER BY t.updated_at DESC LIMIT ? OFFSET ?`;p.push(parseInt(limit),parseInt(offset));
  res.json(db.prepare(q).all(...p));
});

// GET /:id — one ticket with its full message thread.
router.get('/:id', authAdmin, (req,res)=>{
  const db=getDb();
  const ticket=db.prepare('SELECT t.*,u.full_name,u.username,u.email FROM support_tickets t JOIN users u ON t.user_id=u.id WHERE t.id=?').get(req.params.id);
  if(!ticket) return res.status(404).json({error:'Ticket not found'});
  const messages=db.prepare('SELECT * FROM ticket_messages WHERE ticket_id=? ORDER BY created_at').all(ticket.id);
  res.json({...ticket,messages});
});

// POST /:id/reply — adds an admin message and marks the ticket
// 'answered'.
router.post('/:id/reply', authAdmin, (req,res)=>{
  const {message}=req.body;
  if(!message) return res.status(400).json({error:'Message required'});
  const db=getDb();
  const ticket=db.prepare('SELECT * FROM support_tickets WHERE id=?').get(req.params.id);
  if(!ticket) return res.status(404).json({error:'Ticket not found'});
  db.prepare('INSERT INTO ticket_messages (ticket_id,sender_type,sender_id,message) VALUES (?,?,?,?)').run(ticket.id,'admin',req.adminId,message);
  db.prepare(`UPDATE support_tickets SET status='answered',updated_at=unixepoch() WHERE id=?`).run(ticket.id);
  db.prepare('INSERT INTO notifications (user_id,title,message,type,action_url) VALUES (?,?,?,?,?)')
    .run(ticket.user_id,`Support reply: ${ticket.subject}`,message.substring(0,100),'info',`/support/${ticket.id}`);
  res.json({success:true});
});

// PUT /:id/status — closes or reopens a ticket (status 'closed' or
// 'open').
router.put('/:id/status', authAdmin, (req,res)=>{
  const {status}=req.body;
  if(!['open','answered','closed'].includes(status)) return res.status(400).json({error:'Invalid status'});
  getDb().prepare('UPDATE support_tickets SET status=?,updated_at=unixepoch() WHERE id=?').run(status,req.params.id);
  res.json({success:true});
});

module.exports = router;
