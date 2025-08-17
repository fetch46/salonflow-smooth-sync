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
    if (!isSuperAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const body = await req.json();
    const { email, password, full_name, organization_id, role, confirm } = body || {};

    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "email is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (password && (typeof password !== "string" || password.length < 8)) {
      return new Response(JSON.stringify({ error: "Password must be at least 8 characters" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Try to find existing auth user via profiles
    let targetUserId: string | null = null;
    try {
      const { data: existingProfile } = await adminClient
        .from("profiles")
        .select("user_id")
        .eq("email", email)
        .maybeSingle();
      if (existingProfile?.user_id) targetUserId = existingProfile.user_id as string;
    } catch (_) {}

    // If no existing user, create one via Admin API
    if (!targetUserId) {
      const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
        email,
        password: password || undefined,
        email_confirm: !!confirm,
      } as any);
      if (createErr) {
        return new Response(JSON.stringify({ error: createErr.message }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      targetUserId = created?.user?.id ?? null;
      if (!targetUserId) {
        return new Response(JSON.stringify({ error: "Failed to create user" }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    } else if (password) {
      // If user already exists and password is provided, set it now
      const { error: pwdErr } = await adminClient.auth.admin.updateUserById(targetUserId, { password });
      if (pwdErr) {
        return new Response(JSON.stringify({ error: pwdErr.message }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // Upsert profile
    try {
      await adminClient
        .from("profiles")
        .upsert(
          { user_id: targetUserId, email, full_name: full_name || null, updated_at: new Date().toISOString() },
          { onConflict: "user_id" } as any,
        );
    } catch (_) {}

    // Optionally add to organization as staff
    if (organization_id) {
      try {
        await adminClient
          .from("organization_users")
          .upsert(
            {
              organization_id,
              user_id: targetUserId,
              role: (role as string) || "staff",
              is_active: true,
              invited_by: userData.user.id,
              invited_at: new Date().toISOString(),
              joined_at: new Date().toISOString(),
            },
            { onConflict: "organization_id,user_id" } as any,
          );
      } catch (_) {}
    }

    // Optionally confirm email for existing users if requested
    if (!password && confirm && targetUserId) {
      try {
        await adminClient.auth.admin.updateUserById(targetUserId, { email_confirm: true } as any);
        await adminClient
          .from("profiles")
          .update({ email_confirmed_at: new Date().toISOString() })
          .eq("user_id", targetUserId);
      } catch (_) {}
    }

    return new Response(
      JSON.stringify({ success: true, user_id: targetUserId }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});