import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import NPTUploadView from "@/components/NPTUploadView";
import NPTDashboardView from "@/components/NPTDashboardView";
import NPTAnalysisView from "@/components/NPTAnalysisView";

const NPTModule = () => {
  const [activeTab, setActiveTab] = useState("upload");

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">NPT Module</h1>
        <p className="text-muted-foreground mt-2">
          Upload, manage, and analyze Non-Productive Time records
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <NPTUploadView />
        </TabsContent>

        <TabsContent value="dashboard">
          <NPTDashboardView />
        </TabsContent>

        <TabsContent value="analysis">
          <NPTAnalysisView />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NPTModule;
