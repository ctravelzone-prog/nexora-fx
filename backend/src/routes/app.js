// app.js — public app-version endpoint for the Android app's update check.
// GET /api/app/version → {version_code, version_name, download_url, changelog}
// Values come from site_settings (admin-editable via the generic settings
// save); the code defaults below are the current release (v1.3) so the
// endpoint stays correct even after the ephemeral live DB resets.
const router = require('express').Router();
const {getDb} = require('../models/database');

const DEFAULTS = {
  version_code: 8,
  version_name: '1.5',
  download_url: 'https://github.com/ctravelzone-prog/nexora-fx/releases/download/v1.5-android/NexoraFX-1.5.apk',
  changelog: 'Instant notifications — alerts arrive on your phone the moment they are sent (live connection), plus all the latest site updates.',
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

module.exports = router;
