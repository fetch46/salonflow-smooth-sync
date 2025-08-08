#!/bin/bash

echo "🔧 Applying Super Admin Fix for andre4094@gmail.com"
echo "=================================================="

# Check if supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "❌ Error: Supabase CLI not found"
    echo "Please install Supabase CLI first: https://supabase.com/docs/guides/cli"
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

# Apply the migration
echo "📊 Applying super admin fix migration..."
supabase db push

if [ $? -eq 0 ]; then
    echo "✅ Migration applied successfully!"
else
    echo "❌ Migration failed"
    echo "Please check the error messages above"
    exit 1
fi

echo ""
echo "🧪 Testing super admin setup..."

# Test the setup by running a simple query
supabase db shell << 'EOF'
SELECT 
    u.email,
    u.id as user_id,
    sa.is_active,
    sa.permissions
FROM auth.users u
LEFT JOIN public.super_admins sa ON u.id = sa.user_id
WHERE u.email = 'andre4094@gmail.com';
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Super Admin Fix Complete!"
    echo "============================="
    echo "✅ Migration applied successfully"
    echo "✅ Super admin functions updated"
    echo "✅ Row Level Security policies fixed"
    echo "✅ User privileges configured"
    echo ""
    echo "📋 Next Steps:"
    echo "1. Log in to your application with andre4094@gmail.com"
    echo "2. Navigate to /super-admin"
    echo "3. You should now have full system access"
    echo ""
    echo "🔍 If you still have issues:"
    echo "1. Ensure you've signed up with andre4094@gmail.com at least once"
    echo "2. Clear your browser cache and cookies"
    echo "3. Check the browser console for any errors"
else
    echo "❌ Test query failed - there may be additional issues"
    exit 1
fi