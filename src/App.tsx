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
import ProductDetail from "@/pages/ProductDetail";
import Projects from "@/pages/Projects";
import ColorLibrary from "@/pages/ColorLibrary";
import Suppliers from "@/pages/Suppliers";
import Ecos from "@/pages/Ecos";
import Samples from "@/pages/Samples";
import Rfqs from "@/pages/Rfqs";
import Admin from "@/pages/Admin";
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
              <Route path="/styles/:id" element={<ProductDetail />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/materials" element={<Stub title="Materials" />} />
              <Route path="/color-library" element={<ColorLibrary />} />
              <Route path="/boms" element={<Stub title="BOMs" />} />
              <Route path="/suppliers" element={<Suppliers />} />
              <Route path="/rfqs" element={<Rfqs />} />
              <Route path="/ecos" element={<Ecos />} />
              <Route path="/samples" element={<Samples />} />
              <Route path="/settings" element={<Admin />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
