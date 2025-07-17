#!/usr/bin/env node

// Production startup script for ShareZidi
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Starting ShareZidi production server...');
console.log('📂 Working directory:', process.cwd());

// Check if build files exist
const buildPath = join(process.cwd(), 'server', 'public');
if (!existsSync(buildPath)) {
  console.log('⚠️ Build files not found, building frontend...');
  try {
    const buildProcess = spawn('npm', ['run', 'build'], {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    buildProcess.on('close', (code) => {
      if (code === 0) {
        startServer();
      } else {
        console.error('❌ Build failed with code:', code);
        process.exit(1);
      }
    });
  } catch (error) {
    console.error('❌ Build error:', error);
    process.exit(1);
  }
} else {
  console.log('✅ Build files found, starting server...');
  startServer();
}

function startServer() {
  const serverProcess = spawn('npx', ['tsx', 'server/index.ts'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: process.env.PORT || 5000
    },
    cwd: process.cwd()
  });

  serverProcess.on('error', (error) => {
    console.error('❌ Server failed to start:', error);
    process.exit(1);
  });

  serverProcess.on('exit', (code, signal) => {
    console.log(`⚠️ Server process exited with code ${code} and signal ${signal}`);
    if (code !== 0 && signal !== 'SIGTERM') {
      process.exit(code || 1);
    }
  });

  // Handle process termination gracefully
  process.on('SIGTERM', () => {
    console.log('📴 Received SIGTERM, shutting down...');
    serverProcess.kill('SIGTERM');
  });

  process.on('SIGINT', () => {
    console.log('📴 Received SIGINT, shutting down...');
    serverProcess.kill('SIGINT');
  });
}