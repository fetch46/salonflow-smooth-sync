import { serve } from "https://deno.land/std@0.223.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Server not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: getUserErr } = await userClient.auth.getUser();
    if (getUserErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const body = await req.json();
    const { organization_id, email, role, send_email } = body || {};

    // Check if user is admin of the organization
    const { data: isOrgAdmin, error: orgErr } = await userClient.rpc("is_admin_of_organization", { org_id: organization_id });
    if (orgErr) {
      return new Response(JSON.stringify({ error: "Organization privilege check failed", details: orgErr.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    if (!isOrgAdmin) {
      return new Response(JSON.stringify({ error: "Only organization admins can add users" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!organization_id || !email) {
      return new Response(JSON.stringify({ error: "organization_id and email are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const allowedRoles = new Set(["admin", "manager", "member", "staff", "viewer", "accountant"]);
    const roleValue = String(role || "staff");
    if (!allowedRoles.has(roleValue)) {
      return new Response(JSON.stringify({ error: "Invalid role value" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Check if user exists by email
    let userId = null;
    const { data: existingUser } = await adminClient.auth.admin.getUserByEmail(email);
    
    if (existingUser.user) {
      userId = existingUser.user.id;
      
      // Check if user is already in this organization
      const { data: existingOrgUser } = await adminClient
        .from('organization_users')
        .select('id')
        .eq('organization_id', organization_id)
        .eq('user_id', userId)
        .single();

      if (existingOrgUser) {
        return new Response(JSON.stringify({ error: 'User is already a member of this organization' }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    } else {
      // Create new user account
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          invited_to_org: organization_id,
          role: roleValue
        }
      });

      if (createError) {
        return new Response(JSON.stringify({ error: `Failed to create user: ${createError.message}` }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      userId = newUser.user.id;

      // Create profile for new user
      await adminClient
        .from('profiles')
        .insert({
          user_id: userId,
          email: email,
          full_name: email.split('@')[0] // Default name from email
        });
    }

    // Add user to organization
    const { data, error } = await adminClient
      .from("organization_users")
      .insert({
        organization_id,
        user_id: userId,
        role: roleValue,
        is_active: true,
        invited_by: userData.user.id,
        invited_at: new Date().toISOString(),
        joined_at: new Date().toISOString(),
      })
      .select("id, organization_id, user_id, role, is_active")
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Send invitation email if requested
    if (send_email && !existingUser.user) {
      // Generate password reset link for new users
      const { error: resetError } = await adminClient.auth.admin.generateLink({
        type: 'invite',
        email: email,
        options: {
          redirectTo: `${req.headers.get('origin') || 'http://localhost:5173'}/auth`
        }
      });

      if (resetError) {
        console.error('Failed to send invitation email:', resetError);
      }
    }

    return new Response(JSON.stringify({ success: true, membership: data, user_id: userId }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});

