// Supabase Edge Function: set-user-password
// Allows super admins to set (create/reset) a user's password via Admin API
// Mirrors the confirm-user function's auth and privilege checks

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

    // Client bound to end-user JWT for identity checks & RLS
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Admin client with service role for privileged operations
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller identity
    const { data: userData, error: getUserErr } = await userClient.auth.getUser();
    if (getUserErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Check super admin privilege via RPC
    const { data: isSuperAdmin, error: saErr } = await userClient.rpc("is_super_admin", { uid: userData.user.id });
    if (saErr) {
      return new Response(JSON.stringify({ error: "Privilege check failed", details: saErr.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const body = await req.json();
    const { user_id, new_password, organization_id } = body || {};

    if (!user_id || !new_password) {
      return new Response(JSON.stringify({ error: "user_id and new_password are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (typeof new_password !== "string" || new_password.length < 8) {
      return new Response(JSON.stringify({ error: "Password must be at least 8 characters" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // If caller is not a super admin, require that they are an OWNER of the provided organization
    // and that the target user belongs to the same organization
    if (!isSuperAdmin) {
      if (!organization_id) {
        return new Response(JSON.stringify({ error: "organization_id is required for non-super-admins" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Verify caller is OWNER in the organization
      const { data: ownerMembership, error: ownerErr } = await adminClient
        .from("organization_users")
        .select("id")
        .eq("organization_id", organization_id)
        .eq("user_id", userData.user.id)
        .eq("role", "owner")
        .eq("is_active", true)
        .maybeSingle();

      if (ownerErr) {
        return new Response(JSON.stringify({ error: "Ownership check failed", details: ownerErr.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      if (!ownerMembership) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Verify target user is a member of the same organization
      const { data: targetMembership, error: targetErr } = await adminClient
        .from("organization_users")
        .select("id")
        .eq("organization_id", organization_id)
        .eq("user_id", user_id)
        .eq("is_active", true)
        .maybeSingle();

      if (targetErr) {
        return new Response(JSON.stringify({ error: "Target membership check failed", details: targetErr.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      if (!targetMembership) {
        return new Response(JSON.stringify({ error: "User is not a member of the specified organization" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // Set the user's password via Admin API
    const { data: updated, error: updErr } = await adminClient.auth.admin.updateUserById(user_id, {
      password: new_password,
    });

    if (updErr) {
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ success: true, user: updated?.user ?? null }), {
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