/*
 * api.js - API client for the Nexora FX user site.
 * What it does: token storage (localStorage), the core request() helper
 * used by every page, file uploads, and one wrapper per user backend
 * endpoint (auth, profile, deposit, withdraw, copy trade, KYC, support,
 * 2FA, referral). Admin calls live in js/admin-api.js and reuse request().
 * Key functions: request(), upload(), uploadPut(), getMe().
 * Important rules: money is integer cents everywhere - display it only
 * through utils.fmtMoney(). Dashboard balances come from GET /api/user/me.
 * Gotcha: a 401 on an admin call clears the admin token and redirects to
 * /admin login (see _adminAuthFail); the login endpoint is excluded.
 */
const api = {
  // Token storage. User token (nx_token) and admin token (nx_admin_token)
  // are kept separate so admin login-as-user can restore the admin token.
  getToken(){ return localStorage.getItem('nx_token'); },
  getAdminToken(){ return localStorage.getItem('nx_admin_token'); },
  setToken(t){ localStorage.setItem('nx_token',t); },
  setAdminToken(t){ localStorage.setItem('nx_admin_token',t); },
  clearToken(){ localStorage.removeItem('nx_token'); },
  clearAdminToken(){ localStorage.removeItem('nx_admin_token'); },

  // If an admin call fails with 401 (token expired/invalid), send the admin back to
  // the login page with a clear message instead of a confusing "Invalid token" error.
  // The login endpoint itself is excluded (a wrong password must not redirect).
  _adminAuthFail(path){
    if(path.includes('/api/admin/auth/login')) return;
    api.clearAdminToken();
    try{ sessionStorage.setItem('nx_admin_expired','1'); }catch(e){}
    window.location.href='/admin';
  },

  // Core request helper: adds the Bearer token, sends JSON, parses the
  // response, and throws an Error with the backend message on failure.
  // Every request has a 10s timeout (AbortController) — a hung API call used
  // to freeze the whole app on a blank page, because App.init() awaited it.
  async request(method,path,data,admin=false){
    const token=admin?this.getAdminToken():this.getToken();
    const headers={'Content-Type':'application/json'};
    if(token) headers['Authorization']=`Bearer ${token}`;
    const opts={method,headers};
    if(data&&method!=='GET') opts.body=JSON.stringify(data);
    const ctl=new AbortController();
    const to=setTimeout(()=>ctl.abort(),10000);
    opts.signal=ctl.signal;
    let res;
    try { res=await fetch(path,opts); }
    catch(err) {
      clearTimeout(to);
      // A timeout/network failure is NOT an auth failure: mark it so
      // callers keep the token (a retry can still succeed) instead of
      // logging the user out.
      const e=new Error(err&&err.name==='AbortError'?'Request timed out':(err&&err.message)||'Network error');
      e.code=err&&err.name==='AbortError'?'TIMEOUT':'NETWORK';
      throw e;
    }
    finally { clearTimeout(to); }
    const json=await res.json().catch(()=>({}));
    if(!res.ok){ if(res.status===401&&admin) api._adminAuthFail(path); const _e=new Error(json.error||`HTTP ${res.status}`); _e.status=res.status; if(json.suggestion) _e.suggestion=json.suggestion; throw _e; }
    return json;
  },

  // File upload helper (multipart form data, e.g. profile photo, KYC
  // documents). No Content-Type header - the browser sets the boundary.
  async upload(path,formData,admin=false){
    const token=admin?this.getAdminToken():this.getToken();
    const headers={};
    if(token) headers['Authorization']=`Bearer ${token}`;
    const res=await fetch(path,{method:'POST',headers,body:formData});
    const json=await res.json().catch(()=>({}));
    if(!res.ok){ if(res.status===401&&admin) api._adminAuthFail(path); throw new Error(json.error||`HTTP ${res.status}`); }
    return json;
  },

  // Same as upload() but with a PUT request (used for profile updates).
  async uploadPut(path,formData,admin=false){
    const token = admin ? this.getAdminToken() : this.getToken();
    const headers={};
    if(token) headers['Authorization']=`Bearer ${token}`;
    const res=await fetch(path,{method:'PUT',headers,body:formData});
    const json=await res.json().catch(()=>({}));
    if(!res.ok){ if(res.status===401&&admin) api._adminAuthFail(path); throw new Error(json.error||`HTTP ${res.status}`); }
    return json;
  },

  // Auth
  login:(d)=>api.request('POST','/api/auth/login',d),
  register:(d)=>api.request('POST','/api/auth/register',d),
  suggestUsername:(u)=>api.request('GET','/api/auth/username-suggest?username='+encodeURIComponent(u||'')),
  forgotPassword:(d)=>api.request('POST','/api/auth/forgot-password',d),
  forgetRequest:(d)=>api.request('POST','/api/auth/forget-request',d),
  getForgetChat:(id,token)=>api.request('GET',`/api/auth/forget-request/${id}/chat?token=${encodeURIComponent(token||'')}`),
  sendForgetMessage:(id,token,formData)=>api.upload(`/api/auth/forget-request/${id}/message`,formData),
  resetViaAuthenticator:(d)=>api.request('POST','/api/auth/reset-via-authenticator',d),
  resetPassword:(d)=>api.request('POST','/api/auth/reset-password',d),
  verifyEmail:(t)=>api.request('GET',`/api/auth/verify-email?token=${t}`),

  // User
  // getMe() returns the user plus balances (Main / Copy Invested / Profit).
  // Showcase accounts (is_showcase=1) get DISPLAY balances set by admin.
  getMe:()=>api.request('GET','/api/user/me'),
  updateProfile:(d)=>api.request('PUT','/api/user/profile',d),
  requestProfileChange:(d)=>api.request('POST','/api/user/profile-change-request',d),
  getProfileChangeRequests:()=>api.request('GET','/api/user/profile-change-requests'),
  changePassword:(d)=>api.request('POST','/api/user/change-password',d),
  getTransactions:(p)=>api.request('GET',`/api/user/transactions?${new URLSearchParams(p||{})}`),
  getTransactionsSummary:()=>api.request('GET','/api/user/transactions/summary'),
  getNotifications:()=>api.request('GET','/api/user/notifications'),
  readAllNotifications:()=>api.request('PUT','/api/user/notifications/read-all'),
  getSettings:()=>api.request('GET','/api/settings'),

  // Deposit: Binance Pay with TxID + amount, approved by an admin.
  // Until approval the deposit shows as Pending in History.
  submitDeposit:(d)=>api.request('POST','/api/deposit',d),
  getDepositHistory:()=>api.request('GET','/api/deposit/history'),
  getDepositWallet:()=>api.request('GET','/api/deposit/wallet'),

  // Withdraw: USDT BEP20 only, from Main Balance. Profit Balance has a
  // $10 minimum; Main Balance withdrawn before 3 months loses 15%.
  getWithdrawInfo:()=>api.request('GET','/api/withdraw/info'),
  withdrawMain:(d)=>api.request('POST','/api/withdraw/main',d),
  withdrawProfit:(d)=>api.request('POST','/api/withdraw/profit',d),
  getWithdrawHistory:()=>api.request('GET','/api/withdraw/history'),

  // Request Money
  requestMoney:(d)=>api.request('POST','/api/request-money',d),
  getMyMoneyRequests:()=>api.request('GET','/api/request-money'),

  // Copy Trade: real traders only (no fake numbers). Copy money moves
  // from Main Balance to a separate Copy Invested bucket; profit applies
  // only to Copy Invested, and Stop Copy settles it back to Main.
  getTraders:()=>api.request('GET','/api/copy/traders'),
  getTrader:(id)=>api.request('GET',`/api/copy/traders/${id}`),
  getMyCopies:()=>api.request('GET','/api/copy/my-copies'),
  getCopyHistory:()=>api.request('GET','/api/copy/history'),
  startCopy:(d)=>api.request('POST','/api/copy/start',d),
  increaseCopy:(d)=>api.request('POST','/api/copy/increase',d),
  decreaseCopy:(d)=>api.request('POST','/api/copy/decrease',d),
  stopCopy:(d)=>api.request('POST','/api/copy/stop',d),
  getDailyPnlLog:()=>api.request('GET','/api/copy/daily-pnl-log'),

  // KYC
  getKycStatus:()=>api.request('GET','/api/kyc/status'),

  // Support
  getTickets:()=>api.request('GET','/api/support/tickets'),
  createTicket:(d)=>api.request('POST','/api/support/tickets',d),
  getTicket:(id)=>api.request('GET',`/api/support/tickets/${id}`),
  replyTicket:(id,d)=>api.request('POST',`/api/support/tickets/${id}/reply`,d),

  // 2FA
  get2FAStatus:()=>api.request('GET','/api/2fa/status'),
  setup2FA:()=>api.request('GET','/api/2fa/setup'),
  verify2FA:(d)=>api.request('POST','/api/2fa/verify',d),
  disable2FA:(d)=>api.request('POST','/api/2fa/disable',d),

  // Referral
  getReferredUsers:()=>api.request('GET','/api/referral/referred-users'),
  getReferralCommissions:()=>api.request('GET','/api/referral/commissions'),
  getReferralLink:()=>api.request('GET','/api/referral/link'),
  transferReferral:(amount)=>api.request('POST','/api/referral/transfer',{amount}),
  getFriends:()=>api.request('GET','/api/referral/friends'),
};
