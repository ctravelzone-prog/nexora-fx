/*
 * admin-api.js - Admin API client for the Nexora FX admin panel.
 * What it does: one thin wrapper per admin backend endpoint, built on
 * api.request() in js/api.js. Every call passes admin=true, so it sends
 * the admin token (nx_admin_token) instead of the user token.
 * Key groups: auth, dashboard, notifications, site/money/2FA/KYC settings,
 * finance (deposits, withdrawals, transactions), users and showcase
 * (demo) accounts, traders and copies, profit schedule, KYC and tickets.
 * Gotcha: an expired admin token (401) redirects to /admin login - see
 * api._adminAuthFail() in js/api.js. Money is integer cents everywhere.
 */
const adminApi = {
  login:(d)=>api.request('POST','/api/admin/auth/login',d,true),
  me:()=>api.request('GET','/api/admin/auth/me',null,true),
  changePassword:(d)=>api.request('POST','/api/admin/auth/change-password',d,true),
  // Dashboard summary and admin notifications.
  dashboard:()=>api.request('GET','/api/admin/dashboard',null,true),
  notifications:()=>api.request('GET','/api/admin/notifications',null,true),
  readAllNotifs:()=>api.request('PUT','/api/admin/notifications/read-all',null,true),
  readNotif:(id)=>api.request('PUT',`/api/admin/notifications/${id}/read`,null,true),
  sendNotif:(d)=>api.request('POST','/api/admin/notifications/send',d,true),
  // Site settings, money settings, deposit wallet, 2FA and KYC controls.
  // Money settings are Super Admin only and audit-logged on the backend.
  getSettings:()=>api.request('GET','/api/admin/settings',null,true),
  saveSettings:(d)=>api.request('POST','/api/admin/settings',d,true),
  getMoney:()=>api.request('GET','/api/admin/settings/money',null,true),
  saveMoney:(d)=>api.request('PUT','/api/admin/settings/money',d,true),
  getDepositWallet:()=>api.request('GET','/api/admin/settings/deposit-wallet',null,true),
  get2FAControl:()=>api.request('GET','/api/admin/settings/2fa-control',null,true),
  set2FAControl:(d)=>api.request('PUT','/api/admin/settings/2fa-control',d,true),
  getKYCControl:()=>api.request('GET','/api/admin/settings/kyc-control',null,true),
  setKYCControl:(d)=>api.request('PUT','/api/admin/settings/kyc-control',d,true),
  requestSingleKYC:(d)=>api.request('POST','/api/admin/settings/kyc-control/request',d,true),
  cancelSingleKYC:(d)=>api.request('POST','/api/admin/settings/kyc-control/cancel',d,true),
  getAuditLog:()=>api.request('GET','/api/admin/settings/audit-log',null,true),
  getReports:()=>api.request('GET','/api/admin/settings/reports',null,true),
  // Finance: deposits, withdrawals, transactions and referrals.
  // Deposits are approved/rejected here; approval credits Main Balance.
  getDeposits:(p)=>api.request('GET',`/api/admin/finance/deposits?${new URLSearchParams(p||{})}`,null,true),
  approveDeposit:(id)=>api.request('POST',`/api/admin/finance/deposits/${id}/approve`,{},true),
  rejectDeposit:(id,d)=>api.request('POST',`/api/admin/finance/deposits/${id}/reject`,d,true),
  getWithdrawals:(p)=>api.request('GET',`/api/admin/finance/withdrawals?${new URLSearchParams(p||{})}`,null,true),
  processWithdrawal:(id,d)=>api.request('POST',`/api/admin/finance/withdrawals/${id}/process`,d,true),
  getTransactions:(p)=>api.request('GET',`/api/admin/finance/transactions?${new URLSearchParams(p||{})}`,null,true),
  getReferrals:()=>api.request('GET','/api/admin/finance/referrals',null,true),
  // Users and showcase (demo) accounts. Showcase accounts show DISPLAY
  // balances set by the admin, not real money.
  getUsers:(p)=>api.request('GET',`/api/admin/users?${new URLSearchParams(p||{})}`,null,true),
  getUser:(id)=>api.request('GET',`/api/admin/users/${id}`,null,true),
  toggleUser:(id)=>api.request('PUT',`/api/admin/users/${id}/toggle-active`,{},true),
  deleteUser:(id)=>api.request('DELETE',`/api/admin/users/${id}`,null,true),
  addBalance:(id,d)=>api.request('POST',`/api/admin/users/${id}/add-balance`,d,true),
  setTempPassword:(id,d)=>api.request('POST',`/api/admin/users/${id}/set-temp-password`,d,true),
  setUserProfitTarget:(id,d)=>api.request('POST',`/api/admin/users/${id}/profit-target`,d,true),
  loginAsUser:(id)=>api.request('POST',`/api/admin/users/${id}/login-as`,{},true),
  getShowcaseUsers:()=>api.request('GET','/api/admin/users/showcase/list',null,true),
  createShowcase:(d)=>api.request('POST','/api/admin/users/showcase/create',d,true),
  updateShowcase:(id,d)=>api.request('PUT',`/api/admin/users/showcase/${id}`,d,true),
  deleteShowcase:(id)=>api.request('DELETE',`/api/admin/users/showcase/${id}`,null,true),
  // Traders and active copies (admin can hide/delete traders, stop copies).
  getTraders:()=>api.request('GET','/api/admin/traders',null,true),
  toggleTraderHidden:(id)=>api.request('PUT',`/api/admin/traders/${id}/toggle-hidden`,{},true),
  deleteTrader:(id)=>api.request('DELETE',`/api/admin/traders/${id}`,null,true),
  getActiveCopies:()=>api.request('GET','/api/admin/traders/copies/active',null,true),
  adminStopCopy:(id)=>api.request('POST',`/api/admin/traders/copies/${id}/stop`,{},true),
  // Profit schedule and auto-profit (daily PnL applied to Copy Invested).
  getProfitSchedule:(p)=>api.request('GET',`/api/admin/profit/schedule?${new URLSearchParams(p||{})}`,null,true),
  generateSchedule:(d)=>api.request('POST','/api/admin/profit/schedule/generate',d,true),
  editScheduleDay:(y,m,d,data)=>api.request('PUT',`/api/admin/profit/schedule/${y}/${m}/${d}`,data,true),
  applyPnl:(d)=>api.request('POST','/api/admin/profit/apply',d,true),
  getAutoProfitStatus:()=>api.request('GET','/api/admin/profit/auto-status',null,true),
  runAutoProfit:()=>api.request('POST','/api/admin/profit/auto-run',{},true),
  toggleAutoProfit:(d)=>api.request('POST','/api/admin/profit/auto-toggle',d||{},true),
  getUserProfitData:()=>api.request('GET','/api/admin/profit/user-data',null,true),
  // KYC reviews, support tickets, password-reset (forget) requests and
  // request-money approvals.
  getKYCList:(p)=>api.request('GET',`/api/admin/kyc?${new URLSearchParams(p||{})}`,null,true),
  reviewKYC:(id,d)=>api.request('POST',`/api/admin/kyc/${id}/review`,d,true),
  getTickets:(p)=>api.request('GET',`/api/admin/tickets?${new URLSearchParams(p||{})}`,null,true),
  getForgetRequests:()=>api.request('GET','/api/admin/forget-requests',null,true),
  getProfileRequests:()=>api.request('GET','/api/admin/profile-requests',null,true),
  approveProfileRequest:(id)=>api.request('POST',`/api/admin/profile-requests/${id}/approve`,{},true),
  rejectProfileRequest:(id,d)=>api.request('POST',`/api/admin/profile-requests/${id}/reject`,d||{},true),
  getMoneyRequests:()=>api.request('GET','/api/admin/money-requests',null,true),
  getUserBlocks:()=>api.request('GET','/api/admin/user-blocks',null,true),
  blockUser:(userId,kind)=>api.request('POST','/api/admin/user-blocks',{user_id:userId,kind},true),
  unblockUser:(id)=>api.request('DELETE',`/api/admin/user-blocks/${id}`,null,true),
  setRequestMoney:(userId,enabled,oneTime)=>api.request('POST','/api/admin/user-blocks/request-money',{user_id:userId,enabled,one_time:oneTime},true),
  approveMoneyRequest:(id)=>api.request('POST',`/api/admin/money-requests/${id}/approve`,{},true),
  rejectMoneyRequest:(id,d)=>api.request('POST',`/api/admin/money-requests/${id}/reject`,d,true),
  generateForgetOtp:(id)=>api.request('POST',`/api/admin/forget-requests/${id}/generate-otp`,{},true),
  rejectForgetRequest:(id)=>api.request('POST',`/api/admin/forget-requests/${id}/reject`,{},true),
  getTicket:(id)=>api.request('GET',`/api/admin/tickets/${id}`,null,true),
  replyTicket:(id,d)=>api.request('POST',`/api/admin/tickets/${id}/reply`,d,true),
  updateTicketStatus:(id,d)=>api.request('PUT',`/api/admin/tickets/${id}/status`,d,true),
};
