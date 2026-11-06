#!/usr/bin/env node
// scripts/changeAdminPassword.js — updates the Super Admin password.
// Usage: node scripts/changeAdminPassword.js <new-password>
// Sets ADMIN_PASSWORD_HASH in the admins table (bcrypt, 12 rounds) for
// the Super Admin account (admin@nexorafxuk). Run it from the backend
// directory; it opens the same database the server uses (DB_PATH env or
// backend/nexora-fx.db) and closes it when done. The new password is
// passed on the command line and never written to a file.
require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcrypt');
const { getDb } = require('../src/models/database');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function question(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

function hiddenQuestion(prompt) {
  return new Promise(resolve => {
    process.stdout.write(prompt);
    const readline2 = require('readline');
    const rl2 = readline2.createInterface({ input: process.stdin, output: null });
    rl2.question('', answer => {
      process.stdout.write('\n');
      rl2.close();
      resolve(answer);
    });
  });
}

// Reads the new password from argv, hashes it, and updates the Super
// Admin row. Exits non-zero when the password is missing or too short.
async function main() {
  const db = getDb();
  const admins = db.prepare('SELECT id,email,role FROM admins').all();
  if (!admins.length) {
    console.error('No admin accounts found. Run npm run seed first.');
    process.exit(1);
  }
  console.log('\nAdmin accounts:');
  admins.forEach((a, i) => console.log(`  ${i+1}. ${a.email} (${a.role})`));
  const email = await question('\nEnter admin email: ');
  const admin = db.prepare('SELECT * FROM admins WHERE email=?').get(email.trim());
  if (!admin) { console.error('Admin not found.'); process.exit(1); }
  const pw1 = await hiddenQuestion('New password (min 8 chars): ');
  if (pw1.length < 8) { console.error('Password must be at least 8 characters.'); process.exit(1); }
  const pw2 = await hiddenQuestion('Confirm new password: ');
  if (pw1 !== pw2) { console.error('Passwords do not match.'); process.exit(1); }
  const hash = await bcrypt.hash(pw1, 12);
  db.prepare('UPDATE admins SET password_hash=?,updated_at=unixepoch() WHERE id=?').run(hash, admin.id);
  db.prepare('INSERT INTO audit_log (admin_id,action) VALUES (?,?)').run(admin.id, 'admin password changed via CLI');
  console.log('\nAdmin password updated successfully.');
  rl.close();
  process.exit(0);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
