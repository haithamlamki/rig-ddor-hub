import { Database, FileSpreadsheet, AlertTriangle, Settings } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

const MainDashboard = () => {
  const navigate = useNavigate();

  const subsystems = [
    {
      title: "DDOR DataHub",
      description: "Drilling Daily Operations Reporting System",
      icon: FileSpreadsheet,
      route: "/ddor",
      color: "from-primary to-primary-glow"
    },
    {
      title: "NPT Module",
      description: "Non-Productive Time Analysis and Reporting",
      icon: AlertTriangle,
      route: "/npt",
      color: "from-orange-500 to-orange-600"
    },
    {
      title: "Configuration",
      description: "System Settings and Configuration",
      icon: Settings,
      route: "/config",
      color: "from-slate-500 to-slate-600"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card shadow-sm">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-glow shadow-lg">
              <Database className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Operation Data Hub</h1>
              <p className="text-sm text-muted-foreground">Integrated Operations Management System</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-foreground mb-2">Subsystems</h2>
          <p className="text-muted-foreground">Select a subsystem to access its features</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subsystems.map((subsystem) => {
            const Icon = subsystem.icon;
            return (
              <Card 
                key={subsystem.route}
                className="cursor-pointer transition-all hover:shadow-lg hover:scale-105"
                onClick={() => navigate(subsystem.route)}
              >
                <CardHeader>
                  <div className={`flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br ${subsystem.color} shadow-md mb-4`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-xl">{subsystem.title}</CardTitle>
                  <CardDescription>{subsystem.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-primary hover:underline">Access Module →</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>

      <footer className="border-t border-border bg-card mt-12">
        <div className="container mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © 2025 Operation Data Hub. All rights reserved.
            </p>
            <p className="text-sm text-muted-foreground">
              Integrated Operations Management System v1.0
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default MainDashboard;
