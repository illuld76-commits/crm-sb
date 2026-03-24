import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Printer } from 'lucide-react';
import IPRQuadrantDiagram from '@/components/IPRQuadrantDiagram';
import ToothMovementChart from '@/components/ToothMovementChart';
import { IPRData, ToothMovementData } from '@/lib/csv-parser';
import ReportNav from '@/components/ReportNav';
import SnaponLogo from '@/components/SnaponLogo';

interface PlanData { plan_name: string; plan_date: string | null; notes: string | null; }
interface SectionData { section_type: string; data_json: any; caption: string | null; file_url: string | null; sort_order: number; }
interface RemarkData { remark_text: string; created_at: string; user_id: string; }

export default function ReportView() {
  const { token } = useParams();
  const [planData, setPlanData] = useState<PlanData | null>(null);
  const [sections, setSections] = useState<SectionData[]>([]);
  const [remarks, setRemarks] = useState<RemarkData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (token) loadReport(token); }, [token]);

  const loadReport = async (shareToken: string) => {
    const { data: plan, error: planErr } = await supabase.from('treatment_plans').select('*').eq('share_token', shareToken).eq('status', 'published').single();
    if (planErr || !plan) { setError('Report not found or not published.'); setLoading(false); return; }
    setPlanData(plan);
    const [{ data: sectionRows }, { data: remarkRows }] = await Promise.all([
      supabase.from('plan_sections').select('*').eq('plan_id', plan.id).order('sort_order'),
      supabase.from('plan_remarks').select('*').eq('plan_id', plan.id).order('created_at', { ascending: false }),
    ]);
    setSections(sectionRows || []);
    setRemarks(remarkRows || []);
    setLoading(false);
  };

  const feasibilitySections = sections.filter(s => s.section_type === 'feasibility');
  const iprSections = sections.filter(s => s.section_type === 'ipr');
  const movementSections = sections.filter(s => s.section_type === 'movement');
  const imageSections = sections.filter(s => s.section_type === 'image');
  const videoSections = sections.filter(s => s.section_type === 'video');
  const audioSections = sections.filter(s => s.section_type === 'audio');
  const modelSections = sections.filter(s => s.section_type === 'model_analysis');
  const cephSections = sections.filter(s => s.section_type === 'cephalometric');

  const navItems = [
    ...(feasibilitySections.length > 0 ? [{ id: 'feasibility', label: 'Feasibility' }] : []),
    ...(iprSections.length > 0 ? [{ id: 'ipr', label: 'IPR' }] : []),
    ...(movementSections.length > 0 ? [{ id: 'movement', label: 'Movement' }] : []),
    ...(modelSections.length > 0 ? [{ id: 'model', label: 'Model Analysis' }] : []),
    ...(cephSections.length > 0 ? [{ id: 'ceph', label: 'Cephalometric' }] : []),
    ...(imageSections.length > 0 ? [{ id: 'images', label: 'Images' }] : []),
    ...(videoSections.length > 0 ? [{ id: 'video', label: 'Video' }] : []),
    ...(audioSections.length > 0 ? [{ id: 'audio', label: 'Audio' }] : []),
    ...(remarks.length > 0 ? [{ id: 'remarks', label: 'Remarks' }] : []),
  ];

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-pulse text-muted-foreground">Loading report...</div></div>;
  if (error || !planData) return <div className="min-h-screen flex items-center justify-center bg-background"><Card className="max-w-md"><CardContent className="p-8 text-center"><p className="text-muted-foreground">{error || 'Report not found.'}</p></CardContent></Card></div>;

  const renderFeasibilityField = (label: string, value: string | undefined, highlight?: boolean) => {
    if (!value) return null;
    return (
      <div>
        <span className="text-muted-foreground text-xs">{label}</span>
        <p className={`font-medium ${highlight ? 'text-primary' : ''}`}>{value}</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background print:bg-white">
      <header className="dental-gradient text-primary-foreground py-8 print:py-4">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center justify-between">
            <SnaponLogo size={36} className="mb-4 [&_span]:text-primary-foreground" />
            <Button variant="ghost" size="sm" className="text-primary-foreground/80 hover:text-primary-foreground print:hidden" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-1" /> Export PDF
            </Button>
          </div>
          <h1 className="text-3xl font-bold">{planData.plan_name}</h1>
          <div className="flex items-center gap-3 mt-2 text-primary-foreground/80">
            {planData.plan_date && <span className="text-sm">{format(new Date(planData.plan_date), 'MMMM d, yyyy')}</span>}
          </div>
          {planData.notes && <p className="mt-3 text-sm text-primary-foreground/80">{planData.notes}</p>}
        </div>
      </header>

      {navItems.length > 1 && <ReportNav items={navItems} />}

      <main className="container mx-auto px-4 max-w-4xl py-8 space-y-8 print:py-4 print:space-y-4">
        {/* Feasibility */}
        {feasibilitySections.length > 0 && (
          <div id="feasibility" className="scroll-mt-20 space-y-6">
            {feasibilitySections.map((section, idx) => (
              <Card key={idx} className="print:shadow-none print:border">
                <CardHeader><CardTitle className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-primary" />{section.caption || 'Feasibility Report'}</CardTitle></CardHeader>
                <CardContent>
                  {section.data_json && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                      {renderFeasibilityField('Complexity', section.data_json.complexity)}
                      {renderFeasibilityField('Extraction', section.data_json.extractionType, true)}
                      {renderFeasibilityField('Upper Stages', section.data_json.upperAlignersCount)}
                      {renderFeasibilityField('Lower Stages', section.data_json.lowerAlignersCount)}
                      {renderFeasibilityField('Upper O/C Stages', section.data_json.upperOvercorrectionStages)}
                      {renderFeasibilityField('Lower O/C Stages', section.data_json.lowerOvercorrectionStages)}
                      {renderFeasibilityField('Upper Arch', section.data_json.upperArch)}
                      {renderFeasibilityField('Lower Arch', section.data_json.lowerArch)}
                      {renderFeasibilityField('IPR Upper', section.data_json.iprUpper)}
                      {renderFeasibilityField('IPR Lower', section.data_json.iprLower)}
                      {renderFeasibilityField('Attachment Upper', section.data_json.attachmentUpper)}
                      {renderFeasibilityField('Attachment Lower', section.data_json.attachmentLower)}
                      {section.data_json.notes && <div className="col-span-full"><span className="text-muted-foreground text-xs">Notes</span><p className="font-medium">{section.data_json.notes}</p></div>}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {iprSections.length > 0 && (
          <div id="ipr" className="scroll-mt-20 space-y-6">
            {iprSections.map((section, idx) => (
              <Card key={idx} className="print:shadow-none print:border">
                <CardHeader><CardTitle className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-primary" />{section.caption || `IPR ${iprSections.length > 1 ? `(${idx + 1})` : ''}`}</CardTitle></CardHeader>
                <CardContent><IPRQuadrantDiagram iprData={section.data_json as IPRData} /></CardContent>
              </Card>
            ))}
          </div>
        )}

        {movementSections.length > 0 && (
          <div id="movement" className="scroll-mt-20 space-y-6">
            {movementSections.map((section, idx) => (
              <Card key={idx} className="print:shadow-none print:border">
                <CardHeader><CardTitle className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-primary" />{section.caption || `Tooth Movement ${movementSections.length > 1 ? `(${idx + 1})` : ''}`}</CardTitle></CardHeader>
                <CardContent><ToothMovementChart data={section.data_json as ToothMovementData} /></CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Model Analysis */}
        {modelSections.length > 0 && (
          <div id="model" className="scroll-mt-20 space-y-6">
            {modelSections.map((section, idx) => (
              <Card key={idx} className="print:shadow-none print:border">
                <CardHeader><CardTitle className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-primary" />{section.caption || 'Model Analysis'}</CardTitle></CardHeader>
                <CardContent>
                  {section.data_json?.discrepancies && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">Description</th>
                            <th className="text-center py-1.5 px-2 text-muted-foreground font-medium">Norm</th>
                            <th className="text-center py-1.5 px-2 text-muted-foreground font-medium">Value</th>
                            <th className="text-center py-1.5 px-2 text-muted-foreground font-medium">Diff</th>
                          </tr>
                        </thead>
                        <tbody>
                          {section.data_json.discrepancies.map((d: any, i: number) => (
                            <tr key={i} className="border-b border-border/30">
                              <td className="py-1 px-2">{d.description}</td>
                              <td className="py-1 px-2 text-center text-muted-foreground">{d.norm || '—'}</td>
                              <td className="py-1 px-2 text-center font-medium">{d.value || '—'}</td>
                              <td className={`py-1 px-2 text-center ${d.diff && parseFloat(d.diff) < 0 ? 'text-destructive' : ''}`}>{d.diff || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {section.data_json?.anteriorRatio && (
                    <div className="mt-3 flex gap-6 text-sm">
                      <div><span className="text-muted-foreground">Anterior Ratio:</span> <span className="font-medium">{section.data_json.anteriorRatio.value}</span> <span className="text-muted-foreground text-xs">(norm: {section.data_json.anteriorRatio.norm})</span></div>
                      <div><span className="text-muted-foreground">Overall Ratio:</span> <span className="font-medium">{section.data_json.overallRatio?.value}</span> <span className="text-muted-foreground text-xs">(norm: {section.data_json.overallRatio?.norm})</span></div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Cephalometric */}
        {cephSections.length > 0 && (
          <div id="ceph" className="scroll-mt-20 space-y-6">
            {cephSections.map((section, idx) => (
              <Card key={idx} className="print:shadow-none print:border">
                <CardHeader><CardTitle className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-primary" />{section.caption || 'Cephalometric Analysis'}</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {section.data_json?.cephSvg && (
                    <div className="flex justify-center" dangerouslySetInnerHTML={{ __html: section.data_json.cephSvg }} />
                  )}
                  {['skeletal', 'dental', 'softTissue'].map(category => {
                    const items = section.data_json?.[category];
                    if (!items || items.length === 0) return null;
                    return (
                      <div key={category}>
                        <h4 className="text-sm font-semibold capitalize mb-2">{category === 'softTissue' ? 'Soft Tissue' : category} Analysis</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm border-collapse">
                            <thead>
                              <tr className="border-b border-border">
                                <th className="text-left py-1 px-2 text-muted-foreground font-medium">Parameter</th>
                                <th className="text-center py-1 px-2 text-muted-foreground font-medium">Norm</th>
                                <th className="text-center py-1 px-2 text-muted-foreground font-medium">Value</th>
                                <th className="text-left py-1 px-2 text-muted-foreground font-medium">Inference</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((item: any, i: number) => (
                                <tr key={i} className="border-b border-border/30">
                                  <td className="py-1 px-2">{item.parameter}</td>
                                  <td className="py-1 px-2 text-center text-muted-foreground">{item.norm || '—'}</td>
                                  <td className="py-1 px-2 text-center font-medium">{item.computed || item.value || '—'}</td>
                                  <td className="py-1 px-2 text-muted-foreground text-xs">{item.inference || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Images */}
        {imageSections.length > 0 && (
          <div id="images" className="scroll-mt-20 space-y-6">
            <Card className="print:shadow-none print:border">
              <CardHeader><CardTitle className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-primary" />Illustrations</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {imageSections.map((section, idx) => (
                    <div key={idx} className="space-y-2">
                      {section.file_url && <img src={section.file_url} alt={section.caption || 'Illustration'} className="w-full rounded-lg object-cover" />}
                      {section.caption && <p className="text-sm text-muted-foreground">{section.caption}</p>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {videoSections.length > 0 && (
          <div id="video" className="scroll-mt-20 space-y-6 print:hidden">
            {videoSections.map((section, idx) => (
              <Card key={idx}>
                <CardHeader><CardTitle className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-primary" />{section.caption || `Simulation ${videoSections.length > 1 ? `(${idx + 1})` : ''}`}</CardTitle></CardHeader>
                <CardContent><video src={section.file_url!} controls className="w-full rounded-lg" /></CardContent>
              </Card>
            ))}
          </div>
        )}

        {audioSections.length > 0 && (
          <div id="audio" className="scroll-mt-20 space-y-6 print:hidden">
            {audioSections.map((section, idx) => (
              <Card key={idx}>
                <CardHeader><CardTitle className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-primary" />{section.caption || `Audio Notes ${audioSections.length > 1 ? `(${idx + 1})` : ''}`}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {section.file_url && <audio src={section.file_url} controls className="w-full" />}
                  {section.data_json?.transcription && <div className="p-3 bg-muted/50 rounded-lg text-sm">{section.data_json.transcription}</div>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {remarks.length > 0 && (
          <div id="remarks" className="scroll-mt-20">
            <Card className="print:shadow-none print:border">
              <CardHeader><CardTitle>Remarks</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {remarks.map((r, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <span className="text-xs text-muted-foreground shrink-0 mt-0.5">{format(new Date(r.created_at), 'MMM d, yyyy')}</span>
                    <p>{r.remark_text}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        <div className="text-center text-xs text-muted-foreground pt-8 border-t border-border/50 print:pt-4">
          Generated with Snapon Braces • {format(new Date(), 'yyyy')}
        </div>
      </main>
    </div>
  );
}
