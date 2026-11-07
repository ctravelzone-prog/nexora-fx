// app.js — public app-version endpoint for the Android app's update check.
// GET /api/app/version → {version_code, version_name, download_url, changelog}
// GET /api/app/download → 302 redirect to the CURRENT download_url, so the
// website's APK buttons never go stale: they link here, and a new app
// release only needs the site_settings update (no code change).
// Values come from site_settings (admin-editable via the generic settings
// save); the code defaults below are the current release (v1.6) so the
// endpoint stays correct even after the ephemeral live DB resets.
const router = require('express').Router();
const {getDb} = require('../models/database');

const DEFAULTS = {
  version_code: 9,
  version_name: '1.6',
  download_url: 'https://github.com/ctravelzone-prog/nexora-fx/releases/download/v1.6-android/Nexora.apk',
  changelog: 'Instant notifications — alerts arrive on your phone the moment they are sent (live connection). The Download App button now works inside the app too.',
};

function getSetting(k) {
  try {
    const r = getDb().prepare('SELECT value FROM site_settings WHERE key=?').get(k);
    return r ? r.value : null;
  } catch (e) { return null; }
}

router.get('/version', (req, res) => {
  const code = parseInt(getSetting('app_latest_version_code') || DEFAULTS.version_code, 10);
  res.json({
    version_code: Number.isFinite(code) ? code : DEFAULTS.version_code,
    version_name: getSetting('app_latest_version_name') || DEFAULTS.version_name,
    download_url: getSetting('app_download_url') || DEFAULTS.download_url,
    changelog: getSetting('app_changelog') || DEFAULTS.changelog,
  });
});

// GET /download — always the latest APK. The website's download buttons
// link here (not to a versioned GitHub URL), so a new release can never
// leave a stale button behind again.
router.get('/download', (req, res) => {
  res.redirect(getSetting('app_download_url') || DEFAULTS.download_url);
});

module.exports = router;
