import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import IPRQuadrantDiagram from '@/components/IPRQuadrantDiagram';
import ToothMovementChart from '@/components/ToothMovementChart';
import { IPRData, ToothMovementData } from '@/lib/csv-parser';
import SnaponLogo from '@/components/SnaponLogo';

interface PatientInfo { patient_name: string; patient_id_label: string | null; }
interface PhaseInfo { id: string; phase_name: string; phase_order: number; }
interface PlanInfo { id: string; phase_id: string; plan_name: string; plan_date: string | null; notes: string | null; status: string; }
interface SectionInfo { plan_id: string; section_type: string; data_json: any; file_url: string | null; caption: string | null; sort_order: number; }
interface RemarkInfo { plan_id: string; remark_text: string; created_at: string; }

export default function JourneyView() {
  const { token } = useParams();
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [phases, setPhases] = useState<PhaseInfo[]>([]);
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [sections, setSections] = useState<SectionInfo[]>([]);
  const [remarks, setRemarks] = useState<RemarkInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openPhases, setOpenPhases] = useState<Set<string>>(new Set());

  useEffect(() => { if (token) loadJourney(token); }, [token]);

  const loadJourney = async (shareToken: string) => {
    try {
      // Try edge function first (works without auth)
      const { data: fnData, error: fnErr } = await supabase.functions.invoke('get-shared-report', {
        body: null,
        headers: { 'Content-Type': 'application/json' },
      });

      // Build URL manually for GET with query params
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const baseUrl = import.meta.env.VITE_SUPABASE_URL || `https://${projectId}.supabase.co`;
      const res = await fetch(`${baseUrl}/functions/v1/get-shared-report?token=${encodeURIComponent(shareToken)}&type=journey`);
      
      if (res.ok) {
        const data = await res.json();
        if (data.error) { setError(data.error); setLoading(false); return; }
        setPatient(data.patient);
        setPhases(data.phases || []);
        setOpenPhases(new Set((data.phases || []).map((p: any) => p.id)));
        setPlans(data.plans || []);
        setSections(data.sections || []);
        setRemarks(data.remarks || []);
        setLoading(false);
        return;
      }
    } catch {
      // Fallback to direct query (works if user is authenticated)
    }

    // Fallback: direct Supabase query (authenticated users)
    const { data: patientData, error: pErr } = await supabase.from('patients').select('*').eq('share_token', shareToken).single();
    if (pErr || !patientData) { setError('Patient journey not found.'); setLoading(false); return; }
    setPatient(patientData);
    const { data: phaseData } = await supabase.from('phases').select('*').eq('patient_id', patientData.id).order('phase_order');
    setPhases(phaseData || []);
    setOpenPhases(new Set((phaseData || []).map(p => p.id)));
    if (phaseData && phaseData.length > 0) {
      const phaseIds = phaseData.map(p => p.id);
      const { data: planData } = await supabase.from('treatment_plans').select('*').in('phase_id', phaseIds).order('sort_order');
      setPlans(planData || []);
      if (planData && planData.length > 0) {
        const planIds = planData.map(p => p.id);
        const [{ data: sectionData }, { data: remarkData }] = await Promise.all([
          supabase.from('plan_sections').select('*').in('plan_id', planIds).order('sort_order'),
          supabase.from('plan_remarks').select('*').in('plan_id', planIds).order('created_at'),
        ]);
        setSections(sectionData || []);
        setRemarks(remarkData || []);
      }
    }
    setLoading(false);
  };

  const togglePhase = (id: string) => {
    setOpenPhases(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-pulse text-muted-foreground">Loading...</div></div>;
  if (error || !patient) return <div className="min-h-screen flex items-center justify-center bg-background"><Card className="max-w-md"><CardContent className="p-8 text-center"><p className="text-muted-foreground">{error || 'Not found.'}</p></CardContent></Card></div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="dental-gradient text-primary-foreground py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <SnaponLogo size={36} className="mb-4 [&_span]:text-primary-foreground" />
          <h1 className="text-3xl font-bold">{patient.patient_name}</h1>
          {patient.patient_id_label && <Badge variant="secondary" className="bg-white/20 text-white border-0 mt-2">{patient.patient_id_label}</Badge>}
          <p className="mt-2 text-sm text-primary-foreground/70">Treatment Journey — {phases.length} phase(s)</p>
        </div>
      </header>

      <main className="container mx-auto px-4 max-w-4xl py-8 space-y-6">
        {phases.map((phase, phIdx) => {
          const phasePlans = plans.filter(p => p.phase_id === phase.id);
          const isOpen = openPhases.has(phase.id);
          return (
            <Card key={phase.id} className="overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => togglePhase(phase.id)}>
                {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <div className="w-8 h-8 rounded-full dental-gradient flex items-center justify-center text-primary-foreground text-sm font-bold">{phIdx + 1}</div>
                <div><h2 className="font-semibold">{phase.phase_name}</h2><p className="text-xs text-muted-foreground">{phasePlans.length} plan(s)</p></div>
              </div>
              {isOpen && (
                <div className="border-t border-border/50 px-6 py-6 space-y-8">
                  {phasePlans.map(plan => {
                    const planSections = sections.filter(s => s.plan_id === plan.id);
                    const planRemarks = remarks.filter(r => r.plan_id === plan.id);
                    const feasSecs = planSections.filter(s => s.section_type === 'feasibility');
                    const iprSecs = planSections.filter(s => s.section_type === 'ipr');
                    const movSecs = planSections.filter(s => s.section_type === 'movement');
                    const imgSecs = planSections.filter(s => s.section_type === 'image');
                    const vidSecs = planSections.filter(s => s.section_type === 'video');
                    const audSecs = planSections.filter(s => s.section_type === 'audio');
                    return (
                      <div key={plan.id} className="space-y-4">
                        <div className="border-b border-border/30 pb-2">
                          <h3 className="font-semibold text-lg">{plan.plan_name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            {plan.plan_date && <span className="text-xs text-muted-foreground">{format(new Date(plan.plan_date), 'MMM d, yyyy')}</span>}
                            <Badge variant={plan.status === 'published' ? 'default' : 'outline'} className="text-xs">{plan.status}</Badge>
                          </div>
                          {plan.notes && <p className="text-sm text-muted-foreground mt-2">{plan.notes}</p>}
                        </div>

                        {feasSecs.map((sec, idx) => sec.data_json && (
                          <Card key={idx} className="p-4 space-y-2">
                            <h4 className="text-sm font-semibold">{sec.caption || 'Feasibility Report'}</h4>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {sec.data_json.complexity && <div><span className="text-muted-foreground">Complexity:</span> <span className="font-medium">{sec.data_json.complexity}</span></div>}
                              {sec.data_json.upperAlignersCount && <div><span className="text-muted-foreground">Upper:</span> <span className="font-medium">{sec.data_json.upperAlignersCount} aligners</span></div>}
                              {sec.data_json.lowerAlignersCount && <div><span className="text-muted-foreground">Lower:</span> <span className="font-medium">{sec.data_json.lowerAlignersCount} aligners</span></div>}
                              {sec.data_json.notes && <div className="col-span-2"><span className="text-muted-foreground">Notes:</span> <span className="font-medium">{sec.data_json.notes}</span></div>}
                            </div>
                          </Card>
                        ))}

                        {iprSecs.map((sec, idx) => (
                          <div key={idx} className="space-y-2">
                            {sec.caption && <p className="text-sm font-medium">{sec.caption}</p>}
                            <IPRQuadrantDiagram iprData={sec.data_json as IPRData} />
                          </div>
                        ))}
                        {movSecs.map((sec, idx) => (
                          <div key={idx}>
                            {sec.caption && <p className="text-sm font-medium mb-2">{sec.caption}</p>}
                            <ToothMovementChart data={sec.data_json as ToothMovementData} />
                          </div>
                        ))}

                        {imgSecs.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {imgSecs.map((sec, idx) => (
                              <div key={idx} className="space-y-1">
                                {sec.file_url && <img src={sec.file_url} alt={sec.caption || 'Illustration'} className="w-full rounded-lg object-cover" />}
                                {sec.caption && <p className="text-xs text-muted-foreground">{sec.caption}</p>}
                              </div>
                            ))}
                          </div>
                        )}

                        {vidSecs.map((sec, idx) => (
                          <div key={idx}>{sec.caption && <p className="text-sm text-muted-foreground mb-2">{sec.caption}</p>}<video src={sec.file_url!} controls className="w-full rounded-lg" /></div>
                        ))}
                        {audSecs.map((sec, idx) => (
                          <div key={idx} className="space-y-2">
                            {sec.file_url && <audio src={sec.file_url} controls className="w-full" />}
                            {sec.data_json?.transcription && <div className="p-3 bg-muted/50 rounded-lg text-sm">{sec.data_json.transcription}</div>}
                          </div>
                        ))}
                        {planRemarks.length > 0 && (
                          <div className="space-y-2 pt-2 border-t border-border/30">
                            <p className="text-xs font-semibold text-muted-foreground uppercase">Remarks</p>
                            {planRemarks.map((r, i) => (
                              <div key={i} className="flex gap-2 text-sm"><span className="text-xs text-muted-foreground shrink-0">{format(new Date(r.created_at), 'MMM d')}</span><p>{r.remark_text}</p></div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
        <div className="text-center text-xs text-muted-foreground pt-8 border-t border-border/50">Generated with Snapon Braces • {format(new Date(), 'yyyy')}</div>
      </main>
    </div>
  );
}
