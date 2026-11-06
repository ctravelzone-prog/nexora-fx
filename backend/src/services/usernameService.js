// services/usernameService.js — username rules + suggestions.
// Rule (Siam): a username may use ONLY lowercase a-z, 0-9, hyphen - and
// underscore _. No uppercase, no spaces, nothing else.
// normalizeUsername turns whatever the user typed into the closest valid
// name (lowercase it; spaces and disallowed chars become _; repeated
// separators collapse; edge separators trimmed). suggestUsernames returns
// up to `count` names that are free in the database: the normalized base
// first, then base+1, base+2, ... (max ~20 tries).
const USERNAME_RE=/^[a-z0-9_-]+$/;

function normalizeUsername(input){
  let s=String(input||'').toLowerCase().trim();
  s=s.replace(/[^a-z0-9_-]+/g,'_');
  s=s.replace(/_{2,}/g,'_').replace(/-{2,}/g,'-');
  s=s.replace(/^[_-]+|[_-]+$/g,'');
  if(!s) s='user';
  return s.slice(0,30);
}

function suggestUsernames(db,input,count){
  const base=normalizeUsername(input);
  const out=[];let n=0,tries=0;
  while(out.length<count && tries<20){
    const cand=n===0?base:base+n;
    tries++;n++;
    if(!USERNAME_RE.test(cand)) continue;
    if(!db.prepare('SELECT id FROM users WHERE username=?').get(cand)) out.push(cand);
  }
  return out;
}

module.exports={USERNAME_RE,normalizeUsername,suggestUsernames};
