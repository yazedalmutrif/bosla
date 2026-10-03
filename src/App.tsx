import { lazy, Suspense, useEffect } from "react";
import { Route, Routes, useLocation } from "react-router";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { Spinner } from "./components/ui";
import { Home } from "./pages/Home";

const Tailor = lazy(() => import("./pages/Tailor"));
const JobMap = lazy(() => import("./pages/JobMap"));
const Privacy = lazy(() => import("./pages/Legal").then((m) => ({ default: m.Privacy })));
const Terms = lazy(() => import("./pages/Legal").then((m) => ({ default: m.Terms })));
const About = lazy(() => import("./pages/Legal").then((m) => ({ default: m.About })));
const NotFound = lazy(() => import("./pages/Legal").then((m) => ({ default: m.NotFound })));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

export function App() {
  return (
    <div className="flex min-h-dvh flex-col">
      <ScrollToTop />
      <Header />
      <main id="main" className="flex-1">
        <Suspense
          fallback={
            <div className="container-page flex min-h-[50vh] items-center justify-center">
              <Spinner />
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/tailor" element={<Tailor />} />
            <Route path="/map" element={<JobMap />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/about" element={<About />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
