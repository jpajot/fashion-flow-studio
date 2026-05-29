import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import AppShell from "@/components/layout/AppShell";
import AuthPage from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import StyleLibrary from "@/pages/StyleLibrary";
import Projects from "@/pages/Projects";
import Stub from "@/pages/Stub";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route element={<AppShell />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/styles" element={<StyleLibrary />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/materials" element={<Stub title="Materials" />} />
              <Route path="/colorways" element={<Stub title="Colorways" />} />
              <Route path="/boms" element={<Stub title="BOMs" />} />
              <Route path="/suppliers" element={<Stub title="Suppliers" />} />
              <Route path="/rfqs" element={<Stub title="RFQs" />} />
              <Route path="/ecos" element={<Stub title="ECOs" />} />
              <Route path="/samples" element={<Stub title="Samples" />} />
              <Route path="/team" element={<Stub title="Team" />} />
              <Route path="/settings" element={<Stub title="Settings" />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
