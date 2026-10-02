import { spawn } from 'node:child_process';
const child = spawn(process.execPath, ['server.mjs'], { stdio: 'inherit', env: { ...process.env, LAB_MODE: process.argv[2] } });
child.on('exit', code => process.exit(code ?? 1));
