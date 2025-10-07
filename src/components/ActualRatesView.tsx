import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

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

const ActualRatesView = () => {
  const [rates, setRates] = useState<ActualRate[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadExcelData();
  }, []);

  const loadExcelData = async () => {
    try {
      const response = await fetch("/data/Rates.xlsx");
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

      // Skip header row and parse data
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
      })).filter(rate => rate.rig); // Filter out empty rows

      setRates(parsedRates);
    } catch (error) {
      console.error("Error loading Excel data:", error);
      toast({
        title: "Error",
        description: "Failed to load actual rates data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-foreground">Actual Rates</h2>
        <p className="text-muted-foreground mt-2">
          Contract rates for all rigs from Excel file
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-semibold sticky left-0 bg-card z-10">No</TableHead>
                <TableHead className="font-semibold">Rig</TableHead>
                <TableHead className="font-semibold">Material</TableHead>
                <TableHead className="font-semibold">Description</TableHead>
                <TableHead className="font-semibold">Contract Amount</TableHead>
                <TableHead className="font-semibold">Unit</TableHead>
                <TableHead className="font-semibold">USD Amount</TableHead>
                <TableHead className="font-semibold">OMR Amount</TableHead>
                <TableHead className="font-semibold">Per</TableHead>
                <TableHead className="font-semibold">Valid From</TableHead>
                <TableHead className="font-semibold">Valid To</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.map((rate, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium sticky left-0 bg-card">{rate.no}</TableCell>
                  <TableCell>{rate.rig}</TableCell>
                  <TableCell>{rate.material}</TableCell>
                  <TableCell>{rate.description}</TableCell>
                  <TableCell>{rate.contractAmount}</TableCell>
                  <TableCell>{rate.unit}</TableCell>
                  <TableCell>{rate.usdAmount}</TableCell>
                  <TableCell>{rate.omrAmount}</TableCell>
                  <TableCell>{rate.per}</TableCell>
                  <TableCell>{rate.validFrom}</TableCell>
                  <TableCell>{rate.validTo}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};

export default ActualRatesView;
