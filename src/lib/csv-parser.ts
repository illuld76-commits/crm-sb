// Parse OnyxCeph CSV data (UTF-16 tab-separated with quotes)

export interface IPRStepData {
  step: string;
  values: Record<string, number | null>; // e.g. "18d" -> 0.20
}

export interface IPRData {
  maxilla: {
    headers: string[];
    steps: IPRStepData[];
  };
  mandible: {
    headers: string[];
    steps: IPRStepData[];
  };
}

export interface ToothMovementData {
  maxilla: {
    teeth: string[];
    parameters: Record<string, Record<string, number | null>>;
  };
  mandible: {
    teeth: string[];
    parameters: Record<string, Record<string, number | null>>;
  };
}

// Contact IPR: combined mesial of one tooth + distal of adjacent tooth
export interface ContactIPR {
  tooth1: string;
  tooth2: string;
  value: number;
  step: string;
}

function cleanText(text: string): string {
  // Remove BOM, null bytes, extra spaces between chars (UTF-16 artifact)
  return text
    .replace(/\uFEFF/g, '')
    .replace(/\0/g, '')
    .replace(/"/g, '')
    .trim();
}

function parseCSVContent(content: string): string[][] {
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  return lines.map(line => {
    return line.split('\t').map(cell => cleanText(cell));
  });
}

export function parseIPRCSV(content: string): IPRData {
  const rows = parseCSVContent(content);
  
  const result: IPRData = {
    maxilla: { headers: [], steps: [] },
    mandible: { headers: [], steps: [] },
  };

  let currentArch: 'maxilla' | 'mandible' | null = null;
  let headers: string[] = [];

  for (const row of rows) {
    const firstCell = row[0]?.toLowerCase() || '';
    
    if (firstCell.includes('maxilla')) {
      currentArch = 'maxilla';
      headers = [];
      continue;
    }
    if (firstCell.includes('mandible') || firstCell.includes('mandibula')) {
      currentArch = 'mandible';
      headers = [];
      continue;
    }

    if (!currentArch) continue;

    if (firstCell.includes('[mm]') || firstCell.includes('mm')) {
      headers = row.slice(1).map(h => h.trim()).filter(Boolean);
      result[currentArch].headers = headers;
      continue;
    }

    if (firstCell.includes('step') || firstCell.includes('total')) {
      const stepName = row[0]?.trim() || '';
      const values: Record<string, number | null> = {};
      
      for (let i = 1; i < row.length && i - 1 < headers.length; i++) {
        const val = row[i]?.trim();
        values[headers[i - 1]] = val && val !== '' ? parseFloat(val) : null;
      }

      result[currentArch].steps.push({ step: cleanText(stepName), values });
    }
  }

  return result;
}

export function parseToothMovementCSV(content: string): ToothMovementData {
  const rows = parseCSVContent(content);
  
  const result: ToothMovementData = {
    maxilla: { teeth: [], parameters: {} },
    mandible: { teeth: [], parameters: {} },
  };

  let currentArch: 'maxilla' | 'mandible' | null = null;
  let teeth: string[] = [];

  for (const row of rows) {
    const firstCell = row[0]?.toLowerCase() || '';
    
    if (firstCell.includes('maxilla')) {
      currentArch = 'maxilla';
      teeth = [];
      continue;
    }
    if (firstCell.includes('mandible') || firstCell.includes('mandibula')) {
      currentArch = 'mandible';
      teeth = [];
      continue;
    }

    if (!currentArch) continue;

    if (firstCell.includes('tooth') || firstCell === 'tooth') {
      teeth = row.slice(1).map(t => t.trim()).filter(Boolean);
      result[currentArch].teeth = teeth;
      continue;
    }

    // Parameter row
    const paramName = cleanText(row[0] || '');
    if (paramName && teeth.length > 0) {
      const values: Record<string, number | null> = {};
      for (let i = 1; i < row.length && i - 1 < teeth.length; i++) {
        const val = row[i]?.trim();
        values[teeth[i - 1]] = val && val !== '' ? parseFloat(val) : null;
      }
      result[currentArch].parameters[paramName] = values;
    }
  }

  return result;
}

// Get IPR at contact points between adjacent teeth
export function getContactIPR(iprData: IPRData, arch: 'maxilla' | 'mandible', stepIndex: number): ContactIPR[] {
  const archData = iprData[arch];
  if (!archData.steps[stepIndex]) return [];
  
  const step = archData.steps[stepIndex];
  const contacts: ContactIPR[] = [];
  
  // Upper: 18-28, teeth go 18d,18m,17d,17m,...,11d,11m | 21m,21d,...,28m,28d
  // Contact between tooth A and tooth B is: A's mesial + B's distal (or vice versa)
  const upperTeethOrder = ['18','17','16','15','14','13','12','11','21','22','23','24','25','26','27','28'];
  const lowerTeethOrder = ['48','47','46','45','44','43','42','41','31','32','33','34','35','36','37','38'];
  
  const teethOrder = arch === 'maxilla' ? upperTeethOrder : lowerTeethOrder;
  
  for (let i = 0; i < teethOrder.length - 1; i++) {
    const toothA = teethOrder[i];
    const toothB = teethOrder[i + 1];
    
    // Contact is between mesial of A and distal of B (when going from distal to mesial direction)
    // Actually: for right side teeth (18-11, 48-41), mesial is toward midline
    // For left side (21-28, 31-38), mesial is toward midline
    // Contact between adjacent teeth: mesial surface of the more-distal tooth + distal surface of the more-mesial tooth
    
    const aKey = `${toothA}m`; // mesial of tooth A (the more distal tooth)
    const bKey = `${toothB}d`; // distal of tooth B (the more mesial tooth)
    
    // For the midline contact (11-21, 41-31): it's 11m + 21m or 41m + 31m
    let valA: number | null = null;
    let valB: number | null = null;

    if ((toothA === '11' && toothB === '21') || (toothA === '41' && toothB === '31')) {
      valA = step.values[`${toothA}m`] ?? null;
      valB = step.values[`${toothB}m`] ?? null;
    } else {
      valA = step.values[aKey] ?? null;
      valB = step.values[bKey] ?? null;
    }
    
    const combined = (valA || 0) + (valB || 0);
    if (combined > 0) {
      contacts.push({
        tooth1: toothA,
        tooth2: toothB,
        value: Math.round(combined * 100) / 100,
        step: step.step,
      });
    }
  }
  
  return contacts;
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = reject;
    // Try UTF-16 LE first (OnyxCeph default), fallback to UTF-8
    reader.readAsText(file, 'utf-16le');
  });
}

export function readFileAsTextUTF8(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file, 'utf-8');
  });
}

// Combined CSV: contains both IPR (Strip Mesial/Distal) and movement data in one file
export interface CombinedCSVResult {
  ipr: IPRData;
  movement: ToothMovementData;
}

// Normalize parameter names from combined CSV to match ToothMovementChart expectations
function normalizeParamName(name: string): string {
  const map: Record<string, string> = {
    'inclination': 'Inclination +/- [°]',
    'angulation': 'Angulation +/- [°]',
    'rotation': 'Rotation +/- [°]',
    'mesial': 'Mesial +/- [mm]',
    'vestibular': 'Vestibular +/- [mm]',
    'occlusal': 'Occlusal +/- [mm]',
  };
  const lower = name.toLowerCase();
  for (const [key, val] of Object.entries(map)) {
    if (lower.includes(key)) return val;
  }
  return name;
}

export function parseCombinedCSV(content: string): CombinedCSVResult {
  const rows = parseCSVContent(content);

  const ipr: IPRData = {
    maxilla: { headers: [], steps: [] },
    mandible: { headers: [], steps: [] },
  };

  const movement: ToothMovementData = {
    maxilla: { teeth: [], parameters: {} },
    mandible: { teeth: [], parameters: {} },
  };

  let currentArch: 'maxilla' | 'mandible' | null = null;
  let teeth: string[] = [];

  for (const row of rows) {
    const firstCell = row[0]?.toLowerCase() || '';

    if (firstCell.includes('maxilla')) {
      currentArch = 'maxilla';
      teeth = [];
      continue;
    }
    if (firstCell.includes('mandible') || firstCell.includes('mandibula')) {
      currentArch = 'mandible';
      teeth = [];
      continue;
    }

    if (!currentArch) continue;

    if (firstCell.includes('tooth') || firstCell === 'tooth') {
      teeth = row.slice(1).map(t => t.trim()).filter(Boolean);
      movement[currentArch].teeth = teeth;
      continue;
    }

    // Strip Mesial → IPR mesial values
    if (firstCell.includes('strip mesial')) {
      const headers: string[] = [];
      const values: Record<string, number | null> = {};
      teeth.forEach((t, i) => {
        const key = `${t}m`;
        headers.push(key);
        const val = row[i + 1]?.trim();
        values[key] = val && val !== '' ? parseFloat(val) : null;
      });
      ipr[currentArch].headers = [...new Set([...ipr[currentArch].headers, ...headers])];
      if (ipr[currentArch].steps.length === 0) {
        ipr[currentArch].steps.push({ step: 'Total', values: {} });
      }
      Object.assign(ipr[currentArch].steps[0].values, values);
      continue;
    }

    // Strip Distal → IPR distal values
    if (firstCell.includes('strip distal')) {
      const headers: string[] = [];
      const values: Record<string, number | null> = {};
      teeth.forEach((t, i) => {
        const key = `${t}d`;
        headers.push(key);
        const val = row[i + 1]?.trim();
        values[key] = val && val !== '' ? parseFloat(val) : null;
      });
      ipr[currentArch].headers = [...new Set([...ipr[currentArch].headers, ...headers])];
      if (ipr[currentArch].steps.length === 0) {
        ipr[currentArch].steps.push({ step: 'Total', values: {} });
      }
      Object.assign(ipr[currentArch].steps[0].values, values);
      continue;
    }

    // Movement parameters (any non-strip row with data)
    const paramName = cleanText(row[0] || '');
    if (paramName && teeth.length > 0 && !firstCell.includes('strip')) {
      const normalized = normalizeParamName(paramName);
      const paramValues: Record<string, number | null> = {};
      for (let i = 1; i < row.length && i - 1 < teeth.length; i++) {
        const val = row[i]?.trim();
        paramValues[teeth[i - 1]] = val && val !== '' ? parseFloat(val) : null;
      }
      movement[currentArch].parameters[normalized] = paramValues;
    }
  }

  return { ipr, movement };
}
