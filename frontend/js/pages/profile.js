// pages/profile.js — Edit Profile + Change Password
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
          <div><label class="input-label">Full Name</label><input name="full_name" type="text" value="${u.full_name||''}" class="input-field"></div>
          <div><label class="input-label">Email</label><input type="email" value="${u.email||''}" class="input-field bg-gray-50" readonly disabled></div>
          <div><label class="input-label">Username</label><input type="text" value="${u.username||''}" class="input-field bg-gray-50" readonly disabled></div>
          <div><label class="input-label">Phone</label><input name="phone" type="tel" value="${u.phone||''}" class="input-field"></div>
          <div id="profile-err" class="alert-danger hidden"></div>
          <button type="submit" id="profile-btn" class="btn-primary">Save Changes</button>
        </form>
      </div></div>`,'Edit Profile','');
    document.getElementById('profile-form').onsubmit=async(e)=>{
      e.preventDefault();const f=e.target,err=document.getElementById('profile-err'),btn=document.getElementById('profile-btn');
      err.classList.add('hidden');utils.loading(btn,true);
      try{await api.updateProfile({full_name:f.full_name.value,phone:f.phone.value});utils.toast('Profile updated!','success');const me2=await api.getMe();App.state.user=me2.user;}
      catch(ex){err.textContent=ex.message;err.classList.remove('hidden');}
      utils.loading(btn,false);
    };
  }catch(e){document.getElementById('app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
Pages._uploadPhoto=async function(input){
  const file=input.files[0];if(!file)return;
  const form=new FormData();form.append('photo',file);
  try{const r=await api.upload('/api/user/profile-photo',form);document.getElementById('avatar-preview').innerHTML=`<img src="${r.url}" class="w-16 h-16 rounded-full object-cover mx-auto">`;utils.toast('Photo updated!','success');const me=await api.getMe();App.state.user=me.user;}
  catch(e){utils.toast(e.message,'error');}
};
Pages._removePhoto=async function(){
  try{await api.request('DELETE','/api/user/profile-photo');document.getElementById('avatar-preview').innerHTML=utils.avatar(App.state.user?.full_name||'',null,72);utils.toast('Photo removed','success');}
  catch(e){utils.toast(e.message,'error');}
};
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
      <p class="text-sm text-gray-400 mb-3">Request a one-time OTP from Admin. The admin will send you an 8-digit OTP — enter that OTP as your Current Password above to set a new password.</p>
      <form id="fp-form" class="space-y-4">
        <div><label class="input-label">Email</label><input name="email" type="email" value="${u.email||''}" class="input-field bg-gray-50" readonly></div>
        <div><label class="input-label">Contact (phone / WhatsApp / Telegram)</label><input name="contact" type="text" value="${u.phone||''}" class="input-field" required maxlength="100" placeholder="How can admin reach you?"></div>
        <div><label class="input-label">Message (optional)</label><textarea name="message" class="input-field" maxlength="1000" rows="2" placeholder="I forgot my current password, please send an OTP."></textarea></div>
        <div id="fp-err" class="alert-danger hidden"></div>
        <div id="fp-ok" class="hidden" style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:12px;padding:12px;font-size:13px;color:#065F46"></div>
        <button type="submit" id="fp-btn" class="btn-primary">Send Request to Admin</button>
      </form>
    </div></div>`,'Change Password','');
  document.getElementById('fp-form').onsubmit=async(e)=>{
    e.preventDefault();const f=e.target,err=document.getElementById('fp-err'),ok=document.getElementById('fp-ok'),btn=document.getElementById('fp-btn');
    err.classList.add('hidden');ok.classList.add('hidden');utils.loading(btn,true);
    try{await api.forgetRequest({email:f.email.value,contact:f.contact.value,message:f.message.value});ok.textContent='Request sent! Admin will send you a one-time OTP. Enter that OTP as your Current Password above, then set your new password.';ok.classList.remove('hidden');f.reset();}
    catch(ex){err.textContent=ex.message;err.classList.remove('hidden');}
    utils.loading(btn,false);
  };
  document.getElementById('cpw-form').onsubmit=async(e)=>{
    e.preventDefault();const f=e.target,err=document.getElementById('cpw-err'),btn=document.getElementById('cpw-btn');
    if(f.new_password.value!==f.confirm_password.value){err.textContent='Passwords do not match';err.classList.remove('hidden');return;}
    err.classList.add('hidden');utils.loading(btn,true);
    try{await api.changePassword({current_password:f.current_password.value,new_password:f.new_password.value});utils.toast('Password changed successfully','success');f.reset();}
    catch(ex){err.textContent=ex.message;err.classList.remove('hidden');}
    utils.loading(btn,false);
  };
};
Pages._toggleForgot=function(){const s=document.getElementById('fp-section');if(s)s.classList.toggle('hidden');};
