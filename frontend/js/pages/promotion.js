/*
 * pages/promotion.js — Public promotion page: the Nexora FX referral program.
 * Standalone page (no login needed) so visitors can read it from the
 * landing page. Logged-in users also see their own referral link.
 * Key functions:
 * - Pages.promotion() renders the page. Logged-in users: their link
 *   comes from api.getReferralLink().
 * Rules / gotchas:
 * - Referral bonus is 4% of the referred user's FIRST deposit only,
 *   one time, not recurring, and paid on the deposit, not on profit.
 * - Money is integer cents everywhere; display with utils.fmtMoney.
 * - Balances come from GET /api/user/me; showcase accounts
 *   (is_showcase=1) show DISPLAY balances set by the admin.
 * - The ?v= cache version in script tags must be bumped on every
 *   release or browsers may serve stale code.
 */
// Renders the public Promotion page (refer-a-friend, 4% one-time bonus).
// Logged-in users get their personal link shown at the top; logged-out
// visitors see a Sign Up call to action instead.
Pages.promotion=async function(){
  var loggedIn=utils.isLoggedIn()&&App.state.user!==null;
  var linkHtml='';
  var transferHtml='';
  if(loggedIn){
    try{
      var me=await api.getMe();
      var rb=me.balance||{};
      var avail=(rb.referral_available_cents!=null?rb.referral_available_cents:rb.referral_cents)||0;
      var earned=rb.referral_cents||0;
      var moved=rb.referral_transferred_cents||0;
      Pages._refAvail=avail;
      transferHtml='<div class="card mb-6"><h3 class="font-bold mb-2">Transfer Referral Bonus to Profit</h3><p class="text-sm text-gray-600">Available: <strong>'+utils.fmtMoney(avail)+'</strong> &nbsp;·&nbsp; Total earned: '+utils.fmtMoney(earned)+' &nbsp;·&nbsp; Already transferred: '+utils.fmtMoney(moved)+'</p><p class="text-xs text-gray-400 mt-1">Your bonus stays in Referral Bonus until you move it. Transfer any amount to your Profit Balance (Total PnL) — then withdraw it like other profit.</p><div class="flex gap-2 mt-3"><input id="ref-transfer-amt" type="number" min="0" step="0.01" placeholder="Amount ($)" class="input-field flex-1"><button onclick="Pages._refTransferMax()" class="btn-primary text-sm" style="width:auto;padding:10px 16px">Max</button><button onclick="Pages._refTransfer()" class="btn-primary text-sm" style="width:auto;padding:10px 16px">Transfer →</button></div><p id="ref-transfer-msg" class="text-sm mt-2"></p></div>';
    }catch(e){}
// The referral link is best-effort here: if it fails to load, the
// public promotion content still renders without it.
    try{
      const link=await api.getReferralLink();
      linkHtml='<div class="card mb-6"><h3 class="font-bold mb-2">Your Referral Link</h3><div class="flex gap-2"><input type="text" value="'+link.link+'" readonly class="input-field flex-1 text-sm bg-gray-50"><button onclick="navigator.clipboard.writeText(\''+link.link+'\');utils.toast(\'Copied!\',\'success\')" class="btn-primary text-sm" style="width:auto;padding:10px 16px">Copy Link</button></div><p class="text-xs text-gray-400 mt-2">Your code: <strong>'+link.code+'</strong></p></div>';
    }catch(e){}
  }
  var html=`
    <div class="mb-6">
      <h2 class="text-2xl font-bold">⭐ Promotion — Refer a Friend</h2>
      <p class="text-sm text-gray-500 mt-1">Invite friends to Nexora FX and earn on every friend who joins and deposits.</p>
    </div>
    ${linkHtml}
    ${transferHtml}
    <div class="rounded-2xl p-6 mb-6 text-white" style="background:linear-gradient(135deg,#FF6A00,#FF8C33)">
      <div class="text-4xl font-extrabold">4%</div>
      <div class="font-bold mt-1">one-time bonus on your friend's first deposit</div>
      <p class="text-orange-100 text-sm mt-2">Your friend deposits $500 — you earn $20, once. No limit on how many friends you invite.</p>
    </div>
    <div class="grid sm:grid-cols-3 gap-4 mb-6">
      <div class="card text-center"><div class="text-3xl mb-2">🔗</div><div class="font-bold text-sm">1. Share your link</div><p class="text-xs text-gray-400 mt-1">Copy your referral link and send it to friends.</p></div>
      <div class="card text-center"><div class="text-3xl mb-2">👤</div><div class="font-bold text-sm">2. Friend signs up &amp; deposits</div><p class="text-xs text-gray-400 mt-1">They register with your link and make their first deposit.</p></div>
      <div class="card text-center"><div class="text-3xl mb-2">💰</div><div class="font-bold text-sm">3. You earn 4% — once</div><p class="text-xs text-gray-400 mt-1">4% of their first deposit lands in your Referral Bonus, one time — transfer it to Profit when you want.</p></div>
    </div>
    <div class="card mb-6">
      <h3 class="font-bold mb-2">How it works</h3>
      <ul class="text-sm text-gray-600 space-y-1.5 list-disc pl-5">
        <li>Bonus is <strong>4% of the referred user's first deposit only</strong> — one time, not recurring.</li>
        <li>Bonus is paid on the <strong>deposit</strong>, not on profit or trading.</li>
        <li>There is no limit — invite as many friends as you like.</li>
        <li>Your referral bonus appears in your account after your friend's first deposit is approved.</li>
        <li>Your bonus stays in your <strong>Referral Bonus</strong> balance — transfer any amount to your <strong>Profit Balance (Total PnL)</strong> whenever you like, then withdraw it like other profit.</li>
      </ul>
    </div>
    ${loggedIn
      ? '<button onclick="App.navigate(\'/referred-users\')" class="btn-primary" style="width:auto;padding:12px 28px">View My Referred Users →</button>'
      : '<div class="text-center"><button onclick="App.navigate(\'/register\')" class="btn-primary" style="width:auto;padding:12px 28px">Sign Up &amp; Get Your Link →</button><p class="text-xs text-gray-400 mt-3">Already have an account? <a href="/login" class="text-orange-500 font-semibold">Log In</a></p></div>'}
  `;
  if(loggedIn) Components.layout(html,'Promotion','Refer a friend, earn 4%');
  else Components.publicLayout(html);
};
// Fills the transfer amount with the full available referral bonus.
Pages._refTransferMax=function(){var el=document.getElementById('ref-transfer-amt');if(el)el.value=((Pages._refAvail||0)/100).toFixed(2);};
// Moves the typed amount from Referral Bonus to Profit Balance.
Pages._refTransfer=async function(){
  var el=document.getElementById('ref-transfer-amt'),msg=document.getElementById('ref-transfer-msg');
  var amt=parseFloat(el?el.value:'');
  if(!amt||amt<=0){if(msg){msg.textContent='Enter an amount above $0';msg.style.color='var(--red)';}return;}
  try{
    var r=await api.transferReferral(amt);
    utils.toast('Transferred $'+amt.toFixed(2)+' to Profit!','success');
    Pages.promotion();
  }catch(e){if(msg){msg.textContent=e.message;msg.style.color='var(--red)';}}
};
