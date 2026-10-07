// Editor state regressions now use the production history/storage modules.
// Visible controls, viewport changes and tool behavior are additionally checked
// through the native browser workflow documented in docs/VERIFICATION.md.
const {execFileSync}=require('node:child_process');
execFileSync(process.execPath,['--test','tests/history.test.js','tests/storage.test.js'],{stdio:'inherit'});
