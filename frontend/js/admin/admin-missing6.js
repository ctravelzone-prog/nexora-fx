/*
 * admin-missing6.js — Roles, Staff, Email, SMS, Menu Builder.
 *
 * Duplicate fallback definitions for /admin/roles, /admin/staff,
 * /admin/email, /admin/sms (same pages as admin-missing3.js) plus
 * /admin/menu-builder, which shows the default user-site navigation.
 * Key functions: AdminPages.manageRoles, AdminPages.manageStaff,
 * AdminPages.emailSettings, AdminPages.smsSettings, AdminPages.menuBuilder.
 *
 * Gotchas:
 * - This file redefines pages also defined in admin-missing3.js; whichever
 *   script loads last wins, so keep the two files in sync when editing.
 * - Menu Builder is informational only; it does not save a custom menu.
 * - Money is integer cents everywhere; display with utils.fmtMoney.
 * - Admin API calls go through adminApi in js/admin-api.js.
 * - Showcase accounts (is_showcase=1) are demo accounts with DISPLAY
 *   balances set by the admin; they are excluded from all admin totals,
 *   ledgers and reports.
 * - Bump the ?v= cache version in script tags on every release, or
 *   browsers keep serving stale code.
 */
// Renders /admin/roles: static table of the Super Admin and Support
  // Admin roles and their permissions. Informational page, no API call.
AdminPages.manageRoles=function(){AdminComponents.layout('<h2 class="font-bold text-lg mb-4">Manage Roles</h2><div class="panel" style="margin-top:0"><div style="overflow-x:auto;border:1px solid var(--border);border-radius:14px"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:var(--bg2)"><th style="padding:10px 14px;font-size:10.5px;font-weight:800;color:var(--faint);border-bottom:1px solid var(--border)">Role</th><th style="padding:10px 14px;font-size:10.5px;font-weight:800;color:var(--faint);border-bottom:1px solid var(--border)">Permissions</th></tr></thead><tbody><tr><td style="padding:12px 14px"><b>Super Admin</b></td><td style="padding:12px 14px;font-size:12px">Full access — settings, money, users, profit, audit log</td></tr><tr><td style="padding:12px 14px"><b>Support Admin</b></td><td style="padding:12px 14px;font-size:12px">Tickets, user view, deposit/withdrawal — no money settings</td></tr></tbody></table></div></div>','Manage Roles');};
// Renders /admin/staff: staff email, role and 2FA state.
  // Fetches via GET /api/admin/staff; a failed fetch shows an empty list.
AdminPages.manageStaff=async function(){
  try{const a=await api.request('GET','/api/admin/staff',null,true).catch(()=>[]);
    const r=Array.isArray(a)?a.map(x=>'<tr><td style="padding:12px 14px"><b>'+x.email+'</b></td><td style="padding:12px 14px"><span class="st st-blue">'+x.role+'</span></td><td style="padding:12px 14px">'+(x.two_fa_enabled?'<span class="st st-green">On</span>':'<span class="st st-grey">Off</span>')+'</td></tr>').join(''):'';
    AdminComponents.layout('<h2 class="font-bold text-lg mb-4">Manage Staff</h2><div class="panel" style="margin-top:0"><div style="overflow-x:auto;border:1px solid var(--border);border-radius:14px"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:var(--bg2)"><th style="padding:10px 14px;font-size:10.5px;font-weight:800;color:var(--faint);border-bottom:1px solid var(--border)">Email</th><th style="padding:10px 14px;font-size:10.5px;font-weight:800;color:var(--faint);border-bottom:1px solid var(--border)">Role</th><th style="padding:10px 14px;font-size:10.5px;font-weight:800;color:var(--faint);border-bottom:1px solid var(--border)">2FA</th></tr></thead><tbody>'+r+'</tbody></table></div></div>','Manage Staff');
  }catch(e){document.getElementById('admin-app').innerHTML='<p class="p-8 text-red-500">'+e.message+'</p>';}
};
// Renders /admin/email: notes that SMTP lives in backend/.env.
  // Informational page, no API call.
AdminPages.emailSettings=function(){AdminComponents.layout('<h2 class="font-bold text-lg mb-4">Email Settings</h2><div class="panel" style="margin-top:0"><div class="alert-info mb-3" style="font-size:13px">SMTP is in <code>backend/.env</code>: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM. Without SMTP, verify/reset links log to console (dev only).</div></div>','Email Settings');};
// Renders /admin/sms: notes that no SMS provider is configured.
  // Informational page, no API call.
AdminPages.smsSettings=function(){AdminComponents.layout('<h2 class="font-bold text-lg mb-4">SMS Settings</h2><div class="panel" style="margin-top:0"><div class="alert-info mb-3" style="font-size:13px">SMS not configured. Add an SMS provider to <code>.env</code> and update the backend service.</div></div>','SMS Settings');};
// Renders /admin/menu-builder: shows the default user-site navigation.
  // Informational page, no API call and nothing is saved.
AdminPages.menuBuilder=function(){AdminComponents.layout('<h2 class="font-bold text-lg mb-4">Menu Builder</h2><div class="panel" style="margin-top:0"><p style="color:var(--body);font-size:13.5px;line-height:1.7;margin-bottom:12px">Default navigation includes all standard screens.</p><div style="padding:14px;background:var(--bg);border-radius:12px;font-size:13px"><b>Home · Copy Trade · Dashboard · Deposit · Withdraw · History · KYC · Notifications · Risk &amp; Terms</b></div></div>','Menu Builder');};
