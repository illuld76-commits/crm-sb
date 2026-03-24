import React, { useState } from 'react';
import { ToothMovementData } from '@/lib/csv-parser';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface ToothMovementChartProps {
  data: ToothMovementData;
}

const PARAM_CONFIG: { key: string; label: string; color: string }[] = [
  { key: 'Inclination +/- [°]', label: 'Inclination', color: 'hsl(187, 65%, 38%)' },
  { key: 'Angulation +/- [°]', label: 'Angulation', color: 'hsl(38, 92%, 50%)' },
  { key: 'Rotation +/- [°]', label: 'Rotation', color: 'hsl(280, 60%, 50%)' },
  { key: 'Mesial +/- [mm]', label: 'Mesial/Distal', color: 'hsl(152, 60%, 40%)' },
  { key: 'Vestibular +/- [mm]', label: 'Bucco/Lingual', color: 'hsl(0, 72%, 51%)' },
  { key: 'Occlusal +/- [mm]', label: 'Extrusion/Intrusion', color: 'hsl(210, 80%, 55%)' },
];

const ToothMovementChart: React.FC<ToothMovementChartProps> = ({ data }) => {
  const [showTable, setShowTable] = useState(false);

  const renderArchChart = (arch: 'maxilla' | 'mandible', label: string) => {
    const archData = data[arch];
    if (!archData.teeth.length) return null;

    const activeParams = PARAM_CONFIG.filter(p => {
      const paramData = archData.parameters[p.key];
      if (!paramData) return false;
      return Object.values(paramData).some(v => v !== null && v !== 0);
    });

    if (activeParams.length === 0) return null;

    const chartData = archData.teeth.map(tooth => {
      const entry: Record<string, any> = { tooth };
      activeParams.forEach(p => {
        entry[p.label] = archData.parameters[p.key]?.[tooth] ?? 0;
      });
      return entry;
    });

    return (
      <div className="space-y-1">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">{label}</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="tooth" fontSize={9} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
            <YAxis fontSize={9} tick={{ fill: 'hsl(var(--muted-foreground))' }} width={30} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '11px',
              }}
            />
            {activeParams.map(p => (
              <Bar key={p.key} dataKey={p.label} fill={p.color} radius={[2, 2, 0, 0]} maxBarSize={10} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  // Shared legend
  const allActiveParams = PARAM_CONFIG.filter(p => {
    return ['maxilla', 'mandible'].some(arch => {
      const ad = data[arch as 'maxilla' | 'mandible'];
      const pd = ad.parameters[p.key];
      return pd && Object.values(pd).some(v => v !== null && v !== 0);
    });
  });

  const hasMaxilla = data.maxilla.teeth.length > 0;
  const hasMandible = data.mandible.teeth.length > 0;

  if (!hasMaxilla && !hasMandible) {
    return <p className="text-sm text-muted-foreground">No movement data available</p>;
  }

  // Build table data for collapsible section
  const renderTable = (arch: 'maxilla' | 'mandible') => {
    const archData = data[arch];
    if (!archData.teeth.length) return null;
    const activeParams = PARAM_CONFIG.filter(p => {
      const pd = archData.parameters[p.key];
      return pd && Object.values(pd).some(v => v !== null && v !== 0);
    });
    if (activeParams.length === 0) return null;

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-1 px-1.5 text-muted-foreground sticky left-0 bg-card z-10">Param</th>
              {archData.teeth.map(t => (
                <th key={t} className="text-center py-1 px-0.5 text-muted-foreground min-w-[28px]">{t}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeParams.map(p => (
              <tr key={p.key} className="border-b border-border/30">
                <td className="py-0.5 px-1.5 font-medium whitespace-nowrap sticky left-0 bg-card z-10">
                  <span className="inline-block w-1.5 h-1.5 rounded-full mr-1" style={{ backgroundColor: p.color }} />
                  {p.label}
                </td>
                {archData.teeth.map(tooth => {
                  const val = archData.parameters[p.key]?.[tooth];
                  const abs = Math.abs(val || 0);
                  return (
                    <td key={tooth} className={`text-center py-0.5 px-0.5 font-mono ${
                      abs >= 3 ? 'text-destructive font-bold' :
                      abs >= 1 ? 'text-warning font-semibold' :
                      'text-muted-foreground'
                    }`}>
                      {val !== null && val !== undefined ? val.toFixed(1) : '-'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Shared legend */}
      <div className="flex flex-wrap gap-3 text-[10px]">
        {allActiveParams.map(p => (
          <div key={p.key} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: p.color }} />
            <span className="text-muted-foreground">{p.label}</span>
          </div>
        ))}
      </div>

      {/* Charts */}
      {renderArchChart('maxilla', 'Upper Arch (Maxilla)')}
      {renderArchChart('mandible', 'Lower Arch (Mandible)')}

      {/* Collapsible values table */}
      <button
        onClick={() => setShowTable(!showTable)}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
      >
        {showTable ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {showTable ? 'Hide values' : 'Show values'}
      </button>

      {showTable && (
        <div className="space-y-3">
          {hasMaxilla && (
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground mb-1">Upper</div>
              {renderTable('maxilla')}
            </div>
          )}
          {hasMandible && (
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground mb-1">Lower</div>
              {renderTable('mandible')}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ToothMovementChart;
