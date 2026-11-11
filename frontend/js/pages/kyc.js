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
// All countries for the searchable Nationality / Country dropdowns
// (Siam 12 Nov 2026). The form still submits a plain country name,
// so no backend change is needed.
const KYC_COUNTRIES=["Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cambodia", "Cameroon", "Canada", "Cape Verde", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czech Republic", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Ivory Coast", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"];
// Searchable country dropdown HTML: a text input + a filterable list.
// Typing filters the list; clicking a country fills the input.
function kycCountryFieldHtml(fld,req){
  return `<div class="kyc-country" data-field="${fld.field_name}"><input name="${fld.field_name}" type="text" class="input-field kyc-country-input" placeholder="Search country..." autocomplete="off"${req}><div class="kyc-country-list hidden"></div></div>`;
}
// Wires up every searchable country dropdown on the page.
function kycInitCountryFields(){
  document.querySelectorAll('.kyc-country').forEach(wrap=>{
    const input=wrap.querySelector('.kyc-country-input');
    const list=wrap.querySelector('.kyc-country-list');
    const render=q=>{
      const query=(q||'').trim().toLowerCase();
      const matches=KYC_COUNTRIES.filter(c=>c.toLowerCase().includes(query));
      list.innerHTML=matches.length?matches.map(c=>`<div class="kyc-country-item" data-v="${c}">${c}</div>`).join(''):'<div class="kyc-country-item kyc-country-none">No country found</div>';
      list.classList.remove('hidden');
    };
    input.addEventListener('focus',()=>render(input.value));
    input.addEventListener('input',()=>render(input.value));
    list.addEventListener('click',e=>{
      const item=e.target.closest('.kyc-country-item[data-v]');
      if(!item)return;
      input.value=item.dataset.v;
      list.classList.add('hidden');
    });
    document.addEventListener('click',e=>{if(!wrap.contains(e.target))list.classList.add('hidden');});
  });
}
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
    // Layout (v118, v119): two sections — Personal Information and Identity
    // Documents — each in a .kyc-grid. The grid is ONE column on phones
    // and TWO columns on tablet/desktop (media query below), so the form
    // is about half as long on a wide screen. Long fields (address, file
    // uploads) span both columns (.kyc-full). The card is max-w-3xl and
    // mx-auto, so it sits centered in the content area on every device
    // instead of hugging the left edge.
    const isDoc=f=>f.field_name==='selfie'||f.field_name.startsWith('doc_');
    const fieldHtmlFor=list=>list.map(fld=>{
      const req=fld.required?' required':'';
      const mark=fld.required?' <span class="text-red-500">*</span>':'';
      const wrap=(fld.field_type==='textarea'||fld.field_type==='file')?' class="kyc-full"':'';
      let input='';
      if(fld.field_name==='nationality'||fld.field_name==='country'){
        input=kycCountryFieldHtml(fld,req);
      }else if(fld.field_type==='select'){
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
    Components.layout(`<style>.kyc-grid{display:grid;grid-template-columns:1fr;gap:1rem}@media (min-width:768px){.kyc-grid{grid-template-columns:1fr 1fr}.kyc-full{grid-column:1/-1}}.kyc-country{position:relative}.kyc-country-list{position:absolute;left:0;right:0;top:100%;z-index:20;max-height:220px;overflow:auto;background:#fff;border:1px solid var(--border);border-radius:.75rem;margin-top:4px;box-shadow:0 8px 24px rgba(0,0,0,.12)}.kyc-country-item{padding:10px 12px;cursor:pointer;font-size:14px}.kyc-country-item:hover{background:#fff7ed}.kyc-country-none{color:#9ca3af;cursor:default}.kyc-file-done{border-color:#22c55e !important;background-color:#f0fdf4 !important}</style><div class="max-w-3xl card mx-auto">
      <h2 class="font-bold mb-4">Submit KYC</h2>
      <p class="text-sm text-gray-400 mb-4">Fill in your details and upload your documents to verify your identity and unlock Main Balance withdrawals.</p>
      <form id="kyc-form">
        ${fieldHtml}
        <div id="kyc-err" class="alert-danger hidden mt-4"></div>
        <button type="submit" id="kyc-btn" class="btn-primary mt-5">Submit KYC</button>
      </form></div>`,'KYC Verification','');
    kycInitCountryFields();
    // File fields turn light green once a document is chosen (Siam 12 Nov
    // 2026) — front and back each go green on their own when filled.
    document.querySelectorAll('#kyc-form input[type=file]').forEach(inp=>{
      inp.addEventListener('change',()=>{inp.classList.toggle('kyc-file-done',!!(inp.files&&inp.files.length));});
    });
    document.getElementById('kyc-form').onsubmit=async(e)=>{
      e.preventDefault();const f=e.target,err=document.getElementById('kyc-err'),btn=document.getElementById('kyc-btn');
      err.classList.add('hidden');utils.loading(btn,true);
      try{await api.upload('/api/kyc/submit',new FormData(f));utils.toast('KYC submitted! Under review.','success');Pages.kyc();}
      catch(ex){err.textContent=ex.message;err.classList.remove('hidden');}
      utils.loading(btn,false);
    };
  }catch(e){document.getElementById('app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
