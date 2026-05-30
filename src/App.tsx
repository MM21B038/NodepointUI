import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { WorkspaceProvider } from "./context/WorkspaceContext";
import { ThemeProvider } from "./components/ThemeProvider";
import Layout from "./components/Layout";
import Documents from "./pages/Documents";
import KnowledgeBase from "./pages/KnowledgeBase";
import WorkspaceManagement from "./pages/WorkspaceManagement";
import GroupManagement from "./pages/GroupManagement";
import Stream from "./pages/Stream";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <WorkspaceProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Set WorkspaceManagement as the default landing page */}
              <Route path="/" element={<Layout><WorkspaceManagement /></Layout>} />
              {/* Using Layout to wrap page components */}
              <Route path="/documents" element={<Layout><Documents /></Layout>} />
              <Route path="/knowledge-base" element={<Layout><KnowledgeBase /></Layout>} />
              <Route path="/workspace-management" element={<Layout><WorkspaceManagement /></Layout>} />
              <Route path="/group-management" element={<Layout><GroupManagement /></Layout>} />
              <Route path="/chatin" element={<Navigate to="/chat" replace />} />
              <Route path="/stream" element={<Navigate to="/chat" replace />} />
              <Route path="/chat" element={<Layout><Stream /></Layout>} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </WorkspaceProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;