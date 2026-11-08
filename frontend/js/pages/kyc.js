/*
 * kyc.js — KYC Verification page for Nexora FX.
 *
 * Checks the user's KYC status (api.getKycStatus) and shows one of
 * four screens: KYC not required, approved, under review, or the
 * document upload form.
 *
 * Key function:
 * - Pages.kyc — loads the KYC status, renders the matching screen,
 *   and on submit uploads the documents (POST /api/kyc/submit).
 *
 * Rules: KYC unlocks Main Balance withdrawals. The form sends the
 * document type, document front (required), document back (optional)
 * and a selfie with the document (required) as multipart form data.
 * KYC is off by default; the admin turns it on for all users or for
 * a single user. Website UI text is always English.
 * Gotcha: the ?v= cache version in script tags must be bumped on every
 * release, or browsers may serve stale code.
 * Note: this file uses CRLF line endings — preserve them on every edit.
 */
// KYC Verification page: status check + document upload. See header.
Pages.kyc=async function(){
  try{
    const status=await api.getKycStatus();
    // Approved comes FIRST: the backend returns kyc_enabled=false for
    // verified users, so checking it first showed them "not required"
    // instead of Verified.
    if(status.kyc?.status==='approved'){
      Components.layout(`<div class="max-w-md card text-center py-8"><div class="text-5xl mb-3">✅</div><h2 class="font-bold mb-2 text-green-600">Identity Verified</h2><p class="text-gray-400">Your KYC has been approved.</p></div>`,'KYC Verification','');return;
    }
    if(!status.kyc_enabled){
      Components.layout(`<div class="max-w-md card text-center py-12"><div class="text-5xl mb-3">🛡️</div><h2 class="font-bold mb-2">KYC Verification</h2><p class="text-gray-400">KYC verification is not currently required on this platform.</p></div>`,'KYC Verification','');return;
    }
    if(status.kyc?.status==='pending'){
      Components.layout(`<div class="max-w-md card text-center py-8"><div class="text-5xl mb-3">⏳</div><h2 class="font-bold mb-2">KYC Under Review</h2><p class="text-gray-400">Your documents are being reviewed. We'll notify you when done.</p></div>`,'KYC Verification','');return;
    }
    // The form is built from the admin-configured fields (status.fields):
    // text/date/number/tel/email inputs, textareas, dropdowns and file
    // uploads, in the admin's order. Required fields are marked *.
    // Layout (v118): two sections — Personal Information and Identity
    // Documents — each in a .kyc-grid. The grid is ONE column on phones
    // and TWO columns on desktop (media query below), so the form is about
    // half as long on a wide screen. Long fields (address, file uploads)
    // span both columns (.kyc-full). Card is max-w-2xl, not max-w-md.
    const isDoc=f=>f.field_name==='selfie'||f.field_name.startsWith('doc_');
    const fieldHtmlFor=list=>list.map(fld=>{
      const req=fld.required?' required':'';
      const mark=fld.required?' <span class="text-red-500">*</span>':'';
      const wrap=(fld.field_type==='textarea'||fld.field_type==='file')?' class="kyc-full"':'';
      let input='';
      if(fld.field_type==='select'){
        let opts=[];try{opts=JSON.parse(fld.field_options||'[]');}catch(_){}
        input=`<select name="${fld.field_name}" class="input-field"${req}><option value="">Select...</option>${opts.map(o=>`<option value="${o.value}">${o.label}</option>`).join('')}</select>`;
      }else if(fld.field_type==='textarea'){
        input=`<textarea name="${fld.field_name}" class="input-field" rows="3"${req}></textarea>`;
      }else if(fld.field_type==='file'){
        input=`<input name="${fld.field_name}" type="file" accept="image/*" class="input-field"${req}>`;
      }else{
        input=`<input name="${fld.field_name}" type="${fld.field_type}" class="input-field"${req}>`;
      }
      return `<div${wrap}><label class="input-label">${fld.field_label}${mark}</label>${input}</div>`;
    }).join('');
    const personal=(status.fields||[]).filter(f=>!isDoc(f));
    const docs=(status.fields||[]).filter(isDoc);
    const fieldHtml=
      (personal.length?`<h3 class="font-bold text-sm mb-3">Personal Information</h3><div class="kyc-grid">${fieldHtmlFor(personal)}</div>`:'')+
      (docs.length?`<h3 class="font-bold text-sm mt-6 mb-3 pt-4" style="border-top:1px solid var(--border)">Identity Documents</h3><div class="kyc-grid">${fieldHtmlFor(docs)}</div>`:'');
    Components.layout(`<style>.kyc-grid{display:grid;grid-template-columns:1fr;gap:1rem}@media (min-width:768px){.kyc-grid{grid-template-columns:1fr 1fr}.kyc-full{grid-column:1/-1}}</style><div class="max-w-2xl card">
      <h2 class="font-bold mb-4">Submit KYC</h2>
      <p class="text-sm text-gray-400 mb-4">Fill in your details and upload your documents to verify your identity and unlock Main Balance withdrawals.</p>
      <form id="kyc-form">
        ${fieldHtml}
        <div id="kyc-err" class="alert-danger hidden mt-4"></div>
        <button type="submit" id="kyc-btn" class="btn-primary mt-5">Submit KYC</button>
      </form></div>`,'KYC Verification','');
    document.getElementById('kyc-form').onsubmit=async(e)=>{
      e.preventDefault();const f=e.target,err=document.getElementById('kyc-err'),btn=document.getElementById('kyc-btn');
      err.classList.add('hidden');utils.loading(btn,true);
      try{await api.upload('/api/kyc/submit',new FormData(f));utils.toast('KYC submitted! Under review.','success');Pages.kyc();}
      catch(ex){err.textContent=ex.message;err.classList.remove('hidden');}
      utils.loading(btn,false);
    };
  }catch(e){document.getElementById('app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
