import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";

interface RigRate {
  rig_number: string;
  operation_hr_rate: number | null;
  reduce_hr_rate: number | null;
  standby_hr_rate: number | null;
  zero_hr_rate: number | null;
  repair_hr_rate: number | null;
  annual_maintenance_hr_rate: number | null;
  special_hr_rate: number | null;
  force_majeure_hr_rate: number | null;
  stacking_hr_rate: number | null;
  rig_move_hr_rate: number | null;
  rig_move_times: number | null;
  fuel_operation_day_rate_usd: number | null;
  fuel_reduce_day_rate_usd: number | null;
  fuel_zero_day_rate_usd: number | null;
  fuel_repair_day_rate_usd: number | null;
  fuel_special_day_rate_usd: number | null;
  obm_operation_day_rate_usd: number | null;
  obm_reduce_day_rate_usd: number | null;
  obm_zero_day_rate_usd: number | null;
  obm_repair_day_rate_usd: number | null;
}

const RateModule = () => {
  const [rates, setRates] = useState<RigRate[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchRates();
  }, []);

  const fetchRates = async () => {
    try {
      const { data, error } = await supabase
        .from("rig_rates")
        .select("*")
        .order("rig_number");

      if (error) throw error;
      setRates(data || []);
    } catch (error) {
      console.error("Error fetching rates:", error);
      toast({
        title: "Error",
        description: "Failed to load rig rates",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === 0) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-6 py-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-foreground">Rig Rates</h1>
        <p className="text-muted-foreground mt-2">
          View hourly and daily rates for all rigs
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-semibold sticky left-0 bg-card z-10">Rig</TableHead>
                <TableHead className="font-semibold">Operation Hr Rate</TableHead>
                <TableHead className="font-semibold">Reduce Hr Rate</TableHead>
                <TableHead className="font-semibold">Standby Hr Rate</TableHead>
                <TableHead className="font-semibold">Zero Hr Rate</TableHead>
                <TableHead className="font-semibold">Repair Hr Rate</TableHead>
                <TableHead className="font-semibold">Annual Maintenance Hr Rate</TableHead>
                <TableHead className="font-semibold">Special Hr Rate</TableHead>
                <TableHead className="font-semibold">Force Majeure Hr Rate</TableHead>
                <TableHead className="font-semibold">STACKING Hr Rate</TableHead>
                <TableHead className="font-semibold">Rig Move Hr Rate</TableHead>
                <TableHead className="font-semibold">Rig Move Times</TableHead>
                <TableHead className="font-semibold">Fuel Operation Day Rate USD</TableHead>
                <TableHead className="font-semibold">Fuel Reduce Day Rate USD</TableHead>
                <TableHead className="font-semibold">Fuel Zero Day Rate USD</TableHead>
                <TableHead className="font-semibold">Fuel Repair Day Rate USD</TableHead>
                <TableHead className="font-semibold">Fuel Special Day Rate USD</TableHead>
                <TableHead className="font-semibold">OBM Operation Day Rate USD</TableHead>
                <TableHead className="font-semibold">OBM Reduce Day Rate USD</TableHead>
                <TableHead className="font-semibold">OBM Zero Day Rate USD</TableHead>
                <TableHead className="font-semibold">OBM Repair Day Rate USD</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.map((rate) => (
                <TableRow key={rate.rig_number}>
                  <TableCell className="font-medium sticky left-0 bg-card">{rate.rig_number}</TableCell>
                  <TableCell>{formatCurrency(rate.operation_hr_rate)}</TableCell>
                  <TableCell>{formatCurrency(rate.reduce_hr_rate)}</TableCell>
                  <TableCell>{formatCurrency(rate.standby_hr_rate)}</TableCell>
                  <TableCell>{formatCurrency(rate.zero_hr_rate)}</TableCell>
                  <TableCell>{formatCurrency(rate.repair_hr_rate)}</TableCell>
                  <TableCell>{formatCurrency(rate.annual_maintenance_hr_rate)}</TableCell>
                  <TableCell>{formatCurrency(rate.special_hr_rate)}</TableCell>
                  <TableCell>{formatCurrency(rate.force_majeure_hr_rate)}</TableCell>
                  <TableCell>{formatCurrency(rate.stacking_hr_rate)}</TableCell>
                  <TableCell>{formatCurrency(rate.rig_move_hr_rate)}</TableCell>
                  <TableCell>{rate.rig_move_times || "-"}</TableCell>
                  <TableCell>{formatCurrency(rate.fuel_operation_day_rate_usd)}</TableCell>
                  <TableCell>{formatCurrency(rate.fuel_reduce_day_rate_usd)}</TableCell>
                  <TableCell>{formatCurrency(rate.fuel_zero_day_rate_usd)}</TableCell>
                  <TableCell>{formatCurrency(rate.fuel_repair_day_rate_usd)}</TableCell>
                  <TableCell>{formatCurrency(rate.fuel_special_day_rate_usd)}</TableCell>
                  <TableCell>{formatCurrency(rate.obm_operation_day_rate_usd)}</TableCell>
                  <TableCell>{formatCurrency(rate.obm_reduce_day_rate_usd)}</TableCell>
                  <TableCell>{formatCurrency(rate.obm_zero_day_rate_usd)}</TableCell>
                  <TableCell>{formatCurrency(rate.obm_repair_day_rate_usd)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};

export default RateModule;
