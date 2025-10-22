import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
// import { TooltipProvider } from "@/components/ui/tooltip"; // Temporarily removed
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Index from "./pages/Index";
import Documents from "./pages/Documents";
import KnowledgeBase from "./pages/KnowledgeBase";
import Ask from "./pages/Ask";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    {/* Wrapping all children in a Fragment to ensure QueryClientProvider receives a single child */}
    <>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          {/* Using Layout to wrap page components */}
          <Route path="/documents" element={<Layout><Documents /></Layout>} />
          <Route path="/knowledge-base" element={<Layout><KnowledgeBase /></Layout>} />
          <Route path="/ask" element={<Layout><Ask /></Layout>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </>
  </QueryClientProvider>
);

export default App;