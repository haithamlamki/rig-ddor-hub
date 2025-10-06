import { AppLayout } from "@/components/AppLayout";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

const MainDashboard = () => {
  const navigate = useNavigate();

  // Redirect to DDOR by default
  useEffect(() => {
    navigate("/ddor");
  }, [navigate]);

  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-8">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-foreground mb-2">Welcome to Operation Data Hub</h2>
          <p className="text-muted-foreground">Select a subsystem from the sidebar to get started</p>
        </div>
      </div>
    </AppLayout>
  );
};

export default MainDashboard;
