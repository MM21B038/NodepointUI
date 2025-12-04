import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WorkspaceProvider } from "./context/WorkspaceContext";
import { ThemeProvider } from "./components/ThemeProvider";
import Layout from "./components/Layout";
import Documents from "./pages/Documents";
import KnowledgeBase from "./pages/KnowledgeBase";
import WorkspaceManagement from "./pages/WorkspaceManagement";
import ChatIn from "./pages/ChatIn";
import Stream from "./pages/Stream"; // Import the new Stream page
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <WorkspaceProvider>
          <>
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
                <Route path="/chatin" element={<Layout><ChatIn /></Layout>} />
                <Route path="/stream" element={<Layout><Stream /></Layout>} /> {/* New route for Stream */}
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </>
        </WorkspaceProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;