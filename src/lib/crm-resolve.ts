import { supabase } from '@/integrations/supabase/client';

export interface CrmContactInfo {
  name: string;
  email: string;
  address: string;
  gstNumber: string;
  state: string;
  phone: string;
  contactPerson: string;
  entityType: string;
  entityName: string;
}

export interface CrmResolution {
  client: CrmContactInfo | null;
  merchant: CrmContactInfo | null;
  primaryUserId: string | null;
}

/**
 * Resolve CRM contact info from a patient's entity assignments.
 * Checks company > clinic > doctor > lab in priority order for client.
 * Uses lab for merchant details.
 */
export async function resolveCrmContacts(patient: {
  clinic_name?: string | null;
  doctor_name?: string | null;
  lab_name?: string | null;
  company_name?: string | null;
}): Promise<CrmResolution> {
  const entityNames: { name: string; type: string }[] = [];
  if (patient.company_name) entityNames.push({ name: patient.company_name, type: 'company' });
  if (patient.clinic_name) entityNames.push({ name: patient.clinic_name, type: 'clinic' });
  if (patient.doctor_name) entityNames.push({ name: patient.doctor_name, type: 'doctor' });
  if (patient.lab_name) entityNames.push({ name: patient.lab_name, type: 'lab' });

  if (entityNames.length === 0) return { client: null, merchant: null, primaryUserId: null };

  // Fetch all matching entities in one query
  const { data: entities } = await supabase
    .from('settings_entities')
    .select('*')
    .eq('is_deleted', false)
    .in('entity_name', entityNames.map(e => e.name));

  const entityMap = new Map<string, any>();
  (entities || []).forEach(e => entityMap.set(`${e.entity_type}:${e.entity_name}`, e));

  const toContactInfo = (entity: any): CrmContactInfo => ({
    name: entity.entity_name,
    email: entity.email || '',
    address: [entity.address, entity.city, entity.state, entity.country].filter(Boolean).join(', '),
    gstNumber: entity.gst_number || '',
    state: entity.state || '',
    phone: entity.phone || '',
    contactPerson: entity.contact_person || '',
    entityType: entity.entity_type,
    entityName: entity.entity_name,
  });

  // Client: company > clinic > doctor (first one with email preferred)
  let client: CrmContactInfo | null = null;
  const clientPriority = ['company', 'clinic', 'doctor'];
  for (const type of clientPriority) {
    const match = entityNames.find(e => e.type === type);
    if (match) {
      const entity = entityMap.get(`${type}:${match.name}`);
      if (entity) {
        const info = toContactInfo(entity);
        if (!client || (info.email && !client.email)) {
          client = info;
        }
      }
    }
  }

  // Merchant: lab entity
  let merchant: CrmContactInfo | null = null;
  if (patient.lab_name) {
    const labEntity = entityMap.get(`lab:${patient.lab_name}`);
    if (labEntity) merchant = toContactInfo(labEntity);
  }

  // Resolve primary user from user_assignments
  let primaryUserId: string | null = null;
  if (client) {
    const { data: assignments } = await supabase
      .from('user_assignments')
      .select('user_id')
      .eq('assignment_type', client.entityType)
      .eq('assignment_value', client.entityName)
      .limit(1);
    if (assignments && assignments.length > 0) {
      primaryUserId = assignments[0].user_id;
    }
  }

  return { client, merchant, primaryUserId };
}
