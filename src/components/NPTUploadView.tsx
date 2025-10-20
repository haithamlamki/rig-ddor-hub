import { useState } from "react";
import { Upload, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const RIGS = ["103", "104", "105", "106", "107", "108", "109", "110", "111", "112", "201", "202", "203", "204", "205", "206", "207", "208", "209", "210", "211", "301", "302", "303", "304", "305", "306"];

interface UploadedFile {
  rigNumber: string;
  file: File | null;
  status: "idle" | "processing" | "success" | "error";
  message?: string;
  recordsProcessed?: number;
  qualityScore?: number;
}

const NPTUploadView = () => {
  const { toast } = useToast();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>(
    RIGS.map((rig) => ({ rigNumber: rig, file: null, status: "idle" }))
  );
  const [dragOver, setDragOver] = useState<string | null>(null);

  const handleFileSelect = (rigNumber: string, file: File) => {
    setUploadedFiles((prev) =>
      prev.map((item) =>
        item.rigNumber === rigNumber
          ? { ...item, file, status: "idle", message: undefined }
          : item
      )
    );
  };

  const processFile = async (rigNumber: string, file: File) => {
    setUploadedFiles((prev) =>
      prev.map((item) =>
        item.rigNumber === rigNumber ? { ...item, status: "processing" } : item
      )
    );

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("rigNumber", rigNumber);

      const { data, error } = await supabase.functions.invoke("extract-npt-data", {
        body: formData,
      });

      if (error) throw error;

      setUploadedFiles((prev) =>
        prev.map((item) =>
          item.rigNumber === rigNumber
            ? {
                ...item,
                status: "success",
                message: `Processed ${data.recordsProcessed} records`,
                recordsProcessed: data.recordsProcessed,
                qualityScore: Math.round(data.averageQualityScore),
              }
            : item
        )
      );

      toast({
        title: "Upload Successful",
        description: `Rig ${rigNumber}: ${data.recordsProcessed} records processed with ${Math.round(data.averageQualityScore)}% avg quality`,
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      setUploadedFiles((prev) =>
        prev.map((item) =>
          item.rigNumber === rigNumber
            ? { ...item, status: "error", message: error.message || "Upload failed" }
            : item
        )
      );

      toast({
        title: "Upload Failed",
        description: `Rig ${rigNumber}: ${error.message || "Unknown error"}`,
        variant: "destructive",
      });
    }
  };

  const handleUploadAll = async () => {
    const filesToUpload = uploadedFiles.filter((item) => item.file && item.status !== "success");

    for (const item of filesToUpload) {
      if (item.file) {
        await processFile(item.rigNumber, item.file);
      }
    }
  };

  const getStatusIcon = (status: UploadedFile["status"]) => {
    switch (status) {
      case "processing":
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "error":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">NPT Data Upload</h2>
          <p className="text-muted-foreground mt-1">Upload NPT Excel sheets for one or multiple rigs</p>
        </div>
        <Button
          onClick={handleUploadAll}
          disabled={!uploadedFiles.some((item) => item.file && item.status !== "success")}
        >
          Upload All
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {uploadedFiles.map((item) => (
          <Card
            key={item.rigNumber}
            className={`p-4 transition-all ${
              dragOver === item.rigNumber ? "border-primary bg-primary/5" : ""
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(item.rigNumber);
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(null);
              const file = e.dataTransfer.files[0];
              if (file && file.name.endsWith(".xlsx")) {
                handleFileSelect(item.rigNumber, file);
              }
            }}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Rig {item.rigNumber}</h3>
                {getStatusIcon(item.status)}
              </div>

              {!item.file ? (
                <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary transition-colors">
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">Drop file or click</span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".xlsx"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(item.rigNumber, file);
                    }}
                  />
                </label>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm truncate" title={item.file.name}>
                    {item.file.name}
                  </p>
                  {item.status === "idle" && (
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => processFile(item.rigNumber, item.file!)}
                    >
                      Upload
                    </Button>
                  )}
                  {item.message && (
                    <p className="text-xs text-muted-foreground">{item.message}</p>
                  )}
                  {item.qualityScore !== undefined && (
                    <div className="text-xs">
                      Quality Score: <span className="font-semibold">{item.qualityScore}%</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default NPTUploadView;
