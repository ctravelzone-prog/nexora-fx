// services/uploads.js — where user-uploaded files live.
// UPLOADS_DIR env or backend/uploads by default. On the VPS set
// UPLOADS_DIR=/root/nexora-data/uploads so profile pictures, trader
// avatars, KYC docs and forget-request documents live next to the
// database, outside the code repo — a deploy can never delete them.
const fs=require('fs');
const path=require('path');
function getUploadsDir(){
  if(process.env.UPLOADS_DIR)return process.env.UPLOADS_DIR;
  return path.join(__dirname,'..','..','uploads');
}
function ensureUploadsDir(){try{fs.mkdirSync(getUploadsDir(),{recursive:true});}catch(_){}}
module.exports={getUploadsDir,ensureUploadsDir};
