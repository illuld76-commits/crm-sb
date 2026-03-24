import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Upload, FileSpreadsheet, Check, AlertCircle } from 'lucide-react';

interface PatientRow {
  patient_name: string;
  patient_id_label?: string;
  doctor_name?: string;
  clinic_name?: string;
  lab_name?: string;
  country?: string;
  contact_email?: string;
  contact_phone?: string;
  patient_age?: number;
  patient_sex?: string;
}

interface BulkImportDialogProps {
  onImported?: () => void;
}

export default function BulkImportDialog({ onImported }: BulkImportDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<PatientRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const parseCSV = (content: string): PatientRow[] => {
    const lines = content.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
    const patients: PatientRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const row: any = {};
      headers.forEach((h, j) => {
        if (values[j]) row[h] = values[j];
      });

      if (row.patient_name) {
        patients.push({
          patient_name: row.patient_name,
          patient_id_label: row.patient_id_label || row.patient_id || row.id,
          doctor_name: row.doctor_name || row.doctor,
          clinic_name: row.clinic_name || row.clinic,
          lab_name: row.lab_name || row.lab,
          country: row.country || row.location,
          contact_email: row.contact_email || row.email,
          contact_phone: row.contact_phone || row.phone,
          patient_age: row.patient_age || row.age ? parseInt(row.patient_age || row.age) : undefined,
          patient_sex: row.patient_sex || row.sex || row.gender,
        });
      }
    }

    return patients;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      const parsed = parseCSV(content);
      setRows(parsed);
      setResult(null);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!user || rows.length === 0) return;
    setImporting(true);

    let success = 0;
    let failed = 0;

    for (const row of rows) {
      const { data: patient, error: patientError } = await supabase
        .from('patients')
        .insert({
          user_id: user.id,
          patient_name: row.patient_name,
          patient_id_label: row.patient_id_label || null,
          doctor_name: row.doctor_name || null,
          clinic_name: row.clinic_name || null,
          lab_name: row.lab_name || null,
          country: row.country || null,
          contact_email: row.contact_email || null,
          contact_phone: row.contact_phone || null,
          patient_age: row.patient_age || null,
          patient_sex: row.patient_sex || null,
        })
        .select()
        .single();

      if (patientError) {
        failed++;
        continue;
      }

      // Create default phase
      await supabase.from('phases').insert({
        patient_id: patient.id,
        phase_name: 'Initial Treatment',
        phase_order: 0,
      });

      success++;
    }

    setResult({ success, failed });
    setImporting(false);

    if (success > 0) {
      toast.success(`Imported ${success} patient${success !== 1 ? 's' : ''}`);
      onImported?.();
    }
    if (failed > 0) {
      toast.error(`Failed to import ${failed} row${failed !== 1 ? 's' : ''}`);
    }
  };

  const reset = () => {
    setRows([]);
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Upload className="w-4 h-4" /> Bulk Import
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Import Patients</DialogTitle>
          <DialogDescription>
            Upload a CSV file with columns: patient_name, patient_id_label, doctor_name, clinic_name, lab_name, country, contact_email, contact_phone, patient_age, patient_sex
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {rows.length === 0 ? (
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <FileSpreadsheet className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Click to upload CSV file</p>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <Badge variant="secondary">{rows.length} patient{rows.length !== 1 ? 's' : ''} found</Badge>
                <Button variant="ghost" size="sm" onClick={reset}>Clear</Button>
              </div>

              <ScrollArea className="h-[300px] border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Doctor</TableHead>
                      <TableHead>Clinic</TableHead>
                      <TableHead>Age</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{row.patient_name}</TableCell>
                        <TableCell className="text-muted-foreground">{row.patient_id_label || '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{row.doctor_name || '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{row.clinic_name || '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{row.patient_age || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              {result && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  {result.failed === 0 ? (
                    <Check className="w-5 h-5 text-success" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-warning" />
                  )}
                  <span className="text-sm">
                    Imported {result.success} of {rows.length} patients
                    {result.failed > 0 && ` (${result.failed} failed)`}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
          {rows.length > 0 && !result && (
            <Button onClick={handleImport} disabled={importing} className="dental-gradient">
              {importing ? 'Importing...' : `Import ${rows.length} Patient${rows.length !== 1 ? 's' : ''}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
