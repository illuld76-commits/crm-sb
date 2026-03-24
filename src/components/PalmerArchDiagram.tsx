import React, { useMemo } from 'react';
import { ContactIPR } from '@/lib/csv-parser';
import { Button } from '@/components/ui/button';

interface PalmerArchDiagramProps {
  contacts: ContactIPR[];
  arch: 'maxilla' | 'mandible';
  stepLabels?: string[];
  currentStep?: number;
  onStepChange?: (step: number) => void;
  showSlider?: boolean;
}

const UPPER_TEETH = ['18','17','16','15','14','13','12','11','21','22','23','24','25','26','27','28'];
const LOWER_TEETH = ['48','47','46','45','44','43','42','41','31','32','33','34','35','36','37','38'];

function getToothPositions(arch: 'maxilla' | 'mandible') {
  const centerX = 300;
  const isUpper = arch === 'maxilla';
  const teeth = isUpper ? UPPER_TEETH : LOWER_TEETH;
  const positions: { tooth: string; x: number; y: number }[] = [];

  const archWidth = 240;
  const archDepth = isUpper ? 160 : 140;
  const baseY = isUpper ? 220 : 60;

  for (let i = 0; i < teeth.length; i++) {
    const t = i / (teeth.length - 1);
    const angle = Math.PI * t;
    const widthFactor = 1 - 0.15 * Math.sin(angle);
    const x = centerX - archWidth * Math.cos(angle) * widthFactor;
    const yOffset = archDepth * Math.sin(angle);
    const y = isUpper ? baseY - yOffset : baseY + yOffset;
    positions.push({ tooth: teeth[i], x, y });
  }

  return positions;
}

function getIPRColor(value: number): string {
  if (value <= 0.1) return 'hsl(var(--ipr-low))';
  if (value <= 0.3) return 'hsl(var(--ipr-medium))';
  return 'hsl(var(--ipr-high))';
}

const PalmerArchDiagram: React.FC<PalmerArchDiagramProps> = ({
  contacts,
  arch,
  stepLabels = [],
  currentStep = 0,
  onStepChange,
  showSlider = true,
}) => {
  const positions = useMemo(() => getToothPositions(arch), [arch]);
  const isUpper = arch === 'maxilla';

  const contactMap = useMemo(() => {
    const map = new Map<string, number>();
    contacts.forEach(c => {
      map.set(`${c.tooth1}-${c.tooth2}`, c.value);
    });
    return map;
  }, [contacts]);

  const teeth = isUpper ? UPPER_TEETH : LOWER_TEETH;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        {isUpper ? 'Maxilla (Upper)' : 'Mandible (Lower)'}
      </div>

      <svg viewBox="0 0 600 300" className="w-full max-w-lg" style={{ minHeight: 200 }}>
        <path
          d={generateArchPath(positions)}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth="2"
          strokeDasharray="4 4"
        />

        {positions.map((pos) => {
          const isAnterior = ['11','12','13','21','22','23','31','32','33','41','42','43'].includes(pos.tooth);
          const toothWidth = isAnterior ? 14 : 16;
          const toothHeight = isAnterior ? 18 : 20;

          return (
            <g key={pos.tooth}>
              <rect
                x={pos.x - toothWidth / 2}
                y={pos.y - toothHeight / 2}
                width={toothWidth}
                height={toothHeight}
                rx={4}
                className="fill-card stroke-primary/30"
                strokeWidth={1.5}
              />
              <text
                x={pos.x}
                y={pos.y + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-foreground"
                fontSize="7"
                fontWeight="600"
                fontFamily="Space Grotesk, system-ui, sans-serif"
              >
                {pos.tooth}
              </text>
            </g>
          );
        })}

        {teeth.slice(0, -1).map((tooth, i) => {
          const nextTooth = teeth[i + 1];
          const key = `${tooth}-${nextTooth}`;
          const value = contactMap.get(key);

          if (!value || value <= 0) return null;

          const pos1 = positions[i];
          const pos2 = positions[i + 1];
          const midX = (pos1.x + pos2.x) / 2;
          const midY = (pos1.y + pos2.y) / 2;

          const dx = pos2.x - pos1.x;
          const dy = pos2.y - pos1.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const nx = -dy / len;
          const ny = dx / len;
          const offset = isUpper ? -18 : 18;
          const indicatorX = midX + nx * offset;
          const indicatorY = midY + ny * offset;

          const color = getIPRColor(value);

          return (
            <g key={key}>
              <line x1={midX} y1={midY} x2={indicatorX} y2={indicatorY} stroke={color} strokeWidth={1} opacity={0.6} />
              <circle cx={indicatorX} cy={indicatorY} r={10} fill={color} opacity={0.9} />
              <text x={indicatorX} y={indicatorY + 1} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="6" fontWeight="700">
                {value.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* Legend */}
        <g transform="translate(10, 270)">
          <circle cx={8} cy={6} r={5} fill="hsl(var(--ipr-low))" />
          <text x={18} y={9} fontSize="8" className="fill-muted-foreground">≤0.1mm</text>
          <circle cx={58} cy={6} r={5} fill="hsl(var(--ipr-medium))" />
          <text x={68} y={9} fontSize="8" className="fill-muted-foreground">≤0.3mm</text>
          <circle cx={108} cy={6} r={5} fill="hsl(var(--ipr-high))" />
          <text x={118} y={9} fontSize="8" className="fill-muted-foreground">&gt;0.3mm</text>
        </g>
      </svg>

      {/* Stage Chips instead of slider */}
      {showSlider && stepLabels.length > 1 && (
        <div className="w-full max-w-lg">
          <div className="flex flex-wrap gap-1.5 justify-center">
            {stepLabels.map((label, i) => (
              <button
                key={i}
                onClick={() => onStepChange?.(i)}
                className={`text-xs px-2.5 py-1 rounded-full transition-colors border ${
                  i === currentStep
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

function generateArchPath(positions: { x: number; y: number }[]): string {
  if (positions.length < 2) return '';
  const pts = positions;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const cpx = (prev.x + curr.x) / 2;
    const cpy = (prev.y + curr.y) / 2;
    d += ` Q ${prev.x} ${prev.y} ${cpx} ${cpy}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

export default PalmerArchDiagram;
