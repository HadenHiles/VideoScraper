const { exec } = require('child_process');

// Start backend
const backend = exec('cd server && npm start', { shell: true });
backend.stdout.on('data', data => process.stdout.write(`[backend] ${data}`));
backend.stderr.on('data', data => process.stderr.write(`[backend] ${data}`));

// Start frontend
const frontend = exec('npm run dev', { shell: true });
frontend.stdout.on('data', data => process.stdout.write(`[frontend] ${data}`));
frontend.stderr.on('data', data => process.stderr.write(`[frontend] ${data}`));

process.on('SIGINT', () => {
    backend.kill();
    frontend.kill();
    process.exit();
});
