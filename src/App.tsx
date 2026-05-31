import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { SubNavProvider } from "@/contexts/SubNavContext";
import { PageOptionsProvider } from "@/contexts/PageOptionsContext";
import AppShell from "@/components/layout/AppShell";
import AuthPage from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Products from "@/pages/Products";
import MaterialsListView from "@/pages/MaterialsListView";
import ProductDetail from "@/pages/ProductDetail";
import Projects from "@/pages/Projects";
import ProjectDetail from "@/pages/ProjectDetail";
import ColorLibrary from "@/pages/ColorLibrary";
import ColorPalettes from "@/pages/ColorPalettes";
import Suppliers from "@/pages/Suppliers";
import SupplierDetail from "@/pages/SupplierDetail";
import Ecos from "@/pages/Ecos";
import Samples from "@/pages/Samples";
import Rfqs from "@/pages/Rfqs";
import Admin from "@/pages/Admin";
import SettingsHub from "@/pages/SettingsHub";
import ListOfValuesLibrary from "@/pages/ListOfValuesLibrary";
import SystemCodeGeneratorLibrary from "@/pages/SystemCodeGeneratorLibrary";
import SizeGridLibrary from "@/pages/SizeGridLibrary";
import Currencies from "@/pages/Currencies";
import AppConfiguration from "@/pages/AppConfiguration";
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
          <SubNavProvider>
            <PageOptionsProvider>
              <Routes>
                <Route path="/auth" element={<AuthPage />} />
                <Route element={<AppShell />}>
                  <Route path="/" element={<Navigate to="/list-view" replace />} />
                  <Route path="/dashboard" element={<Dashboard />} />

                  <Route path="/list-view" element={<Products />} />
                  <Route path="/styles" element={<Navigate to="/list-view" replace />} />
                  <Route path="/products/new" element={<ProductDetail />} />
                  <Route path="/products/:id" element={<ProductDetail />} />
                  <Route path="/styles/:id" element={<RedirectStyleToProduct />} />

                  <Route path="/projects" element={<Projects />} />
                  <Route path="/projects/:id" element={<ProjectDetail />} />

                  <Route path="/materials" element={<MaterialsListView />} />

                  <Route path="/color-palettes" element={<ColorPalettes />} />
                  <Route path="/color-library" element={<Navigate to="/color-palettes" replace />} />

                  <Route path="/size-studio" element={<SizeGridLibrary />} />
                  <Route path="/size-grid-library" element={<Navigate to="/size-studio" replace />} />
                  <Route path="/currencies" element={<Currencies />} />
                  <Route path="/app-config" element={<AppConfiguration />} />

                  <Route path="/suppliers" element={<Suppliers />} />
                  <Route path="/suppliers/:id" element={<Stub title="Supplier Detail" />} />

                  <Route path="/boms" element={<Stub title="BOMs" />} />

                  <Route path="/change-management/ecos" element={<Ecos />} />
                  <Route path="/ecos" element={<Navigate to="/change-management/ecos" replace />} />

                  <Route path="/rfqs" element={<Rfqs />} />
                  <Route path="/samples" element={<Samples />} />

                  <Route path="/config" element={<SettingsHub />} />
                  <Route path="/config/admin" element={<Admin />} />
                  <Route path="/list-of-values" element={<ListOfValuesLibrary />} />
                  <Route path="/code-generators" element={<SystemCodeGeneratorLibrary />} />
                  <Route path="/settings" element={<Navigate to="/config" replace />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </PageOptionsProvider>
          </SubNavProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

function RedirectStyleToProduct() {
  const id = window.location.pathname.split("/").pop();
  return <Navigate to={`/products/${id}`} replace />;
}

export default App;
