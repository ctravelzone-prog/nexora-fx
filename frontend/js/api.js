// api.js — Nexora Fx API client
const api = {
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

  async request(method,path,data,admin=false){
    const token=admin?this.getAdminToken():this.getToken();
    const headers={'Content-Type':'application/json'};
    if(token) headers['Authorization']=`Bearer ${token}`;
    const opts={method,headers};
    if(data&&method!=='GET') opts.body=JSON.stringify(data);
    const res=await fetch(path,opts);
    const json=await res.json().catch(()=>({}));
    if(!res.ok){ if(res.status===401&&admin) api._adminAuthFail(path); throw new Error(json.error||`HTTP ${res.status}`); }
    return json;
  },

  async upload(path,formData,admin=false){
    const token=admin?this.getAdminToken():this.getToken();
    const headers={};
    if(token) headers['Authorization']=`Bearer ${token}`;
    const res=await fetch(path,{method:'POST',headers,body:formData});
    const json=await res.json().catch(()=>({}));
    if(!res.ok){ if(res.status===401&&admin) api._adminAuthFail(path); throw new Error(json.error||`HTTP ${res.status}`); }
    return json;
  },

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
  forgotPassword:(d)=>api.request('POST','/api/auth/forgot-password',d),
  forgetRequest:(d)=>api.request('POST','/api/auth/forget-request',d),
  resetViaAuthenticator:(d)=>api.request('POST','/api/auth/reset-via-authenticator',d),
  resetPassword:(d)=>api.request('POST','/api/auth/reset-password',d),
  verifyEmail:(t)=>api.request('GET',`/api/auth/verify-email?token=${t}`),

  // User
  getMe:()=>api.request('GET','/api/user/me'),
  updateProfile:(d)=>api.request('PUT','/api/user/profile',d),
  changePassword:(d)=>api.request('POST','/api/user/change-password',d),
  getTransactions:(p)=>api.request('GET',`/api/user/transactions?${new URLSearchParams(p||{})}`),
  getNotifications:()=>api.request('GET','/api/user/notifications'),
  readAllNotifications:()=>api.request('PUT','/api/user/notifications/read-all'),
  getSettings:()=>api.request('GET','/api/settings'),

  // Deposit
  submitDeposit:(d)=>api.request('POST','/api/deposit',d),
  getDepositHistory:()=>api.request('GET','/api/deposit/history'),
  getDepositWallet:()=>api.request('GET','/api/deposit/wallet'),

  // Withdraw
  getWithdrawInfo:()=>api.request('GET','/api/withdraw/info'),
  withdrawMain:(d)=>api.request('POST','/api/withdraw/main',d),
  withdrawProfit:(d)=>api.request('POST','/api/withdraw/profit',d),
  getWithdrawHistory:()=>api.request('GET','/api/withdraw/history'),

  // Request Money
  requestMoney:(d)=>api.request('POST','/api/request-money',d),
  getMyMoneyRequests:()=>api.request('GET','/api/request-money'),

  // Copy
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
  getFriends:()=>api.request('GET','/api/referral/friends'),
};
