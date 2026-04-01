import { supabase } from '@/integrations/supabase/client';
import { CaseRequest, Preset } from '@/types';
import { resolveCrmContacts } from '@/lib/crm-resolve';

export interface ConversionResult {
  patientId: string;
  phaseId: string;
  planIds: string[];
  invoiceId?: string;
}

/**
 * Centralised case request → project conversion.
 * Creates patient (or links existing), phase, plan(s), copies attachments,
 * and optionally creates a draft invoice from request_items.
 */
export async function convertCaseToProject(
  caseReq: CaseRequest,
  presets: Preset[],
  currentUserId: string,
): Promise<ConversionResult | null> {
  // Idempotency: prevent double conversion
  if ((caseReq as any).converted_at) {
    return null;
  }

  let patientId = caseReq.patient_id || null;

  // 1. Create patient if not linked
  if (!patientId) {
    const companyName = (caseReq.dynamic_data as Record<string, any> | undefined)?.company_name || null;
    const { data: newPatient, error } = await supabase.from('patients').insert({
      patient_name: caseReq.patient_name,
      patient_age: caseReq.patient_age,
      patient_sex: caseReq.patient_sex,
      user_id: caseReq.user_id,
      clinic_name: caseReq.clinic_name || null,
      doctor_name: caseReq.doctor_name || null,
      lab_name: caseReq.lab_name || null,
      company_name: companyName,
    }).select('id').single();
    if (error || !newPatient) return null;
    patientId = newPatient.id;
  }

  // 2. Determine next phase order
  const { data: existingPhases } = await supabase
    .from('phases')
    .select('phase_order')
    .eq('patient_id', patientId)
    .order('phase_order', { ascending: false })
    .limit(1);
  const nextOrder = (existingPhases?.[0]?.phase_order ?? -1) + 1;

  // 3. Create phase named after the request
  const phaseName = (caseReq as any).request_name || caseReq.patient_name;
  const { data: newPhase, error: phaseErr } = await supabase.from('phases').insert({
    patient_id: patientId,
    phase_name: phaseName,
    phase_order: nextOrder,
  }).select('id').single();
  if (phaseErr || !newPhase) return null;

  // 4. Create plan(s) from request items or fallback to single request_type
  const planIds: string[] = [];
  const requestItems = ((caseReq as any).request_items as any[]) || [];

  if (requestItems.length > 0) {
    for (const item of requestItems) {
      const reqTypePreset = presets.find(p => p.category === 'request_type' && p.name === item.request_type);
      const planPresetId = reqTypePreset?.description;
      const planPreset = planPresetId ? presets.find(p => p.id === planPresetId) : null;
      const planName = planPreset?.name || item.request_type || 'Treatment Plan';

      const notesJson = JSON.stringify({
        source: 'case_request',
        case_request_id: caseReq.id,
        request_type: item.request_type,
        plan_preset_id: planPresetId || null,
        qty: item.qty,
        rate: item.rate,
      });

      const { data: plan } = await supabase.from('treatment_plans').insert({
        phase_id: newPhase.id,
        plan_name: planName,
        plan_date: new Date().toISOString().split('T')[0],
        notes: notesJson,
        status: 'draft',
        case_request_id: caseReq.id,
        sort_order: planIds.length,
      }).select('id').single();
      if (plan) planIds.push(plan.id);
    }
  } else {
    // Fallback: single plan from request_type
    const reqTypePreset = presets.find(p => p.category === 'request_type' && p.name === caseReq.request_type);
    const planPresetId = reqTypePreset?.description;
    const planPreset = planPresetId ? presets.find(p => p.id === planPresetId) : null;
    const planName = planPreset?.name || caseReq.request_type || 'Treatment Plan';

    const notesJson = JSON.stringify({
      source: 'case_request',
      case_request_id: caseReq.id,
      request_type: caseReq.request_type,
      plan_preset_id: planPresetId || null,
    });

    const { data: plan } = await supabase.from('treatment_plans').insert({
      phase_id: newPhase.id,
      plan_name: planName,
      plan_date: new Date().toISOString().split('T')[0],
      notes: notesJson,
      status: 'draft',
      case_request_id: caseReq.id,
      sort_order: 0,
    }).select('id').single();
    if (plan) planIds.push(plan.id);
  }

  // 5. Copy attachments to assets (deduplicate by file_url)
  const caseAttachments = caseReq.attachments || [];
  if (caseAttachments.length > 0) {
    const urls = caseAttachments.map((att: any) => att.url).filter(Boolean);
    const { data: existingAssets } = await supabase.from('assets')
      .select('file_url')
      .eq('case_id', patientId!)
      .in('file_url', urls);
    const existingUrls = new Set((existingAssets || []).map(a => a.file_url));
    const newAttachments = caseAttachments.filter((att: any) => att.url && !existingUrls.has(att.url));
    if (newAttachments.length > 0) {
      const assetInserts = newAttachments.map((att: any) => ({
        case_id: patientId!,
        file_url: att.url,
        file_type: att.type || 'application/octet-stream',
        original_name: att.name,
        category: 'case_request_attachment',
        is_viewable: true,
        is_downloadable: true,
      }));
      await supabase.from('assets').insert(assetInserts);
    }
  }

  // 6. Link case request to patient and mark as converted
  await supabase.from('case_requests').update({
    patient_id: patientId,
    status: 'accepted',
    converted_at: new Date().toISOString(),
  } as any).eq('id', caseReq.id);

  // 7. Create draft invoice from request_items
  let invoiceId: string | undefined;
  if (requestItems.length > 0) {
    const lineItems = requestItems.map((item: any) => ({
      description: item.request_type || 'Service',
      hsn: '9993',
      qty: item.qty || 1,
      rate: item.rate || 0,
      disc_pct: 0,
      gst_pct: 18,
    }));
    const totalAmount = lineItems.reduce((s: number, li: any) => s + li.qty * li.rate, 0);

    const companyName = (caseReq.dynamic_data as Record<string, any> | undefined)?.company_name || null;
    const crm = await resolveCrmContacts({
      company_name: companyName,
      clinic_name: caseReq.clinic_name,
      doctor_name: caseReq.doctor_name,
      lab_name: caseReq.lab_name,
    });

    // Auto-populate CRM details with primary user email fallback
    let clientEmail = crm.client?.email || '';
    if (!clientEmail && crm.primaryUserId) {
      const { data: puProfile } = await supabase.from('profiles').select('email').eq('user_id', crm.primaryUserId).single();
      if (puProfile?.email) clientEmail = puProfile.email;
    }
    let clientDetails: any = { name: crm.client?.name || caseReq.patient_name, email: clientEmail, address: crm.client?.address || '' };
    let merchantDetails: any = { name: '', email: '', address: '', bank_details: '' };
    let gstNumber = crm.client?.gstNumber || '';
    let placeOfSupply = crm.client?.state || '';

    if (crm.merchant) {
      merchantDetails = {
        name: crm.merchant.name || '',
        email: crm.merchant.email || '',
        address: crm.merchant.address || '',
        bank_details: '',
      };
    }

    // Generate invoice number
    const { data: lastInv } = await supabase.from('invoices')
      .select('invoice_number')
      .like('invoice_number', `INV-${new Date().getFullYear()}-%`)
      .order('invoice_number', { ascending: false }).limit(1);
    const lastNum = lastInv?.[0]?.invoice_number;
    const num = lastNum ? parseInt(lastNum.split('-').pop() || '0') + 1 : 1;
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(num).padStart(4, '0')}`;

    const { data: inv } = await supabase.from('invoices').insert({
      patient_name: caseReq.patient_name,
      patient_id: patientId,
      phase_id: newPhase.id,
      user_id: currentUserId,
      status: 'draft',
      amount_usd: totalAmount,
      items: lineItems as any,
      merchant_details: merchantDetails as any,
      client_details: clientDetails as any,
      invoice_number: invoiceNumber,
      display_id: invoiceNumber,
      case_request_id: caseReq.id,
      balance_due: totalAmount,
      currency_local: 'INR',
      exchange_rate: 1,
      gst_number: gstNumber || null,
      place_of_supply: placeOfSupply || null,
      hsn_code: '9993',
      primary_user_id: crm.primaryUserId || null,
    }).select('id').single();
    if (inv) invoiceId = inv.id;
  }

  return { patientId: patientId!, phaseId: newPhase.id, planIds, invoiceId };
}
