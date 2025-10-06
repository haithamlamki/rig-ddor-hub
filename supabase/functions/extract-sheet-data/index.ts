import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate type mapping to hour categories
const rateTypeMapping: Record<string, string> = {
  'OPER': 'Operation Hr',
  'OP RATE': 'Operation Hr',
  'OPERATION': 'Operation Hr',
  'REDUCE': 'Reduce Hr',
  'STANDBY': 'Standby Hr',
  'ZERO': 'Zero Hr',
  'REPAIR': 'Repair Hr',
  'AM': 'AM Hr',
  'SPECIAL': 'Special Hr',
  'FORCE MAJEURE': 'Force Majeure Hr',
  'STACKING': 'STACKING Hr',
  'RIG MOVE': 'Rig Move Hr',
};

// Function to extract and aggregate activity table hours
function extractActivityHours(sheetData: any[][]): Record<string, number> {
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
  
  // Find the activity table by looking for "From", "TO", "Dur." headers
  let activityTableStartRow = -1;
  for (let i = 0; i < sheetData.length; i++) {
    const row = sheetData[i];
    if (row && row.length > 2) {
      const firstCell = String(row[0] || '').toLowerCase().trim();
      const secondCell = String(row[1] || '').toLowerCase().trim();
      const thirdCell = String(row[2] || '').toLowerCase().trim();
      
      if (firstCell === 'from' && secondCell === 'to' && thirdCell.includes('dur')) {
        activityTableStartRow = i + 1; // Start from next row (data rows)
        console.log('Found activity table at row:', activityTableStartRow);
        break;
      }
    }
  }

  if (activityTableStartRow === -1) {
    console.log('Activity table not found in sheet data');
    return aggregatedHours;
  }

  // Process activity table rows
  for (let i = activityTableStartRow; i < sheetData.length; i++) {
    const row = sheetData[i];
    if (!row || row.length < 3) continue;

    // Skip if first cell is empty or looks like a section break
    const firstCell = String(row[0] || '').trim();
    if (!firstCell || firstCell.length === 0) continue;

    // Column C (index 2) = Duration
    const durationCell = row[2];
    let hours = 0;

    // Parse duration (can be in format "2:00" or decimal)
    if (durationCell) {
      const durationStr = String(durationCell).trim();
      if (durationStr.includes(':')) {
        // Format: "2:00" or "1:30"
        const parts = durationStr.split(':');
        hours = parseInt(parts[0] || '0') + (parseInt(parts[1] || '0') / 60);
      } else {
        // Decimal format
        hours = parseFloat(durationStr) || 0;
      }
    }

    // Look through remaining columns for rate type (usually last column)
    let rateType = '';
    for (let j = row.length - 1; j >= 3; j--) {
      const cellValue = String(row[j] || '').trim().toUpperCase();
      if (cellValue && rateTypeMapping[cellValue]) {
        rateType = cellValue;
        break;
      }
    }

    if (hours > 0 && rateType) {
      const targetField = rateTypeMapping[rateType];
      if (targetField) {
        aggregatedHours[targetField] += hours;
        console.log(`Added ${hours} hours to ${targetField} from rate type ${rateType}`);
      }
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
    const totalHrs = 
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

    const { error: insertError } = await supabase
      .from('extracted_ddor_data')
      .insert({
        rig_number: rig,
        date: dateStr,
        client: extractedData.extractedData?.Client || '',
        operation_hr: activityHours['Operation Hr'],
        reduce_hr: activityHours['Reduce Hr'],
        standby_hr: activityHours['Standby Hr'],
        zero_hr: activityHours['Zero Hr'],
        repair_hr: activityHours['Repair Hr'],
        am_hr: activityHours['AM Hr'],
        special_hr: activityHours['Special Hr'],
        force_majeure_hr: activityHours['Force Majeure Hr'],
        stacking_hr: activityHours['STACKING Hr'],
        rig_move_hr: activityHours['Rig Move Hr'],
        not_received_ddor: extractedData.extractedData?.['Not Received DDOR'] || '',
        total_hrs: totalHrs,
        remarks: extractedData.extractedData?.Remarks || ''
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
