/*
 * pages/profile.js — Edit Profile + Change Password.
 * Edit Profile: change full name, username and profile photo directly.
 * Email and phone change only through an admin-approved request:
 * the user asks, the admin approves, then the new value applies.
 * Change Password: set a new password (minimum 8 characters). Users
 * who logged in with a one-time OTP enter that OTP as the current
 * password; a forgotten password is handled by requesting an 8-digit
 * OTP from the admin (no email/SMTP reset flow).
 * Key functions:
 * - Pages.editProfile() renders the form (GET /api/user/me).
 * - Pages._uploadPhoto() / Pages._removePhoto() manage the photo.
 * - Pages.changePassword() renders the password + forgot-password forms.
 * - Pages._toggleForgot() shows or hides the forgot-password section.
 * Rules / gotchas:
 * - Money is integer cents everywhere; display with utils.fmtMoney.
 * - Balances come from GET /api/user/me; showcase accounts
 *   (is_showcase=1) show DISPLAY balances set by the admin.
 * - The ?v= cache version in script tags must be bumped on every
 *   release or browsers may serve stale code.
 */
// Renders the Edit Profile page: avatar with Change / Remove Photo,
// plus full name + username (editable), email + phone (read-only, change
// by admin-approved request) and the user's pending requests.
// API: api.getMe(). Saving calls api.updateProfile(); requests call
// api.requestProfileChange(); pending list is api.getProfileChangeRequests().
Pages.editProfile=async function(){
  try{
    const me=await api.getMe();const u=me.user;
    Components.layout(`<div class="max-w-xl">
      <div class="card mb-4 text-center">
        <div class="flex justify-center mb-3" id="avatar-preview">${utils.avatar(u.full_name,u.profile_photo,72)}</div>
        <div class="font-bold text-lg">${u.full_name}</div><div class="text-gray-400 text-sm">@${u.username}</div>
        <div class="flex justify-center gap-3 mt-4">
          <label class="btn-secondary text-sm cursor-pointer" style="padding:8px 16px">Change Photo<input type="file" accept="image/*" class="hidden" onchange="Pages._uploadPhoto(this)"></label>
          <button onclick="Pages._removePhoto()" class="btn-danger text-sm" style="padding:8px 16px">Remove Photo</button>
        </div>
      </div>
      <div class="card">
        <h2 class="font-bold mb-4">Edit Profile</h2>
        <form id="profile-form" class="space-y-4">
          <div><label class="input-label">Full Name</label><input name="full_name" type="text" value="${u.full_name||''}" class="input-field" required></div>
          <div><label class="input-label">Username</label><input name="username" type="text" value="${u.username||''}" class="input-field" required><p class="text-xs text-gray-400 mt-1">If another user already uses it, you'll see "Username already taken".</p></div>
          <div><label class="input-label">Email</label><div class="flex gap-2"><input type="email" value="${u.email||''}" class="input-field bg-gray-50 flex-1" readonly disabled><button type="button" onclick="Pages._toggleReq('email')" class="btn-secondary text-sm" style="padding:8px 12px;white-space:nowrap">Request Change</button></div></div>
          <div id="req-email" class="hidden" style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:12px;padding:12px"><label class="input-label">New Email</label><input id="req-email-val" type="email" class="input-field" placeholder="new@email.com"><div id="req-email-err" class="alert-danger hidden mt-2"></div><button type="button" onclick="Pages._sendReq('email')" class="btn-primary text-sm mt-2" style="width:auto;padding:8px 16px">Send Request to Nexora FX</button><p class="text-xs text-gray-400 mt-2">Nexora FX approves it first — your email changes only after approval.</p></div>
          <div><label class="input-label">Phone</label><div class="flex gap-2"><input type="tel" value="${u.phone||''}" class="input-field bg-gray-50 flex-1" readonly disabled><button type="button" onclick="Pages._toggleReq('phone')" class="btn-secondary text-sm" style="padding:8px 12px;white-space:nowrap">Request Change</button></div></div>
          <div id="req-phone" class="hidden" style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:12px;padding:12px"><label class="input-label">New Phone</label><div class="flex gap-2"><select id="req-phone-cc" class="input-field" style="width:110px"><option value="+44">+44 UK</option><option value="+1">+1 US</option><option value="+880">+880 BD</option><option value="+91">+91 IN</option><option value="+92">+92 PK</option></select><input id="req-phone-val" type="tel" class="input-field flex-1" placeholder="Phone number"></div><div id="req-phone-err" class="alert-danger hidden mt-2"></div><button type="button" onclick="Pages._sendReq('phone')" class="btn-primary text-sm mt-2" style="width:auto;padding:8px 16px">Send Request to Nexora FX</button><p class="text-xs text-gray-400 mt-2">Nexora FX approves it first — your phone changes only after approval.</p></div>
          <div id="profile-err" class="alert-danger hidden"></div>
          <button type="submit" id="profile-btn" class="btn-primary">Save Changes</button>
        </form>
      </div>
      <div class="card" id="req-list-card"><h2 class="font-bold mb-3">My Change Requests</h2><div id="req-list" class="text-sm text-gray-400">Loading…</div></div></div>`,'Edit Profile','');
// Profile form submit: saves full name + username, then refreshes
// App.state.user so the header shows the new name immediately.
// "Username already taken" comes from the server when another user
// already uses the name.
    document.getElementById('profile-form').onsubmit=async(e)=>{
      e.preventDefault();const f=e.target,err=document.getElementById('profile-err'),btn=document.getElementById('profile-btn');
      err.classList.add('hidden');utils.loading(btn,true);
      try{await api.updateProfile({full_name:f.full_name.value,username:f.username.value});utils.toast('Profile updated!','success');const me2=await api.getMe();App.state.user=me2.user;}
      catch(ex){err.textContent=ex.message;err.classList.remove('hidden');if(ex.suggestion){err.innerHTML=ex.message+' &mdash; Try: <button type="button" class="text-orange-500 font-semibold" onclick="Pages._useProfileUsername(\''+ex.suggestion+'\')">'+ex.suggestion+'</button>';}}
      utils.loading(btn,false);
    };
    Pages._loadReqList();
  }catch(e){document.getElementById('app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
// Fills the profile username field with a suggested name.
Pages._useProfileUsername=function(u){const el=document.querySelector('#profile-form [name="username"]');if(el)el.value=u;const e2=document.getElementById('profile-err');if(e2)e2.classList.add('hidden');};
// Shows or hides one of the email/phone request forms.
Pages._toggleReq=function(which){const el=document.getElementById('req-'+which);if(el)el.classList.toggle('hidden');};
// Sends an email/phone change request to the admin.
// API: api.requestProfileChange(). The value applies only after approval.
Pages._sendReq=async function(which){
  const err=document.getElementById('req-'+which+'-err');
  const val=which==='email'?document.getElementById('req-email-val').value.trim():document.getElementById('req-phone-val').value.trim();
  const cc=which==='phone'?document.getElementById('req-phone-cc').value:null;
  err.classList.add('hidden');
  if(!val){err.textContent='Please enter the new '+(which==='email'?'email':'phone number');err.classList.remove('hidden');return;}
  try{const r=await api.requestProfileChange({field:which,new_value:val,country_code:cc});utils.toast(r.message||'Request sent to Nexora FX','success');Pages._loadReqList();}
  catch(ex){err.textContent=ex.message;err.classList.remove('hidden');}
};
// Loads the user's own change requests into the list below the form.
Pages._loadReqList=async function(){
  const box=document.getElementById('req-list');if(!box)return;
  try{
    const rows=await api.getProfileChangeRequests();
    if(!rows.length){box.textContent='No requests yet.';return;}
    box.innerHTML=rows.map(r=>`<div style="display:flex;justify-content:space-between;gap:8px;padding:8px 0;border-top:1px solid var(--border)"><span>${r.field==='email'?'Email':'Phone'} → <strong>${r.new_value}</strong></span><span>${utils.statusBadge(r.status)}</span></div>`).join('');
  }catch(e){box.textContent='Could not load requests.';}
};
// Uploads a new profile photo (multipart form, field name 'photo').
// API: POST /api/user/profile-photo. Refreshes App.state.user after.
Pages._uploadPhoto=async function(input){
  const file=input.files[0];if(!file)return;
  const form=new FormData();form.append('photo',file);
  try{const r=await api.upload('/api/user/profile-photo',form);document.getElementById('avatar-preview').innerHTML=`<img src="${r.url}" class="w-16 h-16 rounded-full object-cover mx-auto">`;utils.toast('Photo updated!','success');const me=await api.getMe();App.state.user=me.user;}
  catch(e){utils.toast(e.message,'error');}
};
// Removes the profile photo. API: DELETE /api/user/profile-photo.
// Falls back to the initials avatar afterwards.
Pages._removePhoto=async function(){
  try{await api.request('DELETE','/api/user/profile-photo');document.getElementById('avatar-preview').innerHTML=utils.avatar(App.state.user?.full_name||'',null,72);utils.toast('Photo removed','success');}
  catch(e){utils.toast(e.message,'error');}
};
// Renders the Change Password page, including the hidden
// forgot-password section (request an OTP from the admin).
// No API call on render; the forms submit on user action.
Pages.changePassword=function(){
  const u=App.state.user||{};
  Components.layout(`<div class="max-w-md card">
    <h2 class="font-bold mb-4">Change Password</h2>
    <p class="text-sm text-gray-400 mb-4">If you logged in with a one-time OTP, enter that OTP as your Current Password.</p>
    <form id="cpw-form" class="space-y-4">
      <div><label class="input-label">Current Password</label><input name="current_password" type="password" class="input-field" required></div>
      <div><label class="input-label">New Password</label><input name="new_password" type="password" class="input-field" required minlength="8"></div>
      <div><label class="input-label">Confirm New Password</label><input name="confirm_password" type="password" class="input-field" required></div>
      <div id="cpw-err" class="alert-danger hidden"></div>
      <button type="submit" id="cpw-btn" class="btn-primary">Change Password</button>
    </form>
    <div class="text-center mt-4"><button onclick="Pages._toggleForgot()" class="text-sm font-semibold" style="color:var(--orange);background:none;border:none;cursor:pointer;font-family:inherit">Forgot your current password?</button></div>
    <div id="fp-section" class="hidden mt-4" style="border-top:1px solid var(--border);padding-top:16px">
      <h3 class="font-bold mb-2">Forgot Password</h3>
      <p class="text-sm text-gray-400 mb-3">Request a one-time OTP from Nexora FX. Nexora FX will send you an 8-digit OTP — enter that OTP as your Current Password above to set a new password.</p>
      <form id="fp-form" class="space-y-4">
        <div><label class="input-label">Email</label><input name="email" type="email" value="${u.email||''}" class="input-field bg-gray-50" readonly></div>
        <div><label class="input-label">Contact (phone / WhatsApp / Telegram)</label><input name="contact" type="text" value="${u.phone||''}" class="input-field" required maxlength="100" placeholder="How can Nexora FX reach you?"></div>
        <div><label class="input-label">Message (optional)</label><textarea name="message" class="input-field" maxlength="1000" rows="2" placeholder="I forgot my current password, please send an OTP."></textarea></div>
        <div id="fp-err" class="alert-danger hidden"></div>
        <div id="fp-ok" class="hidden" style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:12px;padding:12px;font-size:13px;color:#065F46"></div>
        <button type="submit" id="fp-btn" class="btn-primary">Send Request to Nexora FX</button>
      </form>
    </div></div>`,'Change Password','');
// Forgot-password form submit: asks the admin for a one-time OTP.
// API: api.forgetRequest(). The OTP is then used as Current Password above.
  document.getElementById('fp-form').onsubmit=async(e)=>{
    e.preventDefault();const f=e.target,err=document.getElementById('fp-err'),ok=document.getElementById('fp-ok'),btn=document.getElementById('fp-btn');
    err.classList.add('hidden');ok.classList.add('hidden');utils.loading(btn,true);
    try{await api.forgetRequest({email:f.email.value,contact:f.contact.value,message:f.message.value});ok.textContent='Request sent! Nexora FX will send you a one-time OTP. Enter that OTP as your Current Password above, then set your new password.';ok.classList.remove('hidden');f.reset();}
    catch(ex){err.textContent=ex.message;err.classList.remove('hidden');}
    utils.loading(btn,false);
  };
// Change-password form submit. The new password must match its
// confirmation; the check below runs before any API call.
// API: api.changePassword().
  document.getElementById('cpw-form').onsubmit=async(e)=>{
    e.preventDefault();const f=e.target,err=document.getElementById('cpw-err'),btn=document.getElementById('cpw-btn');
    if(f.new_password.value!==f.confirm_password.value){err.textContent='Passwords do not match';err.classList.remove('hidden');return;}
    err.classList.add('hidden');utils.loading(btn,true);
    try{await api.changePassword({current_password:f.current_password.value,new_password:f.new_password.value});utils.toast('Password changed successfully','success');f.reset();}
    catch(ex){err.textContent=ex.message;err.classList.remove('hidden');}
    utils.loading(btn,false);
  };
};
// Shows or hides the forgot-password section on the Change Password page.
Pages._toggleForgot=function(){const s=document.getElementById('fp-section');if(s)s.classList.toggle('hidden');};
