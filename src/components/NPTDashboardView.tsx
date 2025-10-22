import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Download, Filter } from "lucide-react";
import { format } from "date-fns";

interface NPTRecord {
  id: string;
  rig_number: string;
  year: number;
  month: string;
  date: string;
  hours: number;
  npt_type: string;
  system: string;
  equipment: string;
  the_part: string;
  contractual: string;
  department_responsibility: string;
  failure_description: string;
  root_cause: string;
  corrective_action: string;
  future_action: string;
  action_party: string;
  notification_number_n2: string;
  failure_investigation_reports: string;
  data_quality_score: number;
}

const NPTDashboardView = () => {
  const [records, setRecords] = useState<NPTRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    rigNumber: "all",
    system: "all",
    rootCause: "all",
    qualityScore: "all",
    searchText: "",
  });

  const [stats, setStats] = useState({
    totalHours: 0,
    avgHoursPerIncident: 0,
    topSystem: "",
    topRootCause: "",
    avgQuality: 0,
  });

  useEffect(() => {
    fetchRecords();
  }, [filters]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      let query = supabase.from("npt_records").select("*").order("date", { ascending: false });

      if (filters.rigNumber !== "all") {
        query = query.eq("rig_number", filters.rigNumber);
      }
      if (filters.system !== "all") {
        query = query.eq("system", filters.system);
      }
      if (filters.rootCause !== "all") {
        query = query.eq("root_cause", filters.rootCause);
      }
      if (filters.qualityScore !== "all") {
        if (filters.qualityScore === "good") {
          query = query.gte("data_quality_score", 80);
        } else if (filters.qualityScore === "fair") {
          query = query.gte("data_quality_score", 50).lt("data_quality_score", 80);
        } else if (filters.qualityScore === "poor") {
          query = query.lt("data_quality_score", 50);
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      let filteredData = data || [];

      if (filters.searchText) {
        filteredData = filteredData.filter(
          (r) =>
            r.failure_description?.toLowerCase().includes(filters.searchText.toLowerCase()) ||
            r.equipment?.toLowerCase().includes(filters.searchText.toLowerCase())
        );
      }

      setRecords(filteredData);

      // Calculate stats
      const totalHours = filteredData.reduce((sum, r) => sum + (r.hours || 0), 0);
      const avgHours = filteredData.length > 0 ? totalHours / filteredData.length : 0;
      const avgQuality =
        filteredData.length > 0
          ? filteredData.reduce((sum, r) => sum + (r.data_quality_score || 0), 0) /
            filteredData.length
          : 0;

      // Find top system
      const systemCounts: { [key: string]: number } = {};
      filteredData.forEach((r) => {
        if (r.system) {
          systemCounts[r.system] = (systemCounts[r.system] || 0) + (r.hours || 0);
        }
      });
      const topSystem =
        Object.keys(systemCounts).length > 0
          ? Object.entries(systemCounts).sort((a, b) => b[1] - a[1])[0][0]
          : "N/A";

      // Find top root cause
      const rootCauseCounts: { [key: string]: number } = {};
      filteredData.forEach((r) => {
        if (r.root_cause) {
          rootCauseCounts[r.root_cause] = (rootCauseCounts[r.root_cause] || 0) + 1;
        }
      });
      const topRootCause =
        Object.keys(rootCauseCounts).length > 0
          ? Object.entries(rootCauseCounts).sort((a, b) => b[1] - a[1])[0][0]
          : "N/A";

      setStats({
        totalHours: Math.round(totalHours * 10) / 10,
        avgHoursPerIncident: Math.round(avgHours * 10) / 10,
        topSystem,
        topRootCause,
        avgQuality: Math.round(avgQuality),
      });
    } catch (error) {
      console.error("Error fetching records:", error);
    } finally {
      setLoading(false);
    }
  };

  const getQualityColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  const exportToCSV = () => {
    const headers = [
      "Rig Number",
      "Year",
      "Month",
      "Date",
      "Hours",
      "NPT Type",
      "System",
      "Equipment",
      "The Part",
      "Contractual",
      "Department Responsibility",
      "Failure Description",
      "Root Cause",
      "Corrective Action",
      "Future Action",
      "Action Party",
      "Notification Number (N2)",
      "Failure Investigation Reports",
    ];
    const csvData = records.map((r) => [
      r.rig_number,
      r.year || "",
      r.month || "",
      r.date,
      r.hours,
      r.npt_type || "",
      r.system || "",
      r.equipment || "",
      r.the_part || "",
      r.contractual || "",
      r.department_responsibility || "",
      r.failure_description || "",
      r.root_cause || "",
      r.corrective_action || "",
      r.future_action || "",
      r.action_party || "",
      r.notification_number_n2 || "",
      r.failure_investigation_reports || "",
    ]);

    const csv = [headers, ...csvData].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `npt-records-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total NPT Hours</p>
          <p className="text-2xl font-bold">{stats.totalHours}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Avg Hours/Incident</p>
          <p className="text-2xl font-bold">{stats.avgHoursPerIncident}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Top System</p>
          <p className="text-lg font-semibold truncate" title={stats.topSystem}>
            {stats.topSystem}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Top Root Cause</p>
          <p className="text-lg font-semibold truncate" title={stats.topRootCause}>
            {stats.topRootCause}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Avg Quality</p>
          <p className={`text-2xl font-bold ${getQualityColor(stats.avgQuality)}`}>
            {stats.avgQuality}%
          </p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4" />
          <h3 className="font-semibold">Filters</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Select value={filters.rigNumber} onValueChange={(v) => setFilters({ ...filters, rigNumber: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Rig Number" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Rigs</SelectItem>
              {["103", "104", "105", "106", "107", "108", "109", "110", "111", "112", "201", "202", "203", "204", "205", "206", "207", "208", "209", "210", "211", "301", "302", "303", "304", "305", "306"].map((rig) => (
                <SelectItem key={rig} value={rig}>
                  Rig {rig}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.system} onValueChange={(v) => setFilters({ ...filters, system: v })}>
            <SelectTrigger>
              <SelectValue placeholder="System" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Systems</SelectItem>
              <SelectItem value="Top_Drive">Top Drive</SelectItem>
              <SelectItem value="Circulating_System">Circulating System</SelectItem>
              <SelectItem value="Handling_System">Handling System</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.rootCause} onValueChange={(v) => setFilters({ ...filters, rootCause: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Root Cause" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Causes</SelectItem>
              <SelectItem value="Wear and Tear">Wear and Tear</SelectItem>
              <SelectItem value="H.Err Focus and Attention">Human Error</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.qualityScore} onValueChange={(v) => setFilters({ ...filters, qualityScore: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Quality Score" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Quality</SelectItem>
              <SelectItem value="good">Good (80-100)</SelectItem>
              <SelectItem value="fair">Fair (50-79)</SelectItem>
              <SelectItem value="poor">Poor (0-49)</SelectItem>
            </SelectContent>
          </Select>

          <Input
            placeholder="Search description..."
            value={filters.searchText}
            onChange={(e) => setFilters({ ...filters, searchText: e.target.value })}
          />
        </div>
      </Card>

      {/* Data Table */}
      <Card>
        <div className="p-4 flex justify-between items-center border-b">
          <div>
            <h3 className="font-semibold">NPT Records</h3>
            <p className="text-sm text-muted-foreground">{records.length} records found</p>
          </div>
          <Button onClick={exportToCSV} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[100px]">Rig Number</TableHead>
                  <TableHead className="min-w-[80px]">Year</TableHead>
                  <TableHead className="min-w-[100px]">Month</TableHead>
                  <TableHead className="min-w-[120px]">Date</TableHead>
                  <TableHead className="min-w-[80px]">Hours</TableHead>
                  <TableHead className="min-w-[120px]">NPT Type</TableHead>
                  <TableHead className="min-w-[150px]">System</TableHead>
                  <TableHead className="min-w-[150px]">Equipment</TableHead>
                  <TableHead className="min-w-[120px]">The Part</TableHead>
                  <TableHead className="min-w-[120px]">Contractual</TableHead>
                  <TableHead className="min-w-[180px]">Department Responsibility</TableHead>
                  <TableHead className="min-w-[250px]">Failure Description</TableHead>
                  <TableHead className="min-w-[180px]">Root Cause</TableHead>
                  <TableHead className="min-w-[200px]">Corrective Action</TableHead>
                  <TableHead className="min-w-[200px]">Future Action</TableHead>
                  <TableHead className="min-w-[150px]">Action Party</TableHead>
                  <TableHead className="min-w-[150px]">Notification Number (N2)</TableHead>
                  <TableHead className="min-w-[200px]">Failure Investigation Reports</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{record.rig_number}</TableCell>
                    <TableCell>{record.year || "-"}</TableCell>
                    <TableCell>{record.month || "-"}</TableCell>
                    <TableCell>{format(new Date(record.date), "MMM dd, yyyy")}</TableCell>
                    <TableCell>{record.hours}</TableCell>
                    <TableCell>{record.npt_type || "-"}</TableCell>
                    <TableCell>{record.system || "-"}</TableCell>
                    <TableCell>{record.equipment || "-"}</TableCell>
                    <TableCell>{record.the_part || "-"}</TableCell>
                    <TableCell>{record.contractual || "-"}</TableCell>
                    <TableCell>{record.department_responsibility || "-"}</TableCell>
                    <TableCell className="max-w-xs truncate" title={record.failure_description}>
                      {record.failure_description || "-"}
                    </TableCell>
                    <TableCell className="max-w-xs truncate" title={record.root_cause}>
                      {record.root_cause || "-"}
                    </TableCell>
                    <TableCell className="max-w-xs truncate" title={record.corrective_action}>
                      {record.corrective_action || "-"}
                    </TableCell>
                    <TableCell className="max-w-xs truncate" title={record.future_action}>
                      {record.future_action || "-"}
                    </TableCell>
                    <TableCell>{record.action_party || "-"}</TableCell>
                    <TableCell>{record.notification_number_n2 || "-"}</TableCell>
                    <TableCell className="max-w-xs truncate" title={record.failure_investigation_reports}>
                      {record.failure_investigation_reports || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default NPTDashboardView;
