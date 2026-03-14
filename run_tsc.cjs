const cp = require('child_process');
const fs = require('fs');
try {
    cp.execSync('npx tsc --noEmit', { stdio: 'pipe', encoding: 'utf-8' });
    fs.writeFileSync('tserr.txt', 'SUCCESS', 'utf-8');
} catch (e) {
    fs.writeFileSync('tserr.txt', e.stdout ? e.stdout.toString() : e.message, 'utf-8');
}
