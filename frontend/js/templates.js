/*
 * templates.js - Auth page templates for the Nexora FX user site.
 * What it does: returns the HTML for the login and register pages,
 * including the public top bar from Components.topbarPublic().
 * Key functions: Templates.login(), Templates.register().
 * Note: the login form has a 6-digit 2FA code row (shown only when the
 * account has 2FA on); the register form requires accepting the Terms
 * and Conditions. Form submit handlers live in js/pages/auth.js.
 * Gotcha: this file uses CRLF line endings - keep them when editing.
 */
const Templates = {};
// Login page: logo, Sign In form with show/hide password, Remember Me,
// Forgot Password link, hidden 2FA code row, and a Sign Up link.
Templates.login=()=>{
  const eye=svgIcons.eye;
  return Components.topbarPublic('login')+
  `<div class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
  <div class="w-full max-w-sm">
  <div class="bg-white rounded-2xl shadow-sm p-8">
  <div class="flex justify-center mb-4"><div class="w-12 h-12 rounded-xl bg-gray-900 flex items-center justify-center"><img src="/assets/logo-nx-mark-transparent.png" style="height:26px" alt="NX"></div></div>
  <h1 class="text-2xl font-bold text-center mb-1">Sign In</h1>
  <p class="text-center text-gray-400 text-sm mb-6">Turn Your Ideas into Reality</p>
  <form id="login-form" class="space-y-4">
  <div><label class="input-label">Your Username</label><input name="username" type="text" placeholder="Your Username" class="input-field" required></div>
  <div><label class="input-label">Your Password</label>
  <div class="relative"><input name="password" type="password" placeholder="Your Password" class="input-field pr-10" required>
  <button type="button" class="absolute right-3 top-3 text-gray-400" onclick="Pages._pw(this)">${eye}</button></div></div>
  <div class="flex items-center justify-between">
  <label class="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" name="remember" class="accent-orange-500" checked> Remember Me</label>
  <a href="/forgot-password" class="text-sm text-orange-500 font-semibold">Forgot Password?</a></div>
  <div id="login-2fa" class="hidden">
    <div style="background:var(--orange-soft);border:1px solid var(--orange-line);border-radius:12px;padding:12px 14px;display:flex;align-items:flex-start;gap:10px;margin-bottom:10px">
      <span style="color:var(--orange);flex:none;margin-top:1px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-3.6 8-10V5l-8-3-8 3v7c0 6.4 8 10 8 10Z"/><path d="m9 11.5 2 2 4-4.5"/></svg></span>
      <p style="font-size:13px;line-height:1.6;color:var(--body)"><b style="color:var(--ink)">Two-factor authentication is on for this account.</b> Enter the 6-digit code from your authenticator app to finish signing in.</p>
    </div>
    <div class="code-row" id="login-code-row"><input class="code-box" inputmode="numeric" maxlength="1"><input class="code-box" inputmode="numeric" maxlength="1"><input class="code-box" inputmode="numeric" maxlength="1"><input class="code-box" inputmode="numeric" maxlength="1"><input class="code-box" inputmode="numeric" maxlength="1"><input class="code-box" inputmode="numeric" maxlength="1"></div>
    <input type="hidden" name="totp_code" id="totp_hidden">
  </div>
  <div id="login-err" class="alert-danger hidden"></div>
  <button type="submit" id="login-btn" class="btn-primary">Sign In</button>
  <p class="text-center text-xs text-gray-400 mt-2" id="login-hint">User 2FA is currently disabled by admin — sign in with your password only, no code step is asked.</p>
  <p class="text-center text-sm text-gray-500 mt-2">Not Registered Yet? <a href="/register" class="text-orange-500 font-semibold">Create an Account</a></p>
  </form></div>
  <p class="text-center text-xs text-gray-400 mt-4">Protected by 2FA security · Nexora FX account area</p>
  </div></div>`;
};


// Register page: full name, email, username, optional referral code,
// phone with country code, password + confirm, terms checkbox.
Templates.register=()=>{

const eye=svgIcons.eye,arr=svgIcons.arrow_left;return Components.topbarPublic('register')+`<div class="min-h-screen bg-gray-50 flex items-center justify-center p-4"><div class="w-full max-w-xl bg-white rounded-2xl shadow-sm p-5 sm:p-8"><div class="flex items-center gap-3 mb-6"><button onclick="history.back()" class="p-2 rounded-lg hover:bg-gray-100">${arr}</button><h1 class="text-xl font-bold flex-1 text-center">Registration</h1><div class="w-8"></div></div><form id="reg-form" class="space-y-4"><div class="grid grid-cols-2 gap-4"><div><label class="input-label">Your Name</label><input name="full_name" type="text" placeholder="Full name" class="input-field" required></div><div><label class="input-label">Your Email</label><input name="email" type="email" placeholder="Email" class="input-field" required></div></div><div class="grid grid-cols-2 gap-4"><div><label class="input-label">User Name</label><input name="username" type="text" placeholder="Username" class="input-field" required></div><div><label class="input-label">Referral Name</label><input name="ref" type="text" placeholder="Referral code or username" class="input-field"></div></div><div><label class="input-label">Your Phone</label><div class="flex gap-2"><select name="country_code" class="input-field" style="width:120px"><option value="+44">+44 UK</option><option value="+1">+1 US</option><option value="+880">+880 BD</option><option value="+91">+91 IN</option><option value="+92">+92 PK</option></select><input name="phone" type="tel" placeholder="Phone number" class="input-field flex-1" required></div></div><div class="grid grid-cols-2 gap-4"><div><label class="input-label">Your Password</label><div class="relative"><input name="password" type="password" placeholder="Password" class="input-field pr-10" required minlength="8"><button type="button" class="absolute right-3 top-3 text-gray-400" onclick="Pages._pw(this)">${eye}</button></div></div><div><label class="input-label">Confirm Password</label><div class="relative"><input name="cpw" type="password" placeholder="Confirm password" class="input-field pr-10" required><button type="button" class="absolute right-3 top-3 text-gray-400" onclick="Pages._pw(this)">${eye}</button></div></div></div><div class="flex items-center justify-between"><label class="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" id="terms-ck" class="accent-orange-500"> I accept all <a href="/risk-terms" class="text-orange-500 font-semibold">Terms &amp; Condition</a></label><a href="/forgot-password" class="text-sm text-orange-500 font-semibold">Forgot Password</a></div><div id="reg-err" class="alert-danger hidden"></div><button type="submit" class="btn-primary" id="reg-btn">Sign Up</button><p class="text-center text-sm text-gray-500">Already Registered? <a href="/login" class="text-orange-500 font-semibold">Sign In</a></p></form></div></div>`;};
