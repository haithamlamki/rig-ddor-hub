import { useState } from "react";
import Header from "@/components/Header";
import UploadView from "@/components/UploadView";
import DashboardView from "@/components/DashboardView";
import ConfigView from "@/components/ConfigView";

const Index = () => {
  const [activeView, setActiveView] = useState<"upload" | "dashboard" | "config">("upload");

  return (
    <div className="min-h-screen bg-background">
      <Header activeView={activeView} onViewChange={setActiveView} />
      
      <main>
        {activeView === "upload" && <UploadView />}
        {activeView === "dashboard" && <DashboardView />}
        {activeView === "config" && <ConfigView />}
      </main>

      <footer className="border-t border-border bg-card mt-12">
        <div className="container mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © 2025 DDOR DataHub. All rights reserved.
            </p>
            <p className="text-sm text-muted-foreground">
              Drilling Operations Reporting System v1.0
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
