import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Sidebar from "@/components/layout/sidebar";
import Dashboard from "@/pages/dashboard";
import Requests from "@/pages/requests";
import Submit from "@/pages/submit";
import Logs from "@/pages/logs";
import Config from "@/pages/config";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <div className="flex h-screen dark">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/requests" component={Requests} />
          <Route path="/submit" component={Submit} />
          <Route path="/logs" component={Logs} />
          <Route path="/config" component={Config} />
          <Route component={NotFound} />
        </Switch>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
