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
            notReceivedDDOR: getFixedValue("Not Received DDOR"),
            totalHrs,
            remarks: getFixedValue("Remarks"),
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

  const totalOperationHrs = filteredData.reduce((sum, row) => sum + row.operationHr, 0);
  const totalReduceHrs = filteredData.reduce((sum, row) => sum + row.reduceHr, 0);
  const avgEfficiency = ((totalOperationHrs / (totalOperationHrs + totalReduceHrs)) * 100).toFixed(1);

  const handleExport = () => {
    const csvContent = [
      ["Date", "Rig", "Client", "Operation Hr", "Reduce Hr", "Standby Hr", "Zero Hr", "Repair Hr", "AM Hr", "Special Hr", "Force Majeure Hr", "STACKING Hr", "Rig Move Hr", "Not Received DDOR", "Total Hr.s", "Remarks"],
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
          <div className="flex gap-1 justify-start flex-wrap">
            {datesInMonth.map((date) => {
              const isSelected = format(date, "yyyy-MM-dd") === format(selectedDateFilter, "yyyy-MM-dd");
              return (
                <Button
                  key={date.toISOString()}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedDateFilter(date)}
                  className={cn(
                    "h-8 w-10 p-0 text-xs",
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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{filteredData.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Across all rigs</p>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Operation Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-success">{totalOperationHrs.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Total productive time</p>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Reduced Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-warning">{totalReduceHrs.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Non-productive time</p>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Efficiency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-secondary">{avgEfficiency}%</div>
            <p className="text-xs text-muted-foreground mt-1">Average efficiency rate</p>
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
                  <TableHead className="font-semibold text-primary-foreground">Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((row, index) => (
                  <TableRow key={index} className="hover:bg-muted/30">
                    <TableCell className="font-medium whitespace-nowrap">{row.date}</TableCell>
                    <TableCell>
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
