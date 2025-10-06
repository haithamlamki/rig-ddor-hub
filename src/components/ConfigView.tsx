import { useState, useEffect } from "react";
import { Save, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Table as DataTable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

interface ColumnMapping {
  columnName: string;
  cellReference: string;
  isFixedData: boolean;
  fixedValue: string;
}

interface RigConfig {
  rigNumber: string;
  sheetName: string;
  columnMappings: ColumnMapping[];
}

const COLUMNS = [
  "Date",
  "Rig",
  "Client",
  "Operation Hr",
  "Reduce Hr",
  "Standby Hr",
  "Zero Hr",
  "Repair Hr",
  "AM Hr",
  "Special Hr",
  "Force Majeure Hr",
  "STACKING Hr",
  "Rig Move Hr",
  "Not Received DDOR",
  "Total Hr.s",
  "Remarks"
];

const RIGS = [
  "103", "104", "105", "106", "107", "108", "109", "110", "111", "112",
  "201", "202", "203", "204", "205", "206", "207", "208", "209", "210", "211",
  "301", "302", "303", "304", "305", "306",
  "Hoist 1", "Hoist 2", "Hoist 3", "Hoist 4", "Hoist 5"
];

const DEFAULT_MAPPINGS: ColumnMapping[] = COLUMNS.map(col => ({
  columnName: col,
  cellReference: "",
  isFixedData: false,
  fixedValue: ""
}));

const generateAllConfigs = (): RigConfig[] => {
  return RIGS.map(rig => ({
    rigNumber: rig,
    sheetName: "DAILY DRILLING REPORT",
    columnMappings: DEFAULT_MAPPINGS.map(m => ({ ...m }))
  }));
};

const ConfigView = () => {
  const [configs, setConfigs] = useState<RigConfig[]>(generateAllConfigs());
  const [selectedRig, setSelectedRig] = useState<string>(RIGS[0]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Load configurations from database
  useEffect(() => {
    const loadConfigs = async () => {
      try {
        const { data, error } = await supabase
          .from('rig_configs')
          .select('*');

        if (error) throw error;

        if (data && data.length > 0) {
          const loadedConfigs = RIGS.map(rigNumber => {
            const savedConfig = data.find(d => d.rig_number === rigNumber);
            if (savedConfig && savedConfig.column_mappings) {
              return {
                rigNumber,
                sheetName: savedConfig.sheet_name,
                columnMappings: Array.isArray(savedConfig.column_mappings) 
                  ? savedConfig.column_mappings as unknown as ColumnMapping[]
                  : DEFAULT_MAPPINGS.map(m => ({ ...m }))
              };
            }
            return {
              rigNumber,
              sheetName: "DAILY DRILLING REPORT",
              columnMappings: DEFAULT_MAPPINGS.map(m => ({ ...m }))
            };
          });
          setConfigs(loadedConfigs);
        }
      } catch (error) {
        console.error('Error loading configs:', error);
        toast({
          title: "Error",
          description: "Failed to load configurations",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    loadConfigs();
  }, []);

  const currentConfig = configs.find((c) => c.rigNumber === selectedRig);

  const handleSheetNameUpdate = (value: string) => {
    setConfigs((prev) =>
      prev.map((config) =>
        config.rigNumber === selectedRig ? { ...config, sheetName: value } : config
      )
    );
  };

  const handleMappingUpdate = (columnName: string, cellReference: string) => {
    setConfigs((prev) =>
      prev.map((config) =>
        config.rigNumber === selectedRig
          ? {
              ...config,
              columnMappings: config.columnMappings.map((m) =>
                m.columnName === columnName ? { ...m, cellReference } : m
              ),
            }
          : config
      )
    );
  };

  const handleFixedDataToggle = (columnName: string, isChecked: boolean) => {
    setConfigs((prev) =>
      prev.map((config) =>
        config.rigNumber === selectedRig
          ? {
              ...config,
              columnMappings: config.columnMappings.map((m) =>
                m.columnName === columnName ? { ...m, isFixedData: isChecked } : m
              ),
            }
          : config
      )
    );
  };

  const handleFixedValueUpdate = (columnName: string, fixedValue: string) => {
    setConfigs((prev) =>
      prev.map((config) =>
        config.rigNumber === selectedRig
          ? {
              ...config,
              columnMappings: config.columnMappings.map((m) =>
                m.columnName === columnName ? { ...m, fixedValue } : m
              ),
            }
          : config
      )
    );
  };

  const handleSaveConfig = async () => {
    if (!currentConfig) return;

    try {
      const { error } = await supabase
        .from('rig_configs')
        .upsert({
          rig_number: selectedRig,
          sheet_name: currentConfig.sheetName,
          column_mappings: currentConfig.columnMappings as any
        }, {
          onConflict: 'rig_number'
        });

      if (error) throw error;

      toast({
        title: "Configuration Saved",
        description: `Settings for Rig ${selectedRig} have been updated successfully.`,
      });
    } catch (error) {
      console.error('Error saving config:', error);
      toast({
        title: "Error",
        description: "Failed to save configuration",
        variant: "destructive"
      });
    }
  };

  const handleResetConfig = () => {
    if (!confirm(`Reset Rig ${selectedRig} to default configuration?`)) {
      return;
    }

    setConfigs((prev) =>
      prev.map((c) =>
        c.rigNumber === selectedRig
          ? {
              rigNumber: c.rigNumber,
              sheetName: "DAILY DRILLING REPORT",
              columnMappings: DEFAULT_MAPPINGS.map(m => ({ ...m }))
            }
          : c
      )
    );
    
    toast({
      title: "Configuration Reset",
      description: `Rig ${selectedRig} has been reset to default settings.`,
    });
  };

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-foreground mb-2">Rig Configuration</h2>
        <p className="text-muted-foreground">
          Manage extraction settings for each rig's DDOR files
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Rig Selection</CardTitle>
            <CardDescription>Choose a rig to configure</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedRig} onValueChange={setSelectedRig}>
              <SelectTrigger>
                <SelectValue placeholder="Select rig..." />
              </SelectTrigger>
              <SelectContent className="bg-card max-h-[300px]">
                {configs.map((config) => (
                  <SelectItem key={config.rigNumber} value={config.rigNumber}>
                    Rig {config.rigNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="pt-4 border-t border-border">
              <h3 className="text-sm font-semibold mb-3 text-foreground">Configured Rigs</h3>
              <div className="space-y-1 max-h-[400px] overflow-y-auto">{configs.map((config) => (
                  <div
                    key={config.rigNumber}
                    className={`p-2 rounded-lg border cursor-pointer transition-colors ${
                      config.rigNumber === selectedRig
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:bg-muted/50"
                    }`}
                    onClick={() => setSelectedRig(config.rigNumber)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">Rig {config.rigNumber}</span>
                      <Settings2 className="h-3 w-3" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Rig {selectedRig} Configuration</CardTitle>
                <CardDescription>Define column mappings for data extraction</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleResetConfig} variant="outline" size="sm" className="gap-2">
                  Reset
                </Button>
                <Button onClick={handleSaveConfig} size="sm" className="gap-2">
                  <Save className="h-4 w-4" />
                  Save
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="py-12 text-center text-muted-foreground">
                <p>Loading configurations...</p>
              </div>
            ) : currentConfig ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="sheetName">Excel Sheet Name</Label>
                  <Input
                    id="sheetName"
                    value={currentConfig.sheetName}
                    onChange={(e) => handleSheetNameUpdate(e.target.value)}
                    placeholder="e.g., DAILY DRILLING REPORT"
                  />
                  <p className="text-xs text-muted-foreground">
                    The name of the worksheet to extract data from
                  </p>
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">Column Mappings</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Specify the Excel cell reference for each column
                  </p>
                  <div className="rounded-lg border border-border overflow-hidden">
                    <DataTable>
                      <TableHeader>
                        <TableRow className="bg-primary/90">
                          <TableHead className="font-semibold text-primary-foreground w-1/3">Column Name</TableHead>
                          <TableHead className="font-semibold text-primary-foreground">Cell Reference</TableHead>
                          <TableHead className="font-semibold text-primary-foreground text-center w-32">Fixed Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentConfig.columnMappings.map((mapping) => (
                          <TableRow key={mapping.columnName}>
                            <TableCell className="font-medium">{mapping.columnName}</TableCell>
                            <TableCell>
                              {mapping.isFixedData ? (
                                <Input
                                  value={mapping.fixedValue}
                                  onChange={(e) => handleFixedValueUpdate(mapping.columnName, e.target.value)}
                                  placeholder="Enter fixed value"
                                  className="max-w-xs"
                                />
                              ) : (
                                <Input
                                  value={mapping.cellReference}
                                  onChange={(e) => handleMappingUpdate(mapping.columnName, e.target.value)}
                                  placeholder="e.g., B11, A54:K100"
                                  className="max-w-xs"
                                />
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center">
                                <Checkbox
                                  checked={mapping.isFixedData}
                                  onCheckedChange={(checked) => 
                                    handleFixedDataToggle(mapping.columnName, checked === true)
                                  }
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </DataTable>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                <p>No rig configuration selected</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ConfigView;
