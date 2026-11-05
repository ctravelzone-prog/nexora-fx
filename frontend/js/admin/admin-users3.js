// admin-users3.js — Showcase Accounts
AdminPages.showcase=async function(){
  try{
    const users=await adminApi.getShowcaseUsers();
    AdminComponents.layout(`<div class="flex items-center justify-between mb-4"><h2 class="font-bold text-lg">Showcase Accounts</h2><button onclick="AdminPages._newShowcase()" class="btn-primary text-sm" style="width:auto;padding:10px 16px">+ Create Showcase</button></div>
    <p class="text-sm text-gray-400 mb-4">Showcase accounts are excluded from all admin totals, ledger totals, reports, and Profit System. Real accounts and showcase accounts are never mixed.</p>
    <div class="overflow-x-auto"><table class="data-table"><thead><tr><th>Name</th><th>Username</th><th>Display Main</th><th>Display Copy</th><th>Display Profit</th></tr></thead><tbody>
      ${users.map(u=>`<tr><td>${u.full_name} <span class="badge badge-gray text-xs">SHOWCASE</span></td><td>@${u.username}</td><td>${utils.fmtMoney(u.showcase_main_cents||0)}</td><td>${utils.fmtMoney(u.showcase_copy_cents||0)}</td><td>${utils.fmtMoney(u.showcase_profit_cents||0)}</td></tr>`).join('')}
      ${users.length===0?'<tr><td colspan="5" class="text-center py-8 text-gray-400">No showcase accounts yet</td></tr>':''}
    </tbody></table></div>`,'Showcase Accounts');
  }catch(e){document.getElementById('admin-app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
AdminPages._newShowcase=function(){
  utils.showModal(`<div class="modal"><h2 class="font-bold mb-4">Create Showcase Account</h2>
  <form id="sc-form" class="space-y-3">
    <div><label class="input-label">Full Name</label><input name="full_name" type="text" class="input-field" required></div>
    <div><label class="input-label">Username</label><input name="username" type="text" class="input-field" required></div>
    <div><label class="input-label">Email</label><input name="email" type="email" class="input-field" required></div>
    <div><label class="input-label">Password (min 8 chars)</label><input name="password" type="password" class="input-field" required minlength="8"></div>
    <div class="grid grid-cols-3 gap-2">
      <div><label class="input-label">Display Main</label><input name="main" type="number" class="input-field" placeholder="0"></div>
      <div><label class="input-label">Display Copy</label><input name="copy" type="number" class="input-field" placeholder="0"></div>
      <div><label class="input-label">Display Profit</label><input name="profit" type="number" class="input-field" placeholder="0"></div>
    </div>
    <div id="sc-e" class="alert-danger hidden"></div>
    <div class="flex gap-3"><button type="button" onclick="utils.closeModal()" class="btn-secondary flex-1">Cancel</button><button type="submit" class="btn-primary flex-1">Create</button></div>
  </form></div>`);
  document.getElementById('sc-form').onsubmit=async(e)=>{
    e.preventDefault();const f=e.target,err=document.getElementById('sc-e');
    try{
      await adminApi.createShowcase({full_name:f.full_name.value,username:f.username.value,email:f.email.value,password:f.password.value,main_cents:Math.round((parseFloat(f.main.value)||0)*100),copy_cents:Math.round((parseFloat(f.copy.value)||0)*100),profit_cents:Math.round((parseFloat(f.profit.value)||0)*100)});
      utils.closeModal();utils.toast('Showcase account created!','success');AdminPages.showcase();
    }catch(ex){err.textContent=ex.message;err.classList.remove('hidden');}
  };
};
