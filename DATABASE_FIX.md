# Database Fix Instructions

## Problem
The application was experiencing database errors due to missing columns (`Exam.teacherId` and `Submission.examId`) in the PostgreSQL database.

## Solution Implemented

### 1. Temporary Fix (SQLite)
The application has been temporarily switched to use SQLite to resolve immediate functionality issues:
```bash
npm run db:switch:sqlite
```

### 2. Permanent Fix (PostgreSQL)
When the PostgreSQL database connection is restored, run the following steps:

#### Option A: Use the Migration Script
1. Switch back to PostgreSQL:
   ```bash
   npm run db:switch:postgres
   ```

2. Run the SQL migration script:
   ```bash
   # Connect to your PostgreSQL database and run:
   psql -d your_database_name -f fix-database-schema.sql
   ```

3. Push the schema changes:
   ```bash
   npm run db:push
   ```

#### Option B: Reset and Recreate
1. Switch back to PostgreSQL:
   ```bash
   npm run db:switch:postgres
   ```

2. Reset the database (WARNING: This will delete all data):
   ```bash
   npm run db:reset
   ```

## Database Switching Commands

### Switch to SQLite (for development/local testing)
```bash
npm run db:switch:sqlite
```

### Switch to PostgreSQL (for production)
```bash
npm run db:switch:postgres
```

## Verification
After switching databases, verify the application works by:
1. Starting the dev server: `npm run dev`
2. Testing API endpoints:
   - `http://localhost:3000/api/teachers`
   - `http://localhost:3000/api/exams`

## Files Created/Modified
- `fix-database-schema.sql` - SQL script to fix missing columns
- `switch-database.js` - Utility to switch between database types
- `package.json` - Added database switching scripts
- `DATABASE_FIX.md` - This documentation file

## Notes
- The SQLite database is stored in `prisma/dev.db`
- PostgreSQL connection details are stored in environment variables
- Always backup your production database before running migration scripts
