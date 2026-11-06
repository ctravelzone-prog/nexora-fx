/*
 * auth.js — Authentication pages for Nexora FX.
 *
 * Renders the register, login, forgot-password, reset-password and
 * email-verification screens, and wires up their forms.
 *
 * Key pages:
 * - Pages.register — calls api.register; requires Terms acceptance,
 *   matching passwords and a minimum of 8 characters.
 * - Pages.login — calls api.login; supports an optional 2FA authenticator
 *   code, forced password change, and a saved redirect destination.
 * - Pages.forgotPassword — reset with an authenticator code, or message
 *   the admin for a 24-hour one-time OTP (no email/SMTP reset link).
 * - Pages.resetPassword — sets a new password from a reset link token.
 * - Pages.verifyEmail — confirms an email verification token.
 *
 * Gotcha: the ?v= cache version in script tags must be bumped on every
 * release, or browsers may serve stale code.
 */
// Toggle password visibility for the input next to the clicked button.
Pages._pw=function(btn){const i=btn.previousElementSibling;if(i)i.type=i.type==='password'?'text':'password';};

// Register page. Validates the form, then calls api.register.
Pages.register=function(){
  document.getElementById('app').innerHTML=Templates.register();
  // Referral link: /register?ref=CODE — auto-fill the referral field so
  // the referrer gets counted (a bare link visit left it empty before).
  try{
    const refCode=new URLSearchParams(window.location.search).get('ref')||new URLSearchParams(window.location.search).get('referral_code');
    if(refCode){const el=document.querySelector('#reg-form [name="ref"]');if(el)el.value=refCode;}
  }catch(e){}
  // Live username check: only a-z, 0-9, - and _ are allowed. While the
  // name is invalid, fetch a free suggestion and show it as a button.
  const _uname=document.querySelector('#reg-form [name="username"]');
  const _sugBox=document.getElementById('reg-user-suggest');
  let _sugTimer=null;
  if(_uname&&_sugBox){
    _uname.addEventListener('input',()=>{
      clearTimeout(_sugTimer);
      const v=_uname.value;
      if(!v||/^[a-z0-9_-]+$/.test(v)){_sugBox.classList.add('hidden');_sugBox.innerHTML='';return;}
      _sugTimer=setTimeout(async()=>{
        try{
          const d=await api.suggestUsername(v);
          if(!d.suggestions||!d.suggestions.length) return;
          _sugBox.innerHTML='Try: '+d.suggestions.map(s=>`<button type="button" class="text-orange-500 font-semibold" onclick="Pages._useUsername('${s}')">${s}</button>`).join(' &middot; ');
          _sugBox.classList.remove('hidden');
        }catch(e){}
      },300);
    });
  }
  document.getElementById('reg-form').onsubmit=async(e)=>{
    e.preventDefault();const f=e.target,err=document.getElementById('reg-err');err.classList.add('hidden');
    if(!document.getElementById('terms-ck').checked){err.textContent='Please accept Terms & Condition';err.classList.remove('hidden');return;}
    if(f.password.value!==f.cpw.value){err.textContent='Passwords do not match';err.classList.remove('hidden');return;}
    if(f.password.value.length<8){err.textContent='Password must be at least 8 characters';err.classList.remove('hidden');return;}
    const btn=document.getElementById('reg-btn');utils.loading(btn,true);
    try{
      await api.register({full_name:f.full_name.value,username:f.username.value,email:f.email.value,phone:f.phone.value,country_code:f.country_code.value,password:f.password.value,referral_code:f.ref.value});
      utils.toast('Registration successful! Please check your email.','success');
      App.navigate('/login');
    }catch(ex){err.textContent=ex.message;err.classList.remove('hidden');if(ex.suggestion){err.innerHTML=ex.message+' &mdash; Try: <button type="button" class="text-orange-500 font-semibold" onclick="Pages._useUsername(\''+ex.suggestion+'\')">'+ex.suggestion+'</button>';}}
    utils.loading(btn,false);
  };
};
// Fills the register username field with a suggested name.
Pages._useUsername=function(u){const el=document.querySelector('#reg-form [name="username"]');if(el)el.value=u;const b=document.getElementById('reg-user-suggest');if(b){b.classList.add('hidden');b.innerHTML='';}};

// Login page. Calls api.login, handles 2FA, forced password change,
// then loads the balance and redirects to the saved destination.
Pages.login=function(){
  document.getElementById('app').innerHTML=Templates.login();
  document.getElementById('login-form').onsubmit=async(e)=>{
    e.preventDefault();
    const f=e.target,err=document.getElementById('login-err');
    err.classList.add('hidden');
    const btn=document.getElementById('login-btn');
    utils.loading(btn,true);
    try{
      const d=await api.login({username:f.username.value,password:f.password.value,totp_code:f.totp_code?.value||undefined});
      // Login succeeded but 2FA is required: reveal the code row.
      if(d.require_2fa){
        document.getElementById('login-2fa').classList.remove('hidden');
        document.getElementById('login-hint').textContent='Enter your 6-digit authenticator code.';
        if(Pages._initCodeRow){
          Pages._initCodeRow('login-code-row');
          document.getElementById('login-code-row').addEventListener('input',()=>{
            const h=document.getElementById('totp_hidden');if(h)h.value=Pages._getCode('login-code-row');
          });
        }
        utils.loading(btn,false);
        return;
      }
      api.setToken(d.token);
      document.getElementById('impersonation-banner')?.remove(); // normal login is never an impersonation
      App.state.user=d.user;
      // One-time temporary password: force the user to set a new one.
      if(d.force_password_change){
        utils.toast('Please set a new permanent password.','info');
        App.navigate('/change-password');
        return;
      }
      // Load balance
      try{const me=await api.getMe();App.state.balance=me.balance;App.state.user=me.user;}catch(e2){}
      // Redirect to saved destination or dashboard
      const redirect=sessionStorage.getItem('nx_redirect')||'/dashboard';
      sessionStorage.removeItem('nx_redirect');
      App.navigate(redirect);
    }catch(ex){
      err.textContent=ex.message;
      err.classList.remove('hidden');
    }
    utils.loading(btn,false);
  };
};

// Switch the forgot-password screen between the authenticator-code
// option and the message-admin option.
Pages._showFpOpt=function(which){
  const a=document.getElementById('fp-auth-section'),m=document.getElementById('fp-msg-section');
  if(a)a.style.display=which==='auth'?'block':'none';
  if(m)m.style.display=which==='msg'?'block':'none';
  const ab=document.getElementById('fp-opt-auth'),mb=document.getElementById('fp-opt-msg');
  if(ab)ab.className=which==='auth'?'btn-primary':'btn-secondary';
  if(mb)mb.className=which==='msg'?'btn-primary':'btn-secondary';
};
// Forgot-password page. Offers two reset paths: authenticator code
// (api.resetViaAuthenticator, then api.resetPassword) or a message to
// the admin (api.forgetRequest) for a 24-hour one-time OTP.
Pages.forgotPassword=function(){
  document.getElementById('app').innerHTML=Components.topbarPublic('')
    +'<div class="min-h-screen bg-gray-50 flex items-center justify-center p-4">'
    +'<div class="w-full max-w-sm space-y-4">'
    +'<div class="bg-white rounded-2xl shadow-sm p-8">'
    +'<h1 class="text-2xl font-bold mb-2">Forgot Password</h1>'
    +'<p class="text-gray-400 text-sm mb-4">Choose how you want to reset your password:</p>'
    +'<div class="space-y-3">'
    +'<button type="button" id="fp-opt-auth" class="btn-primary" style="width:100%" onclick="Pages._showFpOpt(\'auth\')">1. Reset with Authenticator Code</button>'
    +'<button type="button" id="fp-opt-msg" class="btn-secondary" style="width:100%" onclick="Pages._showFpOpt(\'msg\')">2. Message Admin for Help</button>'
    +'</div>'
    +'<p class="text-center text-sm mt-4"><a href="/login" class="text-orange-500">Back to Login</a></p>'
    +'</div>'
    +'<div id="fp-auth-section" class="bg-white rounded-2xl shadow-sm p-8">'
    +'<h2 class="text-lg font-bold mb-2">Authenticator Code</h2>'
    +'<p class="text-gray-400 text-sm mb-4">Open your authenticator app and enter the 6-digit code. This works only if you enabled authenticator before.</p>'
    +'<form id="fp-auth-form" class="space-y-4">'
    +'<div><label class="input-label">Username or Email</label><input name="account" type="text" class="input-field" placeholder="Your username or email" required></div>'
    +'<div><label class="input-label">Authenticator Code</label><input name="code" type="text" class="input-field" placeholder="6-digit code" required></div>'
    +'<div id="fp-auth-msg" class="hidden"></div>'
    +'<button type="submit" id="fp-auth-btn" class="btn-primary">Verify Code</button>'
    +'</form>'
    +'<form id="fp-newpw-form" class="space-y-4" style="display:none">'
    +'<div><label class="input-label">New Password</label><input name="password" type="password" class="input-field" required minlength="8"></div>'
    +'<div><label class="input-label">Confirm New Password</label><input name="confirm_password" type="password" class="input-field" required></div>'
    +'<div id="fp-newpw-msg" class="hidden"></div>'
    +'<button type="submit" id="fp-newpw-btn" class="btn-primary">Set New Password</button>'
    +'</form>'
    +'</div>'
    +'<div id="fp-msg-section" class="bg-white rounded-2xl shadow-sm p-8" style="display:none">'
    +'<h2 class="text-lg font-bold mb-2">Message Admin for Help</h2>'
    +'<p class="text-gray-400 text-sm mb-4">Admin will contact you, verify you, and send a 24-hour one-time OTP. Use that OTP to log in and set a new password.</p>'
    +'<form id="fp-msg-form" class="space-y-4">'
    +'<div><label class="input-label">Email</label><input name="email" type="email" class="input-field" placeholder="Your registered email" required></div>'
    +'<div><label class="input-label">Contact (Telegram / WhatsApp)</label><input name="contact" type="text" class="input-field" placeholder="Where can admin reach you?" required></div>'
    +'<div><label class="input-label">Message (optional)</label><textarea name="message" class="input-field" rows="3" placeholder="Write anything that helps admin verify you..."></textarea></div>'
    +'<input name="website" type="text" style="display:none" tabindex="-1" autocomplete="off">'
    +'<div id="fp-msg-result" class="hidden"></div>'
    +'<button type="submit" id="fp-msg-btn" class="btn-primary">Send Message to Admin</button>'
    +'</form></div>'
    +'</div></div>';
  Pages._fpResetToken=null;
  document.getElementById('fp-auth-form').onsubmit=async(e)=>{
    e.preventDefault();const f=e.target,btn=document.getElementById('fp-auth-btn'),msg=document.getElementById('fp-auth-msg');utils.loading(btn,true);
    try{const r=await api.resetViaAuthenticator({account:f.account.value,code:f.code.value});Pages._fpResetToken=r.reset_token;document.getElementById('fp-auth-form').style.display='none';document.getElementById('fp-newpw-form').style.display='block';msg.className='hidden';}
    catch(ex){msg.className='alert-danger';msg.textContent=ex.message;msg.classList.remove('hidden');}
    utils.loading(btn,false);
  };
  document.getElementById('fp-newpw-form').onsubmit=async(e)=>{
    e.preventDefault();const f=e.target,btn=document.getElementById('fp-newpw-btn'),msg=document.getElementById('fp-newpw-msg');
    if(f.password.value!==f.confirm_password.value){msg.className='alert-danger';msg.textContent='Passwords do not match';msg.classList.remove('hidden');return;}
    utils.loading(btn,true);
    try{await api.resetPassword({token:Pages._fpResetToken,password:f.password.value});msg.className='alert-success';msg.textContent='Password changed successfully. You can now log in.';msg.classList.remove('hidden');document.getElementById('fp-newpw-form').style.display='none';}
    catch(ex){msg.className='alert-danger';msg.textContent=ex.message;msg.classList.remove('hidden');}
    utils.loading(btn,false);
  };
  document.getElementById('fp-msg-form').onsubmit=async(e)=>{
    e.preventDefault();const f=e.target,btn=document.getElementById('fp-msg-btn'),msg=document.getElementById('fp-msg-result');utils.loading(btn,true);
    try{const r=await api.forgetRequest({email:f.email.value,contact:f.contact.value,message:f.message.value,website:f.website.value});msg.className='alert-success';msg.textContent=r.already_pending?'Your request is already pending. Please wait for admin.':'Request sent to admin. Admin will contact you, verify you, and send a 24-hour one-time OTP.';msg.classList.remove('hidden');f.reset();}
    catch(ex){msg.className='alert-danger';msg.textContent=ex.message;msg.classList.remove('hidden');}
    utils.loading(btn,false);
  };
};

// Reset-password page. Reads the token from the argument or the URL,
// then calls api.resetPassword. No token means show forgot-password.
Pages.resetPassword=async function(token){
  const t=token||new URLSearchParams(window.location.search).get('token');
  if(!t){Pages.forgotPassword();return;}
  document.getElementById('app').innerHTML=Components.topbarPublic('')
    +'<div class="min-h-screen bg-gray-50 flex items-center justify-center p-4">'
    +'<div class="w-full max-w-sm space-y-4">'
    +'<div class="bg-white rounded-2xl shadow-sm p-8">'
    +'<h1 class="text-2xl font-bold mb-2">Reset Password</h1>'
    +'<p class="text-gray-400 text-sm mb-4">Enter your new password below.</p>'
    +'<form id="rp-form" class="space-y-4">'
    +'<div><label class="input-label">New Password</label><input name="password" type="password" class="input-field" required minlength="8"></div>'
    +'<div><label class="input-label">Confirm Password</label><input name="confirm_password" type="password" class="input-field" required minlength="8"></div>'
    +'<div id="rp-msg" class="hidden"></div>'
    +'<button type="submit" id="rp-btn" class="btn-primary">Reset Password</button>'
    +'</form>'
    +'<p class="text-center text-sm mt-4"><a href="/login" class="text-orange-500">Back to Login</a></p>'
    +'</div></div></div>';
  document.getElementById('rp-form').onsubmit=async(e)=>{
    e.preventDefault();const f=e.target,btn=document.getElementById('rp-btn'),msg=document.getElementById('rp-msg');
    if(f.password.value!==f.confirm_password.value){msg.className='alert-danger';msg.textContent='Passwords do not match';msg.classList.remove('hidden');return;}
    utils.loading(btn,true);
    try{await api.resetPassword({token:t,password:f.password.value});msg.className='alert-success';msg.textContent='Password changed successfully. You can now log in.';msg.classList.remove('hidden');document.getElementById('rp-form').style.display='none';}
    catch(ex){msg.className='alert-danger';msg.textContent=ex.message;msg.classList.remove('hidden');}
    utils.loading(btn,false);
  };
};

// Email-verification page. Calls api.verifyEmail with the token from
// the argument or the URL and shows a success or invalid-link screen.
Pages.verifyEmail=async function(token){
  document.getElementById('app').innerHTML='<div class="min-h-screen flex items-center justify-center"><div class="text-center p-8"><div class="spinner page-loader mx-auto mb-4"></div><p>Verifying email...</p></div></div>';
  const t=token||new URLSearchParams(window.location.search).get('token');
  try{
    await api.verifyEmail(t);
    document.getElementById('app').innerHTML='<div class="min-h-screen flex items-center justify-center"><div class="bg-white rounded-2xl p-8 shadow text-center max-w-sm"><div class="text-5xl mb-4">✓</div><h1 class="text-xl font-bold mb-2">Email Verified!</h1><p class="text-gray-500 mb-6">Your email has been verified. You can now sign in.</p><a href="/login" class="btn-primary" style="display:inline-block;width:auto;padding:10px 28px">Sign In</a></div></div>';
  }catch(ex){
    document.getElementById('app').innerHTML='<div class="min-h-screen flex items-center justify-center"><div class="bg-white rounded-2xl p-8 shadow text-center max-w-sm"><div class="text-5xl mb-4">✕</div><h1 class="text-xl font-bold mb-2">Invalid Link</h1><p class="text-gray-500 mb-6">'+ex.message+'</p><a href="/login" class="btn-primary" style="display:inline-block;width:auto;padding:10px 28px">Go to Login</a></div></div>';
  }
};

