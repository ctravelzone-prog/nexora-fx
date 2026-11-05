// pages/promotion.js — Public promotion page: the Nexora FX referral program.
// Standalone (no login needed) so visitors can read it from the landing page.
// Logged-in users see their own referral link too.
Pages.promotion=async function(){
  var loggedIn=utils.isLoggedIn()&&App.state.user!==null;
  var linkHtml='';
  if(loggedIn){
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
    <div class="rounded-2xl p-6 mb-6 text-white" style="background:linear-gradient(135deg,#FF6A00,#FF8C33)">
      <div class="text-4xl font-extrabold">4%</div>
      <div class="font-bold mt-1">one-time bonus on your friend's first deposit</div>
      <p class="text-orange-100 text-sm mt-2">Your friend deposits $500 — you earn $20, once. No limit on how many friends you invite.</p>
    </div>
    <div class="grid sm:grid-cols-3 gap-4 mb-6">
      <div class="card text-center"><div class="text-3xl mb-2">🔗</div><div class="font-bold text-sm">1. Share your link</div><p class="text-xs text-gray-400 mt-1">Copy your referral link and send it to friends.</p></div>
      <div class="card text-center"><div class="text-3xl mb-2">👤</div><div class="font-bold text-sm">2. Friend signs up &amp; deposits</div><p class="text-xs text-gray-400 mt-1">They register with your link and make their first deposit.</p></div>
      <div class="card text-center"><div class="text-3xl mb-2">💰</div><div class="font-bold text-sm">3. You earn 4% — once</div><p class="text-xs text-gray-400 mt-1">4% of their first deposit lands in your account, one time.</p></div>
    </div>
    <div class="card mb-6">
      <h3 class="font-bold mb-2">How it works</h3>
      <ul class="text-sm text-gray-600 space-y-1.5 list-disc pl-5">
        <li>Bonus is <strong>4% of the referred user's first deposit only</strong> — one time, not recurring.</li>
        <li>Bonus is paid on the <strong>deposit</strong>, not on profit or trading.</li>
        <li>There is no limit — invite as many friends as you like.</li>
        <li>Your referral bonus appears in your account after your friend's first deposit is approved.</li>
      </ul>
    </div>
    ${loggedIn
      ? '<button onclick="App.navigate(\'/referred-users\')" class="btn-primary" style="width:auto;padding:12px 28px">View My Referred Users →</button>'
      : '<div class="text-center"><button onclick="App.navigate(\'/register\')" class="btn-primary" style="width:auto;padding:12px 28px">Sign Up &amp; Get Your Link →</button><p class="text-xs text-gray-400 mt-3">Already have an account? <a href="/login" class="text-orange-500 font-semibold">Log In</a></p></div>'}
  `;
  if(loggedIn) Components.layout(html,'Promotion','Refer a friend, earn 4%');
  else Components.publicLayout(html);
};
