// admin-settings.js — Site Settings + Media
AdminPages.settings=async function(){
  try{
    const s=await adminApi.getSettings();
    AdminComponents.layout(`<h2 class="font-bold text-lg mb-4">Site Settings / CMS</h2>
    <form id="settings-form" class="space-y-4">
      <div class="card space-y-3"><h3 class="font-bold mb-2">Hero / Landing</h3>
        <div><label class="input-label">Hero Title</label><input name="hero_title" type="text" value="${s.hero_title||''}" class="input-field"></div>
        <div><label class="input-label">Hero Subtitle</label><input name="hero_subtitle" type="text" value="${s.hero_subtitle||''}" class="input-field"></div>
        <div><label class="input-label">Announcement Bar</label><input name="announcement_bar" type="text" value="${s.announcement_bar||''}" class="input-field" placeholder="Leave empty to hide"></div>
        <div><label class="input-label">Footer About Text</label><textarea name="footer_about" class="input-field" rows="2">${s.footer_about||''}</textarea></div>
      </div>
      <div class="card space-y-3"><h3 class="font-bold mb-2">Media Library</h3>
        <div><label class="input-label">Logo Upload (PNG with transparency)</label><input type="file" id="logo-file" accept="image/png" class="input-field"><button type="button" onclick="AdminPages._upMedia('logo','/api/admin/settings/logo')" class="btn-secondary text-sm mt-2" style="padding:8px 16px">Upload Logo</button>${s.logo_url?`<img src="${s.logo_url}" class="h-8 mt-2" alt="Logo">`:''}</div>
        <div><label class="input-label">Hero Image Upload</label><input type="file" id="hero-file" accept="image/*" class="input-field"><button type="button" onclick="AdminPages._upMedia('hero','/api/admin/settings/hero-image')" class="btn-secondary text-sm mt-2" style="padding:8px 16px">Upload Hero Image</button>${s.hero_image_url?`<img src="${s.hero_image_url}" class="h-16 mt-2 rounded" alt="Hero">`:''}</div>
      </div>
      <div id="set-err" class="alert-danger hidden"></div>
      <button type="submit" id="set-btn" class="btn-primary">Save Settings</button>
    </form>`,'Site Settings / CMS');
    document.getElementById('settings-form').onsubmit=async(e)=>{
      e.preventDefault();const f=e.target,err=document.getElementById('set-err'),btn=document.getElementById('set-btn');
      err.classList.add('hidden');utils.loading(btn,true);
      try{await adminApi.saveSettings({hero_title:f.hero_title.value,hero_subtitle:f.hero_subtitle.value,announcement_bar:f.announcement_bar.value,footer_about:f.footer_about.value});utils.toast('Settings saved!','success');}
      catch(ex){err.textContent=ex.message;err.classList.remove('hidden');}
      utils.loading(btn,false);
    };
  }catch(e){document.getElementById('admin-app').innerHTML=`<p class="p-8 text-red-500">${e.message}</p>`;}
};
AdminPages._upMedia=async function(field,ep){
  const fi=document.getElementById(`${field}-file`);
  if(!fi?.files[0]){utils.toast('Select file first','error');return;}
  const fd=new FormData();fd.append(field,fi.files[0]);
  try{await api.upload(ep,fd,true);utils.toast('Uploaded!','success');AdminPages.settings();}
  catch(e){utils.toast(e.message,'error');}
};
