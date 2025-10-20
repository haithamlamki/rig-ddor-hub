import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import {
  BarChart,
  Bar,
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

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", "#82CA9D"];

const NPTAnalysisView = () => {
  const [loading, setLoading] = useState(true);
  const [qualityData, setQualityData] = useState<any>({
    overallScore: 0,
    fieldCompleteness: [],
    qualityDistribution: [],
  });
  const [nptData, setNptData] = useState<any>({
    bySystem: [],
    byRootCause: [],
    byDepartment: [],
  });

  useEffect(() => {
    fetchAnalysisData();
  }, []);

  const fetchAnalysisData = async () => {
    setLoading(true);
    try {
      const { data: records, error } = await supabase
        .from("npt_records")
        .select("*")
        .order("date", { ascending: false });

      if (error) throw error;

      if (!records || records.length === 0) {
        setLoading(false);
        return;
      }

      // Overall quality score
      const avgScore =
        records.reduce((sum, r) => sum + (r.data_quality_score || 0), 0) / records.length;

      // Field completeness
      const fields = [
        "system",
        "equipment",
        "root_cause",
        "department_responsibility",
        "corrective_action",
        "future_action",
      ];
      const completeness = fields.map((field) => ({
        name: field.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
        percentage: Math.round(
          (records.filter((r) => r[field] && r[field] !== "NA" && r[field] !== "").length /
            records.length) *
            100
        ),
      }));

      // Quality score distribution
      const distribution = [
        { name: "Good (80-100)", count: records.filter((r) => r.data_quality_score >= 80).length },
        {
          name: "Fair (50-79)",
          count: records.filter((r) => r.data_quality_score >= 50 && r.data_quality_score < 80)
            .length,
        },
        { name: "Poor (0-49)", count: records.filter((r) => r.data_quality_score < 50).length },
      ];

      setQualityData({
        overallScore: Math.round(avgScore),
        fieldCompleteness: completeness,
        qualityDistribution: distribution,
      });

      // NPT by System
      const systemMap: { [key: string]: number } = {};
      records.forEach((r) => {
        if (r.system) {
          systemMap[r.system] = (systemMap[r.system] || 0) + (r.hours || 0);
        }
      });
      const bySystem = Object.entries(systemMap)
        .map(([name, hours]) => ({ name, hours: Math.round(hours * 10) / 10 }))
        .sort((a, b) => b.hours - a.hours)
        .slice(0, 8);

      // NPT by Root Cause
      const rootCauseMap: { [key: string]: number } = {};
      records.forEach((r) => {
        if (r.root_cause) {
          rootCauseMap[r.root_cause] = (rootCauseMap[r.root_cause] || 0) + (r.hours || 0);
        }
      });
      const byRootCause = Object.entries(rootCauseMap)
        .map(([name, hours]) => ({ name, hours: Math.round(hours * 10) / 10 }))
        .sort((a, b) => b.hours - a.hours)
        .slice(0, 8);

      // NPT by Department
      const deptMap: { [key: string]: number } = {};
      records.forEach((r) => {
        if (r.department_responsibility) {
          deptMap[r.department_responsibility] =
            (deptMap[r.department_responsibility] || 0) + (r.hours || 0);
        }
      });
      const byDepartment = Object.entries(deptMap)
        .map(([name, hours]) => ({ name, hours: Math.round(hours * 10) / 10 }))
        .sort((a, b) => b.hours - a.hours)
        .slice(0, 6);

      setNptData({ bySystem, byRootCause, byDepartment });
    } catch (error) {
      console.error("Error fetching analysis data:", error);
    } finally {
      setLoading(false);
    }
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
      {/* Data Quality Section */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Data Quality Analysis</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Overall Quality Score</h3>
            <div className="flex items-center justify-center h-48">
              <div className="text-center">
                <div className="text-6xl font-bold text-primary">{qualityData.overallScore}%</div>
                <p className="text-muted-foreground mt-2">Average Quality</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold mb-4">Quality Score Distribution</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={qualityData.qualityDistribution}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                >
                  {qualityData.qualityDistribution.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>

        <Card className="p-6 mt-4">
          <h3 className="font-semibold mb-4">Field Completeness</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={qualityData.fieldCompleteness}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="percentage" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* NPT Analysis Section */}
      <div>
        <h2 className="text-xl font-semibold mb-4">NPT Analysis</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">NPT Hours by System</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={nptData.bySystem} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={120} />
                <Tooltip />
                <Bar dataKey="hours" fill="#0088FE" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold mb-4">NPT Hours by Root Cause</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={nptData.byRootCause} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={150} />
                <Tooltip />
                <Bar dataKey="hours" fill="#00C49F" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold mb-4">NPT Hours by Department</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={nptData.byDepartment}
                  dataKey="hours"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {nptData.byDepartment.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default NPTAnalysisView;
