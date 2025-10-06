import { useState, useEffect } from "react";
import { Download, Filter, Search, ChevronLeft, ChevronRight } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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
}

const RIGS = [
  "103", "104", "105", "106", "107", "108", "109", "110", "111", "112",
  "201", "202", "203", "204", "205", "206", "207", "208", "209", "210", "211",
  "301", "302", "303", "304", "305", "306",
  "Hoist 1", "Hoist 2", "Hoist 3", "Hoist 4", "Hoist 5"
];

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
  const { toast } = useToast();
  
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
            
            // Get rates for this rig
            const rates = ratesMap.get(item.rig_number);
            
            // Calculate total fuel amount (hours/24 * daily fuel rates)
            const totalFuelAmount = rates ? (
              ((operationHr / 24) * (Number(rates.fuel_operation_day_rate_usd) || 0)) +
              ((reduceHr / 24) * (Number(rates.fuel_reduce_day_rate_usd) || 0)) +
              ((zeroHr / 24) * (Number(rates.fuel_zero_day_rate_usd) || 0)) +
              ((repairHr / 24) * (Number(rates.fuel_repair_day_rate_usd) || 0)) +
              ((specialHr / 24) * (Number(rates.fuel_special_day_rate_usd) || 0))
            ) : 0;
            
            // Calculate total amount (hours * hourly rates + fuel amount)
            const totalAmount = rates ? (
              (operationHr * (Number(rates.operation_hr_rate) || 0)) +
              (reduceHr * (Number(rates.reduce_hr_rate) || 0)) +
              (standbyHr * (Number(rates.standby_hr_rate) || 0)) +
              (zeroHr * (Number(rates.zero_hr_rate) || 0)) +
              (repairHr * (Number(rates.repair_hr_rate) || 0)) +
              (amHr * (Number(rates.annual_maintenance_hr_rate) || 0)) +
              (specialHr * (Number(rates.special_hr_rate) || 0)) +
              (forceMajeureHr * (Number(rates.force_majeure_hr_rate) || 0)) +
              (stackingHr * (Number(rates.stacking_hr_rate) || 0)) +
              (rigMoveHr * (Number(rates.rig_move_hr_rate) || 0)) +
              totalFuelAmount
            ) : 0;
            
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
          
          // Calculate total amount (hours * hourly rates)
          const totalAmount = rates ? (
            (operationHr * (Number(rates.operation_hr_rate) || 0)) +
            (reduceHr * (Number(rates.reduce_hr_rate) || 0)) +
            (standbyHr * (Number(rates.standby_hr_rate) || 0)) +
            (zeroHr * (Number(rates.zero_hr_rate) || 0)) +
            (repairHr * (Number(rates.repair_hr_rate) || 0)) +
            (amHr * (Number(rates.annual_maintenance_hr_rate) || 0)) +
            (specialHr * (Number(rates.special_hr_rate) || 0)) +
            (forceMajeureHr * (Number(rates.force_majeure_hr_rate) || 0)) +
            (stackingHr * (Number(rates.stacking_hr_rate) || 0)) +
            (rigMoveHr * (Number(rates.rig_move_hr_rate) || 0))
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

  // Calculate totals for all hour categories
  const totalOperationHrs = filteredData.reduce((sum, row) => sum + row.operationHr, 0);
  const totalReduceHrs = filteredData.reduce((sum, row) => sum + row.reduceHr, 0);
  const totalStandbyHrs = filteredData.reduce((sum, row) => sum + row.standbyHr, 0);
  const totalZeroHrs = filteredData.reduce((sum, row) => sum + row.zeroHr, 0);
  const totalRepairHrs = filteredData.reduce((sum, row) => sum + row.repairHr, 0);
  const totalAmHrs = filteredData.reduce((sum, row) => sum + row.amHr, 0);
  const totalSpecialHrs = filteredData.reduce((sum, row) => sum + row.specialHr, 0);
  const totalForceMajeureHrs = filteredData.reduce((sum, row) => sum + row.forceMajeureHr, 0);
  const totalStackingHrs = filteredData.reduce((sum, row) => sum + row.stackingHr, 0);
  const totalRigMoveHrs = filteredData.reduce((sum, row) => sum + row.rigMoveHr, 0);
  const avgEfficiency = ((totalOperationHrs / (totalOperationHrs + totalReduceHrs)) * 100).toFixed(1);

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

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
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
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Reduce Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">{totalReduceHrs.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Non-productive</p>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Standby Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">{totalStandbyHrs.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Waiting time</p>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Zero Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-500">{totalZeroHrs.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">No activity</p>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Repair Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-500">{totalRepairHrs.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Maintenance</p>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">AM Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">{totalAmHrs.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">AM work</p>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Special Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">{totalSpecialHrs.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Special ops</p>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Force Majeure</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">{totalForceMajeureHrs.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">FM events</p>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Stacking Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{totalStackingHrs.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Stacked rigs</p>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Rig Move Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{totalRigMoveHrs.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Mobilization</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <CardTitle>Main Consolidated Sheet</CardTitle>
            <div className="flex gap-2">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by rig, client, or remarks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
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
                  <TableHead className="font-semibold text-primary-foreground">Date</TableHead>
                  <TableHead className="font-semibold text-primary-foreground">Rig</TableHead>
                  <TableHead className="font-semibold text-primary-foreground">Client</TableHead>
                  <TableHead className="font-semibold text-right text-primary-foreground">Operation Hr</TableHead>
                  <TableHead className="font-semibold text-right text-primary-foreground">Reduce Hr</TableHead>
                  <TableHead className="font-semibold text-right text-primary-foreground">Standby Hr</TableHead>
                  <TableHead className="font-semibold text-right text-primary-foreground">Zero Hr</TableHead>
                  <TableHead className="font-semibold text-right text-primary-foreground">Repair Hr</TableHead>
                  <TableHead className="font-semibold text-right text-primary-foreground">AM Hr</TableHead>
                  <TableHead className="font-semibold text-right text-primary-foreground">Special Hr</TableHead>
                  <TableHead className="font-semibold text-right text-primary-foreground">Force Majeure Hr</TableHead>
                  <TableHead className="font-semibold text-right text-primary-foreground">STACKING Hr</TableHead>
                  <TableHead className="font-semibold text-right text-primary-foreground">Rig Move Hr</TableHead>
                  <TableHead className="font-semibold text-right text-primary-foreground">Not Received DDOR</TableHead>
                  <TableHead className="font-semibold text-right text-primary-foreground">Total Hr.s</TableHead>
                  <TableHead className="font-semibold text-right text-primary-foreground">Total Fuel</TableHead>
                  <TableHead className="font-semibold text-right text-primary-foreground">Total Amount</TableHead>
                  <TableHead className="font-semibold text-primary-foreground">Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((row, index) => (
                  <TableRow key={index} className="hover:bg-muted/30">
                    <TableCell className="font-medium whitespace-nowrap">{row.date}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant="outline" className="font-mono">
                        {row.rig}
                      </Badge>
                    </TableCell>
                    <TableCell>{row.client}</TableCell>
                    <TableCell className="text-right">{row.operationHr.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{row.reduceHr.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{row.standbyHr.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{row.zeroHr.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{row.repairHr.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{row.amHr.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{row.specialHr.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{row.forceMajeureHr.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{row.stackingHr.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{row.rigMoveHr.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{row.notReceivedDDOR}</TableCell>
                    <TableCell className={cn(
                      "text-right font-semibold",
                      row.totalHrs > 24 && "text-destructive"
                    )}>
                      {row.totalHrs.toFixed(2)}
                      {row.totalHrs > 24 && (
                        <span className="ml-1 text-xs">⚠️</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-blue-600 dark:text-blue-500">
                      ${row.totalFuelAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-green-600 dark:text-green-500">
                      ${row.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="max-w-md truncate" title={row.remarks}>
                      {row.remarks}
                    </TableCell>
                  </TableRow>
                ))}
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
