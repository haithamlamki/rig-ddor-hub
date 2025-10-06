import { useState } from "react";
import { Download, Filter, Search, Calendar, Building2 } from "lucide-react";
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

interface DashboardData {
  date: string;
  rig: string;
  client: string;
  operationHr: number;
  reduceHr: number;
  standbyHr: number;
  totalHrs: number;
  remarks: string;
}

const SAMPLE_DATA: DashboardData[] = [
  {
    date: "2025-10-05",
    rig: "211",
    client: "WJO",
    operationHr: 24.0,
    reduceHr: 0.0,
    standbyHr: 0.0,
    totalHrs: 24.0,
    remarks: "PJSM. Perform FIT at 7\" casing window. Trip out of hole with milling assy.",
  },
  {
    date: "2025-10-05",
    rig: "206",
    client: "Oxy",
    operationHr: 24.0,
    reduceHr: 0.0,
    standbyHr: 0.0,
    totalHrs: 24.0,
    remarks: "Drill 6 1/8\" lateral from 6750 ft to 8600 ft",
  },
  {
    date: "2025-10-04",
    rig: "211",
    client: "WJO",
    operationHr: 22.5,
    reduceHr: 1.5,
    standbyHr: 0.0,
    totalHrs: 24.0,
    remarks: "Continue drilling operations. BHA adjustment required.",
  },
  {
    date: "2025-10-04",
    rig: "206",
    client: "Oxy",
    operationHr: 23.0,
    reduceHr: 1.0,
    standbyHr: 0.0,
    totalHrs: 24.0,
    remarks: "RIH with RSS BHA. Pressure test completed successfully.",
  },
  {
    date: "2025-10-03",
    rig: "211",
    client: "WJO",
    operationHr: 24.0,
    reduceHr: 0.0,
    standbyHr: 0.0,
    totalHrs: 24.0,
    remarks: "Normal drilling operations. No NPT.",
  },
];

const DashboardView = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [data] = useState<DashboardData[]>(SAMPLE_DATA);

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
      ["Date", "Rig", "Client", "Operation Hr", "Reduce Hr", "Standby Hr", "Total Hrs", "Remarks"],
      ...filteredData.map((row) => [
        row.date,
        row.rig,
        row.client,
        row.operationHr,
        row.reduceHr,
        row.standbyHr,
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

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-foreground mb-2">Consolidated Dashboard</h2>
        <p className="text-muted-foreground">
          View and analyze data from all rigs in one place
        </p>
      </div>

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
            <div className="text-3xl font-bold text-success">{totalOperationHrs.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground mt-1">Total productive time</p>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Reduced Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-warning">{totalReduceHrs.toFixed(1)}</div>
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
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Date
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Rig
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold">Client</TableHead>
                  <TableHead className="font-semibold text-right">Op. Hrs</TableHead>
                  <TableHead className="font-semibold text-right">Red. Hrs</TableHead>
                  <TableHead className="font-semibold text-right">Stby Hrs</TableHead>
                  <TableHead className="font-semibold text-right">Total Hrs</TableHead>
                  <TableHead className="font-semibold">Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((row, index) => (
                  <TableRow key={index} className="hover:bg-muted/30">
                    <TableCell className="font-medium">{row.date}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {row.rig}
                      </Badge>
                    </TableCell>
                    <TableCell>{row.client}</TableCell>
                    <TableCell className="text-right text-success font-semibold">
                      {row.operationHr.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right text-warning font-semibold">
                      {row.reduceHr.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right">{row.standbyHr.toFixed(1)}</TableCell>
                    <TableCell className="text-right font-semibold">{row.totalHrs.toFixed(1)}</TableCell>
                    <TableCell className="max-w-md truncate" title={row.remarks}>
                      {row.remarks}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filteredData.length === 0 && (
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
