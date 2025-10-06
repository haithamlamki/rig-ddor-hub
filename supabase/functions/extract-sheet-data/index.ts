import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate type mapping to hour categories with all synonyms
const rateTypeMapping: Record<string, string> = {
  // Operation Hr synonyms
  'OPER': 'Operation Hr',
  'OP': 'Operation Hr',
  'OP RATE': 'Operation Hr',
  'OP-RATE': 'Operation Hr',
  'O/RATE': 'Operation Hr',
  'O/ RATE': 'Operation Hr', // handle space after slash
  'O-RATE': 'Operation Hr',
  'ORATE': 'Operation Hr',
  'O': 'Operation Hr',
  'OPERATION': 'Operation Hr',
  'O RATE': 'Operation Hr',
  'OPERATION HOURS': 'Operation Hr',
  'OP/HOURS': 'Operation Hr',
  'OPERATION RATE': 'Operation Hr',
  'OPRETION RATE': 'Operation Hr',  // Handle common typo
  'OPRETION': 'Operation Hr',
  'OPRATION': 'Operation Hr',  // Handle common typo - missing E
  'OPRATION RATE': 'Operation Hr',  // Handle common typo with RATE
  'O/ RTAE': 'Operation Hr',  // Handle transposed letters variant
  'O RTAE': 'Operation Hr',   // Without slash variant
  'ORTAE': 'Operation Hr',    // Cleaned string variant
  
  // Reduce Hr synonyms
  'REDUCE': 'Reduce Hr',
  'REDU': 'Reduce Hr',
  'REDU RATE': 'Reduce Hr',
  'REDU/RATE': 'Reduce Hr',
  'R/RATE': 'Reduce Hr',
  'REDUCED': 'Reduce Hr',
  'REDUCTION': 'Reduce Hr',
  'REDUCED-RATE': 'Reduce Hr',
  'REDUCED-RATE.': 'Reduce Hr',
  'REDUCED RATE': 'Reduce Hr',
  
  // Standby Hr synonyms
  'STANDBY': 'Standby Hr',
  
  // Zero Hr synonyms
  'ZERO': 'Zero Hr',
  
  // Repair Hr synonyms
  'REPAIR': 'Repair Hr',
  'BREAKDOWN': 'Repair Hr',
  'REPAIR RATE': 'Repair Hr',
  'BREAKDOWN HOURS': 'Repair Hr',
  
  // AM Hr synonyms
  'AM': 'AM Hr',
  'ANNUAL MAINTENANCE': 'AM Hr',
  'MAINTENANCE': 'AM Hr',
  
  // Special Hr synonyms
  'SPECIAL': 'Special Hr',
  'SPECIAL RATE': 'Special Hr',
  
  // Force Majeure Hr synonyms
  'FORCE MAJEURE': 'Force Majeure Hr',
  'FORRCE MAJEURE': 'Force Majeure Hr',
  
  // STACKING Hr synonyms
  'STACKING': 'STACKING Hr',
  
  // Rig Move Hr synonyms
  'RIG MOVE': 'Rig Move Hr',
  'RIG-MOVE': 'Rig Move Hr',
  'RIG/MOVE': 'Rig Move Hr',
  'RIGMOVE': 'Rig Move Hr',
  'RIG MOVR': 'Rig Move Hr',  // Handle typo
  'MOVE': 'Rig Move Hr',
  'R': 'Rig Move Hr',
};

// Function to calculate string similarity (Levenshtein distance based)
function stringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

// Levenshtein distance implementation
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

// Function to find best matching rate type using fuzzy matching
function findBestRateTypeMatch(input: string): string | null {
  let bestMatch = '';
  let bestScore = 0;
  const threshold = 0.6; // 60% similarity threshold
  
  const inputUpper = input.toUpperCase();
  
  for (const [key, value] of Object.entries(rateTypeMapping)) {
    const similarity = stringSimilarity(inputUpper, key);
    
    if (similarity > bestScore && similarity >= threshold) {
      bestScore = similarity;
      bestMatch = key;
    }
  }
  
  if (bestMatch) {
    console.log(`Fuzzy matched "${input}" to "${bestMatch}" (similarity: ${(bestScore * 100).toFixed(1)}%)`);
    return bestMatch;
  }
  
  return null;
}

// Function to extract and aggregate activity table hours
function extractActivityHours(sheetData: any[]): Record<string, number> {
  const aggregatedHours: Record<string, number> = {
    'Operation Hr': 0,
    'Reduce Hr': 0,
    'Standby Hr': 0,
    'Zero Hr': 0,
    'Repair Hr': 0,
    'AM Hr': 0,
    'Special Hr': 0,
    'Force Majeure Hr': 0,
    'STACKING Hr': 0,
    'Rig Move Hr': 0,
  };

  console.log('Extracting activity hours from sheet data...');
  
  // Track header columns when available
  let headerCols: { from?: string; to?: string; dur?: string; rate?: string } = {};
  
  // Helpers to detect section banners and day-range
  const normalize = (s: any) => String(s ?? '').toUpperCase().trim();
  const rowToText = (row: any) => Object.values(row ?? {}).map((v) => normalize(v)).join(' ');
  const hasBannerRange = (text: string, fromH: number, toH: number) => {
    const compact = text.replace(/\s+/g, ' ');
    const fromStr = fromH.toString().padStart(2, '0');
    const toStr = toH.toString().padStart(2, '0');
    // Match patterns like "00:00 - TO - 06:00" or "00:00 - 06:00"
    const re = new RegExp(`\\b${fromStr}:?00\\s*-\\s*(?:TO\\s*-\\s*)?${toStr}:?00\\b`);
    return re.test(compact);
  };
  const hasFullDayBanner = (): boolean => {
    for (const r of sheetData) {
      const t = rowToText(r);
      if (/\b0{1,2}:?0{2}\s*-\s*(?:TO\s*-\s*)?0{1,2}:?0{2}\b/.test(t)) return true; // 00:00 - 00:00 or 00:00 - to - 00:00
      if (/\b00:00\s*-\s*00:00\s*OPERATION\b/.test(t)) return true; // explicit banner
    }
    return false;
  };
  
  // Helper function to check if a value looks like a time (HH:MM format or decimal)
  const looksLikeTime = (val: any): boolean => {
    if (val === null || val === undefined) return false;
    const str = String(val).trim();
    const norm = str.replace(/;/g, ':');
    // Check for HH:MM (supports ':' or ';') or Excel decimal day (<1)
    return /^\d{1,2}:\d{2}$/.test(norm) || (!isNaN(parseFloat(str)) && parseFloat(str) < 1);
  };

  // Find the activity table by looking for "From", "TO", "Dur." headers OR time pattern rows
  let activityTableStartRow = -1;
  let hasHeaders = false;
  
  for (let i = 0; i < sheetData.length; i++) {
    const row = sheetData[i];
    if (!row || typeof row !== 'object') continue;

    // Check if this row contains the headers (From, TO, Dur.) - case insensitive
    const entries = Object.entries(row);
    const byVal = (match: string) => entries.find(([k, v]) => String(v ?? '').trim().toLowerCase() === match)?.[0];
    const fromKey = byVal('from');
    const toKey = byVal('to');
    const durKey = entries.find(([k, v]) => String(v ?? '').trim().toLowerCase().includes('dur'))?.[0];
    const rateKey = entries.find(([k, v]) => String(v ?? '').trim().toLowerCase().includes('rate'))?.[0];

    if (fromKey && toKey && durKey) {
      activityTableStartRow = i + 1; // Start from next row (data rows)
      hasHeaders = true;
      headerCols = { from: fromKey, to: toKey, dur: durKey, rate: rateKey };
      console.log('Found activity table with headers at row:', activityTableStartRow, 'cols:', headerCols);
      break;
    }
    
    // Alternative: Look for rows with time patterns (for sheets without headers)
    // Check if first 3 columns look like times (start, end, duration)
    const val0 = (row as any)['__EMPTY'];
    const val1 = (row as any)['__EMPTY_1'];
    const val2 = (row as any)['__EMPTY_2'];
    
    if (looksLikeTime(val0) && looksLikeTime(val1) && looksLikeTime(val2)) {
      // Found a row that looks like time data
      activityTableStartRow = i;
      hasHeaders = false;
      console.log('Found activity table without headers at row:', activityTableStartRow);
      break;
    }
  }

  if (activityTableStartRow === -1) {
    console.log('Activity table not found in sheet data, attempting summary hours fallback');
    // Fallback: parse summary boxes like "Operation Hours", "Rig Move Hours", etc.
    const parseNum = (val: any): number => {
      if (val === null || val === undefined) return 0;
      if (typeof val === 'number') return Number(val);
      const s = String(val).replace(/[^0-9.:]/g, '').trim();
      if (!s) return 0;
      // Times like H:MM are not expected here; treat as decimal hours if so
      if (/:/.test(s)) {
        const [h, m] = s.split(':');
        const hours = parseInt(h || '0');
        const mins = parseInt(m || '0');
        return hours + mins / 60;
      }
      const n = parseFloat(s);
      return isNaN(n) ? 0 : n;
    };

    for (const row of sheetData) {
      if (!row || typeof row !== 'object') continue;
      for (const [key, val] of Object.entries(row)) {
        if (!key) continue;
        const k = String(key).toLowerCase();
        const num = parseNum(val);
        if (!num) continue;
        if (k.includes('operation hours')) aggregatedHours['Operation Hr'] += num;
        else if (k.includes('rig move hours')) aggregatedHours['Rig Move Hr'] += num;
        else if (k.includes('reduced') && k.includes('repair')) aggregatedHours['Reduce Hr'] += num; // combined box
        else if (k.includes('stand by hours') || k.includes('standby hours')) aggregatedHours['Standby Hr'] += num;
        else if (k.includes('zero hours')) aggregatedHours['Zero Hr'] += num;
        else if (k.includes('am hours') || k.includes('annual maintenance')) aggregatedHours['AM Hr'] += num;
        else if (k.includes('special')) aggregatedHours['Special Hr'] += num;
        else if (k.includes('force majeure')) aggregatedHours['Force Majeure Hr'] += num;
        else if (k.includes('stacking')) aggregatedHours['STACKING Hr'] += num;
      }
    }
    console.log('Summary fallback hours:', aggregatedHours);
    return aggregatedHours;
  }

  console.log('Processing activity table rows...');
  
  // Track if we've seen late evening hours (indicating we're near end of day)
  let hasSeenLateEvening = false;
  let maxTimeSeen = 0;
  
  // Process activity table rows
  for (let i = activityTableStartRow; i < sheetData.length; i++) {
    const row = sheetData[i];
    if (!row || typeof row !== 'object') continue;

    // Detect and skip the yellow subsection banner like "00:00 - to - 06:00"
    const rowText = rowToText(row);
    if (hasBannerRange(rowText, 0, 6)) {
      console.log('Encountered "00:00 - to - 06:00" section banner at row:', i, '- ignoring sub-table below');
      break; // stop before the secondary table
    }

    // Check if this is a data row by looking at From column (supports headered and non-headered JSON)
    const fromValue = headerCols.from ? (row as any)[headerCols.from] : (row as any)['__EMPTY'];
    if (fromValue === null || fromValue === undefined) continue;
    
    // Skip section headers and empty rows
    const fromStr = String(fromValue).trim();
    if (fromStr.length === 0 || fromStr.includes('Prepared by') || fromStr.includes('Update 00:00')) continue;
    
    // Skip non-time rows within the activity table instead of stopping early
    if (!looksLikeTime(fromValue)) {
      continue;
    }
    
    // Parse the start time to detect day boundaries
    let startTimeHours = 0;
    if (typeof fromValue === 'number') {
      startTimeHours = fromValue * 24; // Convert Excel decimal to hours
    } else {
      const fromNorm = fromStr.replace(/;/g, ':');
      if (fromNorm.includes(':')) {
        const parts = fromNorm.split(':');
        const h = parseInt(parts[0] || '0');
        const m = parseInt(parts[1] || '0');
        startTimeHours = h + m / 60;
      }
    }
    
    // Detect if we've wrapped to the next day
    // If we've seen times >= 20:00 and now see 0:00-7:00, we've crossed midnight into next day
    if (hasSeenLateEvening && startTimeHours >= 0 && startTimeHours < 7) {
      console.log('Detected next day boundary - wrapped from late evening back to early morning at row:', i);
      break;
    }
    
    // Track if we've seen late evening hours (20:00 or later)
    if (startTimeHours >= 20) {
      hasSeenLateEvening = true;
    }
    
    // Track maximum time seen
    if (startTimeHours > maxTimeSeen) {
      maxTimeSeen = startTimeHours;
    }
    
    // Stop processing if we encounter a day separator (next day boundary)
    // This prevents extracting data beyond the first 24-hour period
    if (fromStr.includes('00:00 - to -')) {
      console.log('Reached next day boundary, stopping extraction at row:', i);
      break;
    }

    // Column for Duration (Dur.)
    const durationValue = headerCols.dur ? (row as any)[headerCols.dur] : (row as any)['__EMPTY_2'];
    let hours = 0;

    // Parse duration cell (if present)
    let hoursFromDur = 0;
    if (durationValue !== null && durationValue !== undefined) {
      if (typeof durationValue === 'number') {
        // Excel stores times as decimal fractions of a day
        hoursFromDur = durationValue * 24;
      } else {
        const durationStrRaw = String(durationValue).trim();
        const durationStr = durationStrRaw.replace(/;/g, ':'); // support semicolons
        if (durationStr.includes(':')) {
          // Format: "2:00" or "1:30"
          const parts = durationStr.split(':');
          hoursFromDur = parseInt(parts[0] || '0') + (parseInt(parts[1] || '0') / 60);
        } else {
          // Decimal format (Excel day fraction)
          const parsed = parseFloat(durationStr);
          if (!isNaN(parsed)) {
            hoursFromDur = parsed * 24;
          }
        }
      }
    }

    // Compute duration from From -> TO (validation)
    let hoursFromRange = 0;
    const toValue = headerCols.to ? (row as any)[headerCols.to] : (row as any)['__EMPTY_1'];
    if (toValue !== null && toValue !== undefined && looksLikeTime(toValue)) {
      let toHours = 0;
      const toStrRaw = String(toValue).trim();
      if (typeof toValue === 'number') {
        toHours = toValue * 24; // Excel decimal to hours
      } else {
        const toStr = toStrRaw.replace(/;/g, ':');
        if (toStr.includes(':')) {
          const p = toStr.split(':');
          toHours = parseInt(p[0] || '0') + (parseInt(p[1] || '0') / 60);
        } else {
          const n = parseFloat(toStr);
          if (!isNaN(n)) toHours = n * 24;
        }
      }
      let diff = toHours - startTimeHours;
      if (diff < 0) diff += 24; // wrap midnight
      // Special case: 00:00 to 00:00 means full day
      if (startTimeHours === 0 && toHours === 0) diff = 24;
      hoursFromRange = diff;
    }

    // Choose the most reliable duration
    if (hoursFromDur > 0 && hoursFromRange > 0) {
      const delta = Math.abs(hoursFromDur - hoursFromRange);
      if (delta > 0.17) { // >10 minutes mismatch
        console.log(`Duration mismatch: Dur=${hoursFromDur.toFixed(2)}h vs From/To=${hoursFromRange.toFixed(2)}h. Using From/To.`);
        hours = hoursFromRange;
      } else {
        hours = hoursFromDur;
      }
    } else if (hoursFromDur > 0) {
      hours = hoursFromDur;
    } else if (hoursFromRange > 0) {
      hours = hoursFromRange;
    }

    // If still zero, fallback: infer duration as the 3rd time-like value in the row

    if (hours === 0) {
      // Fallback: infer duration as the 3rd time-like value in the row
      const vals = Object.values(row);
      const timeLikes: any[] = [];
      for (const v of vals) {
        if (looksLikeTime(v)) timeLikes.push(v);
      }
      if (timeLikes.length >= 3) {
        const durVal = timeLikes[2];
        if (typeof durVal === 'number') {
          hours = durVal * 24;
        } else {
          const dStr = String(durVal).trim();
          if (dStr.includes(':')) {
            const parts = dStr.split(':');
            hours = parseInt(parts[0] || '0') + (parseInt(parts[1] || '0') / 60);
          } else {
            const parsed = parseFloat(dStr);
            if (!isNaN(parsed)) hours = parsed * 24;
          }
        }
      }
      if (hours === 0) continue;
    }

    // Look for rate type across known columns first, then all string cells in the row
    let rateType = '';
    // 1) Prefer explicit Rate column if we detected it
    if (headerCols.rate) {
      const rateVal = (row as any)[headerCols.rate];
      if (rateVal != null) {
        const rv = String(rateVal).trim().toUpperCase();
        const cleaned = rv.replace(/[\/\-\s]/g, '').replace('RATE', '');
        if (rateTypeMapping[rv]) rateType = rv;
        else if (rateTypeMapping[cleaned]) rateType = cleaned;
        else {
          const fuzzy = findBestRateTypeMatch(rv);
          if (fuzzy) rateType = fuzzy;
        }
      }
    }
    // 2) Try scanning typical columns
    if (!rateType) {
      for (let colIdx = 20; colIdx >= 0; colIdx--) {
        const colName = colIdx === 0 ? '__EMPTY' : `__EMPTY_${colIdx}`;
        const rawVal = (row as any)[colName];
        const cellValue = String(rawVal ?? '').trim().toUpperCase();
        if (!cellValue) continue;
        const cleanedValue = cellValue.replace(/[\/\-\s]/g, '').replace('RATE', '');
        if (rateTypeMapping[cellValue]) { rateType = cellValue; break; }
        if (rateTypeMapping[cleanedValue]) { rateType = cleanedValue; break; }
        if (cellValue.length > 1) {
          const fuzzyMatch = findBestRateTypeMatch(cellValue);
          if (fuzzyMatch) { rateType = fuzzyMatch; break; }
        }
      }
    }
    // 3) Fallback: scan all values in the row
    if (!rateType) {
      for (const [k, v] of Object.entries(row)) {
        if (v == null) continue;
        const valStr = String(v).trim().toUpperCase();
        if (!valStr || valStr === String(fromValue).toUpperCase() || valStr === String(durationValue).toUpperCase()) continue;
        const cleaned = valStr.replace(/[\/\-\s]/g, '').replace('RATE', '');
        if (rateTypeMapping[valStr]) { rateType = valStr; break; }
        if (rateTypeMapping[cleaned]) { rateType = cleaned; break; }
        if (valStr.length > 1) {
          const fuzzy = findBestRateTypeMatch(valStr);
          if (fuzzy) { rateType = fuzzy; break; }
        }
      }
    }

    if (hours > 0 && rateType) {
      const targetField = rateTypeMapping[rateType];
      if (targetField) {
        aggregatedHours[targetField] += hours;
        console.log(`Added ${hours.toFixed(2)} hours to ${targetField} from rate type ${rateType}`);
      } else {
        console.log(`Warning: Found hours ${hours.toFixed(2)} but rate type ${rateType} not in mapping`);
      }
    } else if (hours > 0) {
      console.log(`Warning: Found ${hours.toFixed(2)} hours but no matching rate type in row ${i}`);
    }
  }

  // If nothing captured, try summary labels fallback scanning values
  const allZero = Object.values(aggregatedHours).every(v => v === 0);
  if (allZero) {
    const pickNumberInRow = (row: any): number => {
      let best = 0;
      for (const v of Object.values(row)) {
        if (v == null) continue;
        const s = String(v).trim();
        // Prefer numbers like 14 or 6.00
        const n = parseFloat(s);
        if (!isNaN(n)) best = Math.max(best, n);
      }
      return best;
    };
    for (const row of sheetData) {
      if (!row || typeof row !== 'object') continue;
      const vals = Object.values(row).map(v => String(v ?? '').toLowerCase());
      if (vals.some(t => t.includes('operation hours'))) aggregatedHours['Operation Hr'] += pickNumberInRow(row);
      if (vals.some(t => t.includes('rig move hours'))) aggregatedHours['Rig Move Hr'] += pickNumberInRow(row);
      if (vals.some(t => t.includes('reduced') && t.includes('repair'))) aggregatedHours['Reduce Hr'] += pickNumberInRow(row);
      if (vals.some(t => t.includes('stand by hours') || t.includes('standby hours'))) aggregatedHours['Standby Hr'] += pickNumberInRow(row);
      if (vals.some(t => t.includes('zero hours'))) aggregatedHours['Zero Hr'] += pickNumberInRow(row);
      if (vals.some(t => t.includes('am hours') || t.includes('annual maintenance'))) aggregatedHours['AM Hr'] += pickNumberInRow(row);
      if (vals.some(t => t.includes('special'))) aggregatedHours['Special Hr'] += pickNumberInRow(row);
      if (vals.some(t => t.includes('force majeure'))) aggregatedHours['Force Majeure Hr'] += pickNumberInRow(row);
      if (vals.some(t => t.includes('stacking'))) aggregatedHours['STACKING Hr'] += pickNumberInRow(row);
    }
  }

  console.log('Aggregated hours:', aggregatedHours);
  return aggregatedHours;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sheetData, rig, fileDate } = await req.json();
    
    console.log(`Processing sheet data for rig ${rig}...`);

    // First, extract activity table hours
    console.log('Extracting activity table hours...');
    const activityHours = extractActivityHours(sheetData);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch rig configuration
    const { data: rigConfig, error: configError } = await supabase
      .from('rig_configs')
      .select('*')
      .eq('rig_number', rig)
      .single();

    if (configError) {
      console.error("Error fetching rig config:", configError);
      throw new Error("Failed to fetch rig configuration");
    }

    console.log("Rig config:", rigConfig);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build column mappings description for AI
    const columnMappings = rigConfig.column_mappings as any[];
    const fixedDataFields = columnMappings
      .filter((m: any) => m.isFixedData && m.fixedValue)
      .map((m: any) => `${m.columnName}: ${m.fixedValue}`)
      .join(', ');

    const extractableFields = columnMappings
      .filter((m: any) => !m.isFixedData && m.cellReference)
      .map((m: any) => `${m.columnName} (from cell ${m.cellReference})`)
      .join(', ');

    // Prepare AI inputs and prompt (with safe fallbacks)
    const fixedClient = (columnMappings.find((m: any) => m.columnName === 'Client' && m.isFixedData && m.fixedValue)?.fixedValue) as string | undefined;
    const sheetPreview = Array.isArray(sheetData) ? sheetData.slice(0, 200) : sheetData;

    // Create a prompt for the AI to analyze and extract structured data
    const prompt = `You are an expert at analyzing Excel spreadsheet data from DDOR (Daily Drilling Operations Report) files.

I have data from rig ${rig}. The sheet name is "${rigConfig.sheet_name}".

FIXED DATA (Use these exact values):
${fixedDataFields || 'None'}

EXTRACT FROM SHEET (These need to be extracted from the data):
${extractableFields || 'All fields need to be extracted'}

Sheet Data (preview only, up to 200 rows):
${JSON.stringify(sheetPreview, null, 2)}

Extract and return a JSON object with this EXACT structure (use empty string for missing values, hours will be filled from activity table):
{
  "extractedData": {
    "Date": "extracted or empty string",
    "Rig": "${rig}",
    "Client": "${columnMappings.find((m: any) => m.columnName === 'Client')?.isFixedData ? columnMappings.find((m: any) => m.columnName === 'Client')?.fixedValue : 'extract from data'}",
    "Not Received DDOR": "extracted or empty string",
    "Remarks": "extracted or empty string"
  },
  "metadata": {
    "rigNumber": "${rig}",
    "dataQuality": "good/fair/poor"
  }
}

NOTE: DO NOT extract hour fields - they have already been calculated from the activity table.

IMPORTANT: Return ONLY valid JSON, no markdown formatting or code blocks.`;

    // Try AI extraction only if client isn't fixed; otherwise, we'll use safe fallback
    let extractedData: any;
    try {
      if (!fixedClient) {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { 
                role: "system", 
                content: "You are a data extraction expert. Always return valid JSON only, with no markdown formatting." 
              },
              { role: "user", content: prompt }
            ],
          }),
        });

        if (!response.ok) {
          if (response.status === 429) {
            return new Response(
              JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), 
              { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          if (response.status === 402) {
            return new Response(
              JSON.stringify({ error: "AI credits exhausted. Please add credits to your workspace." }), 
              { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          const errorText = await response.text();
          console.warn("AI gateway non-OK, falling back without AI:", response.status, errorText);
        } else {
          const aiResponse = await response.json();
          const extractedContent = aiResponse.choices?.[0]?.message?.content ?? '';
          console.log("AI extracted content:", extractedContent);
          try {
            const cleanContent = String(extractedContent)
              .replace(/```json\n?/g, '')
              .replace(/```\n?/g, '')
              .trim();
            if (cleanContent) {
              extractedData = JSON.parse(cleanContent);
            }
          } catch (parseError) {
            console.warn("Failed to parse AI response, using fallback:", parseError);
          }
        }
      }
    } catch (e) {
      console.warn("AI extraction failed, using fallback:", e);
    }

    // Minimal fallback if AI is unavailable or client is fixed
    if (!extractedData) {
      extractedData = {
        extractedData: {
          Date: "",
          Rig: String(rig),
          Client: fixedClient || "",
          "Not Received DDOR": "",
          Remarks: ""
        },
        metadata: {
          rigNumber: String(rig),
          dataQuality: "good"
        }
      };
    }


    // Prepare and store extracted data in database
    const toISODate = (val: unknown): string => {
      // Prefer user-provided date from the uploader if available
      if (fileDate && typeof fileDate === 'string') return fileDate;
      try {
        if (typeof val === 'number' || (typeof val === 'string' && /^\d+$/.test(val as string))) {
          const serial = typeof val === 'number' ? val : parseInt(val as string, 10);
          // Excel serial date: days since 1899-12-30
          const excelEpoch = new Date(Date.UTC(1899, 11, 30));
          const date = new Date(excelEpoch.getTime() + serial * 86400000);
          return date.toISOString().slice(0, 10);
        }
        const d = new Date(String(val));
        if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
      } catch (_) { /* ignore */ }
      return new Date().toISOString().slice(0, 10);
    };

    const dateStr = toISODate(extractedData.extractedData?.Date);

    // Calculate total hours from activity table
    let totalHrs = 
      activityHours['Operation Hr'] +
      activityHours['Reduce Hr'] +
      activityHours['Standby Hr'] +
      activityHours['Zero Hr'] +
      activityHours['Repair Hr'] +
      activityHours['AM Hr'] +
      activityHours['Special Hr'] +
      activityHours['Force Majeure Hr'] +
      activityHours['STACKING Hr'] +
      activityHours['Rig Move Hr'];

    console.log('Total hours calculated:', totalHrs);
    
    // Validate and proportionally scale down if total exceeds 24
    if (totalHrs > 24) {
      console.warn(`WARNING: Total hours (${totalHrs.toFixed(2)}) exceeds 24 hours. Data may span multiple days. Scaling down proportionally.`);
      const scaleFactor = 24 / totalHrs;
      
      // Scale down all hour categories proportionally
      activityHours['Operation Hr'] *= scaleFactor;
      activityHours['Reduce Hr'] *= scaleFactor;
      activityHours['Standby Hr'] *= scaleFactor;
      activityHours['Zero Hr'] *= scaleFactor;
      activityHours['Repair Hr'] *= scaleFactor;
      activityHours['AM Hr'] *= scaleFactor;
      activityHours['Special Hr'] *= scaleFactor;
      activityHours['Force Majeure Hr'] *= scaleFactor;
      activityHours['STACKING Hr'] *= scaleFactor;
      activityHours['Rig Move Hr'] *= scaleFactor;
      
      totalHrs = 24;
      console.log('Hours scaled down proportionally to 24 total hours');
    }

    // No cumulative addition - each upload replaces previous data
    let finalHours = { ...activityHours };
    let finalTotal = totalHrs;

    // Filter remarks if only Zero Hr and Repair Hr have values
    let finalRemarks = extractedData.extractedData?.Remarks || '';
    
    // Check if only Zero Hr and Repair Hr have non-zero values
    const hasOnlyZeroAndRepair = 
      finalHours['Zero Hr'] > 0 &&
      finalHours['Repair Hr'] > 0 &&
      finalHours['Operation Hr'] === 0 &&
      finalHours['Reduce Hr'] === 0 &&
      finalHours['Standby Hr'] === 0 &&
      finalHours['AM Hr'] === 0 &&
      finalHours['Special Hr'] === 0 &&
      finalHours['Force Majeure Hr'] === 0 &&
      finalHours['STACKING Hr'] === 0 &&
      finalHours['Rig Move Hr'] === 0;
    
    // Filter remarks to show only task descriptions (time range + operation)
    if (hasOnlyZeroAndRepair && finalRemarks) {
      // Extract only lines that match time patterns (e.g., "00:00 - 00:00 OPERATION")
      const timePattern = /\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}\s+[A-Z\s]+/gi;
      const taskDescriptions = finalRemarks.match(timePattern);
      if (taskDescriptions && taskDescriptions.length > 0) {
        finalRemarks = taskDescriptions.join(', ');
      }
    }

    // Use upsert to update existing record or insert new one
    const { error: insertError } = await supabase
      .from('extracted_ddor_data')
      .upsert({
        rig_number: rig,
        date: dateStr,
        client: extractedData.extractedData?.Client || '',
        operation_hr: finalHours['Operation Hr'],
        reduce_hr: finalHours['Reduce Hr'],
        standby_hr: finalHours['Standby Hr'],
        zero_hr: finalHours['Zero Hr'],
        repair_hr: finalHours['Repair Hr'],
        am_hr: finalHours['AM Hr'],
        special_hr: finalHours['Special Hr'],
        force_majeure_hr: finalHours['Force Majeure Hr'],
        stacking_hr: finalHours['STACKING Hr'],
        rig_move_hr: finalHours['Rig Move Hr'],
        not_received_ddor: finalTotal === 0 ? '1' : (extractedData.extractedData?.['Not Received DDOR'] || ''),
        total_hrs: finalTotal,
        remarks: finalRemarks
      }, {
        onConflict: 'rig_number,date',
        ignoreDuplicates: false
      });

    if (insertError) {
      console.error("Error inserting extracted data:", insertError);
      throw new Error("Failed to store extracted data");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: extractedData 
      }), 
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error in extract-sheet-data:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
