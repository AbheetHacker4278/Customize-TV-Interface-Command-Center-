import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const clientDir = path.join(__dirname, 'client');
const serverDir = path.join(__dirname, 'server');
const reqFile = path.join(serverDir, 'requirements.txt');

console.log('==> [1/3] Checking & Installing Python dependencies (adb-shell)...');
try {
  const pipCmd = process.platform === 'win32'
    ? `pip install -r "${reqFile}"`
    : `pip3 install --user -r "${reqFile}" || pip install -r "${reqFile}"`;
  execSync(pipCmd, { stdio: 'inherit', cwd: __dirname });
  console.log('✓ Python adb-shell installed successfully.');
} catch (e) {
  console.log('Notice: Python pip install skipped or not available on host. Cloud fallback mode will be active.');
}

console.log('==> [2/3] Installing frontend dependencies & building React client...');
execSync('npm install --include=dev', { stdio: 'inherit', cwd: clientDir });
execSync('npm run build', { stdio: 'inherit', cwd: clientDir });
console.log('✓ React client built successfully.');

console.log('==> [3/3] Installing backend server dependencies...');
execSync('npm install', { stdio: 'inherit', cwd: serverDir });
console.log('✓ Backend dependencies installed successfully.');

console.log('\n=========================================');
console.log('✨ All build steps completed successfully!');
console.log('=========================================\n');
