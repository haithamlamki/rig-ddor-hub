import { useState } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

interface UploadedFile {
  file: File;
  rig: string;
  status: "pending" | "processing" | "success" | "error";
  recordCount?: number;
}

interface UploadViewProps {
  onConfigClick: (rig: string) => void;
}

const RIGS = [
  "103", "104", "105", "106", "107", "108", "109", "110", "111", "112",
  "201", "202", "203", "204", "205", "206", "207", "208", "209", "210", "211",
  "301", "302", "303", "304", "305", "306",
  "Hoist 1", "Hoist 2", "Hoist 3", "Hoist 4", "Hoist 5"
];

const UploadView = ({ onConfigClick }: UploadViewProps) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const { toast } = useToast();

  const handleFileUpload = async (rig: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newFiles: UploadedFile[] = Array.from(files).map((file) => ({
      file,
      rig,
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
          Upload Excel files for each rig
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {RIGS.map((rig) => {
          const rigFiles = uploadedFiles.filter((f) => f.rig === rig);
          const successCount = rigFiles.filter((f) => f.status === "success").length;
          
          return (
            <Card key={rig} className="shadow-md hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Rig {rig}</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onConfigClick(rig)}
                    className="h-8 w-8"
                  >
                    <Settings2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary transition-colors">
                  <input
                    type="file"
                    id={`file-upload-${rig}`}
                    multiple
                    accept=".xlsx,.xls"
                    onChange={(e) => handleFileUpload(rig, e)}
                    className="hidden"
                  />
                  <label htmlFor={`file-upload-${rig}`} className="cursor-pointer">
                    <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-xs font-medium text-foreground mb-1">
                      Drop files here
                    </p>
                    <p className="text-xs text-muted-foreground">or click to browse</p>
                  </label>
                </div>

                {rigFiles.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{rigFiles.length} file(s)</span>
                      <span>{successCount} processed</span>
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {rigFiles.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between text-xs bg-muted/50 rounded p-2"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <FileSpreadsheet className="h-3 w-3 text-primary flex-shrink-0" />
                            <span className="truncate">{file.file.name}</span>
                          </div>
                          <div className="flex-shrink-0 ml-2">
                            {getStatusIcon(file.status)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default UploadView;
