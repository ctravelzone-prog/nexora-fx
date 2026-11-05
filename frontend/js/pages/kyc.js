// pages/kyc.js — KYC Verification
Pages.kyc=async function(){
  try{
    const status=await api.getKycStatus();
    if(!status.kyc_enabled){
      Components.layout(`<div class="max-w-md card text-center py-12"><div class="text-5xl mb-3">🛡️</div><h2 class="font-bold mb-2">KYC Verification</h2><p class="text-gray-400">KYC verification is not currently required on this platform.</p></div>`,'KYC Verification','');return;
    }
    if(status.kyc?.status==='approved'){
      Components.layout(`<div class="max-w-md card text-center py-8"><div class="text-5xl mb-3">✅</div><h2 class="font-bold mb-2 text-green-600">Identity Verified</h2><p class="text-gray-400">Your KYC has been approved.</p></div>`,'KYC Verification','');return;
    }
    if(status.kyc?.status==='pending'){
      Components.layout(`<div class="max-w-md card text-center py-8"><div class="text-5xl mb-3">⏳</div><h2 class="font-bold mb-2">KYC Under Review</h2><p class="text-gray-400">Your documents are being reviewed. We'll notify you when done.</p></div>`,'KYC Verification','');return;
    }
    Components.layout(`<div class="max-w-md card">
      <h2 class="font-bold mb-4">Submit KYC Documents</h2>
      <p class="text-sm text-gray-400 mb-4">Verify your identity to unlock Main Balance withdrawals.</p>
      <form id="kyc-form" class="space-y-4">
        <div><label class="input-label">Document Type</label><select name="doc_type" class="input-field"><option value="passport">Passport</option><option value="id_card">National ID</option><option value="driving_license">Driving License</option></select></div>
        <div><label class="input-label">Document Front</label><input name="doc_front" type="file" accept="image/*" class="input-field" required></div>
        <div><label class="input-label">Document Back (optional)</label><input name="doc_back" type="file" accept="image/*" class="input-field"></div>
        <div><label class="input-label">Selfie with Document</label><input name="selfie" type="file" accept="image/*" class="input-field" required></div>
        <div id="kyc-err" class="alert-danger hidden"></div>
        <button type="submit" id="kyc-btn" class="btn-primary">Submit KYC</button>
      </form></div>`,'KYC Verification','');
    document.getElementById('kyc-form').onsubmit=async(e)=>{
      e.preventDefault();const f=e.target,err=document.getElementById('kyc-err'),btn=document.getElementById('kyc-btn');
      err.classList.add('hidden');utils.loading(btn,true);
      const fd=new FormData();fd.append('doc_type',f.doc_type.value);
      if(f.doc_front.files[0])fd.append('doc_front',f.doc_front.files[0]);
      if(f.doc_back.files[0])fd.append('doc_back',f.doc_back.files[0]);
      if(f.selfie.files[0])fd.append('selfie',f.selfie.files[0]);
      try{await api.upload('/api/kyc/submit',fd);utils.toast('KYC submitted! Under review.','success');Pages.kyc();}
      catch(ex){err.textContent=ex.message;err.classList.remove('hidden');}
      utils.loading(btn,false);
    };
  }catch(e){document.getElementById('app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
