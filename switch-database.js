#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'prisma', 'schema.prisma');

// Read current schema
let schema = fs.readFileSync(schemaPath, 'utf8');

const databaseType = process.argv[2];

if (!databaseType || !['sqlite', 'postgresql'].includes(databaseType)) {
  console.log('Usage: node switch-database.js [sqlite|postgresql]');
  process.exit(1);
}

if (databaseType === 'sqlite') {
  // Switch to SQLite
  schema = schema.replace(
    /datasource db \{\s*provider = "postgresql"\s*url\s*=\s*env\("DATABASE_URL"\)\s*\}/,
    `datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}`
  );
  console.log('Switched to SQLite database');
} else {
  // Switch to PostgreSQL
  schema = schema.replace(
    /datasource db \{\s*provider = "sqlite"\s*url\s*=\s*"file:\.\/dev\.db"\s*\}/,
    `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}`
  );
  console.log('Switched to PostgreSQL database');
}

// Write updated schema
fs.writeFileSync(schemaPath, schema);

// Regenerate Prisma client
const { execSync } = require('child_process');
try {
  execSync('npx prisma generate', { stdio: 'inherit' });
  console.log('Prisma client regenerated successfully');
} catch (error) {
  console.error('Error regenerating Prisma client:', error.message);
}
