import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const NPTModule = () => {
  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg">
            <AlertTriangle className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">NPT Module</h1>
            <p className="text-muted-foreground">Non-Productive Time Analysis and Reporting</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>NPT Overview</CardTitle>
              <CardDescription>Summary of non-productive time across operations</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">NPT tracking and monitoring dashboard coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>NPT Analysis</CardTitle>
              <CardDescription>Detailed analysis of non-productive time events</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Analytical tools and insights coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>NPT Reports</CardTitle>
              <CardDescription>Generate and export NPT reports</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Report generation features coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NPTModule;
