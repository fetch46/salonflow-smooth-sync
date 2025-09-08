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
    const { organization_id, user_id, role, is_active } = body || {};

    // Check if user is admin of the organization
    const { data: isOrgAdmin, error: orgErr } = await userClient.rpc("is_admin_of_organization", { org_id: organization_id });
    if (orgErr) {
      return new Response(JSON.stringify({ error: "Organization privilege check failed", details: orgErr.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    if (!isOrgAdmin) {
      return new Response(JSON.stringify({ error: "Only organization admins can update user roles" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!organization_id || !user_id) {
      return new Response(JSON.stringify({ error: "organization_id and user_id are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (role && typeof role !== "string") {
      return new Response(JSON.stringify({ error: "role must be a string" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const allowedRoles = new Set(["admin", "manager", "member", "staff", "viewer", "accountant"]);
    if (role && !allowedRoles.has(String(role))) {
      return new Response(JSON.stringify({ error: "Invalid role value" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const updateFields: Record<string, any> = {};
    if (role) updateFields.role = String(role);
    if (typeof is_active === "boolean") updateFields.is_active = is_active;

    if (Object.keys(updateFields).length === 0) {
      return new Response(JSON.stringify({ error: "No fields to update" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data, error } = await adminClient
      .from("organization_users")
      .update(updateFields)
      .eq("organization_id", organization_id)
      .eq("user_id", user_id)
      .select("id, organization_id, user_id, role, is_active")
      .maybeSingle();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ success: true, membership: data }), {
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

