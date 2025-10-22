import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Filter, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

const COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];
const RIGS = ["103", "104", "105", "106", "107", "108", "109", "110", "111", "112", "201", "202", "203", "204", "205", "206", "207", "208", "209", "210", "211", "301", "302", "303", "304", "305", "306"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

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
  root_cause: string;
}

const NPTAnalysisView = () => {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<NPTRecord[]>([]);
  const [filters, setFilters] = useState({
    years: [] as number[],
    months: [] as string[],
    rigs: [] as string[],
    nptTypes: [] as string[],
    systems: [] as string[],
    rootCauses: [] as string[],
  });

  const [availableFilters, setAvailableFilters] = useState({
    years: [] as number[],
    nptTypes: [] as string[],
    systems: [] as string[],
    rootCauses: [] as string[],
  });

  const [stats, setStats] = useState({
    totalHours: 0,
    totalIncidents: 0,
    avgHoursPerIncident: 0,
  });

  const [chartData, setChartData] = useState({
    byYear: [] as any[],
    byMonth: [] as any[],
    byRig: [] as any[],
    bySystem: [] as any[],
    systemBreakdown: [] as any[],
  });

  useEffect(() => {
    fetchRecords();
  }, []);

  useEffect(() => {
    if (records.length > 0) {
      processData();
    }
  }, [records, filters]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("npt_records")
        .select("*")
        .order("date", { ascending: true });

      if (error) throw error;

      setRecords(data || []);

      // Extract unique values for filters
      const years = [...new Set(data?.map((r) => r.year).filter(Boolean))].sort() as number[];
      const nptTypes = [...new Set(data?.map((r) => r.npt_type).filter(Boolean))].sort() as string[];
      const systems = [...new Set(data?.map((r) => r.system).filter(Boolean))].sort() as string[];
      const rootCauses = [...new Set(data?.map((r) => r.root_cause).filter(Boolean))].sort() as string[];

      setAvailableFilters({ years, nptTypes, systems, rootCauses });
    } catch (error) {
      console.error("Error fetching records:", error);
    } finally {
      setLoading(false);
    }
  };

  const processData = () => {
    let filtered = records;

    // Apply filters
    if (filters.years.length > 0) {
      filtered = filtered.filter((r) => filters.years.includes(r.year));
    }
    if (filters.months.length > 0) {
      filtered = filtered.filter((r) => filters.months.includes(r.month));
    }
    if (filters.rigs.length > 0) {
      filtered = filtered.filter((r) => filters.rigs.includes(r.rig_number));
    }
    if (filters.nptTypes.length > 0) {
      filtered = filtered.filter((r) => filters.nptTypes.includes(r.npt_type));
    }
    if (filters.systems.length > 0) {
      filtered = filtered.filter((r) => filters.systems.includes(r.system));
    }
    if (filters.rootCauses.length > 0) {
      filtered = filtered.filter((r) => filters.rootCauses.includes(r.root_cause));
    }

    // Calculate stats
    const totalHours = filtered.reduce((sum, r) => sum + (r.hours || 0), 0);
    const totalIncidents = filtered.length;
    const avgHoursPerIncident = totalIncidents > 0 ? totalHours / totalIncidents : 0;

    setStats({
      totalHours: Math.round(totalHours * 10) / 10,
      totalIncidents,
      avgHoursPerIncident: Math.round(avgHoursPerIncident * 10) / 10,
    });

    // NPT by Year
    const yearMap: { [key: number]: number } = {};
    filtered.forEach((r) => {
      if (r.year) {
        yearMap[r.year] = (yearMap[r.year] || 0) + (r.hours || 0);
      }
    });
    const byYear = Object.entries(yearMap)
      .map(([year, hours]) => ({ year: Number(year), hours: Math.round(hours * 10) / 10 }))
      .sort((a, b) => a.year - b.year);

    // NPT by Month
    const monthMap: { [key: string]: number } = {};
    MONTHS.forEach((month) => {
      monthMap[month] = 0;
    });
    filtered.forEach((r) => {
      if (r.month) {
        monthMap[r.month] = (monthMap[r.month] || 0) + (r.hours || 0);
      }
    });
    const byMonth = MONTHS.map((month) => ({
      month,
      hours: Math.round((monthMap[month] || 0) * 10) / 10,
    }));

    // NPT by Rig
    const rigMap: { [key: string]: number } = {};
    filtered.forEach((r) => {
      if (r.rig_number) {
        rigMap[r.rig_number] = (rigMap[r.rig_number] || 0) + (r.hours || 0);
      }
    });
    const byRig = Object.entries(rigMap)
      .map(([rig, hours]) => ({ rig, hours: Math.round(hours * 10) / 10 }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 15);

    // NPT by System
    const systemMap: { [key: string]: number } = {};
    filtered.forEach((r) => {
      if (r.system) {
        systemMap[r.system] = (systemMap[r.system] || 0) + (r.hours || 0);
      }
    });
    const bySystem = Object.entries(systemMap)
      .map(([system, hours]) => ({ system, hours: Math.round(hours * 10) / 10 }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 10);

    // System breakdown with equipment
    const systemEquipmentMap: { [key: string]: { [key: string]: number } } = {};
    filtered.forEach((r) => {
      if (r.system && r.equipment) {
        if (!systemEquipmentMap[r.system]) {
          systemEquipmentMap[r.system] = {};
        }
        systemEquipmentMap[r.system][r.equipment] =
          (systemEquipmentMap[r.system][r.equipment] || 0) + (r.hours || 0);
      }
    });
    const systemBreakdown = Object.entries(systemEquipmentMap)
      .flatMap(([system, equipments]) =>
        Object.entries(equipments).map(([equipment, hours]) => ({
          system,
          equipment,
          hours: Math.round(hours * 10) / 10,
        }))
      )
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 15);

    setChartData({ byYear, byMonth, byRig, bySystem, systemBreakdown });
  };

  const clearAllFilters = () => {
    setFilters({
      years: [],
      months: [],
      rigs: [],
      nptTypes: [],
      systems: [],
      rootCauses: [],
    });
  };

  const toggleFilter = (category: keyof typeof filters, value: string | number) => {
    setFilters((prev) => {
      const currentValues = prev[category] as any[];
      return {
        ...prev,
        [category]: currentValues.includes(value)
          ? currentValues.filter((v) => v !== value)
          : [...currentValues, value],
      };
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters Section */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <h3 className="font-semibold">Filters</h3>
          </div>
          <Button variant="outline" size="sm" onClick={clearAllFilters}>
            <X className="h-4 w-4 mr-2" />
            Clear All
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Year Filter */}
          <div className="space-y-2">
            <Label>Year</Label>
            <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
              {availableFilters.years.map((year) => (
                <div key={year} className="flex items-center space-x-2">
                  <Checkbox
                    id={`year-${year}`}
                    checked={filters.years.includes(year)}
                    onCheckedChange={() => toggleFilter("years", year)}
                  />
                  <label htmlFor={`year-${year}`} className="text-sm cursor-pointer">
                    {year}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Month Filter */}
          <div className="space-y-2">
            <Label>Month</Label>
            <ScrollArea className="h-40 border rounded-md p-3">
              <div className="space-y-2">
                {MONTHS.map((month) => (
                  <div key={month} className="flex items-center space-x-2">
                    <Checkbox
                      id={`month-${month}`}
                      checked={filters.months.includes(month)}
                      onCheckedChange={() => toggleFilter("months", month)}
                    />
                    <label htmlFor={`month-${month}`} className="text-sm cursor-pointer">
                      {month}
                    </label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Rig Filter */}
          <div className="space-y-2">
            <Label>Rig</Label>
            <ScrollArea className="h-40 border rounded-md p-3">
              <div className="space-y-2">
                {RIGS.map((rig) => (
                  <div key={rig} className="flex items-center space-x-2">
                    <Checkbox
                      id={`rig-${rig}`}
                      checked={filters.rigs.includes(rig)}
                      onCheckedChange={() => toggleFilter("rigs", rig)}
                    />
                    <label htmlFor={`rig-${rig}`} className="text-sm cursor-pointer">
                      Rig {rig}
                    </label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* NPT Type Filter */}
          <div className="space-y-2">
            <Label>NPT Type</Label>
            <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
              {availableFilters.nptTypes.map((type) => (
                <div key={type} className="flex items-center space-x-2">
                  <Checkbox
                    id={`npt-${type}`}
                    checked={filters.nptTypes.includes(type)}
                    onCheckedChange={() => toggleFilter("nptTypes", type)}
                  />
                  <label htmlFor={`npt-${type}`} className="text-sm cursor-pointer">
                    {type}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* System Filter */}
          <div className="space-y-2">
            <Label>System</Label>
            <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
              {availableFilters.systems.map((system) => (
                <div key={system} className="flex items-center space-x-2">
                  <Checkbox
                    id={`system-${system}`}
                    checked={filters.systems.includes(system)}
                    onCheckedChange={() => toggleFilter("systems", system)}
                  />
                  <label htmlFor={`system-${system}`} className="text-sm cursor-pointer truncate">
                    {system}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Root Cause Filter - Full Width */}
        <div className="mt-4 space-y-2">
          <Label>Root Cause</Label>
          <ScrollArea className="h-32 border rounded-md p-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {availableFilters.rootCauses.map((cause) => (
                <div key={cause} className="flex items-center space-x-2">
                  <Checkbox
                    id={`cause-${cause}`}
                    checked={filters.rootCauses.includes(cause)}
                    onCheckedChange={() => toggleFilter("rootCauses", cause)}
                  />
                  <label htmlFor={`cause-${cause}`} className="text-sm cursor-pointer truncate">
                    {cause}
                  </label>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Total NPT Hours</p>
          <p className="text-3xl font-bold text-primary">{stats.totalHours}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Total Incidents</p>
          <p className="text-3xl font-bold">{stats.totalIncidents}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Avg Hours/Incident</p>
          <p className="text-3xl font-bold">{stats.avgHoursPerIncident}</p>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* NPT Hours by Year */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4">NPT Hours by Year</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData.byYear}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="hours" stroke="#22c55e" strokeWidth={2} name="NPT Hours" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* NPT Hours by Month */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4">NPT Hours by Month</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData.byMonth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="hours" stroke="#3b82f6" strokeWidth={2} name="NPT Hours" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* NPT Hours by Rig */}
        <Card className="p-6 md:col-span-2">
          <h3 className="font-semibold mb-4">NPT Hours by Rig</h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData.byRig} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="rig" type="category" width={100} />
              <Tooltip />
              <Legend />
              <Bar dataKey="hours" fill="#22c55e" name="NPT Hours" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* NPT Hours by System */}
        <Card className="p-6 md:col-span-2">
          <h3 className="font-semibold mb-4">NPT Hours by System</h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData.bySystem} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="system" type="category" width={200} />
              <Tooltip />
              <Legend />
              <Bar dataKey="hours" fill="#3b82f6" name="NPT Hours" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* System Breakdown Table */}
        <Card className="p-6 md:col-span-2">
          <h3 className="font-semibold mb-4">System & Equipment Breakdown (Top 15)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-semibold">System</th>
                  <th className="text-left p-2 font-semibold">Equipment</th>
                  <th className="text-right p-2 font-semibold">Hours</th>
                </tr>
              </thead>
              <tbody>
                {chartData.systemBreakdown.map((item, idx) => (
                  <tr key={idx} className="border-b hover:bg-muted/50">
                    <td className="p-2">{item.system}</td>
                    <td className="p-2">{item.equipment}</td>
                    <td className="p-2 text-right font-medium">{item.hours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default NPTAnalysisView;
