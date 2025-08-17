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
    const { id, organization_id, email, full_name, phone, is_active, commission_rate, specialties, hire_date } = body || {};

    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    let targetId = id as string | null;

    if (!targetId && email) {
      const { data: existing, error: findErr } = await adminClient
        .from("staff")
        .select("id")
        .eq("organization_id", organization_id)
        .eq("email", email)
        .limit(1)
        .maybeSingle();
      if (findErr) {
        return new Response(JSON.stringify({ error: findErr.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      targetId = existing?.id ?? null;
    }

    const updateFields: Record<string, any> = {};
    if (typeof full_name === "string") updateFields.full_name = full_name;
    if (typeof email === "string") updateFields.email = email;
    if (typeof phone === "string") updateFields.phone = phone;
    if (typeof is_active === "boolean") updateFields.is_active = is_active;
    if (typeof commission_rate === "number") updateFields.commission_rate = commission_rate;
    if (Array.isArray(specialties)) updateFields.specialties = specialties;
    if (typeof hire_date === "string") updateFields.hire_date = hire_date;

    let result: any = null;

    if (targetId) {
      const { data, error } = await adminClient
        .from("staff")
        .update({ ...updateFields, organization_id })
        .eq("id", targetId)
        .select("*")
        .single();
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      result = data;
    } else {
      const insertPayload = { organization_id, is_active: true, ...updateFields } as any;
      if (!insertPayload.full_name) insertPayload.full_name = email || "New Staff";
      const { data, error } = await adminClient
        .from("staff")
        .insert(insertPayload)
        .select("*")
        .single();
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      result = data;
    }

    return new Response(JSON.stringify({ success: true, staff: result }), {
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