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
  date: string; // Display format: "dd-MMM-yy"
  dateISO: string; // ISO format: "yyyy-MM-dd" for querying
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
  rigMoveCurrency?: string; // Store currency at time of application
  // Run tracking (for identifying first day of consecutive moves)
  isFirstDayOfRun?: boolean;
  hasValidRate?: boolean; // Whether a valid rate exists for this date
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
        })).filter(rate => {
          const desc = rate.description.toLowerCase();
          return rate.rig && (desc.includes('rig move') || desc.includes('camp'));
        });

        setActualRates(parsedRates);
      } catch (error) {
        console.error("Error loading actual rates:", error);
      }
    };

    loadActualRates();
  }, []);

  // Helper: Get rig move rates for a specific rig (no date validation)
  const getRigMoveRatesForDate = (rigNumber: string, dateStr: string): ActualRate[] => {
    const filtered = actualRates.filter(rate => {
      if (rate.rig !== rigNumber) return false;

      // Ensure we only consider rates with a valid USD Amount
      const amountNum = parseFloat((rate.usdAmount || '').replace(/[^0-9.-]/g, ''));
      if (isNaN(amountNum) || amountNum <= 0) return false;
      
      return true;
    });
    
    // Sort by description to group similar rates together
    const sorted = filtered.sort((a, b) => a.description.localeCompare(b.description));
    
    return sorted;
  };

  // Helper: Detect if current date is the first day of a rig move run
  const isFirstDayOfRigMoveRun = async (rigNumber: string, currentDateISO: string, rigMoveHr: number): Promise<boolean> => {
    if (!rigMoveHr || rigMoveHr <= 0) return false;

    try {
      // Get the previous day's data
      const currentDate = parseISO(currentDateISO);
      const prevDate = new Date(currentDate);
      prevDate.setDate(prevDate.getDate() - 1);
      const prevDateStr = format(prevDate, 'yyyy-MM-dd');

      const { data: prevDayData } = await supabase
        .from('extracted_ddor_data')
        .select('rig_move_hr, rig_move_rate_id')
        .eq('rig_number', rigNumber)
        .eq('date', prevDateStr)
        .maybeSingle();

      // If no previous day OR previous day has no rig move hours, this is a first day
      if (!prevDayData || !prevDayData.rig_move_hr || prevDayData.rig_move_hr <= 0) {
        return true;
      }

      // Check if rate validity changed between previous day and current day
      const prevRates = getRigMoveRatesForDate(rigNumber, prevDateStr);
      const currRates = getRigMoveRatesForDate(rigNumber, currentDateISO);

      // If prev day had valid rates but current day has different valid rates, this is a new run
      if (prevDayData.rig_move_rate_id && prevRates.length > 0 && currRates.length > 0) {
        const prevRateStillValid = currRates.some(r => r.no === prevDayData.rig_move_rate_id);
        if (!prevRateStillValid) {
          return true; // Rate validity flipped, this is a new first day
        }
      }

      // Otherwise, it's a continuation of a run
      return false;
    } catch (error) {
      console.error("Error checking first day of run:", error);
      return true; // Default to first day on error
    }
  };

  // Load data from database and merge with rig configs
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
              dateISO: item.date,
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

        const operationHr = getFixedNumber("Operation Hr");
        const reduceHr = getFixedNumber("Reduce Hr");
        const standbyHr = getFixedNumber("Standby Hr");
        const zeroHr = getFixedNumber("Zero Hr");
        const repairHr = getFixedNumber("Repair Hr");
        const amHr = getFixedNumber("AM Hr");
        const specialHr = getFixedNumber("Special Hr");
        const forceMajeureHr = getFixedNumber("Force Majeure Hr");
        const stackingHr = getFixedNumber("STACKING Hr");
        const rigMoveHr = getFixedNumber("Rig Move Hr");
        
        const totalHrs = operationHr + reduceHr + standbyHr + zeroHr + repairHr + 
                       amHr + specialHr + forceMajeureHr + stackingHr + rigMoveHr;

        // Get rates for this rig
        const rates = ratesMap.get(rig);
        
        // Calculate individual amounts per hour type
        const operationAmount = operationHr * (Number(rates?.operation_hr_rate) || 0);
        const reduceAmount = reduceHr * (Number(rates?.reduce_hr_rate) || 0);
        const standbyAmount = standbyHr * (Number(rates?.standby_hr_rate) || 0);
        const zeroAmount = zeroHr * (Number(rates?.zero_hr_rate) || 0);
        const repairAmount = repairHr * (Number(rates?.repair_hr_rate) || 0);
        const amAmount = amHr * (Number(rates?.annual_maintenance_hr_rate) || 0);
        const specialAmount = specialHr * (Number(rates?.special_hr_rate) || 0);
        const forceMajeureAmount = forceMajeureHr * (Number(rates?.force_majeure_hr_rate) || 0);
        const stackingAmount = stackingHr * (Number(rates?.stacking_hr_rate) || 0);
        const rigMoveAmount = rigMoveHr * (Number(rates?.rig_move_hr_rate) || 0);
        
        // Calculate total amount (hours * hourly rates)
        const totalAmount = rates ? (
          operationAmount + reduceAmount + standbyAmount + zeroAmount + 
          repairAmount + amAmount + specialAmount + forceMajeureAmount + 
          stackingAmount + rigMoveAmount
        ) : 0;
        
        // Calculate total fuel amount (hours/24 * daily fuel rates)
        const totalFuelAmount = rates ? (
          ((operationHr / 24) * (Number(rates.fuel_operation_day_rate_usd) || 0)) +
          ((reduceHr / 24) * (Number(rates.fuel_reduce_day_rate_usd) || 0)) +
          ((zeroHr / 24) * (Number(rates.fuel_zero_day_rate_usd) || 0)) +
          ((repairHr / 24) * (Number(rates.fuel_repair_day_rate_usd) || 0)) +
          ((specialHr / 24) * (Number(rates.fuel_special_day_rate_usd) || 0))
        ) : 0;

        return {
          date: format(displayDate, "dd-MMM-yy"),
          dateISO: format(displayDate, "yyyy-MM-dd"),
          rig: getFixedValue("Rig") || rig,
          client: getFixedValue("Client"),
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
          notReceivedDDOR: totalHrs === 0 ? "1" : getFixedValue("Not Received DDOR"),
          totalHrs,
          remarks: getFixedValue("Remarks"),
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
          rigMoveRateId: undefined,
          rigMoveAmountApplied: 0,
        };
      });

      setData(fullData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [dateStr]);


  const filteredData = data.filter(
    (row) =>
      row.rig.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.remarks.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filter out Hoist rigs for card calculations
  const nonHoistData = filteredData.filter(row => !row.rig.toLowerCase().includes('hoist'));

  // Calculate totals for all hour categories (excluding Hoists)
  const totalOperationHrs = nonHoistData.reduce((sum, row) => sum + row.operationHr, 0);
  const totalReduceHrs = nonHoistData.reduce((sum, row) => sum + row.reduceHr, 0);
  const totalStandbyHrs = nonHoistData.reduce((sum, row) => sum + row.standbyHr, 0);
  const totalZeroHrs = nonHoistData.reduce((sum, row) => sum + row.zeroHr, 0);
  const totalRepairHrs = nonHoistData.reduce((sum, row) => sum + row.repairHr, 0);
  const totalAmHrs = nonHoistData.reduce((sum, row) => sum + row.amHr, 0);
  const totalSpecialHrs = nonHoistData.reduce((sum, row) => sum + row.specialHr, 0);
  const totalForceMajeureHrs = nonHoistData.reduce((sum, row) => sum + row.forceMajeureHr, 0);
  const totalStackingHrs = nonHoistData.reduce((sum, row) => sum + row.stackingHr, 0);
  const totalRigMoveHrs = nonHoistData.reduce((sum, row) => sum + row.rigMoveHr, 0);
  const avgEfficiency = ((totalOperationHrs / (totalOperationHrs + totalReduceHrs)) * 100).toFixed(1);

  // Calculate total amounts for each hour type (excluding Hoists)
  const totalOperationAmount = nonHoistData.reduce((sum, row) => sum + row.operationAmount, 0);
  const totalReduceAmount = nonHoistData.reduce((sum, row) => sum + row.reduceAmount, 0);
  const totalStandbyAmount = nonHoistData.reduce((sum, row) => sum + row.standbyAmount, 0);
  const totalZeroAmount = nonHoistData.reduce((sum, row) => sum + row.zeroAmount, 0);
  const totalRepairAmount = nonHoistData.reduce((sum, row) => sum + row.repairAmount, 0);
  const totalAmAmount = nonHoistData.reduce((sum, row) => sum + row.amAmount, 0);
  const totalSpecialAmount = nonHoistData.reduce((sum, row) => sum + row.specialAmount, 0);
  const totalForceMajeureAmount = nonHoistData.reduce((sum, row) => sum + row.forceMajeureAmount, 0);
  const totalStackingAmount = nonHoistData.reduce((sum, row) => sum + row.stackingAmount, 0);
  const totalRigMoveAmount = nonHoistData.reduce((sum, row) => sum + row.rigMoveAmountApplied, 0);
  
  // Calculate stacking statistics (excluding Hoists, out of 27 rigs)
  const stackedRigsCount = nonHoistData.filter(row => row.stackingHr > 0).length;
  const stackingPercentage = ((stackedRigsCount / 27) * 100).toFixed(1);
  const utilizationPercentage = (((27 - stackedRigsCount) / 27) * 100).toFixed(1);
  
  // Calculate rig move count
  const rigMoveRigsCount = nonHoistData.filter(row => row.rigMoveHr > 0).length;

  const handleExport = () => {
    const csvContent = [
      ["Date", "Rig", "Client", "Operation Hr", "Reduce Hr", "Standby Hr", "Zero Hr", "Repair Hr", "AM Hr", "Special Hr", "Force Majeure Hr", "STACKING Hr", "Rig Move Hr", "Rig Move Amount", "Not Received DDOR", "Total Hr.s", "Total Fuel Amount", "Total Amount", "Remarks"],
      ...filteredData.map((row) => [
        row.date,
        row.rig,
        row.client,
        row.operationHr,
        row.reduceHr,
        row.standbyHr,
        row.zeroHr,
        row.repairHr,
        row.amHr,
        row.specialHr,
        row.forceMajeureHr,
        row.stackingHr,
        row.rigMoveHr,
        row.rigMoveAmountApplied.toFixed(2),
        row.notReceivedDDOR,
        row.totalHrs,
        row.totalFuelAmount.toFixed(2),
        row.totalAmount.toFixed(2),
        row.remarks,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ddor-consolidated-report.csv";
    a.click();
  };

  const handleDateRangeExport = async () => {
    if (!dateRangeStart || !dateRangeEnd) {
      toast({
        title: "Invalid Date Range",
        description: "Please select both start and end dates",
        variant: "destructive"
      });
      return;
    }

    setIsExportingRange(true);

    try {
      const startStr = format(dateRangeStart, "yyyy-MM-dd");
      const endStr = format(dateRangeEnd, "yyyy-MM-dd");

      // Fetch all data within date range
      const { data: rangeData, error } = await supabase
        .from('extracted_ddor_data')
        .select('*')
        .gte('date', startStr)
        .lte('date', endStr);

      if (error) throw error;

      // Load rig rates and configs
      const { data: rigRates } = await supabase.from('rig_rates').select('*');
      const { data: rigConfigs } = await supabase.from('rig_configs').select('*');

      const ratesMap = new Map((rigRates || []).map(rate => [rate.rig_number, rate]));
      const configMap = new Map((rigConfigs || []).map(config => [config.rig_number, config.column_mappings]));

      // Process data
      const allRangeData: any[] = [];

      // Group by date
      const dateMap = new Map();
      rangeData?.forEach(item => {
        if (!dateMap.has(item.date)) {
          dateMap.set(item.date, []);
        }
        dateMap.get(item.date).push(item);
      });

      // Process each date
      for (const [dateKey, items] of dateMap.entries()) {
        const dateFormatted = format(new Date(dateKey), "dd-MMM-yy");
        const dataMap = new Map(
          items.map((item: any) => {
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
            const totalHrs = operationHr + reduceHr + standbyHr + zeroHr + repairHr + amHr + specialHr + forceMajeureHr + stackingHr + rigMoveHr;
            const isHoistRig = String(item.rig_number).toLowerCase().includes('hoist');
            const rates = ratesMap.get(item.rig_number);
            let totalAmount = 0;
            let totalFuelAmount = 0;
            let operationAmount = 0, reduceAmount = 0, standbyAmount = 0, zeroAmount = 0, repairAmount = 0, amAmount = 0, specialAmount = 0, forceMajeureAmount = 0, stackingAmount = 0, rigMoveAmount = 0;
            const rigMoveAmountApplied = Number(item.rig_move_amount_applied) || 0;

            if (isHoistRig) {
              totalAmount = Number(item.total_amount) || 0;
            } else {
              totalFuelAmount = rates ? (((operationHr / 24) * (Number(rates.fuel_operation_day_rate_usd) || 0)) + ((reduceHr / 24) * (Number(rates.fuel_reduce_day_rate_usd) || 0)) + ((zeroHr / 24) * (Number(rates.fuel_zero_day_rate_usd) || 0)) + ((repairHr / 24) * (Number(rates.fuel_repair_day_rate_usd) || 0)) + ((specialHr / 24) * (Number(rates.fuel_special_day_rate_usd) || 0))) : 0;
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
              totalAmount = rates ? (operationAmount + reduceAmount + standbyAmount + zeroAmount + repairAmount + amAmount + specialAmount + forceMajeureAmount + stackingAmount + rigMoveAmountApplied + totalFuelAmount) : 0;
            }

            return [
              item.rig_number,
              {
                date: dateFormatted, rig: item.rig_number, client: item.client || "", operationHr, reduceHr, standbyHr, zeroHr, repairHr, amHr, specialHr, forceMajeureHr, stackingHr, rigMoveHr,
                notReceivedDDOR: item.not_received_ddor || "", totalHrs, remarks: item.remarks || "", totalAmount, totalFuelAmount, operationAmount, reduceAmount, standbyAmount, zeroAmount, repairAmount,
                amAmount, specialAmount, forceMajeureAmount, stackingAmount, rigMoveAmount, rigMoveRateId: item.rig_move_rate_id || undefined, rigMoveAmountApplied,
              }
            ];
          })
        );

        // Add all rigs for this date
        for (const rig of RIGS) {
          const existingData = dataMap.get(rig);
          if (existingData) {
            allRangeData.push(existingData);
          } else {
            allRangeData.push({
              date: dateFormatted, rig, client: "", operationHr: 0, reduceHr: 0, standbyHr: 0, zeroHr: 0,
              repairHr: 0, amHr: 0, specialHr: 0, forceMajeureHr: 0, stackingHr: 0, rigMoveHr: 0,
              notReceivedDDOR: "", totalHrs: 0, remarks: "", totalAmount: 0, totalFuelAmount: 0,
              operationAmount: 0, reduceAmount: 0, standbyAmount: 0, zeroAmount: 0, repairAmount: 0, amAmount: 0, specialAmount: 0,
              forceMajeureAmount: 0, stackingAmount: 0, rigMoveAmount: 0, rigMoveRateId: undefined, rigMoveAmountApplied: 0,
            });
          }
        }
      }

      // Export to CSV
      const csvContent = [
        ["Date", "Rig", "Client", "Operation Hr", "Reduce Hr", "Standby Hr", "Zero Hr", "Repair Hr", "AM Hr", "Special Hr", "Force Majeure Hr", "STACKING Hr", "Rig Move Hr", "Rig Move Amount", "Not Received DDOR", "Total Hr.s", "Total Fuel Amount", "Total Amount", "Remarks"],
        ...allRangeData.map((row) => [row.date, row.rig, row.client, row.operationHr, row.reduceHr, row.standbyHr, row.zeroHr, row.repairHr, row.amHr, row.specialHr, row.forceMajeureHr, row.stackingHr, row.rigMoveHr, row.rigMoveAmountApplied.toFixed(2), row.notReceivedDDOR, row.totalHrs, row.totalFuelAmount.toFixed(2), row.totalAmount.toFixed(2), row.remarks])
      ].map((row) => row.join(",")).join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ddor-report-${startStr}-to-${endStr}.csv`;
      a.click();

      toast({
        title: "Export Successful",
        description: `Exported data from ${startStr} to ${endStr}`,
      });
    } catch (error) {
      console.error('Error exporting range:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export date range data",
        variant: "destructive"
      });
    } finally {
      setIsExportingRange(false);
    }
  };

  const handleClearHours = async () => {
    if (!selectedRigToClear) return;

    try {
      setLoading(true);

      // Delete from database
      let error;
      if (selectedRigToClear === 'ALL_RIGS') {
        // Delete all rigs for this date
        const { error: deleteError } = await supabase
          .from('extracted_ddor_data')
          .delete()
          .eq('date', dateStr);
        error = deleteError;
      } else {
        // Delete specific rig for this date
        const { error: deleteError } = await supabase
          .from('extracted_ddor_data')
          .delete()
          .eq('rig_number', selectedRigToClear)
          .eq('date', dateStr);
        error = deleteError;
      }

      if (error) throw error;

      toast({
        title: "Success",
        description: selectedRigToClear === 'ALL_RIGS' ? 'Cleared hours for all rigs' : `Cleared hours for rig ${selectedRigToClear}`,
      });

      // Reload data
      const { data: extractedData } = await supabase.from('extracted_ddor_data').select('*').eq('date', dateStr);
      const { data: rigConfigs } = await supabase.from('rig_configs').select('*');
      const { data: rigRates } = await supabase.from('rig_rates').select('*');

      const ratesMap = new Map((rigRates || []).map(rate => [rate.rig_number, rate]));
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
          const totalHrs = operationHr + reduceHr + standbyHr + zeroHr + repairHr + amHr + specialHr + forceMajeureHr + stackingHr + rigMoveHr;
          const isHoistRig = String(item.rig_number).toLowerCase().includes('hoist');
          const rates = ratesMap.get(item.rig_number);
          let totalAmount = 0;
          let totalFuelAmount = 0;
          let operationAmount = 0, reduceAmount = 0, standbyAmount = 0, zeroAmount = 0, repairAmount = 0, amAmount = 0, specialAmount = 0, forceMajeureAmount = 0, stackingAmount = 0, rigMoveAmount = 0;
          const rigMoveAmountApplied = Number(item.rig_move_amount_applied) || 0;

          if (isHoistRig) {
            totalAmount = Number(item.total_amount) || 0;
          } else {
            totalFuelAmount = rates ? (((operationHr / 24) * (Number(rates.fuel_operation_day_rate_usd) || 0)) + ((reduceHr / 24) * (Number(rates.fuel_reduce_day_rate_usd) || 0)) + ((zeroHr / 24) * (Number(rates.fuel_zero_day_rate_usd) || 0)) + ((repairHr / 24) * (Number(rates.fuel_repair_day_rate_usd) || 0)) + ((specialHr / 24) * (Number(rates.fuel_special_day_rate_usd) || 0))) : 0;
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
            totalAmount = rates ? (operationAmount + reduceAmount + standbyAmount + zeroAmount + repairAmount + amAmount + specialAmount + forceMajeureAmount + stackingAmount + rigMoveAmountApplied + totalFuelAmount) : 0;
          }

          return [
            item.rig_number,
            {
              date: format(new Date(item.date), "dd-MMM-yy"), 
              dateISO: item.date,
              rig: item.rig_number, client: item.client || "", operationHr, reduceHr, standbyHr, zeroHr, repairHr, amHr, specialHr,
              forceMajeureHr, stackingHr, rigMoveHr, notReceivedDDOR: item.not_received_ddor || "", totalHrs, remarks: item.remarks || "", totalAmount, totalFuelAmount,
              operationAmount, reduceAmount, standbyAmount, zeroAmount, repairAmount, amAmount, specialAmount, forceMajeureAmount, stackingAmount, rigMoveAmount,
              rigMoveRateId: item.rig_move_rate_id || undefined, rigMoveAmountApplied,
            }
          ];
        })
      );

      const configMap = new Map((rigConfigs || []).map(config => [config.rig_number, config.column_mappings]));

      const fullData = RIGS.map(rig => {
        const existingData = dataMap.get(rig);
        if (existingData) return existingData;

        const mappings = configMap.get(rig) as any[] || [];
        const getFixedValue = (columnName: string) => {
          const mapping = mappings.find((m: any) => m.columnName === columnName && m.isFixedData);
          return mapping?.fixedValue || "";
        };
        
        const getFixedNumber = (columnName: string) => {
          const val = getFixedValue(columnName);
          return val ? Number(val) : 0;
        };

        const operationHr = getFixedNumber("Operation Hr");
        const reduceHr = getFixedNumber("Reduce Hr");
        const standbyHr = getFixedNumber("Standby Hr");
        const zeroHr = getFixedNumber("Zero Hr");
        const repairHr = getFixedNumber("Repair Hr");
        const amHr = getFixedNumber("AM Hr");
        const specialHr = getFixedNumber("Special Hr");
        const forceMajeureHr = getFixedNumber("Force Majeure Hr");
        const stackingHr = getFixedNumber("STACKING Hr");
        const rigMoveHr = getFixedNumber("Rig Move Hr");
        
        const totalHrs = operationHr + reduceHr + standbyHr + zeroHr + repairHr + amHr + specialHr + forceMajeureHr + stackingHr + rigMoveHr;

        const rates = ratesMap.get(rig);
        const operationAmount = operationHr * (Number(rates?.operation_hr_rate) || 0);
        const reduceAmount = reduceHr * (Number(rates?.reduce_hr_rate) || 0);
        const standbyAmount = standbyHr * (Number(rates?.standby_hr_rate) || 0);
        const zeroAmount = zeroHr * (Number(rates?.zero_hr_rate) || 0);
        const repairAmount = repairHr * (Number(rates?.repair_hr_rate) || 0);
        const amAmount = amHr * (Number(rates?.annual_maintenance_hr_rate) || 0);
        const specialAmount = specialHr * (Number(rates?.special_hr_rate) || 0);
        const forceMajeureAmount = forceMajeureHr * (Number(rates?.force_majeure_hr_rate) || 0);
        const stackingAmount = stackingHr * (Number(rates?.stacking_hr_rate) || 0);
        const rigMoveAmount = rigMoveHr * (Number(rates?.rig_move_hr_rate) || 0);
        const totalAmount = rates ? (operationAmount + reduceAmount + standbyAmount + zeroAmount + repairAmount + amAmount + specialAmount + forceMajeureAmount + stackingAmount + rigMoveAmount) : 0;
        const totalFuelAmount = rates ? (((operationHr / 24) * (Number(rates.fuel_operation_day_rate_usd) || 0)) + ((reduceHr / 24) * (Number(rates.fuel_reduce_day_rate_usd) || 0)) + ((zeroHr / 24) * (Number(rates.fuel_zero_day_rate_usd) || 0)) + ((repairHr / 24) * (Number(rates.fuel_repair_day_rate_usd) || 0)) + ((specialHr / 24) * (Number(rates.fuel_special_day_rate_usd) || 0))) : 0;

        return {
          date: format(selectedDateFilter, "dd-MMM-yy"), 
          dateISO: format(selectedDateFilter, "yyyy-MM-dd"),
          rig: getFixedValue("Rig") || rig, client: getFixedValue("Client"), operationHr, reduceHr, standbyHr, zeroHr, repairHr, amHr, specialHr,
          forceMajeureHr, stackingHr, rigMoveHr, notReceivedDDOR: totalHrs === 0 ? "1" : getFixedValue("Not Received DDOR"), totalHrs, remarks: getFixedValue("Remarks"), totalAmount, totalFuelAmount,
          operationAmount, reduceAmount, standbyAmount, zeroAmount, repairAmount, amAmount, specialAmount, forceMajeureAmount, stackingAmount, rigMoveAmount,
          rigMoveRateId: undefined, rigMoveAmountApplied: 0,
        };
      });

      setData(fullData);
      setSelectedRigToClear("");
    } catch (error) {
      console.error('Error clearing hours:', error);
      toast({
        title: "Error",
        description: "Failed to clear hours",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleEditRow = (rig: string) => {
    const rowData = data.find(r => r.rig === rig);
    if (rowData) {
      setEditingRig(rig);
      setEditedValues({ ...rowData });
    }
  };

  const handleCancelEdit = () => {
    setEditingRig(null);
    setEditedValues({});
  };

  const handleFieldChange = (field: keyof DashboardData, value: string | number) => {
    setEditedValues(prev => {
      const updated = { ...prev, [field]: value };
      
      if (field.includes('Hr') && field !== 'totalHrs') {
        const totalHrs = (Number(updated.operationHr) || 0) + (Number(updated.reduceHr) || 0) + (Number(updated.standbyHr) || 0) + (Number(updated.zeroHr) || 0) + (Number(updated.repairHr) || 0) + (Number(updated.amHr) || 0) + (Number(updated.specialHr) || 0) + (Number(updated.forceMajeureHr) || 0) + (Number(updated.stackingHr) || 0) + (Number(updated.rigMoveHr) || 0);
        updated.totalHrs = totalHrs;
      }
      
      return updated;
    });
  };

  const handleRigMoveRateChange = (rateId: string) => {
    const selectedRate = actualRates.find(r => r.no === rateId);
    if (!selectedRate) return;

    const amountStr = selectedRate.usdAmount.replace(/[^0-9.-]/g, "");
    const amount = parseFloat(amountStr) || 0;

    setEditedValues(prev => ({
      ...prev,
      rigMoveRateId: rateId,
      rigMoveAmountApplied: amount,
      rigMoveCurrency: 'USD', // Store currency at application time
    }));
  };

  const handleSaveRow = async () => {
    if (!editingRig || !editedValues) return;

    try {
      const validationData = {
        operationHr: Number(editedValues.operationHr) || 0, reduceHr: Number(editedValues.reduceHr) || 0, standbyHr: Number(editedValues.standbyHr) || 0,
        zeroHr: Number(editedValues.zeroHr) || 0, repairHr: Number(editedValues.repairHr) || 0, amHr: Number(editedValues.amHr) || 0,
        specialHr: Number(editedValues.specialHr) || 0, forceMajeureHr: Number(editedValues.forceMajeureHr) || 0, stackingHr: Number(editedValues.stackingHr) || 0,
        rigMoveHr: Number(editedValues.rigMoveHr) || 0, client: String(editedValues.client || ""), notReceivedDDOR: String(editedValues.notReceivedDDOR || ""),
        remarks: String(editedValues.remarks || ""),
      };

      const result = hourFieldSchema.safeParse(validationData);
      if (!result.success) {
        toast({ title: "Validation Error", description: result.error.errors[0].message, variant: "destructive" });
        return;
      }

      // Validation: If rig move hours > 0, ensure a rate is selected and valid
      if (validationData.rigMoveHr > 0) {
        const availableRates = getRigMoveRatesForDate(editingRig, editedValues.dateISO || dateStr);
        
        if (availableRates.length === 0) {
          toast({ 
            title: "Validation Error", 
            description: "No Rig/Camp Move rate is valid on this date for this rig. Cannot save.", 
            variant: "destructive" 
          });
          return;
        }

        if (!editedValues.rigMoveRateId) {
          toast({ 
            title: "Validation Error", 
            description: "Please select a Rig/Camp Move rate before saving.", 
            variant: "destructive" 
          });
          return;
        }

        // Check if this is the first day of the run
        const isFirstDay = await isFirstDayOfRigMoveRun(editingRig, editedValues.dateISO || dateStr, validationData.rigMoveHr);
        
        // If it's a first day, ensure amount is applied
        if (isFirstDay && (!editedValues.rigMoveAmountApplied || editedValues.rigMoveAmountApplied <= 0)) {
          toast({ 
            title: "Validation Error", 
            description: "First day of rig move run must have a rate amount applied.", 
            variant: "destructive" 
          });
          return;
        }
      }

      setIsSaving(true);

      const { data: existingData, error: checkError } = await supabase.from('extracted_ddor_data').select('id').eq('rig_number', editingRig).eq('date', dateStr).maybeSingle();
      if (checkError) throw checkError;

      const updateData = {
        rig_number: editingRig, date: dateStr, client: validationData.client, operation_hr: validationData.operationHr, reduce_hr: validationData.reduceHr,
        standby_hr: validationData.standbyHr, zero_hr: validationData.zeroHr, repair_hr: validationData.repairHr, am_hr: validationData.amHr, special_hr: validationData.specialHr,
        force_majeure_hr: validationData.forceMajeureHr, stacking_hr: validationData.stackingHr, rig_move_hr: validationData.rigMoveHr,
        not_received_ddor: validationData.notReceivedDDOR, remarks: validationData.remarks, rig_move_rate_id: editedValues.rigMoveRateId || null,
        rig_move_amount_applied: editedValues.rigMoveAmountApplied || 0,
        total_hrs: validationData.operationHr + validationData.reduceHr + validationData.standbyHr + validationData.zeroHr + validationData.repairHr + validationData.amHr + validationData.specialHr + validationData.forceMajeureHr + validationData.stackingHr + validationData.rigMoveHr,
      };

      if (existingData) {
        const { error: updateError } = await supabase.from('extracted_ddor_data').update(updateData).eq('id', existingData.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('extracted_ddor_data').insert(updateData);
        if (insertError) throw insertError;
      }

      // If this was the first day of a run and rate changed, update downstream days to 0
      if (validationData.rigMoveHr > 0 && editedValues.rigMoveRateId) {
        const isFirstDay = await isFirstDayOfRigMoveRun(editingRig, editedValues.dateISO || dateStr, validationData.rigMoveHr);
        if (isFirstDay) {
          await applyCarryForwardLogic(editingRig, editedValues.dateISO || dateStr, editedValues.rigMoveRateId);
        }
      }

      toast({ title: "Success", description: "Data saved successfully" });
      
      // Set the date filter to the edited date and reload data
      const editedDate = parseISO(editedValues.dateISO || dateStr);
      setSelectedDateFilter(editedDate);
      setEditingRig(null);
      setEditedValues({});
      
      // Reload data for the new date
      await loadData();
    } catch (error) {
      console.error('Error saving data:', error);
      toast({ title: "Error", description: "Failed to save data", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // Helper: Apply carry-forward logic for rig move runs
  const applyCarryForwardLogic = async (rigNumber: string, firstDayISO: string, rateId: string) => {
    try {
      const currentDate = parseISO(firstDayISO);
      let checkDate = new Date(currentDate);
      checkDate.setDate(checkDate.getDate() + 1);

      // Get all subsequent days until we hit a break (no rig move hours or rate validity changes)
      while (true) {
        const checkDateStr = format(checkDate, 'yyyy-MM-dd');
        
        const { data: nextDayData } = await supabase
          .from('extracted_ddor_data')
          .select('*')
          .eq('rig_number', rigNumber)
          .eq('date', checkDateStr)
          .maybeSingle();

        // Stop if no data or no rig move hours
        if (!nextDayData || !nextDayData.rig_move_hr || nextDayData.rig_move_hr <= 0) {
          break;
        }

        // Check if the same rate is still valid on this day
        const ratesForDay = getRigMoveRatesForDate(rigNumber, checkDateStr);
        const rateStillValid = ratesForDay.some(r => r.no === rateId);

        // Stop if rate is no longer valid (validity flipped)
        if (!rateStillValid) {
          break;
        }

        // Update this day to have 0 amount applied (continuation day)
        await supabase
          .from('extracted_ddor_data')
          .update({ 
            rig_move_amount_applied: 0,
            rig_move_rate_id: rateId 
          })
          .eq('rig_number', rigNumber)
          .eq('date', checkDateStr);

        // Move to next day
        checkDate.setDate(checkDate.getDate() + 1);
      }
    } catch (error) {
      console.error("Error applying carry-forward logic:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center gap-4">
        <Button variant="outline" size="icon" onClick={handlePreviousMonth}><ChevronLeft className="h-4 w-4" /></Button>
        <h2 className="text-xl font-semibold">{format(currentMonth, "MMMM yyyy")}</h2>
        <Button variant="outline" size="icon" onClick={handleNextMonth}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      <div className="flex flex-wrap gap-2 justify-center">
        {datesInMonth.map((date) => {
          const isSelected = format(date, "yyyy-MM-dd") === format(selectedDateFilter, "yyyy-MM-dd");
          return (
            <Button key={date.toISOString()} variant={isSelected ? "default" : "outline"} size="sm" onClick={() => setSelectedDateFilter(date)}
              className={cn("w-10 h-10 p-0", isSelected && "ring-2 ring-primary ring-offset-2")}>
              {format(date, "d")}
            </Button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">Operation Hours</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{totalOperationHrs.toFixed(2)}</div>
            <p className="text-sm font-semibold text-foreground mt-2">${totalOperationAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">Reduce Hours</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{totalReduceHrs.toFixed(2)}</div>
            <p className="text-sm font-semibold text-foreground mt-2">${totalReduceAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">Standby Hours</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{totalStandbyHrs.toFixed(2)}</div>
            <p className="text-sm font-semibold text-foreground mt-2">${totalStandbyAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">Zero Hours</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{totalZeroHrs.toFixed(2)}</div>
            <p className="text-sm font-semibold text-foreground mt-2">${totalZeroAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">Repair Hours</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{totalRepairHrs.toFixed(2)}</div>
            <p className="text-sm font-semibold text-foreground mt-2">${totalRepairAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">AM Hours</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{totalAmHrs.toFixed(2)}</div>
            <p className="text-sm font-semibold text-foreground mt-2">${totalAmAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">Special Hours</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{totalSpecialHrs.toFixed(2)}</div>
            <p className="text-sm font-semibold text-foreground mt-2">${totalSpecialAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">Force Majeure</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-pink-600">{totalForceMajeureHrs.toFixed(2)}</div>
            <p className="text-sm font-semibold text-foreground mt-2">${totalForceMajeureAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">Stacking Hours</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{totalStackingHrs.toFixed(2)}</div>
            <p className="text-xs text-primary mt-1">Utilization: {utilizationPercentage}%</p>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">Rig Move Hours</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{totalRigMoveHrs.toFixed(2)}</div>
            <p className="text-sm font-semibold text-foreground mt-2">${totalRigMoveAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="text-xs text-primary mt-1">{rigMoveRigsCount} rigs</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <CardTitle>Main Consolidated Sheet</CardTitle>
            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search by rig, client, or remarks..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
              </div>
              <Select value={selectedRigToClear} onValueChange={setSelectedRigToClear}>
                <SelectTrigger className="w-[180px] bg-background"><SelectValue placeholder="Select rig to clear" /></SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="ALL_RIGS">Clear All</SelectItem>
                  {RIGS.map((rig) => (<SelectItem key={rig} value={rig}>Rig {rig}</SelectItem>))}
                </SelectContent>
              </Select>
              <Button variant="destructive" size="icon" onClick={handleClearHours} disabled={!selectedRigToClear} title="Clear selected rig hours"><Trash2 className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon"><Filter className="h-4 w-4" /></Button>
              <Button onClick={handleExport} variant="outline" className="gap-2"><Download className="h-4 w-4" />Export Current</Button>
              
              <div className="flex gap-2 items-center border-l pl-2">
                <Popover>
                  <PopoverTrigger asChild><Button variant="outline" size="sm" className="gap-2"><CalendarIcon className="h-4 w-4" />{dateRangeStart ? format(dateRangeStart, "dd-MMM-yy") : "Start Date"}</Button></PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={dateRangeStart} onSelect={setDateRangeStart} initialFocus /></PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild><Button variant="outline" size="sm" className="gap-2"><CalendarIcon className="h-4 w-4" />{dateRangeEnd ? format(dateRangeEnd, "dd-MMM-yy") : "End Date"}</Button></PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={dateRangeEnd} onSelect={setDateRangeEnd} initialFocus /></PopoverContent>
                </Popover>
                <Button onClick={handleDateRangeExport} className="gap-2" disabled={!dateRangeStart || !dateRangeEnd || isExportingRange}><Download className="h-4 w-4" />{isExportingRange ? "Exporting..." : "Export Range"}</Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-primary/90">
                    <TableHead className="font-semibold text-center text-primary-foreground px-2 py-2">Date</TableHead>
                    <TableHead className="font-semibold text-center text-primary-foreground px-2 py-2">Rig</TableHead>
                    <TableHead className="font-semibold text-center text-primary-foreground px-2 py-2">Client</TableHead>
                    <TableHead className="font-semibold text-center text-primary-foreground px-2 py-2">Operation Hr</TableHead>
                    <TableHead className="font-semibold text-center text-primary-foreground px-2 py-2">Reduce Hr</TableHead>
                    <TableHead className="font-semibold text-center text-primary-foreground px-2 py-2">Standby Hr</TableHead>
                    <TableHead className="font-semibold text-center text-primary-foreground px-2 py-2">Zero Hr</TableHead>
                    <TableHead className="font-semibold text-center text-primary-foreground px-2 py-2">Repair Hr</TableHead>
                    <TableHead className="font-semibold text-center text-primary-foreground px-2 py-2">AM Hr</TableHead>
                    <TableHead className="font-semibold text-center text-primary-foreground px-2 py-2">Special Hr</TableHead>
                    <TableHead className="font-semibold text-center text-primary-foreground px-2 py-2">Force Majeure Hr</TableHead>
                    <TableHead className="font-semibold text-center text-primary-foreground px-2 py-2">STACKING Hr</TableHead>
                    <TableHead className="font-semibold text-center text-primary-foreground px-2 py-2">Rig Move Hr</TableHead>
                    <TableHead className="font-semibold text-center text-primary-foreground px-2 py-2">Rig Move Amount</TableHead>
                    <TableHead className="font-semibold text-center text-primary-foreground px-2 py-2">Not Received DDOR</TableHead>
                    <TableHead className="font-semibold text-center text-primary-foreground px-2 py-2">Total Hr.s</TableHead>
                    <TableHead className="font-semibold text-center text-primary-foreground px-2 py-2">Total Fuel</TableHead>
                    <TableHead className="font-semibold text-center text-primary-foreground px-2 py-2">Total Amount</TableHead>
                    <TableHead className="font-semibold text-center text-primary-foreground px-2 py-2">Remarks</TableHead>
                    <TableHead className="font-semibold text-center text-primary-foreground px-2 py-2">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((row, index) => {
                    const isEditing = editingRig === row.rig;
                    const displayRow = isEditing ? editedValues : row;
                    const availableRates = getRigMoveRatesForDate(row.rig, row.dateISO || dateStr);
                    
                    return (
                      <TableRow key={index} className={cn("hover:bg-muted/30", isEditing && "bg-accent/20")}>
                        <TableCell className="font-medium whitespace-nowrap text-center px-2 py-1.5">{row.date}</TableCell>
                        <TableCell className="whitespace-nowrap text-center px-2 py-1.5"><Badge variant="outline" className="font-mono text-xs">{row.rig}</Badge></TableCell>
                        
                        <TableCell className="text-center px-2 py-1.5">
                          {isEditing ? <Input type="text" value={displayRow.client || ""} onChange={(e) => handleFieldChange('client', e.target.value)} className="h-7 text-sm text-center" /> : row.client}
                        </TableCell>
                        
                        {['operationHr', 'reduceHr', 'standbyHr', 'zeroHr', 'repairHr', 'amHr', 'specialHr', 'forceMajeureHr', 'stackingHr', 'rigMoveHr'].map((field) => (
                          <TableCell key={field} className="text-center px-2 py-1.5">
                            {isEditing ? (
                              <Input type="number" step="0.01" min="0" max="24" value={Number(displayRow[field as keyof DashboardData]) || 0}
                                onChange={(e) => handleFieldChange(field as keyof DashboardData, parseFloat(e.target.value) || 0)} className="h-7 text-sm text-center w-20" />
                            ) : ((row[field as keyof DashboardData] as number).toFixed(2))}
                          </TableCell>
                        ))}
                        
                        <TableCell className="text-center px-2 py-1.5">
                          {isEditing && (displayRow.rigMoveHr || 0) > 0 ? (
                            <div className="flex flex-col gap-1">
                              {availableRates.length > 0 ? (
                                <Select 
                                  value={displayRow.rigMoveRateId || (availableRates.length > 0 ? availableRates[0].no : "")} 
                                  onValueChange={handleRigMoveRateChange}
                                >
                                  <SelectTrigger className="h-7 text-sm w-full bg-background border-border">
                                    <SelectValue placeholder="Select rate" />
                                  </SelectTrigger>
                                  <SelectContent 
                                    position="popper" 
                                    className="bg-popover text-popover-foreground border-border shadow-md z-[100]"
                                    sideOffset={5}
                                    align="start"
                                    avoidCollisions={true}
                                  >
                                    {availableRates.map((rate) => (
                                      <SelectItem key={rate.no} value={rate.no} className="cursor-pointer hover:bg-accent">
                                        {rate.description} - ${parseFloat(rate.usdAmount.replace(/[^0-9.-]/g, "")).toFixed(2)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <div className="flex flex-col gap-1">
                                  <span className="text-xs text-destructive font-semibold">⚠️ No valid rate</span>
                                  <span className="text-[10px] text-destructive">Cannot save</span>
                                </div>
                              )}
                            </div>
                          ) : (displayRow.rigMoveHr || 0) > 0 && !isEditing ? (
                            <span className="text-sm">${row.rigMoveAmountApplied.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        
                        <TableCell className="text-center px-2 py-1.5">
                          {isEditing ? <Input type="text" value={displayRow.notReceivedDDOR || ""} onChange={(e) => handleFieldChange('notReceivedDDOR', e.target.value)} className="h-7 text-sm text-center w-16" /> : row.notReceivedDDOR}
                        </TableCell>
                        
                        <TableCell className={cn("text-center font-semibold px-2 py-1.5", (displayRow.totalHrs || 0) !== 24 && (displayRow.totalHrs || 0) > 0 && "text-destructive")}>
                          {(displayRow.totalHrs || 0).toFixed(2)}
                          {(displayRow.totalHrs || 0) !== 24 && (displayRow.totalHrs || 0) > 0 && <span className="ml-1 text-xs">⚠️</span>}
                        </TableCell>
                        
                        <TableCell className="text-center font-semibold text-blue-600 dark:text-blue-500 px-2 py-1.5">
                          ${row.totalFuelAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        
                        <TableCell className="text-center font-semibold text-green-600 dark:text-green-500 px-2 py-1.5">
                          ${row.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        
                        <TableCell className="max-w-md text-center px-2 py-1.5">
                          {isEditing ? <Input type="text" value={displayRow.remarks || ""} onChange={(e) => handleFieldChange('remarks', e.target.value)} className="h-7 text-sm" /> : <span className="truncate" title={row.remarks}>{row.remarks}</span>}
                        </TableCell>
                        
                        <TableCell className="text-center px-2 py-1.5">
                          {isEditing ? (
                            <div className="flex gap-1 justify-center">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveRow} disabled={isSaving}><Check className="h-4 w-4 text-green-600" /></Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleCancelEdit} disabled={isSaving}><X className="h-4 w-4 text-red-600" /></Button>
                            </div>
                          ) : (
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleEditRow(row.rig)}>Edit</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
          {loading && <div className="py-12 text-center text-muted-foreground"><p>Loading data...</p></div>}
          {!loading && filteredData.length === 0 && <div className="py-12 text-center text-muted-foreground"><p>No records found matching your search criteria.</p></div>}
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardView;
