import React, { useMemo, useCallback, useRef } from 'react';
import { IPRData } from '@/lib/csv-parser';
import { useIsMobile } from '@/hooks/use-mobile';

interface IPRQuadrantDiagramProps {
  iprData: IPRData;
  editable?: boolean;
  selectedContacts?: Set<string>;
  onContactToggle?: (contactKey: string, event: React.MouseEvent) => void;
}

const UPPER_TEETH = ['18','17','16','15','14','13','12','11','21','22','23','24','25','26','27','28'];
const LOWER_TEETH = ['48','47','46','45','44','43','42','41','31','32','33','34','35','36','37','38'];

function getIPRColorClass(value: number): string {
  if (value <= 0) return '';
  if (value <= 0.1) return 'bg-ipr-low text-white';
  if (value <= 0.3) return 'bg-ipr-medium text-white';
  return 'bg-ipr-high text-white';
}

function getIPRDotColor(value: number): string {
  if (value <= 0) return '';
  if (value <= 0.1) return 'bg-ipr-low';
  if (value <= 0.3) return 'bg-ipr-medium';
  return 'bg-ipr-high';
}

interface ContactValue {
  combined: number;
  valA: number;
  valB: number;
}

function getContact(
  iprData: IPRData, arch: 'maxilla' | 'mandible', stepIdx: number,
  toothLeft: string, toothRight: string, teeth: string[]
): ContactValue {
  const step = iprData[arch]?.steps?.[stepIdx];
  if (!step) return { combined: 0, valA: 0, valB: 0 };

  const leftIdx = teeth.indexOf(toothLeft);
  const midlineIdx = 7;
  let valA = 0, valB = 0;

  if (leftIdx === midlineIdx) {
    valA = step.values[`${toothLeft}m`] || 0;
    valB = step.values[`${toothRight}m`] || 0;
  } else if (leftIdx < midlineIdx) {
    valA = step.values[`${toothLeft}m`] || 0;
    valB = step.values[`${toothRight}d`] || 0;
  } else {
    valA = step.values[`${toothLeft}d`] || 0;
    valB = step.values[`${toothRight}m`] || 0;
  }

  return { combined: Math.round((valA + valB) * 100) / 100, valA, valB };
}

function formatValue(contact: ContactValue): string {
  if (contact.combined <= 0) return '';
  if (contact.valA > 0 && contact.valB > 0) return contact.combined.toFixed(1);
  if (contact.valA > 0) return `${contact.valA.toFixed(1)}→`;
  if (contact.valB > 0) return `←${contact.valB.toFixed(1)}`;
  return contact.combined.toFixed(1);
}

// Get all contacts with values > 0 from the "Total" step (index 0 for combined CSVs)
export function getAllContactKeys(iprData: IPRData): string[] {
  const keys: string[] = [];
  for (const arch of ['maxilla', 'mandible'] as const) {
    const teeth = arch === 'maxilla' ? UPPER_TEETH : LOWER_TEETH;
    const steps = iprData[arch]?.steps || [];
    for (let si = 0; si < steps.length; si++) {
      for (let i = 0; i < teeth.length - 1; i++) {
        const contact = getContact(iprData, arch, si, teeth[i], teeth[i + 1], teeth);
        if (contact.combined > 0) {
          const key = `${arch}:${teeth[i]}-${teeth[i + 1]}`;
          if (!keys.includes(key)) keys.push(key);
        }
      }
    }
  }
  return keys;
}

// === Desktop Table View ===
const ArchTable: React.FC<{
  arch: 'maxilla' | 'mandible'; teeth: string[]; iprData: IPRData; label: string; reverseStages?: boolean;
  editable?: boolean; selectedContacts?: Set<string>; onContactToggle?: (key: string, e: React.MouseEvent) => void;
}> = ({ arch, teeth, iprData, label, reverseStages, editable, selectedContacts, onContactToggle }) => {
  const steps = iprData[arch]?.steps || [];

  const contacts = useMemo(() => {
    const pairs: { left: string; right: string }[] = [];
    for (let i = 0; i < teeth.length - 1; i++) pairs.push({ left: teeth[i], right: teeth[i + 1] });
    return pairs;
  }, [teeth]);

  const rows = useMemo(() => {
    const result: { label: string; values: ContactValue[] }[] = [];
    steps.forEach((step, stepIdx) => {
      const vals = contacts.map(c => getContact(iprData, arch, stepIdx, c.left, c.right, teeth));
      if (vals.some(v => v.combined > 0)) result.push({ label: step.step, values: vals });
    });
    if (reverseStages) result.reverse();
    return result;
  }, [steps, contacts, iprData, arch, teeth, reverseStages]);

  if (rows.length === 0) return null;

  const midlineContactIdx = 7;

  return (
    <div className="space-y-1">
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">{label}</div>
      <div className="overflow-x-auto print:overflow-visible">
        <table className="text-[10px] border-collapse w-full table-fixed">
          <thead>
            <tr>
              <th className="sticky left-0 bg-card z-10 w-[60px] print:static" />
              {teeth.map((t, i) => (
                <React.Fragment key={t}>
                  <th className={`text-center px-0 font-semibold text-foreground ${i === 8 ? 'border-l-2 border-primary/30' : ''}`}>{t}</th>
                  {i < teeth.length - 1 && <th className={`${i === midlineContactIdx ? 'border-l-2 border-r-2 border-primary/20' : ''}`} />}
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={rowIdx} className="border-t border-border/20 hover:bg-muted/20 transition-colors">
                <td className="sticky left-0 bg-card z-10 py-0.5 px-1.5 text-muted-foreground font-medium whitespace-nowrap text-[9px]">{row.label}</td>
                {teeth.map((t, i) => (
                  <React.Fragment key={t}>
                    <td className={`${i === 8 ? 'border-l-2 border-primary/30' : ''}`} />
                    {i < teeth.length - 1 && (
                      <td className={`text-center py-0.5 px-0 ${i === midlineContactIdx ? 'border-l-2 border-r-2 border-primary/20' : ''}`}>
                        {row.values[i].combined > 0 ? (
                          <div
                            className={`inline-flex items-center justify-center min-w-[26px] h-[16px] rounded-sm text-[8px] font-bold ${getIPRColorClass(row.values[i].combined)} ${editable ? 'cursor-pointer ring-offset-1' : ''} ${selectedContacts?.has(`${arch}:${contacts[i].left}-${contacts[i].right}`) ? 'ring-2 ring-primary ring-offset-background' : ''}`}
                            title={`${contacts[i].left}-${contacts[i].right}: ${row.values[i].combined.toFixed(2)}mm${editable ? ' (click to select)' : ''}`}
                            onClick={editable && onContactToggle ? (e) => onContactToggle(`${arch}:${contacts[i].left}-${contacts[i].right}`, e) : undefined}
                          >
                            {formatValue(row.values[i])}
                          </div>
                        ) : null}
                      </td>
                    )}
                  </React.Fragment>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// === Mobile Vertical Card View ===
const ArchMobile: React.FC<{
  arch: 'maxilla' | 'mandible'; teeth: string[]; iprData: IPRData; label: string;
  editable?: boolean; selectedContacts?: Set<string>; onContactToggle?: (key: string, e: React.MouseEvent) => void;
}> = ({ arch, teeth, iprData, label, editable, selectedContacts, onContactToggle }) => {
  const steps = iprData[arch]?.steps || [];

  const contacts = useMemo(() => {
    const pairs: { left: string; right: string }[] = [];
    for (let i = 0; i < teeth.length - 1; i++) pairs.push({ left: teeth[i], right: teeth[i + 1] });
    return pairs;
  }, [teeth]);

  const rows = useMemo(() => {
    const result: { label: string; contacts: { pair: string; contactKey: string; value: ContactValue }[] }[] = [];
    steps.forEach((step, stepIdx) => {
      const activeContacts: { pair: string; contactKey: string; value: ContactValue }[] = [];
      contacts.forEach(c => {
        const val = getContact(iprData, arch, stepIdx, c.left, c.right, teeth);
        if (val.combined > 0) activeContacts.push({ pair: `${c.left}|${c.right}`, contactKey: `${arch}:${c.left}-${c.right}`, value: val });
      });
      if (activeContacts.length > 0) result.push({ label: step.step, contacts: activeContacts });
    });
    return result;
  }, [steps, contacts, iprData, arch, teeth]);

  if (rows.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</div>
      {rows.map((row, rowIdx) => (
        <div key={rowIdx} className="rounded-lg border border-border/50 overflow-hidden">
          <div className="bg-muted/30 px-3 py-1.5 text-[11px] font-medium text-muted-foreground">{row.label}</div>
          <div className="divide-y divide-border/30">
            {row.contacts.map((c, cIdx) => (
              <div
                key={cIdx}
                className={`flex items-center justify-between px-3 py-2 ${editable ? 'cursor-pointer hover:bg-accent/30' : ''} ${selectedContacts?.has(c.contactKey) ? 'bg-primary/10 ring-1 ring-primary/30' : ''}`}
                onClick={editable && onContactToggle ? (e) => onContactToggle(c.contactKey, e) : undefined}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-foreground">{c.pair}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{formatValue(c.value)}<span className="text-muted-foreground text-xs">mm</span></span>
                  <div className={`w-3 h-3 rounded-full ${getIPRDotColor(c.value.combined)}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const IPRQuadrantDiagram: React.FC<IPRQuadrantDiagramProps> = ({ iprData, editable, selectedContacts, onContactToggle }) => {
  const isMobile = useIsMobile();

  const hasAnyData = useMemo(() => {
    for (const arch of ['maxilla', 'mandible'] as const) {
      const steps = iprData[arch]?.steps || [];
      for (const step of steps) {
        if (Object.values(step.values).some(v => v && v > 0)) return true;
      }
    }
    return false;
  }, [iprData]);

  if (!hasAnyData) {
    return <p className="text-sm text-muted-foreground">No IPR data available</p>;
  }

  if (isMobile) {
    return (
      <div className="space-y-4">
        <ArchMobile arch="maxilla" teeth={UPPER_TEETH} iprData={iprData} label="Upper Arch" editable={editable} selectedContacts={selectedContacts} onContactToggle={onContactToggle} />
        <ArchMobile arch="mandible" teeth={LOWER_TEETH} iprData={iprData} label="Lower Arch" editable={editable} selectedContacts={selectedContacts} onContactToggle={onContactToggle} />
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-1">
          <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-ipr-low" /><span>≤0.1</span></div>
          <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-ipr-medium" /><span>≤0.3</span></div>
          <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-ipr-high" /><span>&gt;0.3</span></div>
          {editable && <span className="text-primary font-medium ml-2">Click contacts to select • Ctrl+click for multi • Shift+click for range</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ArchTable arch="maxilla" teeth={UPPER_TEETH} iprData={iprData} label="Upper Arch (Maxilla)" reverseStages editable={editable} selectedContacts={selectedContacts} onContactToggle={onContactToggle} />
      <ArchTable arch="mandible" teeth={LOWER_TEETH} iprData={iprData} label="Lower Arch (Mandible)" editable={editable} selectedContacts={selectedContacts} onContactToggle={onContactToggle} />
      <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground pt-1">
        <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-ipr-low" /><span>≤0.1mm</span></div>
        <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-ipr-medium" /><span>≤0.3mm</span></div>
        <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-ipr-high" /><span>&gt;0.3mm</span></div>
        <span className="text-muted-foreground/60">0.1→ = one surface</span>
        {editable && <span className="text-primary font-medium ml-2">Click contacts to select • Ctrl+click for multi • Shift+click for range</span>}
      </div>
    </div>
  );
};

export default IPRQuadrantDiagram;
