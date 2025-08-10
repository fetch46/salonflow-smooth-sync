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

# Check if supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "❌ Error: Supabase CLI not found"
    echo "Please install Supabase CLI first: https://supabase.com/docs/guides/cli"
    echo "Alternatively, run the SQL in Supabase Dashboard > SQL Editor: setup_database.sql and the migrations in supabase/migrations/*.sql"
    exit 1
fi

echo "✅ Supabase CLI found"

# Check if we're connected to a Supabase project
if ! supabase status &> /dev/null; then
    echo "❌ Error: Not connected to a Supabase project"
    echo "Please run 'supabase login' and 'supabase link' first"
    exit 1
fi

echo "✅ Connected to Supabase project"

# Run the database setup
echo "📊 Running database setup..."
echo "This may take a few minutes..."

# Run the setup script
psql "$(supabase db reset --linked)" -f setup_database.sql

if [ $? -eq 0 ]; then
    echo "✅ Database setup completed successfully!"
    echo ""
    echo "🎉 Your database is now ready with:"
    echo "   • 23+ tables for complete salon management"
    echo "   • Multi-tenant architecture"
    echo "   • Row Level Security (RLS) policies"
    echo "   • Comprehensive indexing"
    echo "   • Default subscription plans"
    echo "   • Default business locations"
    echo "   • Default accounting structure"
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
    echo "Please check the error messages above"
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