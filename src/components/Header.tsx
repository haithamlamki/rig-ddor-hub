import { Database, Upload, Settings, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  activeView: "upload" | "dashboard" | "config" | "npt";
  onViewChange: (view: "upload" | "dashboard" | "config" | "npt") => void;
}

const Header = ({ activeView, onViewChange }: HeaderProps) => {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card shadow-sm">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-glow shadow-primary">
              <Database className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Operation Data Hub</h1>
              <p className="text-sm text-muted-foreground">Drilling Operations Management System</p>
            </div>
          </div>
          
          <nav className="flex gap-2">
            <Button
              variant={activeView === "upload" ? "default" : "ghost"}
              onClick={() => onViewChange("upload")}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              Upload
            </Button>
            <Button
              variant={activeView === "dashboard" ? "default" : "ghost"}
              onClick={() => onViewChange("dashboard")}
              className="gap-2"
            >
              <Database className="h-4 w-4" />
              Dashboard
            </Button>
            <Button
              variant={activeView === "config" ? "default" : "ghost"}
              onClick={() => onViewChange("config")}
              className="gap-2"
            >
              <Settings className="h-4 w-4" />
              Config
            </Button>
            <Button
              variant={activeView === "npt" ? "default" : "ghost"}
              onClick={() => onViewChange("npt")}
              className="gap-2"
            >
              <AlertTriangle className="h-4 w-4" />
              NPT
            </Button>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;
