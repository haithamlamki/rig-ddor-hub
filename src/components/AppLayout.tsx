import { PropsWithChildren } from "react";
import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "./AppSidebar";

const AppLayout = ({ children }: PropsWithChildren) => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur">
            <div className="container mx-auto px-4 h-12 flex items-center gap-2">
              <SidebarTrigger />
              <span className="text-sm text-muted-foreground">Subsystems</span>
            </div>
          </header>
          <main className="flex-1">
            {children ?? <Outlet />}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;
