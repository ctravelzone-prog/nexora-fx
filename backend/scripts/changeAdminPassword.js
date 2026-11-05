#!/usr/bin/env node
// changeAdminPassword.js — CLI tool to change admin password
// Usage: npm run change-admin-password
// Never prints or logs the plain-text password.
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
