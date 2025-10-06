import { useState } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Settings2, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
interface UploadedFile {
  file: File;
  rig: string;
  status: "pending" | "processing" | "success" | "error";
  recordCount?: number;
}

interface UploadViewProps {
  onConfigClick: (rig: string) => void;
  selectedDate: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
}

const RIGS = [
  "103", "104", "105", "106", "107", "108", "109", "110", "111", "112",
  "201", "202", "203", "204", "205", "206", "207", "208", "209", "210", "211",
  "301", "302", "303", "304", "305", "306",
  "Hoist 1", "Hoist 2", "Hoist 3", "Hoist 4", "Hoist 5"
];

const UploadView = ({ onConfigClick, selectedDate, onDateChange }: UploadViewProps) => {
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
      // Read Excel file
      const data = await uploadedFile.file.arrayBuffer();
      const workbook = XLSX.read(data);
      
      // Convert first sheet to JSON
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const sheetData = XLSX.utils.sheet_to_json(worksheet);

      // Call AI edge function to extract data
      const { data: result, error: fnError } = await supabase.functions.invoke('extract-sheet-data', {
        body: {
          sheetData,
          rig: uploadedFile.rig,
          fileDate: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : undefined,
        },
      });

      if (fnError) {
        throw new Error(fnError.message || 'Failed to process file');
      }

      if (!result?.success) {
        throw new Error((result as any)?.error || 'Failed to extract data');
      }

      const recordCount = 1; // we insert a single consolidated row per file/rig

      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.file === uploadedFile.file
            ? { ...f, status: "success", recordCount }
            : f
        )
      );

      toast({
        title: "File Processed",
        description: `AI extracted ${recordCount} records from ${uploadedFile.file.name}`,
      });
    } catch (error) {
      console.error("Error processing file:", error);
      
      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.file === uploadedFile.file ? { ...f, status: "error" } : f
        )
      );

      toast({
        title: "Processing Error",
        description: error instanceof Error ? error.message : `Failed to process ${uploadedFile.file.name}`,
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
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-3xl font-bold text-foreground mb-2">Upload DDOR Files</h2>
            <p className="text-muted-foreground">
              Upload Excel files for each rig
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">File Date:</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[240px] justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={onDateChange}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {RIGS.map((rig) => {
          const rigFiles = uploadedFiles.filter((f) => f.rig === rig);
          const successCount = rigFiles.filter((f) => f.status === "success").length;
          
          return (
            <Card key={rig} className="shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3 w-32 flex-shrink-0">
                    <CardTitle className="text-base">Rig {rig}</CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onConfigClick(rig)}
                      className="h-7 w-7"
                    >
                      <Settings2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex-1">
                    <div className="border-2 border-dashed border-border rounded-lg px-6 py-3 text-center hover:border-primary transition-colors">
                      <input
                        type="file"
                        id={`file-upload-${rig}`}
                        multiple
                        accept=".xlsx,.xls"
                        onChange={(e) => handleFileUpload(rig, e)}
                        className="hidden"
                      />
                      <label htmlFor={`file-upload-${rig}`} className="cursor-pointer flex items-center justify-center gap-3">
                        <Upload className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            Drop files here
                          </p>
                          <p className="text-xs text-muted-foreground">or click to browse</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {rigFiles.length > 0 && (
                    <div className="w-64 flex-shrink-0">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                        <span>{rigFiles.length} file(s)</span>
                        <span>{successCount} processed</span>
                      </div>
                      <div className="space-y-1 max-h-20 overflow-y-auto">
                        {rigFiles.map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between text-xs bg-muted/50 rounded p-1.5"
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
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default UploadView;
