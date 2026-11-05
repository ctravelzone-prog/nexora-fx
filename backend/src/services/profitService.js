// profitService.js — 22-day profit schedule
// Target: profit_target_bp setting (default 1000 bp = 10%) over 22 weekday-only days
// 2 or 3 loss days, varying daily rates, Day 22 balances to exactly the target
const { getDb } = require('../models/database');
const H = require('./moneyHelpers');

// Global cycle target in basis points (100 = 1%). Admin sets it in Money Settings.
function getTargetBp() { const v = parseInt(H.getSetting('profit_target_bp','1000')); return Number.isFinite(v) && v >= 0 ? v : 1000; }

function generateSchedule(year, month) {
  const db = getDb();
  const TARGET_BP = getTargetBp();
  db.prepare('DELETE FROM profit_schedule WHERE cycle_year=? AND cycle_month=?').run(year, month);
  const lossCount = Math.random() < 0.5 ? 2 : 3;
  const posCount = 22 - lossCount;
  const lossRates = Array.from({length:lossCount},()=>-(20+Math.floor(Math.random()*21)));
  const totalLossBp = lossRates.reduce((a,b)=>a+b,0);
  const totalPosBp = TARGET_BP - totalLossBp;
  const posRates = variedRates(posCount, totalPosBp);
  const lossPos = pickLossPos(22, lossCount);
  const days = [];
  let pi=0, li=0;
  for(let i=1;i<=22;i++){
    if(lossPos.includes(i)) days.push({day:i,rate:lossRates[li++],isLoss:1});
    else days.push({day:i,rate:posRates[pi++],isLoss:0});
  }
  const sumWithout22 = days.slice(0,21).reduce((a,r)=>a+r.rate,0);
  days[21].rate = TARGET_BP - sumWithout22;
  days[21].isLoss = days[21].rate < 0 ? 1 : 0;
  const ins = db.prepare('INSERT INTO profit_schedule (cycle_year,cycle_month,day_number,rate_bp,is_loss) VALUES (?,?,?,?,?)');
  db.transaction(rows=>{ for(const r of rows) ins.run(year,month,r.day,r.rate,r.isLoss); })(days);
  return days;
}

function variedRates(count, total) {
  if(count<=0) return [];
  const raw = Array.from({length:count},()=>10+Math.random()*60);
  const s = raw.reduce((a,b)=>a+b,0);
  const sc = raw.map(r=>Math.round(r/s*total));
  sc[sc.length-1] += total - sc.reduce((a,b)=>a+b,0);
  for(let i=sc.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1));[sc[i],sc[j]]=[sc[j],sc[i]]; }
  return sc;
}

function pickLossPos(total, n) {
  const avail=[]; for(let i=2;i<=total-1;i++) avail.push(i);
  const pos=[];
  while(pos.length<n){ pos.push(avail.splice(Math.floor(Math.random()*avail.length),1)[0]); }
  return pos;
}

function getSchedule(year, month) {
  return getDb().prepare('SELECT * FROM profit_schedule WHERE cycle_year=? AND cycle_month=? ORDER BY day_number').all(year,month);
}

// Showcase profit: display-only profit for showcase accounts, 10% target over the
// same 22-day schedule, computed on the DISPLAY copy balance (showcase_copy_cents)
// and added to the DISPLAY profit (showcase_profit_cents). No real transactions,
// no daily_pnl_log rows, no balances rows — so showcase money never appears in
// admin totals, ledgers or reports. Idempotent via showcase_profit_log (one row
// per showcase user per schedule day). Runs only on a FULL apply (not a
// single-user manual apply).
function applyShowcasePnl(db, rateBp, yr, mo, day) {
  const users = db.prepare('SELECT id, showcase_copy_cents FROM users WHERE is_showcase=1 AND showcase_copy_cents>0').all();
  let cnt = 0, tot = 0;
  const has = db.prepare('SELECT id FROM showcase_profit_log WHERE user_id=? AND cycle_year=? AND cycle_month=? AND day_number=?');
  const ins = db.prepare('INSERT INTO showcase_profit_log (user_id,cycle_year,cycle_month,day_number,rate_bp,amount_cents) VALUES (?,?,?,?,?,?)');
  const upd = db.prepare('UPDATE users SET showcase_profit_cents=showcase_profit_cents+? WHERE id=?');
  for (const u of users) {
    if (has.get(u.id, yr, mo, day)) continue;
    const ac = Math.round((u.showcase_copy_cents || 0) * rateBp / 10000);
    ins.run(u.id, yr, mo, day, rateBp, ac);
    upd.run(ac, u.id);
    // Mirror the real-user flow: spread the day's profit across the user's
    // active copies (proportional to each copy's amount) so the trader
    // profile in Your Copies / My Copies shows its own profit too.
    const copies = db.prepare("SELECT id, amount_cents FROM copies WHERE user_id=? AND status='active'").all(u.id);
    const totCopy = copies.reduce((s, c) => s + c.amount_cents, 0);
    if (totCopy > 0) {
      let remaining = ac;
      copies.forEach((c, i) => {
        const share = (i === copies.length - 1) ? remaining : Math.round(ac * c.amount_cents / totCopy);
        remaining -= share;
        db.prepare('UPDATE copies SET profit_cents=profit_cents+?,daily_pnl_cents=?,updated_at=unixepoch() WHERE id=?').run(share, share, c.id);
      });
    }
    cnt++; tot += ac;
  }
  return { count: cnt, totalApplied: tot };
}

function applyDailyPnl(rateBp, yr, mo, day, targetUserId) {
  const db = getDb();
  return db.transaction(()=>{
    let q="SELECT c.*, u.profit_target_bp FROM copies c JOIN users u ON c.user_id=u.id WHERE c.status='active' AND u.is_showcase=0";
    const p=[]; if(targetUserId){q+=' AND c.user_id=?';p.push(targetUserId);}
    const copies=db.prepare(q).all(...p);
    let cnt=0,tot=0;
    const globalTarget=getTargetBp();
    for(const copy of copies){
      if(db.prepare('SELECT id FROM daily_pnl_log WHERE copy_id=? AND cycle_year=? AND cycle_month=? AND day_number=?').get(copy.id,yr,mo,day)) continue;
      const userTarget=(copy.profit_target_bp!==null&&copy.profit_target_bp!==undefined)?copy.profit_target_bp:globalTarget;
      const rateBpEff=globalTarget>0?Math.round(rateBp*userTarget/globalTarget):rateBp;
      const ac=Math.round(copy.amount_cents*rateBpEff/10000);
      db.prepare('INSERT INTO daily_pnl_log (copy_id,user_id,trader_id,cycle_year,cycle_month,day_number,rate_bp,amount_cents) VALUES (?,?,?,?,?,?,?,?)')
        .run(copy.id,copy.user_id,copy.trader_id,yr,mo,day,rateBpEff,ac);
      db.prepare('UPDATE copies SET profit_cents=profit_cents+?,daily_pnl_cents=?,cycle_day=cycle_day+1,updated_at=unixepoch() WHERE id=?')
        .run(ac,ac,copy.id);
      db.prepare('UPDATE balances SET profit_cents=profit_cents+?,updated_at=unixepoch() WHERE user_id=?').run(ac,copy.user_id);
      db.prepare('INSERT INTO transactions (user_id,type,amount_cents,fee_cents,net_cents,direction,status,reason,formula) VALUES (?,?,?,0,?,?,?,?,?)')
        .run(copy.user_id,'daily_pnl',Math.abs(ac),Math.abs(ac),ac>=0?'in':'out','completed',
          `Daily PnL — Day ${day} of 22`,
          `Profit ${ac>=0?'+=':'-='} ${Math.abs(rateBpEff)/100}% x $${H.fmtC(copy.amount_cents)} = $${H.fmtC(Math.abs(ac))}${ac<0?' (loss)':''}`);
      cnt++;tot+=ac;
    }
    // Showcase accounts earn the same daily rate on their DISPLAY copy balance.
    // Only on a full apply — a single-user manual apply must not touch showcase.
    let sc = { count: 0, totalApplied: 0 };
    if (!targetUserId) sc = applyShowcasePnl(db, rateBp, yr, mo, day);
    db.prepare('UPDATE profit_schedule SET applied=1,applied_at=unixepoch() WHERE cycle_year=? AND cycle_month=? AND day_number=?').run(yr,mo,day);
    return {count:cnt,totalApplied:tot,showcaseCount:sc.count,showcaseTotalApplied:sc.totalApplied};
  })();
}

function rebalanceSchedule(year,month,editedDay,editedRate){
  const db=getDb();
  const TARGET_BP=getTargetBp();
  return db.transaction(()=>{
    db.prepare('UPDATE profit_schedule SET rate_bp=? WHERE cycle_year=? AND cycle_month=? AND day_number=?').run(editedRate,year,month,editedDay);
    const all=db.prepare('SELECT * FROM profit_schedule WHERE cycle_year=? AND cycle_month=? ORDER BY day_number').all(year,month);
    const lockedSum=all.filter(d=>d.applied===1||d.day_number===editedDay).reduce((a,d)=>a+d.rate_bp,0);
    const rem=all.filter(d=>d.applied===0&&d.day_number!==editedDay&&d.day_number!==22);
    if(rem.length>0){
      const needed=TARGET_BP-lockedSum;
      const rawSum=rem.reduce((a,d)=>a+Math.abs(d.rate_bp),0);
      for(const d of rem){
        const nr=rawSum>0?Math.round(Math.abs(d.rate_bp)/rawSum*needed):Math.round(needed/rem.length);
        db.prepare('UPDATE profit_schedule SET rate_bp=? WHERE id=?').run(nr,d.id);
      }
    }
    const d22=all.find(d=>d.day_number===22);
    if(d22&&d22.applied===0){
      const updated=db.prepare('SELECT * FROM profit_schedule WHERE cycle_year=? AND cycle_month=? ORDER BY day_number').all(year,month);
      const s22=updated.filter(d=>d.day_number!==22).reduce((a,d)=>a+d.rate_bp,0);
      db.prepare('UPDATE profit_schedule SET rate_bp=? WHERE cycle_year=? AND cycle_month=? AND day_number=22').run(TARGET_BP-s22,year,month);
    }
  })();
}

// Rebalance a month's remaining (unapplied) days to a new total target.
// Applied days stay exactly as they are; Day 22 (if unapplied) balances the month.
function retargetSchedule(year,month,newTargetBp){
  const db=getDb();
  return db.transaction(()=>{
    const all=db.prepare('SELECT * FROM profit_schedule WHERE cycle_year=? AND cycle_month=? ORDER BY day_number').all(year,month);
    if(!all.length) return {changed:false,reason:'no_schedule'};
    const applied=all.filter(d=>d.applied===1);
    const remaining=all.filter(d=>d.applied!==1);
    if(!remaining.length) return {changed:false,reason:'all_applied'};
    const appliedSum=applied.reduce((a,d)=>a+d.rate_bp,0);
    const needed=newTargetBp-appliedSum;
    const curSum=remaining.reduce((a,d)=>a+d.rate_bp,0);
    const upd=db.prepare('UPDATE profit_schedule SET rate_bp=?,is_loss=? WHERE id=?');
    const non22=remaining.filter(d=>d.day_number!==22);
    if(curSum!==0){
      const factor=needed/curSum;
      for(const d of non22){const nr=Math.round(d.rate_bp*factor);upd.run(nr,nr<0?1:0,d.id);}
    }else{
      const per=remaining.length?Math.round(needed/remaining.length):0;
      for(const d of non22){upd.run(per,per<0?1:0,d.id);}
    }
    const d22=remaining.find(d=>d.day_number===22);
    if(d22){
      const others=db.prepare('SELECT * FROM profit_schedule WHERE cycle_year=? AND cycle_month=?').all(year,month);
      const sumOthers=others.filter(d=>d.day_number!==22).reduce((a,d)=>a+d.rate_bp,0);
      const r22=newTargetBp-sumOthers;
      upd.run(r22,r22<0?1:0,d22.id);
    }
    return {changed:true};
  })();
}

module.exports = { generateSchedule, getSchedule, applyDailyPnl, rebalanceSchedule, retargetSchedule, getTargetBp };
