import React, { useMemo, useState } from 'react';
import { IPRData, getContactIPR, ContactIPR } from '@/lib/csv-parser';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface LinearIPRDiagramProps {
  iprData: IPRData;
  arch: 'maxilla' | 'mandible';
}

const UPPER_TEETH = ['18','17','16','15','14','13','12','11','21','22','23','24','25','26','27','28'];
const LOWER_TEETH = ['48','47','46','45','44','43','42','41','31','32','33','34','35','36','37','38'];

function getIPRColor(value: number): string {
  if (value <= 0.1) return 'hsl(var(--ipr-low))';
  if (value <= 0.3) return 'hsl(var(--ipr-medium))';
  return 'hsl(var(--ipr-high))';
}

function getIPRBgClass(value: number): string {
  if (value <= 0) return '';
  if (value <= 0.1) return 'bg-ipr-low text-white';
  if (value <= 0.3) return 'bg-ipr-medium text-white';
  return 'bg-ipr-high text-white';
}

const LinearIPRDiagram: React.FC<LinearIPRDiagramProps> = ({ iprData, arch }) => {
  const teeth = arch === 'maxilla' ? UPPER_TEETH : LOWER_TEETH;
  const archData = iprData[arch];
  const steps = archData?.steps || [];
  
  // Build contact pairs
  const contactPairs = useMemo(() => {
    const pairs: string[] = [];
    for (let i = 0; i < teeth.length - 1; i++) {
      pairs.push(`${teeth[i]}-${teeth[i+1]}`);
    }
    return pairs;
  }, [arch]);

  // Build matrix: rows=steps, cols=contact pairs, values=IPR amount
  const matrix = useMemo(() => {
    return steps.map((step, stepIdx) => {
      const contacts = getContactIPR(iprData, arch, stepIdx);
      const contactMap = new Map<string, number>();
      contacts.forEach(c => contactMap.set(`${c.tooth1}-${c.tooth2}`, c.value));
      
      return {
        label: step.step,
        values: contactPairs.map(pair => contactMap.get(pair) || 0),
      };
    });
  }, [steps, contactPairs, iprData, arch]);

  if (steps.length === 0) {
    return <p className="text-sm text-muted-foreground">No IPR data available for {arch === 'maxilla' ? 'upper' : 'lower'} arch</p>;
  }

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {arch === 'maxilla' ? 'Upper Arch (Maxilla)' : 'Lower Arch (Mandible)'}
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[600px]">
          <thead>
            <tr>
              <th className="text-left py-1.5 px-2 text-muted-foreground font-medium sticky left-0 bg-card z-10 min-w-[80px]">Stage</th>
              {teeth.map((tooth, i) => (
                <React.Fragment key={tooth}>
                  <th className="text-center py-1.5 px-0.5 text-foreground font-semibold min-w-[28px]">
                    {tooth}
                  </th>
                  {i < teeth.length - 1 && (
                    <th className="text-center py-1.5 px-0 min-w-[24px]">
                      <span className="text-muted-foreground/40">│</span>
                    </th>
                  )}
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, rowIdx) => (
              <tr key={rowIdx} className="border-t border-border/30 hover:bg-muted/30 transition-colors">
                <td className="py-1 px-2 text-muted-foreground font-medium whitespace-nowrap sticky left-0 bg-card z-10">
                  {row.label}
                </td>
                {teeth.map((tooth, colIdx) => (
                  <React.Fragment key={tooth}>
                    {/* Tooth column - empty spacer */}
                    <td className="text-center py-1 px-0.5">
                      <div className="w-6 h-5 mx-auto rounded bg-muted/20" />
                    </td>
                    {/* Contact point between teeth */}
                    {colIdx < teeth.length - 1 && (
                      <td className="text-center py-1 px-0">
                        {row.values[colIdx] > 0 ? (
                          <div
                            className={`w-5 h-5 mx-auto rounded-sm flex items-center justify-center text-[9px] font-bold cursor-default ${getIPRBgClass(row.values[colIdx])}`}
                            title={`${contactPairs[colIdx]}: ${row.values[colIdx].toFixed(2)}mm — ${row.label}`}
                          >
                            {row.values[colIdx].toFixed(1)}
                          </div>
                        ) : (
                          <div className="w-5 h-5 mx-auto" />
                        )}
                      </td>
                    )}
                  </React.Fragment>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-ipr-low" />
          <span>≤0.1mm</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-ipr-medium" />
          <span>≤0.3mm</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-ipr-high" />
          <span>&gt;0.3mm</span>
        </div>
      </div>
    </div>
  );
};

export default LinearIPRDiagram;
