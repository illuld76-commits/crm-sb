import React, { useState, useMemo, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Trash2, Plus } from 'lucide-react';

// Permanent teeth
const UPPER_TEETH = ['18','17','16','15','14','13','12','11','21','22','23','24','25','26','27','28'];
const LOWER_TEETH = ['48','47','46','45','44','43','42','41','31','32','33','34','35','36','37','38'];

// Deciduous (primary) teeth
const UPPER_DECIDUOUS = ['55','54','53','52','51','61','62','63','64','65'];
const LOWER_DECIDUOUS = ['85','84','83','82','81','71','72','73','74','75'];

const WORK_TYPES = [
  'Crown', 'Bridge', 'Veneer', 'Inlay', 'Onlay', 'Implant', 'Extraction',
  'Root Canal', 'Splint', 'Denture', 'Retainer', 'Night Guard', 'Other',
];

export interface ToothSelection {
  id: string;
  teeth: string[];
  workType: string;
  notes: string;
}

interface ToothChartSelectorProps {
  value: ToothSelection[];
  onChange: (selections: ToothSelection[]) => void;
  readOnly?: boolean;
}

function getToothPositions(teeth: string[], arch: 'upper' | 'lower', compact?: boolean) {
  const centerX = compact ? 200 : 280;
  const positions: { tooth: string; x: number; y: number }[] = [];
  const archWidth = compact ? 150 : 220;
  const archDepth = compact ? (arch === 'upper' ? 100 : 85) : (arch === 'upper' ? 140 : 120);
  const baseY = arch === 'upper' ? (compact ? 130 : 180) : (compact ? 40 : 50);

  for (let i = 0; i < teeth.length; i++) {
    const t = i / (teeth.length - 1);
    const angle = Math.PI * t;
    const x = centerX - archWidth * Math.cos(angle);
    const yOffset = archDepth * Math.sin(angle);
    const y = arch === 'upper' ? baseY - yOffset : baseY + yOffset;
    positions.push({ tooth: teeth[i], x, y });
  }
  return positions;
}

const WORK_TYPE_COLORS: Record<string, string> = {
  Crown: 'hsl(var(--primary))',
  Bridge: 'hsl(210, 80%, 55%)',
  Veneer: 'hsl(280, 60%, 60%)',
  Inlay: 'hsl(160, 60%, 45%)',
  Onlay: 'hsl(120, 50%, 50%)',
  Implant: 'hsl(30, 80%, 50%)',
  Extraction: 'hsl(0, 70%, 55%)',
  'Root Canal': 'hsl(45, 80%, 50%)',
  Splint: 'hsl(200, 60%, 55%)',
  Denture: 'hsl(330, 50%, 55%)',
  Retainer: 'hsl(180, 50%, 50%)',
  'Night Guard': 'hsl(240, 40%, 60%)',
  Other: 'hsl(var(--muted-foreground))',
};

const ToothChartSelector: React.FC<ToothChartSelectorProps> = ({ value, onChange, readOnly }) => {
  const [selectedTeeth, setSelectedTeeth] = useState<Set<string>>(new Set());
  const [currentWorkType, setCurrentWorkType] = useState('Crown');
  const [currentNotes, setCurrentNotes] = useState('');
  const [showDeciduous, setShowDeciduous] = useState(false);
  const lastClickedTooth = useRef<string | null>(null);

  // Permanent positions
  const upperPositions = useMemo(() => getToothPositions(UPPER_TEETH, 'upper'), []);
  const lowerPositions = useMemo(() => getToothPositions(LOWER_TEETH, 'lower'), []);

  // Deciduous positions
  const upperDecPositions = useMemo(() => getToothPositions(UPPER_DECIDUOUS, 'upper', true), []);
  const lowerDecPositions = useMemo(() => getToothPositions(LOWER_DECIDUOUS, 'lower', true), []);

  const assignedTeethMap = useMemo(() => {
    const map = new Map<string, { workType: string; selectionId: string }>();
    value.forEach(sel => {
      sel.teeth.forEach(t => map.set(t, { workType: sel.workType, selectionId: sel.id }));
    });
    return map;
  }, [value]);

  // Get all teeth in current arch for shift-select range
  const getCurrentArchTeeth = useCallback((tooth: string): string[] => {
    if (UPPER_TEETH.includes(tooth)) return UPPER_TEETH;
    if (LOWER_TEETH.includes(tooth)) return LOWER_TEETH;
    if (UPPER_DECIDUOUS.includes(tooth)) return UPPER_DECIDUOUS;
    if (LOWER_DECIDUOUS.includes(tooth)) return LOWER_DECIDUOUS;
    return [];
  }, []);

  const toggleTooth = useCallback((tooth: string, event: React.MouseEvent) => {
    if (readOnly) return;

    setSelectedTeeth(prev => {
      const next = new Set(prev);

      // Shift+click range selection
      if (event.shiftKey && lastClickedTooth.current) {
        const archTeeth = getCurrentArchTeeth(tooth);
        const lastArchTeeth = getCurrentArchTeeth(lastClickedTooth.current);

        if (archTeeth.length > 0 && archTeeth === lastArchTeeth) {
          const startIdx = archTeeth.indexOf(lastClickedTooth.current);
          const endIdx = archTeeth.indexOf(tooth);
          if (startIdx !== -1 && endIdx !== -1) {
            const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
            for (let i = from; i <= to; i++) {
              next.add(archTeeth[i]);
            }
            lastClickedTooth.current = tooth;
            return next;
          }
        }
      }

      // Normal toggle
      next.has(tooth) ? next.delete(tooth) : next.add(tooth);
      lastClickedTooth.current = tooth;
      return next;
    });
  }, [readOnly, getCurrentArchTeeth]);

  const addSelection = () => {
    if (selectedTeeth.size === 0) return;
    const newSelection: ToothSelection = {
      id: crypto.randomUUID(),
      teeth: Array.from(selectedTeeth).sort(),
      workType: currentWorkType,
      notes: currentNotes,
    };
    onChange([...value, newSelection]);
    setSelectedTeeth(new Set());
    setCurrentNotes('');
    lastClickedTooth.current = null;
  };

  const removeSelection = (id: string) => {
    onChange(value.filter(s => s.id !== id));
  };

  const renderTooth = (pos: { tooth: string; x: number; y: number }, isDeciduous?: boolean) => {
    const isSelected = selectedTeeth.has(pos.tooth);
    const assigned = assignedTeethMap.get(pos.tooth);
    const anteriorPermanent = ['11','12','13','21','22','23','31','32','33','41','42','43'];
    const anteriorDeciduous = ['51','52','53','61','62','63','71','72','73','81','82','83'];
    const isAnterior = isDeciduous ? anteriorDeciduous.includes(pos.tooth) : anteriorPermanent.includes(pos.tooth);
    const w = isDeciduous ? (isAnterior ? 12 : 14) : (isAnterior ? 16 : 18);
    const h = isDeciduous ? (isAnterior ? 14 : 16) : (isAnterior ? 20 : 22);

    let fill = 'hsl(var(--card))';
    let stroke = 'hsl(var(--border))';
    let strokeWidth = 1.5;

    if (isSelected) {
      fill = 'hsl(var(--primary) / 0.3)';
      stroke = 'hsl(var(--primary))';
      strokeWidth = 2.5;
    } else if (assigned) {
      fill = WORK_TYPE_COLORS[assigned.workType] || 'hsl(var(--primary))';
      stroke = fill;
      strokeWidth = 2;
    }

    return (
      <g key={pos.tooth} className={readOnly ? '' : 'cursor-pointer'} onClick={(e) => toggleTooth(pos.tooth, e)}>
        <rect
          x={pos.x - w / 2} y={pos.y - h / 2}
          width={w} height={h} rx={4}
          fill={fill} stroke={stroke} strokeWidth={strokeWidth}
          opacity={assigned && !isSelected ? 0.85 : 1}
        />
        <text
          x={pos.x} y={pos.y + 1}
          textAnchor="middle" dominantBaseline="middle"
          fill={assigned && !isSelected ? 'white' : 'hsl(var(--foreground))'}
          fontSize={isDeciduous ? '7' : '8'} fontWeight="600"
        >
          {pos.tooth}
        </text>
      </g>
    );
  };

  return (
    <div className="space-y-4">
      {/* Dentition Toggle */}
      {!readOnly && (
        <div className="flex items-center gap-2">
          <Switch checked={showDeciduous} onCheckedChange={setShowDeciduous} className="h-4 w-7" />
          <Label className="text-xs text-muted-foreground">Show Deciduous (Primary) Teeth</Label>
          {!readOnly && (
            <span className="text-[10px] text-muted-foreground ml-auto">Shift+Click for range select</span>
          )}
        </div>
      )}

      {/* Permanent Tooth Chart */}
      <div className="flex flex-col items-center">
        <span className="text-xs font-medium text-muted-foreground mb-1">Permanent — Maxilla (Upper)</span>
        <svg viewBox="0 0 560 240" className="w-full max-w-lg" style={{ minHeight: 100 }}>
          {upperPositions.map(p => renderTooth(p))}
        </svg>
        <svg viewBox="0 0 560 200" className="w-full max-w-lg" style={{ minHeight: 90 }}>
          {lowerPositions.map(p => renderTooth(p))}
        </svg>
        <span className="text-xs font-medium text-muted-foreground mt-1">Permanent — Mandible (Lower)</span>
      </div>

      {/* Deciduous Tooth Chart */}
      {showDeciduous && (
        <div className="flex flex-col items-center border-t border-border/50 pt-4">
          <span className="text-xs font-medium text-muted-foreground mb-1">Deciduous — Maxilla (Upper)</span>
          <svg viewBox="0 0 400 180" className="w-full max-w-sm" style={{ minHeight: 80 }}>
            {upperDecPositions.map(p => renderTooth(p, true))}
          </svg>
          <svg viewBox="0 0 400 150" className="w-full max-w-sm" style={{ minHeight: 70 }}>
            {lowerDecPositions.map(p => renderTooth(p, true))}
          </svg>
          <span className="text-xs font-medium text-muted-foreground mt-1">Deciduous — Mandible (Lower)</span>
        </div>
      )}

      {/* Add Selection Controls */}
      {!readOnly && (
        <div className="flex flex-wrap items-end gap-2 p-3 rounded-lg border border-border/50 bg-muted/20">
          <div className="space-y-1 flex-1 min-w-[140px]">
            <span className="text-xs text-muted-foreground">Selected: {selectedTeeth.size} teeth</span>
            <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
              {Array.from(selectedTeeth).sort().map(t => (
                <Badge key={t} variant="secondary" className="text-[10px] h-5">{t}</Badge>
              ))}
            </div>
          </div>
          <Select value={currentWorkType} onValueChange={setCurrentWorkType}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {WORK_TYPES.map(wt => <SelectItem key={wt} value={wt}>{wt}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            value={currentNotes}
            onChange={e => setCurrentNotes(e.target.value)}
            placeholder="Notes..."
            className="h-8 text-xs w-32"
          />
          <Button size="sm" className="h-8" onClick={addSelection} disabled={selectedTeeth.size === 0}>
            <Plus className="w-3 h-3 mr-1" /> Add
          </Button>
        </div>
      )}

      {/* Selections Summary Table */}
      {value.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left p-2 font-medium">Teeth</th>
                <th className="text-left p-2 font-medium">Work Type</th>
                <th className="text-left p-2 font-medium hidden sm:table-cell">Notes</th>
                {!readOnly && <th className="w-8" />}
              </tr>
            </thead>
            <tbody>
              {value.map(sel => (
                <tr key={sel.id} className="border-t border-border/50">
                  <td className="p-2">
                    <div className="flex flex-wrap gap-0.5">
                      {sel.teeth.map(t => (
                        <Badge key={t} variant="outline" className="text-[9px] h-4 px-1">{t}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="p-2">
                    <Badge
                      className="text-[10px]"
                      style={{ backgroundColor: WORK_TYPE_COLORS[sel.workType], color: 'white' }}
                    >
                      {sel.workType}
                    </Badge>
                  </td>
                  <td className="p-2 text-muted-foreground hidden sm:table-cell">{sel.notes || '—'}</td>
                  {!readOnly && (
                    <td className="p-2">
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeSelection(sel.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {[...new Set(value.map(v => v.workType))].map(wt => (
            <div key={wt} className="flex items-center gap-1">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: WORK_TYPE_COLORS[wt] }} />
              <span className="text-[10px] text-muted-foreground">{wt}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ToothChartSelector;
