/*
 * admin-profile.js — My Profile page (v99).
 *
 * Renders /admin/profile: opened by clicking the avatar in the top bar.
 * Three things here:
 *  - Profile photo: upload a new picture (max 5 MB) or remove it. The
 *    header avatar shows the picture when one is set, else the initial.
 *  - Name + login email: the name is the display name shown in the
 *    panel; the email is the login username. Changing the email requires
 *    the current password (and the new email must be free).
 *  - Change password: the existing POST /api/admin/auth/change-password
 *    (current password required, new password min 8 chars).
 * Key functions: AdminPages.profile, AdminPages._saveAdminProfile,
 * AdminPages._saveAdminPassword, AdminPages._uploadAdminPhoto,
 * AdminPages._removeAdminPhoto.
 * Gotchas:
 * - After any save, AdminApp.state.admin is reloaded from /me and the
 *   page re-renders, so the header avatar updates right away.
 * - Admin API calls go through adminApi in js/admin-api.js.
 * - Bump the ?v= cache version in script tags on every release, or
 *   browsers keep serving stale code.
 */
// Renders /admin/profile: photo + name/email + change password.
AdminPages.profile=async function(){
  const a=AdminApp.state.admin||{};
  const esc=v=>String(v||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  AdminComponents.layout(`<h2 class="font-bold text-lg mb-4">My Profile</h2>
  <div class="grid gap-4" style="max-width:640px">
    <div class="card w-full">
      <h3 class="font-bold mb-4">Profile</h3>
      <div class="flex items-center gap-4 mb-4">
        <div id="admin-avatar-preview">${utils.avatar(a.name||a.email||'Admin',a.profile_pic||null,72)}</div>
        <div class="flex flex-col gap-2">
          <button type="button" class="btn-secondary text-sm" style="padding:8px 14px" onclick="document.getElementById('admin-photo-input').click()">Change photo</button>
          ${a.profile_pic?`<button type="button" class="btn-secondary text-sm" style="padding:8px 14px" onclick="AdminPages._removeAdminPhoto()">Remove photo</button>`:''}
          <input type="file" id="admin-photo-input" accept="image/*" class="hidden" onchange="AdminPages._uploadAdminPhoto(this)">
          <span class="text-xs text-gray-400">JPG or PNG, max 5 MB</span>
        </div>
      </div>
      <form id="admin-profile-form" class="space-y-4" onsubmit="event.preventDefault();AdminPages._saveAdminProfile()">
        <div><label class="input-label">Display name</label><input id="ap-name" type="text" class="input-field" required maxlength="50" value="${esc(a.name||'Admin')}"></div>
        <div><label class="input-label">Login email (username)</label><input id="ap-email" type="email" class="input-field" required value="${esc(a.email||'')}"></div>
        <div><label class="input-label">Current password <span class="text-gray-400 font-normal">(only needed if you change the email)</span></label><input id="ap-current" type="password" class="input-field" autocomplete="current-password" placeholder="Required to change email"></div>
        <div id="ap-err" class="alert-danger hidden"></div>
        <button type="submit" id="ap-btn" class="btn-primary">Save profile</button>
      </form>
    </div>
    <div class="card w-full">
      <h3 class="font-bold mb-4">Change password</h3>
      <form id="admin-password-form" class="space-y-4" onsubmit="event.preventDefault();AdminPages._saveAdminPassword()">
        <div><label class="input-label">Current password</label><input id="apw-current" type="password" class="input-field" required autocomplete="current-password"></div>
        <div><label class="input-label">New password</label><input id="apw-new" type="password" class="input-field" required minlength="8" autocomplete="new-password" placeholder="At least 8 characters"></div>
        <div><label class="input-label">Confirm new password</label><input id="apw-confirm" type="password" class="input-field" required autocomplete="new-password"></div>
        <div id="apw-err" class="alert-danger hidden"></div>
        <button type="submit" id="apw-btn" class="btn-primary">Change password</button>
      </form>
    </div>
  </div>`,'My Profile');
};

// Saves the name + login email. Email change needs the current password.
AdminPages._saveAdminProfile=async function(){
  const btn=document.getElementById('ap-btn');const err=document.getElementById('ap-err');
  err.classList.add('hidden');btn.disabled=true;btn.textContent='Saving...';
  try{
    const r=await adminApi.updateProfile({name:document.getElementById('ap-name').value.trim(),email:document.getElementById('ap-email').value.trim(),current_password:document.getElementById('ap-current').value});
    AdminApp.state.admin=r.admin||await adminApi.me();
    utils.toast('Profile saved','success');
    AdminPages.profile();
  }catch(e){err.textContent=e.message;err.classList.remove('hidden');btn.disabled=false;btn.textContent='Save profile';}
};

// Changes the admin password (current password required).
AdminPages._saveAdminPassword=async function(){
  const btn=document.getElementById('apw-btn');const err=document.getElementById('apw-err');
  err.classList.add('hidden');btn.disabled=true;btn.textContent='Saving...';
  try{
    await adminApi.changePassword({current_password:document.getElementById('apw-current').value,new_password:document.getElementById('apw-new').value,confirm_password:document.getElementById('apw-confirm').value});
    utils.toast('Password changed','success');
    document.getElementById('admin-password-form').reset();
    btn.disabled=false;btn.textContent='Change password';
  }catch(e){err.textContent=e.message;err.classList.remove('hidden');btn.disabled=false;btn.textContent='Change password';}
};

// Uploads a new profile photo (max 5 MB) and refreshes the header avatar.
AdminPages._uploadAdminPhoto=async function(input){
  if(!input.files||!input.files[0]) return;
  const form=new FormData();form.append('photo',input.files[0]);
  try{
    const r=await adminApi.uploadProfilePhoto(form);
    AdminApp.state.admin=await adminApi.me();
    utils.toast('Photo updated!','success');
    AdminPages.profile();
  }catch(e){utils.toast(e.message,'error');}
  input.value='';
};

// Removes the profile photo (back to the initial letter).
AdminPages._removeAdminPhoto=async function(){
  try{
    await adminApi.deleteProfilePhoto();
    AdminApp.state.admin=await adminApi.me();
    utils.toast('Photo removed','success');
    AdminPages.profile();
  }catch(e){utils.toast(e.message,'error');}
};
