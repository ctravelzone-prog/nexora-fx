/*
 * admin-missing.js — Request Money, Blog and Pages editor.
 *
 * Renders /admin/request-money (approve to credit Main Balance, reject with
 * a reason), /admin/blog (create / list / delete posts) and the Website
 * Contents page editor (Terms, Privacy, Risk Disclosure, FAQ, plus new pages).
 * Key functions: AdminPages.requestMoney, AdminPages._mrApprove,
 * AdminPages._mrReject, AdminPages._doMrReject, AdminPages.manageBlog,
 * AdminPages._delPost, AdminPages._newPost, AdminPages.pagesEditor,
 * AdminPages._editPage, AdminPages._newPage.
 *
 * Gotchas:
 * - Blog and page calls use api.request directly (not adminApi) because
 *   those endpoints have no adminApi wrapper yet.
 * - Form fields are read with querySelector('[name=...]') because the
 *   built-in form.title / form.target properties shadow input names.
 * - Money is integer cents everywhere; display with utils.fmtMoney.
 * - Admin API calls go through adminApi in js/admin-api.js.
 * - Showcase accounts (is_showcase=1) are demo accounts with DISPLAY
 *   balances set by the admin; they are excluded from all admin totals,
 *   ledgers and reports.
 * - Bump the ?v= cache version in script tags on every release, or
 *   browsers keep serving stale code.
 */
// Renders /admin/request-money: pending requests first, reviewed ones
  // below. Data comes from adminApi.getMoneyRequests().
AdminPages.requestMoney=async function(){
  try{const _gen=AdminApp._gen;const rs=await adminApi.getMoneyRequests();if(_gen!==AdminApp._gen)return;
  // Request Money access (per-user ON/OFF switch, same as Money Settings >
  // User Access Controls): Request Money is ON for every user by default.
  // The panel lists the users who are switched OFF (each with a Turn ON
  // button, so the admin gives the permission with one click) and the
  // once-only users (each with a Turn OFF button). Search finds any user;
  // the selected user's card has Turn ON / Turn ON once / Turn OFF.
  // State lives on AdminPages so the 1s auto-refresh (which re-renders
  // this page) rebuilds the panel as-is; typing is safe because the
  // refresh skips while an input is focused.
  let _rmBlocks={blocks:[],requestMoneyOff:[],requestMoneyOnce:[]};
  try{_rmBlocks=await adminApi.getUserBlocks();}catch(e){}
  const _rmOff=_rmBlocks.requestMoneyOff||[],_rmOnce=_rmBlocks.requestMoneyOnce||[];
  const _rmQ=AdminPages._rmQuery||'',_rmRes=AdminPages._rmResults||[],_rmSelId=AdminPages._rmSelectedId||null;
  const _rmSelU=_rmSelId?(AdminPages._rmFound||{})[_rmSelId]:null;
  const _rmEsc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  const _rmResHtml=_rmRes.length?_rmRes.map(u=>'<div style="display:flex;justify-content:space-between;gap:10px;padding:8px 4px;border-top:1px solid var(--border);cursor:pointer" onclick="AdminPages._rmSelect('+u.id+')"><span><b style="font-size:13px">'+_rmEsc(u.full_name)+' (@'+_rmEsc(u.username)+')</b><br><span style="color:var(--faint);font-size:12px">'+_rmEsc(u.email||'')+'</span></span><span style="color:var(--orange);font-size:12px">Select →</span></div>').join(''):(_rmQ?'<p style="color:var(--muted);font-size:13px;padding:6px 0">No user found.</p>':'');
  let _rmSelHtml='';
  if(_rmSelU){
    const _off=_rmOff.find(x=>x.id===_rmSelU.id),_once=_rmOnce.find(x=>x.id===_rmSelU.id);
    const _status=_off?'Off':(_once?'On — once only (turns off after they use it once)':'On');
    _rmSelHtml='<div style="border:1px solid var(--border);border-radius:12px;padding:14px;margin-top:10px"><div style="font-weight:800">'+_rmEsc(_rmSelU.full_name)+' (@'+_rmEsc(_rmSelU.username)+')</div><div style="color:var(--faint);font-size:12px;margin-bottom:4px">'+_rmEsc(_rmSelU.email||'')+'</div><div style="font-size:13px;margin-bottom:10px">Request Money: <b>'+_status+'</b></div><div style="display:flex;flex-wrap:wrap;gap:8px">'
      +(_off?'<button class="btn-primary text-sm" style="width:auto;padding:8px 14px" onclick="AdminPages._rmSet('+_rmSelU.id+',1,0)">Turn ON</button><button class="btn-secondary text-sm" style="width:auto;padding:8px 14px" onclick="AdminPages._rmSet('+_rmSelU.id+',1,1)">Turn ON once</button>':'<button class="btn-secondary text-sm" style="width:auto;padding:8px 14px" onclick="AdminPages._rmSet('+_rmSelU.id+',0,0)">Turn OFF</button>')
      +'</div></div>';
  }
  // Lists with a one-click ON/OFF button per user — no search needed to
  // give permission. OFF list (give permission) + once-only list (take it
  // back). Capped at 10 rows each; search finds the rest.
  let _rmListsHtml='';
  if(_rmOff.length){
    const _shown=_rmOff.slice(0,10);
    _rmListsHtml+='<div style="margin-top:14px"><div style="font-weight:700;font-size:13px;margin-bottom:6px">Request Money OFF ('+_rmOff.length+')</div>'+_shown.map(u=>'<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 4px;border-top:1px solid var(--border)"><span><b style="font-size:13px">'+_rmEsc(u.full_name)+' (@'+_rmEsc(u.username)+')</b><br><span style="color:var(--faint);font-size:12px">'+_rmEsc(u.email||'')+'</span></span><button class="btn-primary text-sm" style="width:auto;padding:6px 12px;white-space:nowrap" onclick="AdminPages._rmSet('+u.id+',1,0)">Turn ON</button></div>').join('')+(_rmOff.length>10?'<p style="color:var(--muted);font-size:12px;padding-top:6px">And '+(_rmOff.length-10)+' more — search above to find them.</p>':'')+'</div>';
  }else{
    _rmListsHtml+='<p style="color:var(--muted);font-size:13px;margin-top:14px">Nobody has Request Money switched off right now.</p>';
  }
  if(_rmOnce.length){
    _rmListsHtml+='<div style="margin-top:14px"><div style="font-weight:700;font-size:13px;margin-bottom:6px">ON — once only ('+_rmOnce.length+')</div>'+_rmOnce.slice(0,10).map(u=>'<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 4px;border-top:1px solid var(--border)"><span><b style="font-size:13px">'+_rmEsc(u.full_name)+' (@'+_rmEsc(u.username)+')</b><br><span style="color:var(--faint);font-size:12px">'+_rmEsc(u.email||'')+'</span></span><button class="btn-secondary text-sm" style="width:auto;padding:6px 12px;white-space:nowrap" onclick="AdminPages._rmSet('+u.id+',0,0)">Turn OFF</button></div>').join('')+'</div>';
  }
  const _rmPanel='<div class="panel" style="margin-top:0"><h3 style="font-weight:800;margin-bottom:6px">Request Money access</h3><p style="color:var(--muted);font-size:13px;margin-bottom:12px">Request Money is ON for every user by default. Turn it off for someone here, or turn it back on yourself — you give the permission.</p><div style="display:flex;gap:8px;margin-bottom:6px"><input id="rm-q" type="text" class="input-field" placeholder="Search user by name, username or email" value="'+_rmEsc(_rmQ)+'" style="flex:1"><button class="btn-primary text-sm" style="width:auto;padding:8px 16px" onclick="AdminPages._rmSearch()">Search</button></div><div>'+_rmResHtml+'</div>'+_rmSelHtml+_rmListsHtml+'</div>';
  const pend=rs.filter(r=>r.status==='pending'),done=rs.filter(r=>r.status!=='pending');
  AdminComponents.layout('<div class="admin-head"><div><h2>Request Money</h2><p style="color:var(--muted);font-size:13px">Money requests from users. Approve to add the amount to Main Balance, reject with a reason.</p></div></div>'
  +_rmPanel
  +'<div class="panel" style="margin-top:0"><h3 style="font-weight:800;margin-bottom:10px">Pending ('+pend.length+')</h3>'
  +(pend.length?'<div style="overflow-x:auto"><table class="data-table" style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:var(--bg2)"><th style="padding:10px;text-align:left">User</th><th style="padding:10px;text-align:left">Amount</th><th style="padding:10px;text-align:left">Reason</th><th style="padding:10px;text-align:left">Date</th><th style="padding:10px;text-align:left">Actions</th></tr></thead><tbody>'
  +pend.map(r=>'<tr style="border-top:1px solid var(--border)"><td data-label="User" style="padding:10px"><div>'+r.full_name+' (@'+r.username+')<br><span style="color:var(--faint);font-size:12px">'+r.email+'</span></div></td><td data-label="Amount" style="padding:10px;font-weight:800">'+utils.fmtMoney(r.amount_cents)+'</td><td data-label="Reason" style="padding:10px">'+(r.reason||'—')+'</td><td data-label="Date" style="padding:10px">'+utils.fmtDateTime(r.created_at)+'</td><td data-label="Actions" style="padding:10px"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button class="btn-primary text-sm" style="width:auto;padding:8px 14px;white-space:nowrap" onclick="AdminPages._mrApprove('+r.id+')">Approve</button><button class="btn-danger text-sm" style="width:auto;padding:8px 14px;white-space:nowrap" onclick="AdminPages._mrReject('+r.id+')">Reject</button></div></td></tr>').join('')+'</tbody></table></div>':'<p style="text-align:center;padding:20px;color:var(--muted)">No pending money requests.</p>')
  +'</div>'
  +(done.length?'<div class="panel"><h3 style="font-weight:800;margin-bottom:10px">Reviewed</h3>'+done.map(r=>'<div style="display:flex;justify-content:space-between;gap:10px;padding:10px 0;border-top:1px solid var(--border);font-size:13px"><span>'+r.full_name+' (@'+r.username+') — <b>'+utils.fmtMoney(r.amount_cents)+'</b>'+(r.admin_note?' <span style="color:var(--danger)">('+r.admin_note+')</span>':'')+'</span><span class="'+utils.statusBadge(r.status)+'">'+r.status+'</span></div>').join('')+'</div>':'')
  ,'Request Money');
  const _rmQEl=document.getElementById('rm-q'); if(_rmQEl) _rmQEl.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();AdminPages._rmSearch();}};
  }catch(e){document.getElementById('admin-app').innerHTML='<p class="p-8 text-red-500">'+e.message+'</p>';}
};
// Request Money access helpers (per-user switch, shown on this page).
// State lives on AdminPages so the 1s auto-refresh rebuilds the panel.
AdminPages._rmSearch=async function(){
  const q=(document.getElementById('rm-q')||{}).value||''; const query=q.trim(); if(!query) return;
  try{const d=await adminApi.getUsers({search:query,limit:5});
    const users=Array.isArray(d)?d:(d.users||[]);
    AdminPages._rmFound=AdminPages._rmFound||{};
    users.forEach(u=>{AdminPages._rmFound[u.id]=u;});
    AdminPages._rmQuery=query; AdminPages._rmResults=users;
    AdminPages.requestMoney();
  }catch(e){utils.toast(e.message,'error');}
};
AdminPages._rmSelect=function(id){AdminPages._rmSelectedId=id;AdminPages.requestMoney();};
AdminPages._rmSet=async function(id,enabled,oneTime){
  try{await adminApi.setRequestMoney(id,enabled,oneTime);utils.toast(enabled?'Request Money enabled':'Request Money disabled','success');AdminPages.requestMoney();}catch(e){utils.toast(e.message,'error');}
};
// Confirms, then approves a money request via adminApi.approveMoneyRequest.
  // Approval adds the amount to the user's Main Balance.
AdminPages._mrApprove=function(id){utils.confirm('Approve this request? The amount will be added to the user\'s Main Balance.',async()=>{try{await adminApi.approveMoneyRequest(id);utils.toast('Approved — balance added','success');AdminPages.requestMoney();}catch(ex){utils.toast(ex.message,'error');}},'Approve');};
// Opens a modal asking for a rejection reason for a money request.
AdminPages._mrReject=function(id){utils.showModal('<div class="modal"><h2 class="font-bold mb-3">Reject Request #'+id+'</h2><label class="input-label">Reason (optional)</label><input id="mr-note" type="text" class="input-field mb-3"><div class="flex gap-3"><button onclick="utils.closeModal()" class="btn-secondary flex-1">Cancel</button><button onclick="AdminPages._doMrReject('+id+')" class="btn-danger flex-1">Reject</button></div></div>');};
// Submits the rejection (with note) via adminApi.rejectMoneyRequest.
AdminPages._doMrReject=async function(id){const note=document.getElementById('mr-note').value;try{await adminApi.rejectMoneyRequest(id,{note});utils.closeModal();utils.toast('Rejected','success');AdminPages.requestMoney();}catch(ex){utils.toast(ex.message,'error');}};
// Renders /admin/blog: the post list with a New Post button.
  // Fetches posts with GET /api/admin/blog; a failed fetch shows an empty list.
AdminPages.manageBlog=async function(){
  let posts=[];
  try{ const r=await api.request('GET','/api/admin/blog',null,true); posts=Array.isArray(r)?r:[]; }catch(e){ posts=[]; }
  const rows=posts.map(p=>{
    const d=p.created_at?new Date(p.created_at*1000).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):''; // created_at is epoch seconds, so x1000 converts it to milliseconds.
    const badge=p.status==='published'?'<span class="st st-green">Published</span>':'<span class="st">Draft</span>';
    return '<div class="flex items-center gap-3" style="padding:12px 4px;border-bottom:1px solid var(--border)"><div class="grow min-w-0"><b style="font-size:14px">'+String(p.title||'').replace(/</g,'&lt;')+'</b><div class="text-xs text-gray-400">'+d+'</div></div>'+badge+'<button onclick="AdminPages._delPost('+p.id+')" class="btn-secondary text-xs" style="padding:6px 12px;width:auto">Delete</button></div>';
  }).join('');
  AdminComponents.layout(`<div class="admin-head"><div><h2>Manage Blog</h2><p style="color:var(--muted);font-size:13px">Create and manage blog posts.</p></div><div style="margin-left:auto"><button onclick="AdminPages._newPost()" class="btn-primary text-sm" style="width:auto;padding:10px 16px">+ New Post</button></div></div><div class="panel" style="margin-top:0">${rows||'<p style="text-align:center;padding:32px;color:var(--muted)">No blog posts yet.</p>'}</div>`,'Manage Blog');
};
// Confirms, then deletes a blog post via DELETE /api/admin/blog/:id.
AdminPages._delPost=function(id){
  utils.confirm('Delete this blog post?',async()=>{
    try{ await api.request('DELETE','/api/admin/blog/'+id,null,true); utils.toast('Post deleted','success'); AdminPages.manageBlog(); }catch(e){ utils.toast(e.message,'error'); }
  },'Delete Post');
};
// Opens the New Blog Post modal and saves it via POST /api/admin/blog.
AdminPages._newPost=function(){
  utils.showModal('<div class="modal"><h2 style="font-size:18px;font-weight:800;margin-bottom:12px">New Blog Post</h2><form id="bp-form" class="space-y-4"><div><label class="input-label">Title</label><input name="title" type="text" class="input-field" required></div><div><label class="input-label">Content (HTML)</label><textarea name="content" class="input-field" rows="5" placeholder="<p>Content...</p>"></textarea></div><div><label class="input-label">Status</label><select name="status" class="input-field"><option value="draft">Draft</option><option value="published">Published</option></select></div><div class="flex gap-3"><button type="button" onclick="utils.closeModal()" class="btn-secondary flex-1">Cancel</button><button type="submit" id="bp-btn" class="btn-primary flex-1">Save</button></div></form></div>');
  document.getElementById('bp-form').onsubmit=async e=>{
    e.preventDefault();const f=e.target,btn=document.getElementById('bp-btn');utils.loading(btn,true);
    try{ await api.request('POST','/api/admin/blog',{title:f.querySelector('[name="title"]').value,content:f.querySelector('[name="content"]').value,status:f.querySelector('[name="status"]').value},true); utils.closeModal(); utils.toast('Post saved!','success'); AdminPages.manageBlog(); }
    catch(ex){ utils.toast(ex.message,'error'); utils.loading(btn,false); }
  };
};
// Renders the Website Contents page picker (Terms, Privacy, Risk, FAQ)
  // plus an Add New Page card. No API call; content loads on edit.
AdminPages.pagesEditor=function(){
  AdminComponents.layout('<div class="admin-head"><div><h2>Website Contents — Pages</h2><p style="color:var(--muted);font-size:13px">Edit Terms, Privacy Policy, Risk Disclosure, FAQ.</p></div></div><div class="panel" style="margin-top:0"><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px">'
    +[['terms','Terms & Conditions'],['privacy','Privacy Policy'],['risk','Risk Disclosure'],['faq','FAQ']].map(([s,t])=>'<div class="card" style="cursor:pointer" onclick="AdminPages._editPage(\''+s+'\',\''+t+'\')"><b style="font-size:15px;color:var(--ink)">'+t+'</b><p style="font-size:12px;color:var(--muted);margin-top:3px">Click to edit</p></div>').join('')
    +'<div class="card" style="border:2px dashed var(--border);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px" onclick="AdminPages._newPage()"><span style="font-size:20px;color:var(--muted)">+</span><span style="font-size:13px;font-weight:700;color:var(--muted)">Add New Page</span></div>'
    +'</div></div>','Website Contents');
};
// Loads one page's HTML via GET /api/admin/pages/:slug (missing page
  // means empty content) and saves edits via PUT to the same endpoint.
AdminPages._editPage=async function(slug,title){
  let content='';
  try{const p=await api.request('GET','/api/admin/pages/'+slug,null,true).catch(()=>null);if(p)content=p.content||'';}catch(e){}
  utils.showModal('<div class="modal" style="max-width:640px"><h2 style="font-size:18px;font-weight:800;margin-bottom:12px">Edit: '+title+'</h2><form id="pge-form"><label class="input-label">Content (HTML)</label><textarea name="content" class="input-field" rows="10" style="margin-bottom:12px">'+content+'</textarea><div class="flex gap-3"><button type="button" onclick="utils.closeModal()" class="btn-secondary flex-1">Cancel</button><button type="submit" id="pge-btn" class="btn-primary flex-1">Save</button></div></form></div>');
  document.getElementById('pge-form').onsubmit=async(e)=>{e.preventDefault();const btn=document.getElementById('pge-btn');utils.loading(btn,true);try{await api.request('PUT','/api/admin/pages/'+slug,{content:e.target.content.value},true);utils.closeModal();utils.toast('Page saved!','success');}catch(ex){utils.toast(ex.message,'error');utils.loading(btn,false);}};
};
// Opens the New Page modal and creates the page via POST /api/admin/pages.
AdminPages._newPage=function(){
  utils.showModal('<div class="modal"><h2 style="font-size:18px;font-weight:800;margin-bottom:12px">New Page</h2><form id="npg-form" class="space-y-4"><div><label class="input-label">Title</label><input name="title" type="text" class="input-field" required></div><div><label class="input-label">Slug (e.g. about)</label><input name="slug" type="text" class="input-field" required></div><div><label class="input-label">Content (HTML)</label><textarea name="content" class="input-field" rows="5"></textarea></div><div class="flex gap-3"><button type="button" onclick="utils.closeModal()" class="btn-secondary flex-1">Cancel</button><button type="submit" id="npg-btn" class="btn-primary flex-1">Create</button></div></form></div>');
  document.getElementById('npg-form').onsubmit=async(e)=>{e.preventDefault();const btn=document.getElementById('npg-btn');utils.loading(btn,true);try{await api.request('POST','/api/admin/pages',{title:e.target.querySelector('[name="title"]').value,slug:e.target.querySelector('[name="slug"]').value,content:e.target.querySelector('[name="content"]').value},true);utils.closeModal();utils.toast('Page created!','success');AdminPages.pagesEditor();}catch(ex){utils.toast(ex.message,'error');utils.loading(btn,false);}};
};
