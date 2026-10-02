import { spawn } from 'node:child_process';
const mode = process.argv[2];
if (!['fixed', 'vulnerable'].includes(mode)) throw new Error('Specify fixed or vulnerable');
const child = spawn(process.execPath, ['--test', 'tests/policy.test.mjs'], { stdio: 'inherit', env: { ...process.env, LAB_MODE: mode } });
child.on('exit', code => process.exit(code ?? 1));
