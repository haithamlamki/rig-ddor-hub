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
  'R/MOVE': 'Rig Move Hr',
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

// Function to extract daily totals from Hoist billing sheets
// Returns a map of date -> total amount for all dates found in the sheet
function extractHoistDailyTotals(sheetData: any[]): Record<string, number> {
  console.log('Extracting daily totals for Hoist rig from billing sheet...');
  
  const dailyTotals: Record<string, number> = {};
  
  // Find the header row containing "Date" and "Amount"
  let dateColKey = '';
  let amountColKey = '';
  let headerRowIndex = -1;
  
  for (let i = 0; i < sheetData.length; i++) {
    const row = sheetData[i];
    if (!row || typeof row !== 'object') continue;
    
    // Check if this row contains "Date" and "Amount" headers
    for (const [key, value] of Object.entries(row)) {
      const valStr = String(value || '').trim().toLowerCase();
      if (valStr === 'date' && !dateColKey) {
        dateColKey = key;
      }
      if (valStr === 'amount' && !amountColKey) {
        amountColKey = key;
      }
    }
    
    // If we found both columns, this is the header row
    if (dateColKey && amountColKey) {
      headerRowIndex = i;
      console.log(`Found header row at index ${i}: Date column="${dateColKey}", Amount column="${amountColKey}"`);
      break;
    }
  }
  
  if (headerRowIndex === -1) {
    console.warn('Could not find header row with "Date" and "Amount" columns');
    return dailyTotals;
  }
  
  // Helper to parse date to ISO format (YYYY-MM-DD)
  const parseDate = (val: any): string | null => {
    if (!val) return null;
    
    try {
      // Handle Excel serial date (number)
      if (typeof val === 'number') {
        const excelEpoch = new Date(Date.UTC(1899, 11, 30));
        const date = new Date(excelEpoch.getTime() + val * 86400000);
        return date.toISOString().slice(0, 10);
      }
      
      // Handle string dates
      const str = String(val).trim();
      if (!str) return null;
      
      // Try parsing as ISO date or other common formats
      const date = new Date(str);
      if (!isNaN(date.getTime())) {
        // Extract date-only (ignore time)
        return date.toISOString().slice(0, 10);
      }
    } catch (e) {
      console.warn(`Failed to parse date: ${val}`, e);
    }
    
    return null;
  };
  
  // Helper to parse amount (strip $ and commas)
  const parseAmount = (val: any): number => {
    if (!val) return 0;
    
    const str = String(val).trim();
    // Remove $ and commas, then parse as float
    const cleaned = str.replace(/[\$,]/g, '');
    const amount = parseFloat(cleaned);
    
    return isNaN(amount) ? 0 : amount;
  };
  
  // Process data rows after the header
  for (let i = headerRowIndex + 1; i < sheetData.length; i++) {
    const row = sheetData[i];
    if (!row || typeof row !== 'object') continue;
    
    const dateVal = (row as any)[dateColKey];
    const amountVal = (row as any)[amountColKey];
    
    const dateStr = parseDate(dateVal);
    const amount = parseAmount(amountVal);
    
    // Skip rows without valid date or amount
    if (!dateStr || amount <= 0) continue;
    
    // Optional: Filter to hoist rows only
    // Check if "Activity Description" column contains "hoist" (case-insensitive)
    const rowStr = JSON.stringify(row).toLowerCase();
    if (!rowStr.includes('hoist')) {
      // If your file can contain other equipment, uncomment this to filter
      // continue;
    }
    
    // Sum amounts by date
    if (!dailyTotals[dateStr]) {
      dailyTotals[dateStr] = 0;
    }
    dailyTotals[dateStr] += amount;
    
    console.log(`Date: ${dateStr}, Amount: $${amount.toFixed(2)} (daily total: $${dailyTotals[dateStr].toFixed(2)})`);
  }
  
  console.log('Daily totals extracted:', dailyTotals);
  return dailyTotals;
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
  
  // Helper: Convert time string/number to minutes after midnight
  const parseTimeToMinutes = (timeValue: any): number => {
    if (timeValue === null || timeValue === undefined) return -1;
    if (typeof timeValue === 'number') {
      // Excel decimal (0.5 = 12:00 = 720 minutes)
      return Math.round(timeValue * 24 * 60);
    }
    const timeStr = String(timeValue).trim().replace(/;/g, ':');
    if (!timeStr.includes(':')) return -1;
    const parts = timeStr.split(':');
    const h = parseInt(parts[0] || '0');
    const m = parseInt(parts[1] || '0');
    return h * 60 + m;
  };
  
  // Helper: Check if value looks like a time
  const looksLikeTime = (val: any): boolean => {
    if (val === null || val === undefined) return false;
    const str = String(val).trim();
    const norm = str.replace(/;/g, ':');
    return /^\d{1,2}:\d{2}$/.test(norm) || (!isNaN(parseFloat(str)) && parseFloat(str) < 1);
  };
  
  // Helper: Check if row has yellow fill (Excel fill color)
  const hasYellowFill = (row: any): boolean => {
    // Excel fills are in the 's' (style) property if available
    // This is a simplified check - xlsx library may expose fill info differently
    try {
      if (row && typeof row === 'object') {
        const rowStr = JSON.stringify(row);
        // Check for common yellow fill indicators in Excel data
        // Note: This may need adjustment based on how xlsx library exposes styling
        return rowStr.includes('"fgColor":{"rgb":"FFFFFF00"') || 
               rowStr.includes('"fgColor":{"rgb":"FFFF00"') ||
               rowStr.includes('"bgColor":"yellow"');
      }
    } catch (e) {
      // Ignore errors
    }
    return false;
  };
  
  // Helper: Extract band label from text (e.g., "00:00 - 06:00")
  const extractBandLabel = (text: string): string | null => {
    const normalized = text.toUpperCase().replace(/\s+/g, ' ').trim();
    // Match patterns like "00:00 - 06:00" or "00:00-06:00" or "0:00 - 6:00"
    const match = normalized.match(/(\d{1,2}):?(\d{2})?\s*-\s*(\d{1,2}):?(\d{2})?/);
    if (match) {
      const fromH = match[1].padStart(2, '0');
      const fromM = (match[2] || '00').padStart(2, '0');
      const toH = match[3].padStart(2, '0');
      const toM = (match[4] || '00').padStart(2, '0');
      return `${fromH}:${fromM} - ${toH}:${toM}`;
    }
    return null;
  };
  
  // Helper: Check if band label is "00:00 - 06:00"
  const isMorningBand = (bandLabel: string): boolean => {
    return bandLabel === '00:00 - 06:00' || bandLabel === '0:00 - 06:00';
  };
  
  // Helper: Convert row to text for searching
  const rowToText = (row: any): string => {
    if (!row || typeof row !== 'object') return '';
    return Object.values(row).map(v => String(v ?? '')).join(' ');
  };
  
  // Step 1: Find all activity blocks (each has a band label + header row)
  interface ActivityBlock {
    bandLabel: string;
    bandRow: number;
    headerRow: number;
    dataStartRow: number;
    headerCols: { from?: string; to?: string; dur?: string; rate?: string };
    firstFromTime: number; // Track first activity's FROM time to detect 00:00-06:00 blocks
  }
  
  const blocks: ActivityBlock[] = [];
  
  for (let i = 0; i < sheetData.length - 1; i++) {
    const row = sheetData[i];
    if (!row || typeof row !== 'object') continue;
    
    const rowText = rowToText(row);
    const bandLabel = extractBandLabel(rowText);
    
    if (bandLabel) {
      // Found a potential band label, look for header row in next few rows
      for (let j = i + 1; j < Math.min(i + 5, sheetData.length); j++) {
        const headerRow = sheetData[j];
        if (!headerRow || typeof headerRow !== 'object') continue;
        
        // Check if this row contains "From", "TO", "Dur." headers
        const entries = Object.entries(headerRow);
        const byVal = (match: string) => entries.find(([k, v]) => String(v ?? '').trim().toLowerCase() === match)?.[0];
        const fromKey = byVal('from');
        const toKey = byVal('to');
        const durKey = entries.find(([k, v]) => String(v ?? '').trim().toLowerCase().includes('dur'))?.[0];
        const rateKey = entries.find(([k, v]) => String(v ?? '').trim().toLowerCase().includes('rate'))?.[0];
        
        if (fromKey && toKey && durKey) {
          // Found header row for this block - peek at first data row to get firstFromTime
          let firstFromTime = -1;
          for (let k = j + 1; k < Math.min(j + 10, sheetData.length); k++) {
            const dataRow = sheetData[k];
            if (!dataRow) continue;
            const fromVal = (dataRow as any)[fromKey];
            if (looksLikeTime(fromVal)) {
              firstFromTime = parseTimeToMinutes(fromVal);
              break;
            }
          }
          
          blocks.push({
            bandLabel,
            bandRow: i,
            headerRow: j,
            dataStartRow: j + 1,
            headerCols: { from: fromKey, to: toKey, dur: durKey, rate: rateKey },
            firstFromTime
          });
          console.log(`Found activity block: "${bandLabel}" at rows ${i}-${j}, firstFromTime=${firstFromTime}`);
          break;
        }
      }
    }
  }
  
  // If no blocks found with band labels, try to find ALL standalone activity tables
  if (blocks.length === 0) {
    console.log('No band-labeled blocks found, searching for all activity tables...');
    
    for (let i = 0; i < sheetData.length; i++) {
      const row = sheetData[i];
      if (!row || typeof row !== 'object') continue;
      
      const entries = Object.entries(row);
      const byVal = (match: string) => entries.find(([k, v]) => String(v ?? '').trim().toLowerCase() === match)?.[0];
      const fromKey = byVal('from');
      const toKey = byVal('to');
      const durKey = entries.find(([k, v]) => String(v ?? '').trim().toLowerCase().includes('dur'))?.[0];
      const rateKey = entries.find(([k, v]) => String(v ?? '').trim().toLowerCase().includes('rate'))?.[0];
      
      if (fromKey && toKey && durKey) {
        // Peek at first data row to determine if this is a morning block (00:00-06:00)
        let firstFromTime = -1;
        let lastToTime = -1;
        let totalRows = 0;
        for (let k = i + 1; k < Math.min(i + 30, sheetData.length); k++) {
          const dataRow = sheetData[k];
          if (!dataRow) continue;
          const fromVal = (dataRow as any)[fromKey];
          const toVal = (dataRow as any)[toKey];
          if (looksLikeTime(fromVal)) {
            totalRows++;
            if (firstFromTime === -1) {
              firstFromTime = parseTimeToMinutes(fromVal);
            }
            if (looksLikeTime(toVal)) {
              let toMins = parseTimeToMinutes(toVal);
              // Treat TO=00:00 as 24:00 for lastToTime calculation
              if (toMins === 0 && parseTimeToMinutes(fromVal) > 0) {
                toMins = 1440;
              }
              if (toMins > lastToTime) lastToTime = toMins;
            }
          }
        }
        
        // Infer band label based on activity times
        // A morning block (00:00-06:00) has few rows (< 5) and all activities end before 06:00
        // A full-day block has many rows (>= 5) or activities extending past 06:00
        let inferredBandLabel = '00:00 - 00:00'; // Default to full-day
        if (firstFromTime === 0 && lastToTime > 0 && lastToTime <= 360 && totalRows < 5) {
          inferredBandLabel = '00:00 - 06:00'; // Morning block
          console.log(`Inferred morning band (00:00 - 06:00) from data: firstFrom=${firstFromTime}, lastTo=${lastToTime}, rows=${totalRows}`);
        } else {
          console.log(`Inferred full-day band (00:00 - 00:00) from data: firstFrom=${firstFromTime}, lastTo=${lastToTime}, rows=${totalRows}`);
        }
        
        blocks.push({
          bandLabel: inferredBandLabel,
          bandRow: i - 1,
          headerRow: i,
          dataStartRow: i + 1,
          headerCols: { from: fromKey, to: toKey, dur: durKey, rate: rateKey },
          firstFromTime
        });
        console.log(`Found standalone activity table at row ${i}, inferred band: "${inferredBandLabel}"`);
        
        // Continue searching for more tables (don't break)
      }
    }
  }
  
  if (blocks.length === 0) {
    console.log('No activity tables found, attempting summary fallback...');
    // Fallback: Try to parse summary boxes
    const parseNum = (val: any): number => {
      if (val === null || val === undefined) return 0;
      if (typeof val === 'number') return Number(val);
      const s = String(val).replace(/[^0-9.:]/g, '').trim();
      if (!s) return 0;
      if (/:/.test(s)) {
        const [h, m] = s.split(':');
        return (parseInt(h || '0') || 0) + (parseInt(m || '0') || 0) / 60;
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
        else if (k.includes('reduced') && k.includes('repair')) aggregatedHours['Reduce Hr'] += num;
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
  
  // Step 2: Process blocks
  let totalMinutes = 0;
  let yellowCutoffReached = false;
  
  for (const block of blocks) {
    if (yellowCutoffReached) {
      console.log(`Skipping block "${block.bandLabel}" - yellow cut-off already reached`);
      break;
    }
    
    // Skip "00:00 - 06:00" bands
    if (isMorningBand(block.bandLabel)) {
      console.log(`Skipping block "${block.bandLabel}" - morning band rule`);
      continue;
    }
    
    console.log(`Processing block: "${block.bandLabel}"`);
    
    // Process data rows in this block
    for (let i = block.dataStartRow; i < sheetData.length; i++) {
      const row = sheetData[i];
      if (!row || typeof row !== 'object') continue;
      
      // Check for yellow fill - if found, stop processing this and all subsequent blocks
      if (hasYellowFill(row)) {
        console.log(`Yellow row detected at row ${i} - stopping all processing`);
        yellowCutoffReached = true;
        break;
      }
      
      // Check if we've hit another activity table header (From | To | Dur.)
      const entries = Object.entries(row);
      const byVal = (match: string) => entries.find(([k, v]) => String(v ?? '').trim().toLowerCase() === match)?.[0];
      const hasFromHeader = byVal('from');
      const hasToHeader = byVal('to');
      const hasDurHeader = entries.find(([k, v]) => String(v ?? '').trim().toLowerCase().includes('dur'))?.[0];
      
      if (hasFromHeader && hasToHeader && hasDurHeader) {
        console.log(`Hit next activity table header at row ${i} - stopping current block`);
        break;
      }
      
      // Get From, TO, Dur values
      const fromValue = (row as any)[block.headerCols.from!];
      const toValue = (row as any)[block.headerCols.to!];
      const durValue = (row as any)[block.headerCols.dur!];
      
      if (fromValue === null || fromValue === undefined) continue;
      
      // Skip non-time rows
      if (!looksLikeTime(fromValue)) continue;
      
      // Parse times
      let fromMinutes = parseTimeToMinutes(fromValue);
      let toMinutes = parseTimeToMinutes(toValue);
      
      if (fromMinutes < 0) continue;
      
      // Skip rows where From == TO (e.g., 0:00 - 0:00 with bogus duration)
      if (fromMinutes === toMinutes) {
        console.log(`Row ${i}: Skipping From==TO (${fromMinutes} mins)`);
        continue;
      }
      
      // Treat TO=00:00 as 24:00 (1440 minutes)
      if (toMinutes === 0 && fromMinutes > 0) {
        toMinutes = 1440;
        console.log(`Row ${i}: TO is 00:00, treating as 24:00`);
      }
      
      // If TO < FROM, clamp TO to 24:00 (drop spill to next day)
      if (toMinutes >= 0 && toMinutes < fromMinutes) {
        console.log(`Row ${i}: TO < FROM (${toMinutes} < ${fromMinutes}), clamping TO to 1440`);
        toMinutes = 1440;
      }
      
      // Compute mins_from_to = max(0, min(TO, 1440) - From)
      const minsFromTo = Math.max(0, Math.min(toMinutes >= 0 ? toMinutes : 1440, 1440) - fromMinutes);
      
      // Parse Dur. → mins_dur
      let minsDur = 0;
      if (durValue !== null && durValue !== undefined) {
        if (typeof durValue === 'number') {
          minsDur = Math.round(durValue * 24 * 60);
        } else {
          const durStr = String(durValue).trim().replace(/;/g, ':');
          if (durStr.includes(':')) {
            const parts = durStr.split(':');
            const h = parseInt(parts[0] || '0');
            const m = parseInt(parts[1] || '0');
            minsDur = h * 60 + m;
          } else {
            const parsed = parseFloat(durStr);
            if (!isNaN(parsed)) minsDur = Math.round(parsed * 60);
          }
        }
      }
      
      // row_minutes = min(mins_from_to, mins_dur) - double validation
      const rowMinutes = Math.min(minsFromTo, minsDur);
      
      if (rowMinutes <= 0) continue;
      
      console.log(`Row ${i}: From=${fromMinutes}, TO=${toMinutes}, minsFromTo=${minsFromTo}, minsDur=${minsDur}, rowMinutes=${rowMinutes}`);
      
      // Find rate type
      let rateType = '';
      
      // Try rate column first
      if (block.headerCols.rate) {
        const rateVal = (row as any)[block.headerCols.rate];
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
      
      // Scan all cells in row if not found
      if (!rateType) {
        for (const [k, v] of Object.entries(row)) {
          if (v == null) continue;
          const valStr = String(v).trim().toUpperCase();
          if (!valStr || valStr === String(fromValue).toUpperCase() || valStr === String(durValue).toUpperCase()) continue;
          const cleaned = valStr.replace(/[\/\-\s]/g, '').replace('RATE', '');
          if (rateTypeMapping[valStr]) { rateType = valStr; break; }
          if (rateTypeMapping[cleaned]) { rateType = cleaned; break; }
          if (valStr.length > 1) {
            const fuzzy = findBestRateTypeMatch(valStr);
            if (fuzzy) { rateType = fuzzy; break; }
          }
        }
      }
      
      // Add to totals
      if (rateType && rateTypeMapping[rateType]) {
        const targetField = rateTypeMapping[rateType];
        const hours = rowMinutes / 60;
        aggregatedHours[targetField] += hours;
        totalMinutes += rowMinutes;
        console.log(`Added ${hours.toFixed(2)} hours to ${targetField} from rate type ${rateType}`);
      } else if (rowMinutes > 0) {
        // Default to Operation Hr if no rate type found
        const hours = rowMinutes / 60;
        aggregatedHours['Operation Hr'] += hours;
        totalMinutes += rowMinutes;
        console.log(`Added ${hours.toFixed(2)} hours to Operation Hr (no rate type found)`);
      }
    }
  }
  
  // Cap total at 1440 minutes (24 hours)
  const cappedMinutes = Math.min(totalMinutes, 1440);
  if (totalMinutes > 1440) {
    console.log(`WARNING: Total minutes (${totalMinutes}) exceeds 24 hours, capping to 1440`);
    // Scale down all hours proportionally
    const scaleFactor = cappedMinutes / totalMinutes;
    for (const key of Object.keys(aggregatedHours)) {
      aggregatedHours[key] *= scaleFactor;
    }
  }
  
  console.log(`Total minutes: ${totalMinutes}, capped: ${cappedMinutes}`);
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

    // Check if this is a Hoist rig (Hoist 1, Hoist 2, etc.)
    const isHoistRig = String(rig).toLowerCase().includes('hoist');
    
    let hoistDailyTotals: Record<string, number> = {};
    let activityHours: Record<string, number> = {};
    
    if (isHoistRig) {
      // For Hoist rigs, extract daily totals from all dates in the file
      console.log('Detected Hoist rig - extracting daily billing totals...');
      hoistDailyTotals = extractHoistDailyTotals(sheetData);
    } else {
      // For regular rigs, extract activity table hours
      console.log('Extracting activity table hours...');
      activityHours = extractActivityHours(sheetData);
    }

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

    // For Hoist rigs, process each date found in the file separately
    if (isHoistRig) {
      console.log('Processing Hoist rig - updating all dates found in file:', Object.keys(hoistDailyTotals));
      
      // Update database for each date found in the file
      for (const [dateIso, totalAmount] of Object.entries(hoistDailyTotals)) {
        console.log(`Upserting Hoist data for date ${dateIso} with amount $${totalAmount.toFixed(2)}`);
        
        const { error: upsertError } = await supabase
          .from('extracted_ddor_data')
          .upsert({
            rig_number: rig,
            date: dateIso,
            client: extractedData.extractedData?.Client || '',
            operation_hr: 0,
            reduce_hr: 0,
            standby_hr: 0,
            zero_hr: 0,
            repair_hr: 0,
            am_hr: 0,
            special_hr: 0,
            force_majeure_hr: 0,
            stacking_hr: 0,
            rig_move_hr: 0,
            not_received_ddor: totalAmount === 0 ? '1' : '',
            total_hrs: 0,
            total_amount: totalAmount,
            remarks: ''
          }, {
            onConflict: 'rig_number,date',
            ignoreDuplicates: false
          });

        if (upsertError) {
          console.error(`Error upserting data for date ${dateIso}:`, upsertError);
          throw new Error(`Failed to store data for date ${dateIso}`);
        }
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: extractedData,
          hoistDailyTotals: hoistDailyTotals,
          datesUpdated: Object.keys(hoistDailyTotals)
        }), 
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // For regular rigs, continue with the normal flow
    const dateStr = toISODate(extractedData.extractedData?.Date);

    let totalHrs = 0;
    let finalHours: Record<string, number> = {};
    let finalTotal = 0;

    // Calculate total hours from activity table for regular rigs
    totalHrs = 
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
    
    // Log warning if total doesn't equal 24, but don't scale
    if (totalHrs !== 24 && totalHrs > 0) {
      console.warn(`WARNING: Total hours (${totalHrs.toFixed(2)}) is not 24 hours. This will show a warning in the UI.`);
    }

    // Store actual hours without scaling
    finalHours = { ...activityHours };
    finalTotal = totalHrs;

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

    // Check if a record already exists for this rig and date
    const { data: existingRecord } = await supabase
      .from('extracted_ddor_data')
      .select('*')
      .eq('rig_number', rig)
      .eq('date', dateStr)
      .single();

    // If record exists, add hours to existing values (accumulate)
    // If not, use the extracted hours as-is
    const recordToInsert = existingRecord ? {
      rig_number: rig,
      date: dateStr,
      client: extractedData.extractedData?.Client || existingRecord.client || '',
      operation_hr: (existingRecord.operation_hr || 0) + finalHours['Operation Hr'],
      reduce_hr: (existingRecord.reduce_hr || 0) + finalHours['Reduce Hr'],
      standby_hr: (existingRecord.standby_hr || 0) + finalHours['Standby Hr'],
      zero_hr: (existingRecord.zero_hr || 0) + finalHours['Zero Hr'],
      repair_hr: (existingRecord.repair_hr || 0) + finalHours['Repair Hr'],
      am_hr: (existingRecord.am_hr || 0) + finalHours['AM Hr'],
      special_hr: (existingRecord.special_hr || 0) + finalHours['Special Hr'],
      force_majeure_hr: (existingRecord.force_majeure_hr || 0) + finalHours['Force Majeure Hr'],
      stacking_hr: (existingRecord.stacking_hr || 0) + finalHours['STACKING Hr'],
      rig_move_hr: (existingRecord.rig_move_hr || 0) + finalHours['Rig Move Hr'],
      not_received_ddor: finalTotal === 0 ? '1' : (extractedData.extractedData?.['Not Received DDOR'] || ''),
      total_hrs: (existingRecord.total_hrs || 0) + finalTotal,
      total_amount: 0, // Regular rigs don't use total_amount
      remarks: existingRecord.remarks ? `${existingRecord.remarks}\n---\n${finalRemarks}` : finalRemarks
    } : {
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
      total_amount: 0, // Regular rigs don't use total_amount
      remarks: finalRemarks
    };

    console.log('Inserting/updating record:', existingRecord ? 'Accumulating with existing data' : 'Creating new record');
    
    // Use upsert to update existing record or insert new one
    const { error: insertError } = await supabase
      .from('extracted_ddor_data')
      .upsert(recordToInsert, {
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
