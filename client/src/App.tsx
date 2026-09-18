import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import KlipFlowShell from "./components/KlipFlowShell";
import Onboarding from "./components/Onboarding";
import { ThemeProvider } from "./contexts/ThemeContext";
import Accounts from "./pages/Accounts";
import Clips from "./pages/Clips";
import Earnings from "./pages/Earnings";
import Home from "./pages/Home";
import HowToUse from "./pages/HowToUse";
import NewProject from "./pages/NewProject";
import NotFound from "./pages/NotFound";
import ProjectDetail from "./pages/ProjectDetail";
import Settings from "./pages/Settings";

function Router() { return <KlipFlowShell><Switch><Route path="/" component={Home} /><Route path="/new-project" component={NewProject} /><Route path="/project/:id" component={ProjectDetail} /><Route path="/clips" component={Clips} /><Route path="/earnings" component={Earnings} /><Route path="/accounts" component={Accounts} /><Route path="/settings" component={Settings} /><Route path="/how-to-use" component={HowToUse} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch><Onboarding /></KlipFlowShell>; }
export default function App() { return <ErrorBoundary><ThemeProvider defaultTheme="light" switchable><TooltipProvider><Toaster /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>; }
