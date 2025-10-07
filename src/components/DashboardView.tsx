import { useState, useEffect } from "react";
import { Download, Filter, Search, ChevronLeft, ChevronRight, Trash2, Check, X, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, parseISO, isWithinInterval } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { z } from "zod";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import * as XLSX from "xlsx";

interface ActualRate {
  no: string;
  rig: string;
  material: string;
  description: string;
  contractAmount: string;
  unit: string;
  usdAmount: string;
  omrAmount: string;
  per: string;
  validFrom: string;
  validTo: string;
}

interface DashboardData {
  date: string;
  rig: string;
  client: string;
  operationHr: number;
  reduceHr: number;
  standbyHr: number;
  zeroHr: number;
  repairHr: number;
  amHr: number;
  specialHr: number;
  forceMajeureHr: number;
  stackingHr: number;
  rigMoveHr: number;
  notReceivedDDOR: string;
  totalHrs: number;
  remarks: string;
  totalAmount: number;
  totalFuelAmount: number;
  // Individual amounts per hour type
  operationAmount: number;
  reduceAmount: number;
  standbyAmount: number;
  zeroAmount: number;
  repairAmount: number;
  amAmount: number;
  specialAmount: number;
  forceMajeureAmount: number;
  stackingAmount: number;
  rigMoveAmount: number;
  // Rig move rate tracking
  rigMoveRateId?: string;
  rigMoveAmountApplied: number;
}

const RIGS = [
  "103", "104", "105", "106", "107", "108", "109", "110", "111", "112",
  "201", "202", "203", "204", "205", "206", "207", "208", "209", "210", "211",
  "301", "302", "303", "304", "305", "306",
  "Hoist 1", "Hoist 2", "Hoist 3", "Hoist 4", "Hoist 5"
];

// Validation schema for edited hour fields
const hourFieldSchema = z.object({
  operationHr: z.number().min(0).max(24),
  reduceHr: z.number().min(0).max(24),
  standbyHr: z.number().min(0).max(24),
  zeroHr: z.number().min(0).max(24),
  repairHr: z.number().min(0).max(24),
  amHr: z.number().min(0).max(24),
  specialHr: z.number().min(0).max(24),
  forceMajeureHr: z.number().min(0).max(24),
  stackingHr: z.number().min(0).max(24),
  rigMoveHr: z.number().min(0).max(24),
  client: z.string().max(100).trim(),
  notReceivedDDOR: z.string().max(10).trim(),
  remarks: z.string().max(1000).trim(),
});

interface DashboardViewProps {
  selectedDate?: Date;
}

const DashboardView = ({ selectedDate }: DashboardViewProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [data, setData] = useState<DashboardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRigToClear, setSelectedRigToClear] = useState<string>("");
  const [actualRates, setActualRates] = useState<ActualRate[]>([]);
  const { toast } = useToast();
  
  // Editing state
  const [editingRig, setEditingRig] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<Partial<DashboardData>>({});
  const [isSaving, setIsSaving] = useState(false);
  
  // Month and date selection state
  const [currentMonth, setCurrentMonth] = useState(selectedDate || new Date());
  const [selectedDateFilter, setSelectedDateFilter] = useState(selectedDate || new Date());
  
  // Date range export state
  const [dateRangeStart, setDateRangeStart] = useState<Date | undefined>(undefined);
  const [dateRangeEnd, setDateRangeEnd] = useState<Date | undefined>(undefined);
  const [isExportingRange, setIsExportingRange] = useState(false);
  
  // Use selected date filter
  const displayDate = selectedDateFilter;
  const dateStr = format(displayDate, "yyyy-MM-dd");
  
  // Generate all dates in the current month
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const datesInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Load actual rates from Excel
  useEffect(() => {
    const loadActualRates = async () => {
      try {
        const response = await fetch("/data/Rates.xlsx");
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

        // Parse rates and filter for Rig Move and Camp Move
        const parsedRates: ActualRate[] = jsonData.slice(1).map((row) => ({
          no: row[0]?.toString() || "",
          rig: row[1]?.toString() || "",
          material: row[2]?.toString() || "",
          description: row[3]?.toString() || "",
          contractAmount: row[4]?.toString() || "",
          unit: row[5]?.toString() || "",
          usdAmount: row[6]?.toString() || "",
          omrAmount: row[7]?.toString() || "",
          per: row[8]?.toString() || "",
          validFrom: row[9]?.toString() || "",
          validTo: row[10]?.toString() || "",
        })).filter(rate => 
          rate.rig && 
          (rate.description.toLowerCase().includes('rig move') || 
           rate.description.toLowerCase().includes('camp move'))
        );

        setActualRates(parsedRates);
      } catch (error) {
        console.error("Error loading actual rates:", error);
      }
    };

    loadActualRates();
  }, []);

  // Helper: Get rig move rates valid for a specific date and rig
  const getRigMoveRatesForDate = (rigNumber: string, dateStr: string): ActualRate[] => {
    const targetDate = parseISO(dateStr);
    
    return actualRates.filter(rate => {
      if (rate.rig !== rigNumber) return false;
      
      // Parse date strings (format: "44927" Excel serial or "DD/MM/YYYY")
      const parseExcelDate = (dateStr: string): Date => {
        // Try Excel serial number first
        const serial = parseFloat(dateStr);
        if (!isNaN(serial)) {
          // Excel epoch is 1899-12-30
          const excelEpoch = new Date(1899, 11, 30);
          excelEpoch.setDate(excelEpoch.getDate() + serial);
          return excelEpoch;
        }
        // Try regular date parse
        return parseISO(dateStr);
      };

      try {
        const validFrom = parseExcelDate(rate.validFrom);
        const validTo = parseExcelDate(rate.validTo);
        return isWithinInterval(targetDate, { start: validFrom, end: validTo });
      } catch {
        return false;
      }
    });
  };

  // Load data from database and merge with rig configs
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Load extracted data
        const { data: extractedData, error: extractError } = await supabase
          .from('extracted_ddor_data')
          .select('*')
          .eq('date', dateStr);

        if (extractError) throw extractError;

        // Load all rig configurations
        const { data: rigConfigs, error: configError } = await supabase
          .from('rig_configs')
          .select('*');

        if (configError) throw configError;

        // Load rig rates
        const { data: rigRates, error: ratesError } = await supabase
          .from('rig_rates')
          .select('*');

        if (ratesError) throw ratesError;

        // Create a map of rig rates
        const ratesMap = new Map(
          (rigRates || []).map(rate => [rate.rig_number, rate])
        );

        // Create a map of existing data by rig number
        const dataMap = new Map(
          (extractedData || []).map(item => {
            const operationHr = Number(item.operation_hr) || 0;
            const reduceHr = Number(item.reduce_hr) || 0;
            const standbyHr = Number(item.standby_hr) || 0;
            const zeroHr = Number(item.zero_hr) || 0;
            const repairHr = Number(item.repair_hr) || 0;
            const amHr = Number(item.am_hr) || 0;
            const specialHr = Number(item.special_hr) || 0;
            const forceMajeureHr = Number(item.force_majeure_hr) || 0;
            const stackingHr = Number(item.stacking_hr) || 0;
            const rigMoveHr = Number(item.rig_move_hr) || 0;
            
            const totalHrs = operationHr + reduceHr + standbyHr + zeroHr + repairHr + 
                           amHr + specialHr + forceMajeureHr + stackingHr + rigMoveHr;
            
            // Check if this is a Hoist rig
            const isHoistRig = String(item.rig_number).toLowerCase().includes('hoist');
            
            // Get rates for this rig
            const rates = ratesMap.get(item.rig_number);
            
            let totalAmount = 0;
            let totalFuelAmount = 0;
            
            // Declare amount variables
            let operationAmount = 0;
            let reduceAmount = 0;
            let standbyAmount = 0;
            let zeroAmount = 0;
            let repairAmount = 0;
            let amAmount = 0;
            let specialAmount = 0;
            let forceMajeureAmount = 0;
            let stackingAmount = 0;
            let rigMoveAmount = 0;
            const rigMoveAmountApplied = Number(item.rig_move_amount_applied) || 0;
            
            if (isHoistRig) {
              // For Hoist rigs, use the total_amount from database
              totalAmount = Number(item.total_amount) || 0;
              totalFuelAmount = 0; // Hoist rigs don't have fuel amounts
            } else {
              // For regular rigs, calculate total fuel amount (hours/24 * daily fuel rates)
              totalFuelAmount = rates ? (
                ((operationHr / 24) * (Number(rates.fuel_operation_day_rate_usd) || 0)) +
                ((reduceHr / 24) * (Number(rates.fuel_reduce_day_rate_usd) || 0)) +
                ((zeroHr / 24) * (Number(rates.fuel_zero_day_rate_usd) || 0)) +
                ((repairHr / 24) * (Number(rates.fuel_repair_day_rate_usd) || 0)) +
                ((specialHr / 24) * (Number(rates.fuel_special_day_rate_usd) || 0))
              ) : 0;
              
              // Calculate individual amounts per hour type
              operationAmount = operationHr * (Number(rates?.operation_hr_rate) || 0);
              reduceAmount = reduceHr * (Number(rates?.reduce_hr_rate) || 0);
              standbyAmount = standbyHr * (Number(rates?.standby_hr_rate) || 0);
              zeroAmount = zeroHr * (Number(rates?.zero_hr_rate) || 0);
              repairAmount = repairHr * (Number(rates?.repair_hr_rate) || 0);
              amAmount = amHr * (Number(rates?.annual_maintenance_hr_rate) || 0);
              specialAmount = specialHr * (Number(rates?.special_hr_rate) || 0);
              forceMajeureAmount = forceMajeureHr * (Number(rates?.force_majeure_hr_rate) || 0);
              stackingAmount = stackingHr * (Number(rates?.stacking_hr_rate) || 0);
              rigMoveAmount = rigMoveHr * (Number(rates?.rig_move_hr_rate) || 0);
              
              // Calculate total amount (use applied rig move amount instead of calculated)
              totalAmount = rates ? (
                operationAmount + reduceAmount + standbyAmount + zeroAmount + 
                repairAmount + amAmount + specialAmount + forceMajeureAmount + 
                stackingAmount + rigMoveAmountApplied + totalFuelAmount
              ) : 0;
            }
            
            return [
              item.rig_number,
              {
                date: format(new Date(item.date), "dd-MMM-yy"),
                rig: item.rig_number,
                client: item.client || "",
                operationHr,
                reduceHr,
                standbyHr,
                zeroHr,
                repairHr,
                amHr,
                specialHr,
                forceMajeureHr,
                stackingHr,
                rigMoveHr,
                notReceivedDDOR: item.not_received_ddor || "",
                totalHrs,
                remarks: item.remarks || "",
                totalAmount,
                totalFuelAmount,
                operationAmount,
                reduceAmount,
                standbyAmount,
                zeroAmount,
                repairAmount,
                amAmount,
                specialAmount,
                forceMajeureAmount,
                stackingAmount,
                rigMoveAmount,
                rigMoveRateId: item.rig_move_rate_id || undefined,
                rigMoveAmountApplied,
              }
            ];
          })
        );

        // Create a map of rig configurations
        const configMap = new Map(
          (rigConfigs || []).map(config => [config.rig_number, config.column_mappings])
        );

        // Generate full list with all rigs, filling in blanks with fixed data from config
        const fullData = RIGS.map(rig => {
          const existingData = dataMap.get(rig);
          if (existingData) return existingData;

          // No uploaded data, but check for fixed values in config
          const mappings = configMap.get(rig) as any[] || [];
          const getFixedValue = (columnName: string) => {
            const mapping = mappings.find((m: any) => m.columnName === columnName && m.isFixedData);
            return mapping?.fixedValue || "";
          };
          
          const getFixedNumber = (columnName: string) => {
            const val = getFixedValue(columnName);
            return val ? Number(val) : 0;
          };

          const operationHr = getFixed
