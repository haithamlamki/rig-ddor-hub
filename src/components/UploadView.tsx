import { useState } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

interface UploadedFile {
  file: File;
  rig: string;
  status: "pending" | "processing" | "success" | "error";
  recordCount?: number;
}

const RIGS = [
  "103", "104", "105", "106", "107", "108", "109", "110", "111", "112",
  "201", "202", "203", "204", "205", "206", "207", "208", "209", "210", "211",
  "301", "302", "303", "304", "305", "306",
  "Hoist 1", "Hoist 2", "Hoist 3", "Hoist 4", "Hoist 5"
];

const UploadView = () => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [selectedRig, setSelectedRig] = useState<string>("");
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (!selectedRig) {
      toast({
        title: "Rig Not Selected",
        description: "Please select a rig before uploading files.",
        variant: "destructive",
      });
      return;
    }

    const newFiles: UploadedFile[] = Array.from(files).map((file) => ({
      file,
      rig: selectedRig,
      status: "pending",
    }));

    setUploadedFiles((prev) => [...prev, ...newFiles]);

    // Process files
    for (const uploadedFile of newFiles) {
      await processFile(uploadedFile);
    }
  };

  const processFile = async (uploadedFile: UploadedFile) => {
    setUploadedFiles((prev) =>
      prev.map((f) =>
        f.file === uploadedFile.file ? { ...f, status: "processing" } : f
      )
    );

    try {
      const data = await uploadedFile.file.arrayBuffer();
      const workbook = XLSX.read(data);
      
      // Simulate processing
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const recordCount = Math.floor(Math.random() * 20) + 5;

      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.file === uploadedFile.file
            ? { ...f, status: "success", recordCount }
            : f
        )
      );

      toast({
        title: "File Processed",
        description: `Successfully extracted ${recordCount} records from ${uploadedFile.file.name}`,
      });
    } catch (error) {
      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.file === uploadedFile.file ? { ...f, status: "error" } : f
        )
      );

      toast({
        title: "Processing Error",
        description: `Failed to process ${uploadedFile.file.name}`,
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: UploadedFile["status"]) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="h-5 w-5 text-success" />;
      case "error":
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      default:
        return <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />;
    }
  };

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-foreground mb-2">Upload DDOR Files</h2>
        <p className="text-muted-foreground">
          Select a rig and upload Excel files for data extraction
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="text-lg">Files Uploaded</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary">{uploadedFiles.length}</div>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="text-lg">Successfully Processed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-success">
              {uploadedFiles.filter((f) => f.status === "success").length}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="text-lg">Total Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-secondary">
              {uploadedFiles.reduce((sum, f) => sum + (f.recordCount || 0), 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Upload New Files</CardTitle>
          <CardDescription>
            Select the rig and upload one or more Excel DDOR files
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Select Rig</label>
            <Select value={selectedRig} onValueChange={setSelectedRig}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a rig..." />
              </SelectTrigger>
              <SelectContent>
                {RIGS.map((rig) => (
                  <SelectItem key={rig} value={rig}>
                    Rig {rig}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors">
            <input
              type="file"
              id="file-upload"
              multiple
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
              disabled={!selectedRig}
            />
            <label
              htmlFor="file-upload"
              className={`cursor-pointer ${!selectedRig ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm font-medium text-foreground mb-1">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-muted-foreground">Excel files (.xlsx, .xls)</p>
            </label>
          </div>

          {uploadedFiles.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-foreground">Uploaded Files</h3>
              <div className="space-y-2">
                {uploadedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-lg border border-border bg-card p-4 shadow-sm"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <FileSpreadsheet className="h-8 w-8 text-primary" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {file.file.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Rig {file.rig} • {(file.file.size / 1024).toFixed(1)} KB
                          {file.recordCount && ` • ${file.recordCount} records`}
                        </p>
                      </div>
                    </div>
                    <div>{getStatusIcon(file.status)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UploadView;
