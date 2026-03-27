import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  display_name: z.string().optional(),
  password_hint: z.string().nullable().optional(),
  assignments: z.array(
    z.object({
      type: z.string(),
      value: z.string(),
      expires_at: z.string().nullable().optional(),
    })
  ).optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = userData.user.id;

    // Check caller is admin
    const { data: callerRole } = await anonClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .single();

    if (!callerRole || callerRole.role !== "admin") {
      return new Response(JSON.stringify({ error: "Only admins can create users" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, password, display_name, password_hint, assignments } = parsed.data;

    // Use service role to create the user
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: display_name || email },
    });

    if (createErr || !newUser.user) {
      return new Response(
        JSON.stringify({ error: createErr?.message || "Failed to create user" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = newUser.user.id;

    // Insert role (default 'user')
    await adminClient.from("user_roles").insert({ user_id: userId, role: "user" });

    // Update password hint if provided
    if (password_hint) {
      await adminClient
        .from("profiles")
        .update({ password_hint })
        .eq("user_id", userId);
    }

    // Insert assignments
    if (assignments && assignments.length > 0) {
      const rows = assignments.map((a) => ({
        user_id: userId,
        assignment_type: a.type,
        assignment_value: a.value,
        assigned_by: callerId,
        expires_at: a.expires_at || null,
      }));
      await adminClient.from("user_assignments").insert(rows);
    }

    return new Response(
      JSON.stringify({ success: true, user_id: userId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
