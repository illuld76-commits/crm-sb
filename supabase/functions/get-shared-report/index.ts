import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const type = url.searchParams.get("type"); // 'journey' or 'report'

    if (!token || !type) {
      return new Response(JSON.stringify({ error: "Missing token or type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (type === "report") {
      // Fetch plan by share_token, must be published
      const { data: plan, error: planErr } = await supabase
        .from("treatment_plans")
        .select("*")
        .eq("share_token", token)
        .eq("status", "published")
        .single();

      if (planErr || !plan) {
        return new Response(JSON.stringify({ error: "Report not found or not published." }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const [{ data: sections }, { data: remarks }] = await Promise.all([
        supabase.from("plan_sections").select("section_type, data_json, caption, file_url, sort_order").eq("plan_id", plan.id).order("sort_order"),
        supabase.from("plan_remarks").select("remark_text, created_at, user_id").eq("plan_id", plan.id).order("created_at", { ascending: false }),
      ]);

      return new Response(JSON.stringify({
        plan: { plan_name: plan.plan_name, plan_date: plan.plan_date, notes: plan.notes },
        sections: sections || [],
        remarks: (remarks || []).map((r: any) => ({ remark_text: r.remark_text, created_at: r.created_at })),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type === "journey") {
      const { data: patient, error: pErr } = await supabase
        .from("patients")
        .select("patient_name, patient_id_label")
        .eq("share_token", token)
        .single();

      if (pErr || !patient) {
        return new Response(JSON.stringify({ error: "Patient journey not found." }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get patient id for further queries
      const { data: patientFull } = await supabase
        .from("patients")
        .select("id")
        .eq("share_token", token)
        .single();

      const patientId = patientFull!.id;

      const { data: phases } = await supabase
        .from("phases")
        .select("id, phase_name, phase_order")
        .eq("patient_id", patientId)
        .order("phase_order");

      let plans: any[] = [];
      let sections: any[] = [];
      let remarks: any[] = [];

      if (phases && phases.length > 0) {
        const phaseIds = phases.map((p: any) => p.id);
        const { data: planData } = await supabase
          .from("treatment_plans")
          .select("id, phase_id, plan_name, plan_date, notes, status")
          .in("phase_id", phaseIds)
          .order("sort_order");
        plans = planData || [];

        if (plans.length > 0) {
          const planIds = plans.map((p: any) => p.id);
          const [{ data: secData }, { data: remData }] = await Promise.all([
            supabase.from("plan_sections").select("plan_id, section_type, data_json, file_url, caption, sort_order").in("plan_id", planIds).order("sort_order"),
            supabase.from("plan_remarks").select("plan_id, remark_text, created_at").in("plan_id", planIds).order("created_at"),
          ]);
          sections = secData || [];
          remarks = remData || [];
        }
      }

      return new Response(JSON.stringify({
        patient: { patient_name: patient.patient_name, patient_id_label: patient.patient_id_label },
        phases: phases || [],
        plans,
        sections,
        remarks,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid type" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
