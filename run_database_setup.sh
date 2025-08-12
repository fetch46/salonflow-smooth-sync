#!/bin/bash

# Database Setup Script for Salon Management System
# This script sets up all required database tables and relationships

echo "🚀 Starting Database Setup for Salon Management System"
echo "=================================================="

# Check if we're in the right directory
if [ ! -f "setup_database.sql" ]; then
    echo "❌ Error: setup_database.sql not found in current directory"
    echo "Please run this script from the project root directory"
    exit 1
fi

# Ensure psql is available
if ! command -v psql &> /dev/null; then
    echo "❌ Error: psql not found"
    echo "Please install PostgreSQL client (psql) first"
    echo "Ubuntu/Debian: sudo apt-get update && sudo apt-get install -y postgresql-client"
    exit 1
fi

# Require a DATABASE_URL for the target database
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL environment variable is not set"
    echo "Set it to your database connection string, for example:"
    echo "  export DATABASE_URL=\"postgresql://USER:PASSWORD@HOST:PORT/DBNAME?sslmode=require\""
    echo "For Supabase, use the 'Connection string' from Settings → Database (Project connection string)."
    exit 1
fi

# Optional: show the target host for confirmation
DB_HOST=$(python3 - <<'PY'
import os
from urllib.parse import urlparse
u = urlparse(os.environ.get('DATABASE_URL',''))
print(u.hostname or '')
PY
)

if [ -n "$DB_HOST" ]; then
  echo "Target host: $DB_HOST"
fi

# Run the database setup
echo "📊 Running database setup via psql..."
echo "This may take a few minutes..."

# -v ON_ERROR_STOP=1 to stop on first error
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f setup_database.sql

if [ $? -eq 0 ]; then
    echo "✅ Database setup completed successfully!"
    echo ""
    echo "🎉 Your database is now ready with:"
    echo "   • Core tables, functions, policies, and defaults"
    echo ""
    echo "📚 Check DATABASE_STRUCTURE.md for complete documentation"
    echo ""
    echo "🚀 You can now:"
    echo "   1. Create your first organization"
    echo "   2. Add staff members"
    echo "   3. Set up services and inventory"
    echo "   4. Start managing appointments and sales"
else
    echo "❌ Database setup failed"
    echo "Please review the error messages above."
    echo "If you attempted to run this in a non-psql context (e.g., Supabase SQL editor), note that psql meta-commands like \i are not supported there."
    exit 1
fi

echo ""
echo "🔗 Next steps:"
echo "   1. Start your development server: npm run dev"
echo "   2. Navigate to /setup to create your first organization"
echo "   3. Complete the onboarding process"
echo ""
echo "📖 For more information, see:"
echo "   • DATABASE_STRUCTURE.md - Complete database documentation"
echo "   • README.md - Project overview and setup instructions"