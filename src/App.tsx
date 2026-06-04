import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { WorkspaceProvider } from "./context/WorkspaceContext";
import { ThemeProvider } from "./components/ThemeProvider";
import RequireAuth from "@/components/auth/RequireAuth";
import RequireRole from "@/components/auth/RequireRole";
import Layout from "./components/Layout";
import Documents from "./pages/Documents";
import KnowledgeBase from "./pages/KnowledgeBase";
import WorkspaceManagement from "./pages/WorkspaceManagement";
import GroupManagement from "./pages/GroupManagement";
import Stream from "./pages/Stream";
import Login from "./pages/Login";
import Register from "./pages/Register";
import RecoverAccount from "./pages/RecoverAccount";
import Account from "./pages/Account";
import UserManagement from "./pages/admin/UserManagement";
import ApiKeyManagement from "./pages/admin/ApiKeyManagement";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AuthenticatedShell() {
  return (
    <RequireAuth>
      <WorkspaceProvider>
        <Outlet />
      </WorkspaceProvider>
    </RequireAuth>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/recover" element={<RecoverAccount />} />
              <Route element={<AuthenticatedShell />}>
                <Route
                  path="/"
                  element={
                    <Layout>
                      <WorkspaceManagement />
                    </Layout>
                  }
                />
                <Route
                  path="/documents"
                  element={
                    <Layout>
                      <Documents />
                    </Layout>
                  }
                />
                <Route
                  path="/knowledge-base"
                  element={
                    <Layout>
                      <KnowledgeBase />
                    </Layout>
                  }
                />
                <Route
                  path="/workspace-management"
                  element={
                    <Layout>
                      <WorkspaceManagement />
                    </Layout>
                  }
                />
                <Route
                  path="/group-management"
                  element={
                    <Layout>
                      <GroupManagement />
                    </Layout>
                  }
                />
                <Route path="/chatin" element={<Navigate to="/chat" replace />} />
                <Route path="/stream" element={<Navigate to="/chat" replace />} />
                <Route
                  path="/chat"
                  element={
                    <Layout>
                      <Stream />
                    </Layout>
                  }
                />
                <Route
                  path="/account"
                  element={
                    <Layout>
                      <Account />
                    </Layout>
                  }
                />
                <Route
                  path="/admin/users"
                  element={
                    <Layout>
                      <RequireRole roles={["admin", "superadmin"]}>
                        <UserManagement />
                      </RequireRole>
                    </Layout>
                  }
                />
                <Route
                  path="/admin/api-keys"
                  element={
                    <Layout>
                      <RequireRole roles={["admin", "superadmin"]}>
                        <ApiKeyManagement />
                      </RequireRole>
                    </Layout>
                  }
                />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
