import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, User, Receipt, FileText, ClipboardList, ExternalLink } from 'lucide-react';
import { useRelationalNav, EntityType } from '@/hooks/useRelationalNav';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

const entityLabels: Record<EntityType, string> = {
  patient: 'Patient', invoice: 'Invoice', case: 'Case',
  plan: 'Plan', workorder: 'Work Order', remark: 'Remark',
};

const entityIcons: Record<EntityType, typeof User> = {
  patient: User, invoice: Receipt, case: ClipboardList,
  plan: FileText, workorder: ClipboardList, remark: FileText,
};

export default function RelationalPreviewDrawer() {
  const { previewState, closePreview, goBack, historyStack, openPreview } = useRelationalNav();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!previewState.isOpen || !previewState.entityId || !previewState.entityType) return;
    setLoading(true);
    setData(null);

    const fetch = async () => {
      const { entityType, entityId } = previewState;
      let result: any = null;

      if (entityType === 'patient') {
        const { data: p } = await supabase.from('patients').select('*').eq('id', entityId).single();
        if (p) {
          const [{ count: phaseCount }, { count: planCount }, { count: caseCount }, { count: invCount }] = await Promise.all([
            supabase.from('phases').select('*', { count: 'exact', head: true }).eq('patient_id', entityId),
            supabase.from('treatment_plans').select('*, phases!inner(patient_id)', { count: 'exact', head: true }).eq('phases.patient_id', entityId),
            supabase.from('case_requests').select('*', { count: 'exact', head: true }).eq('patient_id', entityId).eq('is_deleted', false),
            supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('patient_id', entityId),
          ]);
          result = { ...p, _counts: { phases: phaseCount || 0, plans: planCount || 0, cases: caseCount || 0, invoices: invCount || 0 } };
        }
      } else if (entityType === 'invoice') {
        const { data: inv } = await supabase.from('invoices').select('*').eq('id', entityId).single();
        result = inv;
      } else if (entityType === 'case' || entityType === 'workorder') {
        const { data: cr } = await supabase.from('case_requests').select('*').eq('id', entityId).single();
        result = cr;
      } else if (entityType === 'plan') {
        const { data: pl } = await supabase.from('treatment_plans').select('*, phases(phase_name, patient_id, patients(patient_name))').eq('id', entityId).single();
        result = pl;
      }

      setData(result);
      setLoading(false);
    };

    fetch();
  }, [previewState.isOpen, previewState.entityId, previewState.entityType]);

  const Icon = previewState.entityType ? entityIcons[previewState.entityType] : User;

  return (
    <Sheet open={previewState.isOpen} onOpenChange={(open) => { if (!open) closePreview(); }}>
      <SheetContent side="right" className="w-[380px] sm:w-[420px] p-0">
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center gap-2">
            {historyStack.length > 0 && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <Icon className="h-4 w-4 text-muted-foreground" />
            <SheetTitle className="text-sm">
              {previewState.entityType ? entityLabels[previewState.entityType] : ''} Preview
            </SheetTitle>
          </div>
        </SheetHeader>

        <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(100vh-80px)]">
          {loading && (
            <div className="space-y-3">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-20 w-full" />
            </div>
          )}

          {!loading && !data && (
            <p className="text-sm text-muted-foreground text-center py-8">Not found</p>
          )}

          {/* PATIENT */}
          {!loading && data && previewState.entityType === 'patient' && (
            <>
              <div>
                <h2 className="text-lg font-semibold">{data.patient_name}</h2>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {data.patient_id_label && <Badge variant="outline" className="text-xs">{data.patient_id_label}</Badge>}
                  {data.patient_age && <Badge variant="secondary" className="text-xs">{data.patient_age}y</Badge>}
                  {data.patient_sex && <Badge variant="secondary" className="text-xs">{data.patient_sex}</Badge>}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {data.doctor_name && <Badge variant="outline" className="text-xs">👨‍⚕️ {data.doctor_name}</Badge>}
                {data.clinic_name && <Badge variant="outline" className="text-xs">🏥 {data.clinic_name}</Badge>}
                {data.lab_name && <Badge variant="outline" className="text-xs">🔬 {data.lab_name}</Badge>}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {['phases', 'plans', 'cases', 'invoices'].map(key => (
                  <div key={key} className="bg-muted/50 rounded-lg p-3 text-center">
                    <p className="text-lg font-semibold">{data._counts[key]}</p>
                    <p className="text-xs text-muted-foreground capitalize">{key}</p>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground">
                Updated {formatDistanceToNow(new Date(data.updated_at), { addSuffix: true })}
              </p>

              <Button className="w-full" onClick={() => { closePreview(); navigate(`/patient/${data.id}`); }}>
                Open Full Profile <ExternalLink className="h-3 w-3 ml-2" />
              </Button>
            </>
          )}

          {/* INVOICE */}
          {!loading && data && previewState.entityType === 'invoice' && (
            <>
              <div>
                <h2 className="text-lg font-semibold">{data.invoice_number || data.display_id || 'Invoice'}</h2>
                {data.patient_name && (
                  <Badge variant="outline" className="cursor-pointer mt-1" onClick={() => data.patient_id && openPreview('patient', data.patient_id)}>
                    👤 {data.patient_name}
                  </Badge>
                )}
              </div>

              <div className="flex gap-2 flex-wrap">
                <Badge className={data.status === 'paid' ? 'bg-green-500/10 text-green-700' : data.status === 'overdue' ? 'bg-destructive/10 text-destructive' : 'bg-blue-500/10 text-blue-700'}>
                  {data.status}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Amount</span><p className="font-medium">₹{data.amount_usd}</p></div>
                <div><span className="text-muted-foreground">Due</span><p className="font-medium">{data.due_date || '—'}</p></div>
                <div><span className="text-muted-foreground">Balance</span><p className="font-medium">₹{data.balance_due || 0}</p></div>
              </div>

              <Button className="w-full" onClick={() => { closePreview(); navigate(`/billing/${data.id}`); }}>
                Open Invoice <ExternalLink className="h-3 w-3 ml-2" />
              </Button>
            </>
          )}

          {/* CASE / WORK ORDER */}
          {!loading && data && (previewState.entityType === 'case' || previewState.entityType === 'workorder') && (
            <>
              <div>
                <h2 className="text-lg font-semibold">{data.display_id || 'Case Request'}</h2>
                <p className="text-sm text-muted-foreground">{data.request_type}</p>
                {data.patient_name && (
                  <Badge variant="outline" className="cursor-pointer mt-1" onClick={() => data.patient_id && openPreview('patient', data.patient_id)}>
                    👤 {data.patient_name}
                  </Badge>
                )}
              </div>

              <Badge variant="secondary">{data.status}</Badge>

              <p className="text-xs text-muted-foreground">
                Submitted {formatDistanceToNow(new Date(data.created_at), { addSuffix: true })}
              </p>

              {data.notes && <p className="text-sm text-muted-foreground line-clamp-3">{data.notes}</p>}

              <Button className="w-full" onClick={() => { closePreview(); navigate(`/case-submission/${data.id}`); }}>
                Open Work Order <ExternalLink className="h-3 w-3 ml-2" />
              </Button>
            </>
          )}

          {/* PLAN */}
          {!loading && data && previewState.entityType === 'plan' && (
            <>
              <div>
                <h2 className="text-lg font-semibold">{data.plan_name}</h2>
                {data.phases && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    <Badge variant="outline" className="text-xs">{data.phases.phase_name}</Badge>
                    {data.phases.patients && (
                      <Badge variant="outline" className="cursor-pointer text-xs" onClick={() => openPreview('patient', data.phases.patient_id)}>
                        👤 {data.phases.patients.patient_name}
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              <Badge variant="secondary">{data.status}</Badge>

              {data.notes && <p className="text-sm text-muted-foreground line-clamp-3">{data.notes}</p>}

              <Button className="w-full" onClick={() => { closePreview(); navigate(`/plan/${data.id}`); }}>
                Open Plan Editor <ExternalLink className="h-3 w-3 ml-2" />
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
