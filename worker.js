// Background worker process for scanning jobs
// Run this separately: node worker.js

require('dotenv').config({ path: '.env.local' });

console.log('🚀 Starting LinkGuard Background Worker...\n');

// Import the worker
require('./lib/scanWorker.ts');

console.log('✅ Worker is running and processing jobs');
console.log('📝 Press Ctrl+C to stop\n');

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n⚠️  SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n⚠️  SIGINT received, shutting down gracefully...');
  process.exit(0);
});
