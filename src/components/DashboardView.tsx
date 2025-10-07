import { useState, useEffect } from "react";
import { Download, Filter, Search, ChevronLeft, ChevronRight, Trash2, Check, X } from "lucide-react";
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
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { z } from "zod";

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

// Generate data structure for all rigs
const generateRigData = (dateStr: string): DashboardData[] => {
  const data: DashboardData[] = [];
  
  for (const rig of RIGS) {
    data.push({
      date: dateStr,
      rig: rig,
      client: "",
      operationHr: 0,
      reduceHr: 0,
      standbyHr: 0,
      zeroHr: 0,
      repairHr: 0,
      amHr: 0,
      specialHr: 0,
      forceMajeureHr: 0,
      stackingHr: 0,
      rigMoveHr: 0,
      notReceivedDDOR: "",
      totalHrs: 0,
      remarks: "",
      totalAmount: 0,
      totalFuelAmount: 0,
      operationAmount: 0,
      reduceAmount: 0,
      standbyAmount: 0,
      zeroAmount: 0,
      repairAmount: 0,
      amAmount: 0,
      specialAmount: 0,
      forceMajeureAmount: 0,
      stackingAmount: 0,
      rigMoveAmount: 0,
    });
  }
  
  return data;
};

interface DashboardViewProps {
  selectedDate?: Date;
}

const DashboardView = ({ selectedDate }: DashboardViewProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [data, setData] = useState<DashboardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRigToClear, setSelectedRigToClear] = useState<string>("");
  const { toast } = useToast();
  
  // Editing state
  const [editingRig, setEditingRig] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<Partial<DashboardData>>({});
  const [isSaving, setIsSaving] = useState(false);
  
  // Month and date selection state
  const [currentMonth, setCurrentMonth] = useState(selectedDate || new Date());
  const [selectedDateFilter, setSelectedDateFilter] = useState(selectedDate || new Date());
  
  // Use selected date filter
  const displayDate = selectedDateFilter;
  const dateStr = format(displayDate, "yyyy-MM-dd");
  
  // Generate all dates in the current month
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const datesInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

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
              
              // Calculate total amount (hours * hourly rates + fuel amount)
              totalAmount = rates ? (
                operationAmount + reduceAmount + standbyAmount + zeroAmount + 
                repairAmount + amAmount + specialAmount + forceMajeureAmount + 
                stackingAmount + rigMoveAmount + totalFuelAmount
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
                operationAmount: operationAmount,
                reduceAmount: reduceAmount,
                standbyAmount: standbyAmount,
                zeroAmount: zeroAmount,
                repairAmount: repairAmount,
                amAmount: amAmount,
                specialAmount: specialAmount,
                forceMajeureAmount: forceMajeureAmount,
                stackingAmount: stackingAmount,
                rigMoveAmount: rigMoveAmount,
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
  const totalRigMoveAmount = nonHoistData.reduce((sum, row) => sum + row.rigMoveAmount, 0);
  
  // Calculate stacking statistics (excluding Hoists, out of 27 rigs)
  const stackedRigsCount = nonHoistData.filter(row => row.stackingHr > 0).length;
  const stackingPercentage = ((stackedRigsCount / 27) * 100).toFixed(1);

  const handleExport = () => {
    const csvContent = [
      ["Date", "Rig", "Client", "Operation Hr", "Reduce Hr", "Standby Hr", "Zero Hr", "Repair Hr", "AM Hr", "Special Hr", "Force Majeure Hr", "STACKING Hr", "Rig Move Hr", "Not Received DDOR", "Total Hr.s", "Total Fuel Amount", "Total Amount", "Remarks"],
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

  const handleClearHours = async () => {
    if (!selectedRigToClear) {
      toast({
        title: "No Rig Selected",
        description: "Please select a rig to clear hours",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('extracted_ddor_data')
        .delete()
        .eq('rig_number', selectedRigToClear)
        .eq('date', dateStr);

      if (error) throw error;

      toast({
        title: "Hours Cleared",
        description: `Successfully cleared hours for Rig ${selectedRigToClear} on ${format(selectedDateFilter, "dd-MMM-yy")}`,
      });

      // Reload data
      setLoading(true);
      const { data: extractedData, error: extractError } = await supabase
        .from('extracted_ddor_data')
        .select('*')
        .eq('date', dateStr);

      if (extractError) throw extractError;

      // Reload configurations and rates
      const { data: rigConfigs } = await supabase.from('rig_configs').select('*');
      const { data: rigRates } = await supabase.from('rig_rates').select('*');

      // Re-process data (same logic as in useEffect)
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
          
          const totalHrs = operationHr + reduceHr + standbyHr + zeroHr + repairHr + 
                         amHr + specialHr + forceMajeureHr + stackingHr + rigMoveHr;
          
          const isHoistRig = String(item.rig_number).toLowerCase().includes('hoist');
          const rates = ratesMap.get(item.rig_number);
          
          let totalAmount = 0;
          let totalFuelAmount = 0;
          
          // Declare amount variables outside to ensure they're in scope
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
          
          if (isHoistRig) {
            totalAmount = Number(item.total_amount) || 0;
            totalFuelAmount = 0;
          } else {
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
            
            totalAmount = rates ? (
              operationAmount + reduceAmount + standbyAmount + zeroAmount +
              repairAmount + amAmount + specialAmount + forceMajeureAmount +
              stackingAmount + rigMoveAmount + totalFuelAmount
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
        
        const totalHrs = operationHr + reduceHr + standbyHr + zeroHr + repairHr + 
                       amHr + specialHr + forceMajeureHr + stackingHr + rigMoveHr;

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
        
        const totalAmount = rates ? (
          operationAmount + reduceAmount + standbyAmount + zeroAmount + 
          repairAmount + amAmount + specialAmount + forceMajeureAmount + 
          stackingAmount + rigMoveAmount
        ) : 0;
        
        const totalFuelAmount = rates ? (
          ((operationHr / 24) * (Number(rates.fuel_operation_day_rate_usd) || 0)) +
          ((reduceHr / 24) * (Number(rates.fuel_reduce_day_rate_usd) || 0)) +
          ((zeroHr / 24) * (Number(rates.fuel_zero_day_rate_usd) || 0)) +
          ((repairHr / 24) * (Number(rates.fuel_repair_day_rate_usd) || 0)) +
          ((specialHr / 24) * (Number(rates.fuel_special_day_rate_usd) || 0))
        ) : 0;

        return {
          date: format(selectedDateFilter, "dd-MMM-yy"),
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

  // Handle starting edit mode for a row
  const handleEditRow = (rig: string) => {
    const rowData = data.find(r => r.rig === rig);
    if (rowData) {
      setEditingRig(rig);
      setEditedValues({ ...rowData });
    }
  };

  // Handle canceling edit
  const handleCancelEdit = () => {
    setEditingRig(null);
    setEditedValues({});
  };

  // Handle input change in edit mode
  const handleFieldChange = (field: keyof DashboardData, value: string | number) => {
    setEditedValues(prev => {
      const updated = { ...prev, [field]: value };
      
      // Auto-recalculate totalHrs when hour fields change
      if (field.includes('Hr') && field !== 'totalHrs') {
        const totalHrs = 
          (Number(updated.operationHr) || 0) +
          (Number(updated.reduceHr) || 0) +
          (Number(updated.standbyHr) || 0) +
          (Number(updated.zeroHr) || 0) +
          (Number(updated.repairHr) || 0) +
          (Number(updated.amHr) || 0) +
          (Number(updated.specialHr) || 0) +
          (Number(updated.forceMajeureHr) || 0) +
          (Number(updated.stackingHr) || 0) +
          (Number(updated.rigMoveHr) || 0);
        updated.totalHrs = totalHrs;
      }
      
      return updated;
    });
  };

  // Handle saving edited row
  const handleSaveRow = async () => {
    if (!editingRig || !editedValues) return;

    try {
      // Validate inputs
      const validationData = {
        operationHr: Number(editedValues.operationHr) || 0,
        reduceHr: Number(editedValues.reduceHr) || 0,
        standbyHr: Number(editedValues.standbyHr) || 0,
        zeroHr: Number(editedValues.zeroHr) || 0,
        repairHr: Number(editedValues.repairHr) || 0,
        amHr: Number(editedValues.amHr) || 0,
        specialHr: Number(editedValues.specialHr) || 0,
        forceMajeureHr: Number(editedValues.forceMajeureHr) || 0,
        stackingHr: Number(editedValues.stackingHr) || 0,
        rigMoveHr: Number(editedValues.rigMoveHr) || 0,
        client: String(editedValues.client || "").trim(),
        notReceivedDDOR: String(editedValues.notReceivedDDOR || "").trim(),
        remarks: String(editedValues.remarks || "").trim(),
      };

      hourFieldSchema.parse(validationData);

      setIsSaving(true);

      // Save to database
      const { error } = await supabase
        .from('extracted_ddor_data')
        .upsert({
          rig_number: editingRig,
          date: dateStr,
          client: validationData.client,
          operation_hr: validationData.operationHr,
          reduce_hr: validationData.reduceHr,
          standby_hr: validationData.standbyHr,
          zero_hr: validationData.zeroHr,
          repair_hr: validationData.repairHr,
          am_hr: validationData.amHr,
          special_hr: validationData.specialHr,
          force_majeure_hr: validationData.forceMajeureHr,
          stacking_hr: validationData.stackingHr,
          rig_move_hr: validationData.rigMoveHr,
          not_received_ddor: validationData.notReceivedDDOR,
          remarks: validationData.remarks,
          total_hrs: editedValues.totalHrs || 0,
        }, {
          onConflict: 'rig_number,date'
        });

      if (error) throw error;

      toast({
        title: "Saved",
        description: `Successfully updated Rig ${editingRig}`,
      });

      // Reload data
      setEditingRig(null);
      setEditedValues({});
      setLoading(true);
      
      const { data: extractedData, error: extractError } = await supabase
        .from('extracted_ddor_data')
        .select('*')
        .eq('date', dateStr);

      if (extractError) throw extractError;

      const { data: rigConfigs } = await supabase.from('rig_configs').select('*');
      const { data: rigRates } = await supabase.from('rig_rates').select('*');

      // Re-process data (reuse existing logic)
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
          
          const totalHrs = operationHr + reduceHr + standbyHr + zeroHr + repairHr + 
                         amHr + specialHr + forceMajeureHr + stackingHr + rigMoveHr;
          
          const isHoistRig = String(item.rig_number).toLowerCase().includes('hoist');
          const rates = ratesMap.get(item.rig_number);
          
          let totalAmount = 0;
          let totalFuelAmount = 0;
          
          // Declare amount variables outside to ensure they're in scope
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
          
          if (isHoistRig) {
            totalAmount = Number(item.total_amount) || 0;
            totalFuelAmount = 0;
          } else {
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
            
            totalAmount = rates ? (
              operationAmount + reduceAmount + standbyAmount + zeroAmount +
              repairAmount + amAmount + specialAmount + forceMajeureAmount +
              stackingAmount + rigMoveAmount + totalFuelAmount
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
        
        const totalHrs = operationHr + reduceHr + standbyHr + zeroHr + repairHr + 
                       amHr + specialHr + forceMajeureHr + stackingHr + rigMoveHr;

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
        
        const totalAmount = rates ? (
          operationAmount + reduceAmount + standbyAmount + zeroAmount + 
          repairAmount + amAmount + specialAmount + forceMajeureAmount + 
          stackingAmount + rigMoveAmount
        ) : 0;
        
        const totalFuelAmount = rates ? (
          ((operationHr / 24) * (Number(rates.fuel_operation_day_rate_usd) || 0)) +
          ((reduceHr / 24) * (Number(rates.fuel_reduce_day_rate_usd) || 0)) +
          ((zeroHr / 24) * (Number(rates.fuel_zero_day_rate_usd) || 0)) +
          ((repairHr / 24) * (Number(rates.fuel_repair_day_rate_usd) || 0)) +
          ((specialHr / 24) * (Number(rates.fuel_special_day_rate_usd) || 0))
        ) : 0;

        return {
          date: format(displayDate, "dd-MMM-yy"),
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
        };
      });

      setData(fullData);

    } catch (error: any) {
      console.error('Error saving row:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save changes",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-foreground mb-2">Consolidated Dashboard</h2>
        <p className="text-muted-foreground">
          View and analyze data from all rigs in one place
        </p>
      </div>
      
      {/* Month and Date Filters */}
      <Card className="shadow-md mb-6">
        <CardContent className="pt-6">
          {/* Month Selector */}
          <div className="flex items-center justify-between mb-4 pb-4 border-b">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePreviousMonth}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-lg font-semibold">
              {format(currentMonth, "MMMM yyyy")}
            </h3>
            <Button
              variant="outline"
              size="icon"
              onClick={handleNextMonth}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Date Selector */}
          <div className="flex gap-1 w-full">
            {datesInMonth.map((date) => {
              const isSelected = format(date, "yyyy-MM-dd") === format(selectedDateFilter, "yyyy-MM-dd");
              return (
                <Button
                  key={date.toISOString()}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedDateFilter(date)}
                  className={cn(
                    "h-8 flex-1 p-0 text-sm min-w-0",
                    isSelected && "bg-primary text-primary-foreground"
                  )}
                >
                  {format(date, "d")}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 mb-8">
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Operation Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-500">{totalOperationHrs.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Productive time</p>
            <p className="text-sm font-semibold text-foreground mt-2">${totalOperationAmount.toFixed(2)}</p>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Reduce Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">{totalReduceHrs.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Non-productive</p>
            <p className="text-sm font-semibold text-foreground mt-2">${totalReduceAmount.toFixed(2)}</p>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Standby Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">{totalStandbyHrs.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Waiting time</p>
            <p className="text-sm font-semibold text-foreground mt-2">${totalStandbyAmount.toFixed(2)}</p>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Zero Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-500">{totalZeroHrs.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">No activity</p>
            <p className="text-sm font-semibold text-foreground mt-2">${totalZeroAmount.toFixed(2)}</p>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Repair Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-500">{totalRepairHrs.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Maintenance</p>
            <p className="text-sm font-semibold text-foreground mt-2">${totalRepairAmount.toFixed(2)}</p>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">AM Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">{totalAmHrs.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">AM work</p>
            <p className="text-sm font-semibold text-foreground mt-2">${totalAmAmount.toFixed(2)}</p>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Special Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">{totalSpecialHrs.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Special ops</p>
            <p className="text-sm font-semibold text-foreground mt-2">${totalSpecialAmount.toFixed(2)}</p>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Force Majeure</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">{totalForceMajeureHrs.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">FM events</p>
            <p className="text-sm font-semibold text-foreground mt-2">${totalForceMajeureAmount.toFixed(2)}</p>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Stacking Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{totalStackingHrs.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Stacked rigs</p>
            <p className="text-sm font-semibold text-foreground mt-2">${totalStackingAmount.toFixed(2)}</p>
            <p className="text-xs text-primary mt-1">{stackedRigsCount} rigs ({stackingPercentage}% of 27)</p>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Rig Move Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{totalRigMoveHrs.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Mobilization</p>
            <p className="text-sm font-semibold text-foreground mt-2">${totalRigMoveAmount.toFixed(2)}</p>
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
                <Input
                  placeholder="Search by rig, client, or remarks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={selectedRigToClear} onValueChange={setSelectedRigToClear}>
                <SelectTrigger className="w-[180px] bg-background">
                  <SelectValue placeholder="Select rig to clear" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {RIGS.map((rig) => (
                    <SelectItem key={rig} value={rig}>
                      Rig {rig}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                variant="destructive" 
                size="icon"
                onClick={handleClearHours}
                disabled={!selectedRigToClear}
                title="Clear selected rig hours"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
              <Button onClick={handleExport} className="gap-2">
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border overflow-hidden">
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
                  
                  return (
                    <TableRow 
                      key={index} 
                      className={cn(
                        "hover:bg-muted/30",
                        isEditing && "bg-accent/20"
                      )}
                    >
                      <TableCell className="font-medium whitespace-nowrap text-center px-2 py-1.5">{row.date}</TableCell>
                      <TableCell className="whitespace-nowrap text-center px-2 py-1.5">
                        <Badge variant="outline" className="font-mono text-xs">
                          {row.rig}
                        </Badge>
                      </TableCell>
                      
                      {/* Client - Editable */}
                      <TableCell className="text-center px-2 py-1.5">
                        {isEditing ? (
                          <Input
                            type="text"
                            value={displayRow.client || ""}
                            onChange={(e) => handleFieldChange('client', e.target.value)}
                            className="h-7 text-sm text-center"
                          />
                        ) : row.client}
                      </TableCell>
                      
                      {/* Hour fields - All editable */}
                      {['operationHr', 'reduceHr', 'standbyHr', 'zeroHr', 'repairHr', 'amHr', 'specialHr', 'forceMajeureHr', 'stackingHr', 'rigMoveHr'].map((field) => (
                        <TableCell key={field} className="text-center px-2 py-1.5">
                          {isEditing ? (
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="24"
                              value={displayRow[field as keyof DashboardData] || 0}
                              onChange={(e) => handleFieldChange(field as keyof DashboardData, parseFloat(e.target.value) || 0)}
                              className="h-7 text-sm text-center w-20"
                            />
                          ) : (
                            (row[field as keyof DashboardData] as number).toFixed(2)
                          )}
                        </TableCell>
                      ))}
                      
                      {/* Not Received DDOR - Editable */}
                      <TableCell className="text-center px-2 py-1.5">
                        {isEditing ? (
                          <Input
                            type="text"
                            value={displayRow.notReceivedDDOR || ""}
                            onChange={(e) => handleFieldChange('notReceivedDDOR', e.target.value)}
                            className="h-7 text-sm text-center w-16"
                          />
                        ) : row.notReceivedDDOR}
                      </TableCell>
                      
                      {/* Total Hours - Auto-calculated */}
                      <TableCell className={cn(
                        "text-center font-semibold px-2 py-1.5",
                        (displayRow.totalHrs || 0) !== 24 && (displayRow.totalHrs || 0) > 0 && "text-destructive"
                      )}>
                        {(displayRow.totalHrs || 0).toFixed(2)}
                        {(displayRow.totalHrs || 0) !== 24 && (displayRow.totalHrs || 0) > 0 && (
                          <span className="ml-1 text-xs">⚠️</span>
                        )}
                      </TableCell>
                      
                      {/* Total Fuel - Read-only */}
                      <TableCell className="text-center font-semibold text-blue-600 dark:text-blue-500 px-2 py-1.5">
                        ${row.totalFuelAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      
                      {/* Total Amount - Read-only */}
                      <TableCell className="text-center font-semibold text-green-600 dark:text-green-500 px-2 py-1.5">
                        ${row.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      
                      {/* Remarks - Editable */}
                      <TableCell className="max-w-md text-center px-2 py-1.5">
                        {isEditing ? (
                          <Input
                            type="text"
                            value={displayRow.remarks || ""}
                            onChange={(e) => handleFieldChange('remarks', e.target.value)}
                            className="h-7 text-sm"
                          />
                        ) : (
                          <span className="truncate" title={row.remarks}>{row.remarks}</span>
                        )}
                      </TableCell>
                      
                      {/* Actions */}
                      <TableCell className="text-center px-2 py-1.5">
                        {isEditing ? (
                          <div className="flex gap-1 justify-center">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={handleSaveRow}
                              disabled={isSaving}
                            >
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={handleCancelEdit}
                              disabled={isSaving}
                            >
                              <X className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => handleEditRow(row.rig)}
                          >
                            Edit
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {loading && (
            <div className="py-12 text-center text-muted-foreground">
              <p>Loading data...</p>
            </div>
          )}
          {!loading && filteredData.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              <p>No records found matching your search criteria.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardView;
