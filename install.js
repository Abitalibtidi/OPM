/**
 * OPM Platform — Cross-Platform Setup Script
 * Works reliably on Windows, Mac, and Linux.
 * Run with: node install.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const SERVER = path.join(ROOT, 'server');
const CLIENT = path.join(ROOT, 'client');

function log(msg) { console.log(`  ${msg}`); }
function ok(msg) { console.log(`  OK: ${msg}`); }
function fail(msg) { console.log(`  FAIL: ${msg}`); }

function run(cmd, cwd) {
  try {
    execSync(cmd, { cwd: cwd || ROOT, stdio: 'pipe' });
    return true;
  } catch (err) {
    console.error(`  Error running: ${cmd}`);
    console.error(`  ${err.stderr ? err.stderr.toString().trim().split('\n')[0] : err.message}`);
    return false;
  }
}

console.log('');
console.log('========================================================');
console.log('       OPM Valuation Platform - Setup');
console.log('========================================================');
console.log('');

// ── Step 1: Verify Node version ──
console.log('[1/5] Checking Node.js...');
const nodeVersion = process.version;
const major = parseInt(nodeVersion.slice(1).split('.')[0], 10);
if (major < 18) {
  fail(`Node.js ${nodeVersion} is too old. Need v18 or higher.`);
  fail('Download the latest from https://nodejs.org');
  process.exit(1);
}
ok(`Node.js ${nodeVersion}`);

// ── Step 2: Create .env file ──
console.log('[2/5] Setting up configuration...');
const envPath = path.join(SERVER, '.env');
const envExamplePath = path.join(SERVER, '.env.example');

if (!fs.existsSync(envPath)) {
  const secret = crypto.randomBytes(32).toString('hex');
  const envContent = [
    `DATABASE_URL="file:./dev.db"`,
    `JWT_SECRET="${secret}"`,
    `PORT=3000`,
    '',
  ].join('\n');
  fs.writeFileSync(envPath, envContent, 'utf8');
  ok('Configuration file created (server/.env)');
} else {
  ok('Configuration file already exists');
}

// ── Step 3: Install dependencies ──
console.log('[3/5] Installing dependencies (this may take 1-2 minutes)...');

log('Installing root dependencies...');
if (!run('npm install')) {
  fail('Root npm install failed');
  process.exit(1);
}

log('Installing server dependencies...');
if (!run('npm install', SERVER)) {
  fail('Server npm install failed');
  process.exit(1);
}

log('Installing client dependencies...');
if (!run('npm install', CLIENT)) {
  fail('Client npm install failed');
  process.exit(1);
}
ok('All dependencies installed');

// ── Step 4: Set up database ──
console.log('[4/5] Setting up database...');

log('Generating Prisma client...');
if (!run('npx prisma generate', SERVER)) {
  fail('Prisma generate failed');
  process.exit(1);
}

log('Running database migrations...');
if (!run('npx prisma migrate dev --name init', SERVER)) {
  // Might already be migrated — try reset
  log('Migration may already exist, continuing...');
}
ok('Database ready');

// ── Step 5: Seed demo data ──
console.log('[5/5] Loading demo data...');
if (!run('npx prisma db seed', SERVER)) {
  log('Seed may have already run, continuing...');
}

console.log('');
console.log('========================================================');
console.log('  SETUP COMPLETE!');
console.log('========================================================');
console.log('');
console.log('  To start the application:');
console.log('');
console.log('    Double-click start.bat (Windows)');
console.log('    Or run: npm run dev');
console.log('');
console.log('  Then open your browser to:');
console.log('');
console.log('    http://localhost:5173');
console.log('');
console.log('  Demo Accounts:');
console.log('    Admin:    admin@opm.local    / admin123!');
console.log('    Analyst:  analyst@opm.local  / analyst123!');
console.log('    Reviewer: reviewer@opm.local / reviewer123!');
console.log('');
console.log('========================================================');
console.log('');
