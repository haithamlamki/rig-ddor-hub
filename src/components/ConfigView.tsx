import { useState } from "react";
import { Plus, Save, Trash2, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface RigConfig {
  rigNumber: string;
  sheetName: string;
  dateColumn: string;
  depthColumn: string;
  operationColumn: string;
  dataStartRow: string;
  dataEndRow: string;
  notes: string;
}

const RIGS = [
  "103", "104", "105", "106", "107", "108", "109", "110", "111", "112",
  "201", "202", "203", "204", "205", "206", "207", "208", "209", "210", "211",
  "301", "302", "303", "304", "305", "306",
  "Hoist 1", "Hoist 2", "Hoist 3", "Hoist 4", "Hoist 5"
];

const DEFAULT_CONFIG: Omit<RigConfig, 'rigNumber'> = {
  sheetName: "DAILY DRILLING REPORT",
  dateColumn: "B11",
  depthColumn: "H11",
  operationColumn: "A54:K100",
  dataStartRow: "54",
  dataEndRow: "100",
  notes: "",
};

// Generate configs for all rigs
const generateAllConfigs = (): RigConfig[] => {
  return RIGS.map(rig => ({
    rigNumber: rig,
    ...DEFAULT_CONFIG,
    notes: rig === "211" ? "Standard WJO configuration with motor BHA details" :
           rig === "206" ? "Oxy configuration with RSS BHA setup" : "",
  }));
};

const ConfigView = () => {
  const [configs, setConfigs] = useState<RigConfig[]>(generateAllConfigs());
  const [selectedRig, setSelectedRig] = useState<string>(RIGS[0]);
  const { toast } = useToast();

  const currentConfig = configs.find((c) => c.rigNumber === selectedRig);

  const handleConfigUpdate = (field: keyof RigConfig, value: string) => {
    setConfigs((prev) =>
      prev.map((config) =>
        config.rigNumber === selectedRig ? { ...config, [field]: value } : config
      )
    );
  };

  const handleSaveConfig = () => {
    toast({
      title: "Configuration Saved",
      description: `Settings for Rig ${selectedRig} have been updated successfully.`,
    });
  };

  const handleResetConfig = () => {
    if (!confirm(`Reset Rig ${selectedRig} to default configuration?`)) {
      return;
    }

    setConfigs((prev) =>
      prev.map((c) =>
        c.rigNumber === selectedRig
          ? { ...c, ...DEFAULT_CONFIG }
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
                <CardDescription>Define data extraction rules and mappings</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleResetConfig} variant="outline" size="sm" className="gap-2">
                  <Trash2 className="h-4 w-4" />
                  Reset
                </Button>
                <Button onClick={handleSaveConfig} size="sm" className="gap-2">
                  <Save className="h-4 w-4" />
                  Save
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {currentConfig ? (
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="basic">Basic Settings</TabsTrigger>
                  <TabsTrigger value="advanced">Advanced Mapping</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-6 pt-6">
                  <div className="space-y-2">
                    <Label htmlFor="sheetName">Excel Sheet Name</Label>
                    <Input
                      id="sheetName"
                      value={currentConfig.sheetName}
                      onChange={(e) => handleConfigUpdate("sheetName", e.target.value)}
                      placeholder="e.g., DAILY DRILLING REPORT"
                    />
                    <p className="text-xs text-muted-foreground">
                      The name of the worksheet to extract data from
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="dateColumn">Date Cell</Label>
                      <Input
                        id="dateColumn"
                        value={currentConfig.dateColumn}
                        onChange={(e) => handleConfigUpdate("dateColumn", e.target.value)}
                        placeholder="e.g., B11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="depthColumn">Depth Cell</Label>
                      <Input
                        id="depthColumn"
                        value={currentConfig.depthColumn}
                        onChange={(e) => handleConfigUpdate("depthColumn", e.target.value)}
                        placeholder="e.g., H11"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Configuration Notes</Label>
                    <Textarea
                      id="notes"
                      value={currentConfig.notes}
                      onChange={(e) => handleConfigUpdate("notes", e.target.value)}
                      placeholder="Add notes about this rig's configuration..."
                      rows={4}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="advanced" className="space-y-6 pt-6">
                  <div className="space-y-2">
                    <Label htmlFor="operationColumn">Operations Data Range</Label>
                    <Input
                      id="operationColumn"
                      value={currentConfig.operationColumn}
                      onChange={(e) => handleConfigUpdate("operationColumn", e.target.value)}
                      placeholder="e.g., A54:K100"
                    />
                    <p className="text-xs text-muted-foreground">
                      Cell range containing daily operations table
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="dataStartRow">Data Start Row</Label>
                      <Input
                        id="dataStartRow"
                        value={currentConfig.dataStartRow}
                        onChange={(e) => handleConfigUpdate("dataStartRow", e.target.value)}
                        placeholder="e.g., 54"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="dataEndRow">Data End Row</Label>
                      <Input
                        id="dataEndRow"
                        value={currentConfig.dataEndRow}
                        onChange={(e) => handleConfigUpdate("dataEndRow", e.target.value)}
                        placeholder="e.g., 100"
                      />
                    </div>
                  </div>

                  <div className="rounded-lg bg-muted p-4">
                    <h4 className="text-sm font-semibold text-foreground mb-2">Extraction Preview</h4>
                    <div className="space-y-1 text-sm text-muted-foreground font-mono">
                      <p>Sheet: {currentConfig.sheetName}</p>
                      <p>Date from: {currentConfig.dateColumn}</p>
                      <p>Depth from: {currentConfig.depthColumn}</p>
                      <p>Operations: {currentConfig.operationColumn}</p>
                      <p>Rows: {currentConfig.dataStartRow} to {currentConfig.dataEndRow}</p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
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
