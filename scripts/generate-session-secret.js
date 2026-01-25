#!/usr/bin/env node
/**
 * Generate a secure random SESSION_SECRET for production use.
 * 
 * Usage: node scripts/generate-session-secret.js
 */

const crypto = require('crypto');

const secret = crypto.randomBytes(32).toString('base64');

console.log('\n=== SESSION_SECRET (copy this value) ===');
console.log(secret);
console.log('\nAdd this to DigitalOcean App Platform environment variables as:');
console.log('SESSION_SECRET=' + secret);
console.log('\n');
