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
  
  // Helper function to check if a value looks like a time (HH:MM format or decimal)
  const looksLikeTime = (val: any): boolean => {
    if (val === null || val === undefined) return false;
    const str = String(val).trim();
    // Check for HH:MM format or decimal number
    return /^\d{1,2}:\d{2}$/.test(str) || (!isNaN(parseFloat(str)) && parseFloat(str) < 1);
  };

  // Find the activity table by looking for "From", "TO", "Dur." headers OR time pattern rows
  let activityTableStartRow = -1;
  let hasHeaders = false;
  
  for (let i = 0; i < sheetData.length; i++) {
    const row = sheetData[i];
    if (!row || typeof row !== 'object') continue;

    // Check if this row contains the headers (From, TO, Dur.) - case insensitive
    const col0 = String((row as any)['__EMPTY'] || '').trim();
    const col1 = String((row as any)['__EMPTY_1'] || '').trim();
    const col2 = String((row as any)['__EMPTY_2'] || '').trim();
    
    if (col0.toLowerCase() === 'from' && col1.toLowerCase() === 'to' && col2.toLowerCase().includes('dur')) {
      activityTableStartRow = i + 1; // Start from next row (data rows)
      hasHeaders = true;
      console.log('Found activity table with headers at row:', activityTableStartRow);
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
    console.log('Activity table not found in sheet data');
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

    // Check if this is a data row by looking at __EMPTY (From column)
    const fromValue = (row as any)['__EMPTY'];
    if (fromValue === null || fromValue === undefined) continue;
    
    // Skip section headers and empty rows
    const fromStr = String(fromValue).trim();
    if (fromStr.length === 0 || fromStr.includes('Prepared by') || fromStr.includes('Update 00:00')) continue;
    
    // Stop if we don't see time-like data anymore (indicates end of activity table)
    if (!looksLikeTime(fromValue) && fromStr.length > 0) {
      console.log('End of activity table detected at row:', i);
      break;
    }
    
    // Parse the start time to detect day boundaries
    let startTimeHours = 0;
    if (typeof fromValue === 'number') {
      startTimeHours = fromValue * 24; // Convert Excel decimal to hours
    } else if (fromStr.includes(':')) {
      const parts = fromStr.split(':');
      startTimeHours = parseInt(parts[0] || '0');
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

    // Column __EMPTY_2 = Duration (Dur.)
    const durationValue = (row as any)['__EMPTY_2'];
    let hours = 0;

    // Parse duration
    if (durationValue !== null && durationValue !== undefined) {
      if (typeof durationValue === 'number') {
        // Excel stores times as decimal fractions of a day
        // e.g., 2 hours = 2/24 = 0.0833...
        hours = durationValue * 24;
      } else {
        const durationStr = String(durationValue).trim();
        if (durationStr.includes(':')) {
          // Format: "2:00" or "1:30"
          const parts = durationStr.split(':');
          hours = parseInt(parts[0] || '0') + (parseInt(parts[1] || '0') / 60);
        } else {
          // Decimal format
          const parsed = parseFloat(durationStr);
          if (!isNaN(parsed)) {
            hours = parsed * 24; // Convert from days to hours
          }
        }
      }
    }

    if (hours === 0) continue;

    // Look for rate type in ALL columns from right to left
    let rateType = '';
    for (let colIdx = 12; colIdx >= 3; colIdx--) {
      const colName = colIdx === 0 ? '__EMPTY' : `__EMPTY_${colIdx}`;
      const cellValue = String((row as any)[colName] || '').trim().toUpperCase();
      // Clean up the value - remove extra characters
      const cleanedValue = cellValue.replace(/[\/\-\s]/g, '').replace('RATE', '');
      
      // Try exact match first
      if (cellValue && rateTypeMapping[cellValue]) {
        rateType = cellValue;
        break;
      }
      // Try cleaned version for matches like "O/Rate" -> "O" or "ORATE"
      if (cleanedValue && rateTypeMapping[cleanedValue]) {
        rateType = cleanedValue;
        break;
      }
      // Try fuzzy matching as fallback if we have a non-empty value
      if (cellValue && cellValue.length > 1) {
        const fuzzyMatch = findBestRateTypeMatch(cellValue);
        if (fuzzyMatch) {
          rateType = fuzzyMatch;
          break;
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

    // Create a prompt for the AI to analyze and extract structured data
    const prompt = `You are an expert at analyzing Excel spreadsheet data from DDOR (Daily Drilling Operations Report) files.

I have data from rig ${rig}. The sheet name is "${rigConfig.sheet_name}".

FIXED DATA (Use these exact values):
${fixedDataFields || 'None'}

EXTRACT FROM SHEET (These need to be extracted from the data):
${extractableFields || 'All fields need to be extracted'}

Sheet Data:
${JSON.stringify(sheetData, null, 2)}

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
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const aiResponse = await response.json();
    const extractedContent = aiResponse.choices[0].message.content;
    
    console.log("AI extracted content:", extractedContent);

    // Parse the AI response
    let extractedData;
    try {
      // Remove markdown code blocks if present
      const cleanContent = extractedContent
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      extractedData = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      throw new Error("Failed to parse AI response");
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

    // Check if record exists for this rig and date
    const { data: existingRecord } = await supabase
      .from('extracted_ddor_data')
      .select('*')
      .eq('rig_number', rig)
      .eq('date', dateStr)
      .single();

    let finalHours = { ...activityHours };
    let finalTotal = totalHrs;

    // If record exists and current total < 24, add to existing hours (cumulative upload)
    if (existingRecord && totalHrs < 24) {
      const existingTotal = Number(existingRecord.total_hrs || 0);
      
      // Add new hours to existing hours
      finalHours['Operation Hr'] += Number(existingRecord.operation_hr || 0);
      finalHours['Reduce Hr'] += Number(existingRecord.reduce_hr || 0);
      finalHours['Standby Hr'] += Number(existingRecord.standby_hr || 0);
      finalHours['Zero Hr'] += Number(existingRecord.zero_hr || 0);
      finalHours['Repair Hr'] += Number(existingRecord.repair_hr || 0);
      finalHours['AM Hr'] += Number(existingRecord.am_hr || 0);
      finalHours['Special Hr'] += Number(existingRecord.special_hr || 0);
      finalHours['Force Majeure Hr'] += Number(existingRecord.force_majeure_hr || 0);
      finalHours['STACKING Hr'] += Number(existingRecord.stacking_hr || 0);
      finalHours['Rig Move Hr'] += Number(existingRecord.rig_move_hr || 0);
      
      finalTotal = existingTotal + totalHrs;
      
      console.log(`Cumulative upload detected. Adding ${totalHrs.toFixed(2)} hours to existing ${existingTotal.toFixed(2)} hours. New total: ${finalTotal.toFixed(2)}`);
      
      // Scale down if combined total exceeds 24
      if (finalTotal > 24) {
        console.warn(`Combined total (${finalTotal.toFixed(2)}) exceeds 24 hours. Scaling down proportionally.`);
        const scaleFactor = 24 / finalTotal;
        
        finalHours['Operation Hr'] *= scaleFactor;
        finalHours['Reduce Hr'] *= scaleFactor;
        finalHours['Standby Hr'] *= scaleFactor;
        finalHours['Zero Hr'] *= scaleFactor;
        finalHours['Repair Hr'] *= scaleFactor;
        finalHours['AM Hr'] *= scaleFactor;
        finalHours['Special Hr'] *= scaleFactor;
        finalHours['Force Majeure Hr'] *= scaleFactor;
        finalHours['STACKING Hr'] *= scaleFactor;
        finalHours['Rig Move Hr'] *= scaleFactor;
        
        finalTotal = 24;
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
        not_received_ddor: extractedData.extractedData?.['Not Received DDOR'] || '',
        total_hrs: finalTotal,
        remarks: extractedData.extractedData?.Remarks || ''
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
