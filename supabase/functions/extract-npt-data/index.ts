import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ColumnMapping {
  [key: string]: string[];
}

const columnMapping: ColumnMapping = {
  'rig_number': ['rig number', 'rig', 'rig no', 'rig #'],
  'year': ['year', 'yr'],
  'month': ['month', 'mon'],
  'date': ['date', 'day'],
  'hours': ['hours', 'hrs', 'duration'],
  'npt_type': ['npt type', 'type', 'npt category'],
  'system': ['system', 'major system'],
  'equipment': ['equipment', 'equip'],
  'the_part': ['the part', 'part', 'component'],
  'contractual': ['contractual', 'contract'],
  'department_responsibility': ['department responsibility', 'dept', 'responsible dept', 'department'],
  'failure_description': ['failure description', 'the failure description', 'description', 'details'],
  'root_cause': ['root cause', 'cause'],
  'corrective_action': ['corrective action', 'action taken'],
  'future_action': ['future action', 'preventive action'],
  'action_party': ['action party', 'responsible party'],
  'notification_number_n2': ['notification number (n2)', 'notification number', 'n2', 'notif no'],
  'failure_investigation_reports': ['failure investigation reports', 'failure investigation', 'investigation', 'report status']
};

function normalizeColumnName(name: string): string {
  return name.toLowerCase().trim().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ');
}

function findColumnIndex(headers: any[], fieldName: string): number {
  const possibleNames = columnMapping[fieldName] || [fieldName];
  
  for (let i = 0; i < headers.length; i++) {
    const header = String(headers[i] || '');
    const normalized = normalizeColumnName(header);
    
    if (possibleNames.some(name => normalized.includes(name) || name.includes(normalized))) {
      return i;
    }
  }
  
  return -1;
}

function calculateDataQuality(record: any): { score: number; missingFields: string[]; issues: any[] } {
  const criticalFields = ['rig_number', 'date', 'hours', 'system', 'failure_description', 'root_cause'];
  const importantFields = ['equipment', 'department_responsibility', 'corrective_action', 'future_action', 'action_party'];
  const optionalFields = ['the_part', 'contractual', 'notification_number_n2', 'failure_investigation_reports'];
  
  let score = 100;
  const missingFields: string[] = [];
  const issues: any[] = [];
  
  // Check critical fields
  for (const field of criticalFields) {
    const value = record[field];
    if (!value || value === '' || value === 'NA') {
      score -= 15;
      missingFields.push(field);
      issues.push({
        field_name: field,
        severity: 'critical',
        quality_issue_type: 'missing_field',
        description: `Critical field "${field}" is missing`
      });
    }
  }
  
  // Check important fields
  for (const field of importantFields) {
    const value = record[field];
    if (!value || value === '' || value === 'NA') {
      score -= 8;
      missingFields.push(field);
      issues.push({
        field_name: field,
        severity: 'high',
        quality_issue_type: 'missing_field',
        description: `Important field "${field}" is missing`
      });
    }
  }
  
  // Check optional fields
  for (const field of optionalFields) {
    const value = record[field];
    if (!value || value === '' || value === 'NA') {
      score -= 3;
      missingFields.push(field);
    }
  }
  
  // Validate hours (0-24)
  if (record.hours !== null && record.hours !== undefined) {
    const hours = parseFloat(record.hours);
    if (isNaN(hours) || hours < 0 || hours > 24) {
      score -= 5;
      issues.push({
        field_name: 'hours',
        severity: 'medium',
        quality_issue_type: 'invalid_format',
        description: `Hours value "${record.hours}" is out of valid range (0-24)`
      });
    }
  }
  
  // Validate date
  if (record.date) {
    const dateObj = new Date(record.date);
    if (isNaN(dateObj.getTime())) {
      score -= 5;
      issues.push({
        field_name: 'date',
        severity: 'high',
        quality_issue_type: 'invalid_format',
        description: `Invalid date format: "${record.date}"`
      });
    }
  }
  
  return {
    score: Math.max(0, score),
    missingFields,
    issues
  };
}

function parseExcelDate(value: any): string | null {
  if (!value) return null;
  
  // If it's already a date string
  if (typeof value === 'string') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }
  
  // If it's an Excel serial number
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }
  }
  
  return null;
}

function cleanText(value: any): string {
  if (!value) return '';
  return String(value).trim().replace(/\s+/g, ' ').replace(/\n+/g, ' ');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const rigNumber = formData.get('rigNumber') as string;

    if (!file) {
      throw new Error('No file provided');
    }

    console.log(`Processing NPT file for rig ${rigNumber}...`);

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

    // Find the sheet with detailed NPT records (avoid summary sheets)
    let targetSheet = null;
    let targetSheetName = '';

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      
      // Skip if it looks like a summary sheet
      const firstRow = jsonData[0] as any[];
      if (firstRow && (
        firstRow.some(cell => String(cell).includes('Row Labels')) ||
        firstRow.some(cell => String(cell).includes('Sum of'))
      )) {
        console.log(`Skipping summary sheet: ${sheetName}`);
        continue;
      }

      // Look for sheets with NPT detail columns
      const hasNPTColumns = firstRow && (
        firstRow.some(cell => normalizeColumnName(String(cell)).includes('rig number')) ||
        firstRow.some(cell => normalizeColumnName(String(cell)).includes('hours')) ||
        firstRow.some(cell => normalizeColumnName(String(cell)).includes('system'))
      );

      if (hasNPTColumns) {
        targetSheet = sheet;
        targetSheetName = sheetName;
        console.log(`Found NPT detail sheet: ${sheetName}`);
        break;
      }
    }

    if (!targetSheet) {
      throw new Error('Could not find NPT detail sheet in the workbook');
    }

    const jsonData = XLSX.utils.sheet_to_json(targetSheet, { header: 1, raw: false });
    
    // Find header row
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(10, jsonData.length); i++) {
      const row = jsonData[i] as any[];
      if (row && row.some(cell => normalizeColumnName(String(cell)).includes('rig number'))) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      throw new Error('Could not find header row in sheet');
    }

    const headers = jsonData[headerRowIndex] as any[];
    console.log(`Found headers at row ${headerRowIndex}`);

    // Map column indexes
    const columnIndexes: { [key: string]: number } = {};
    for (const fieldName of Object.keys(columnMapping)) {
      const index = findColumnIndex(headers, fieldName);
      if (index !== -1) {
        columnIndexes[fieldName] = index;
        console.log(`Mapped ${fieldName} to column ${index}`);
      }
    }

    // Process data rows
    const records: any[] = [];
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
      const row = jsonData[i] as any[];
      
      // Skip empty rows
      if (!row || row.every(cell => !cell)) {
        continue;
      }

      const record: any = {};
      
      // Extract data for each field
      for (const [fieldName, colIndex] of Object.entries(columnIndexes)) {
        let value = row[colIndex];
        
        if (fieldName === 'date') {
          value = parseExcelDate(value);
        } else if (fieldName === 'hours') {
          value = value ? parseFloat(String(value)) : null;
        } else if (fieldName === 'year') {
          value = value ? parseInt(String(value)) : null;
        } else {
          value = cleanText(value);
        }
        
        record[fieldName] = value || null;
      }

      // Override rig_number if provided
      if (rigNumber) {
        record.rig_number = rigNumber;
      }

      // Skip if missing critical data
      if (!record.rig_number || !record.date || !record.hours) {
        console.log(`Skipping row ${i + 1}: Missing critical data`);
        continue;
      }

      // Calculate data quality
      const quality = calculateDataQuality(record);
      record.data_quality_score = quality.score;
      record.missing_fields = quality.missingFields;
      record.data_quality_issues = quality.issues;

      // Insert record
      const { data: insertedRecord, error: insertError } = await supabase
        .from('npt_records')
        .insert(record)
        .select()
        .single();

      if (insertError) {
        console.error(`Error inserting record from row ${i + 1}:`, insertError);
        continue;
      }

      console.log(`Inserted record ${insertedRecord.id} with quality score ${quality.score}`);

      // Insert quality issues
      if (quality.issues.length > 0) {
        const qualityRecords = quality.issues.map(issue => ({
          npt_record_id: insertedRecord.id,
          ...issue
        }));

        const { error: qualityError } = await supabase
          .from('npt_data_quality')
          .insert(qualityRecords);

        if (qualityError) {
          console.error('Error inserting quality records:', qualityError);
        }
      }

      records.push(insertedRecord);
    }

    console.log(`Successfully processed ${records.length} NPT records`);

    return new Response(
      JSON.stringify({
        success: true,
        recordsProcessed: records.length,
        averageQualityScore: records.reduce((sum, r) => sum + (r.data_quality_score || 0), 0) / records.length,
        sheetName: targetSheetName
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in extract-npt-data function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
