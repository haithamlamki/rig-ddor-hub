import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import Header from "@/components/Header";
import UploadView from "@/components/UploadView";
import DashboardView from "@/components/DashboardView";
import ConfigView from "@/components/ConfigView";

const DDORDataHub = () => {
  const [activeView, setActiveView] = useState<"upload" | "dashboard" | "config">("upload");
  const [selectedRig, setSelectedRig] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const handleConfigClick = (rig: string) => {
    setSelectedRig(rig);
    setActiveView("config");
  };

  return (
    <AppLayout>
      <div className="bg-background">
        <Header activeView={activeView} onViewChange={setActiveView} />
        
        <main>
          {activeView === "upload" && <UploadView onConfigClick={handleConfigClick} selectedDate={selectedDate} onDateChange={setSelectedDate} />}
          {activeView === "dashboard" && <DashboardView selectedDate={selectedDate} />}
          {activeView === "config" && <ConfigView />}
        </main>

        <footer className="border-t border-border bg-card mt-12">
          <div className="container mx-auto px-6 py-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                © 2025 Operation Data Hub. All rights reserved.
              </p>
              <p className="text-sm text-muted-foreground">
                Drilling Operations Reporting System v1.0
              </p>
            </div>
          </div>
        </footer>
      </div>
    </AppLayout>
  );
};

export default DDORDataHub;
