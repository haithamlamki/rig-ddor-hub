import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sheetData, rig, fileDate } = await req.json();
    
    console.log(`Processing sheet data for rig ${rig}...`);

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

Extract and return a JSON object with this EXACT structure (use empty string or 0 for missing values):
{
  "extractedData": {
    "Date": "extracted or empty string",
    "Rig": "${rig}",
    "Client": "${columnMappings.find((m: any) => m.columnName === 'Client')?.isFixedData ? columnMappings.find((m: any) => m.columnName === 'Client')?.fixedValue : 'extract from data'}",
    "Operation Hr": number,
    "Reduce Hr": number,
    "Standby Hr": number,
    "Zero Hr": number,
    "Repair Hr": number,
    "AM Hr": number,
    "Special Hr": number,
    "Force Majeure Hr": number,
    "STACKING Hr": number,
    "Rig Move Hr": number,
    "Not Received DDOR": "extracted or empty string",
    "Total Hr.s": number,
    "Remarks": "extracted or empty string"
  },
  "metadata": {
    "rigNumber": "${rig}",
    "dataQuality": "good/fair/poor"
  }
}

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

    const { error: insertError } = await supabase
      .from('extracted_ddor_data')
      .insert({
        rig_number: rig,
        date: dateStr,
        client: extractedData.extractedData?.Client || '',
        operation_hr: Number(extractedData.extractedData?.['Operation Hr']) || 0,
        reduce_hr: Number(extractedData.extractedData?.['Reduce Hr']) || 0,
        standby_hr: Number(extractedData.extractedData?.['Standby Hr']) || 0,
        zero_hr: Number(extractedData.extractedData?.['Zero Hr']) || 0,
        repair_hr: Number(extractedData.extractedData?.['Repair Hr']) || 0,
        am_hr: Number(extractedData.extractedData?.['AM Hr']) || 0,
        special_hr: Number(extractedData.extractedData?.['Special Hr']) || 0,
        force_majeure_hr: Number(extractedData.extractedData?.['Force Majeure Hr']) || 0,
        stacking_hr: Number(extractedData.extractedData?.['STACKING Hr']) || 0,
        rig_move_hr: Number(extractedData.extractedData?.['Rig Move Hr']) || 0,
        not_received_ddor: extractedData.extractedData?.['Not Received DDOR'] || '',
        total_hrs: Number(extractedData.extractedData?.['Total Hr.s']) || 0,
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
