import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle } from "lucide-react";

const NPTView = () => {
  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <AlertTriangle className="h-8 w-8 text-orange-600" />
          <h1 className="text-3xl font-bold text-foreground">NPT Module</h1>
        </div>
        <p className="text-muted-foreground">Non-Productive Time Analysis and Reporting</p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Total NPT Hours</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-500">0.00</div>
                <p className="text-xs text-muted-foreground mt-1">All categories combined</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Repair Hours</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600 dark:text-red-500">0.00</div>
                <p className="text-xs text-muted-foreground mt-1">Maintenance time</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Standby Hours</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">0.00</div>
                <p className="text-xs text-muted-foreground mt-1">Waiting time</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>NPT Categories</CardTitle>
              <CardDescription>Breakdown of non-productive time by category</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div>
                    <p className="font-medium">Repair Hours</p>
                    <p className="text-sm text-muted-foreground">Equipment maintenance and repairs</p>
                  </div>
                  <span className="text-lg font-bold text-red-600">0.00</span>
                </div>
                <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div>
                    <p className="font-medium">Standby Hours</p>
                    <p className="text-sm text-muted-foreground">Waiting on weather or decisions</p>
                  </div>
                  <span className="text-lg font-bold text-gray-600">0.00</span>
                </div>
                <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div>
                    <p className="font-medium">Reduce Hours</p>
                    <p className="text-sm text-muted-foreground">Reduced operations</p>
                  </div>
                  <span className="text-lg font-bold text-gray-600">0.00</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis">
          <Card>
            <CardHeader>
              <CardTitle>NPT Analysis</CardTitle>
              <CardDescription>Detailed analysis and trends</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">NPT analysis coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle>NPT Reports</CardTitle>
              <CardDescription>Generate and export NPT reports</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">NPT reporting features coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NPTView;
