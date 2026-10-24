import { Suspense, lazy } from "react";
import type { ComponentType } from "react";
import { Outlet, createBrowserRouter } from "react-router-dom";
import type { RouteObject } from "react-router-dom";
import { LoginPage } from "../features/auth/LoginPage";
import { Spinner } from "../shared/ui/Spinner";
import { NotFound, RouteError } from "./NotFound";
import { Shell } from "./Shell";
import { SessionProvider } from "./session";

/** Carga perezosa de una pantalla exportada por nombre. */
function screen(
  load: () => Promise<Record<string, ComponentType>>,
  name: string,
) {
  const Lazy = lazy(async () => ({ default: (await load())[name] }));
  return (
    <Suspense fallback={<Spinner label="Cargando…" />}>
      <Lazy />
    </Suspense>
  );
}

export function RootLayout() {
  return (
    <SessionProvider>
      <Outlet />
    </SessionProvider>
  );
}

/*
 * Pantallas por módulo. Cada tarea posterior solo sustituye el archivo importado
 * (mismo nombre de archivo y mismo export); este mapa no cambia:
 *   features/projects/ProjectsPage        módulo 1, lista de proyectos   (Tarea 5)
 *   features/projects/ProjectOverviewPage módulo 1, resumen              (Tarea 5)
 *   features/stories/StoriesPage          módulo 2                       (Tarea 6)
 *   features/analysis/AnalysisPage        módulos 3 y 4                  (Tarea 7)
 *   features/test-design/TestsPage        módulo 6                       (Tarea 8)
 *   features/qa-session/SessionsPage      módulo 7, lista (Tarea 9); SessionDetailPage = detalle
 *   features/reports/ReportsPage          módulo 8                       (Tarea 10)
 *   features/settings/SettingsPage        configuración del proyecto
 * Una pantalla puede lanzar un ApiError 404 (p. ej. historia ajena al proyecto):
 * el errorElement lo muestra como NotFound.
 */
export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      { path: "/login", element: <LoginPage /> },
      {
        element: <Shell />,
        children: [
          {
            errorElement: <RouteError />,
            children: [
              {
                index: true,
                element: screen(
                  () => import("../features/projects/ProjectsPage"),
                  "ProjectsPage",
                ),
              },
              {
                path: "p/:projectId",
                element: screen(
                  () => import("../features/projects/ProjectOverviewPage"),
                  "ProjectOverviewPage",
                ),
              },
              {
                path: "p/:projectId/stories",
                element: screen(
                  () => import("../features/stories/StoriesPage"),
                  "StoriesPage",
                ),
              },
              {
                path: "p/:projectId/stories/:storyId/analysis",
                element: screen(
                  () => import("../features/analysis/AnalysisPage"),
                  "AnalysisPage",
                ),
              },
              {
                path: "p/:projectId/stories/:storyId/tests",
                element: screen(
                  () => import("../features/test-design/TestsPage"),
                  "TestsPage",
                ),
              },
              {
                path: "p/:projectId/stories/:storyId/sessions",
                element: screen(
                  () => import("../features/qa-session/SessionsPage"),
                  "SessionsPage",
                ),
              },
              {
                path: "p/:projectId/stories/:storyId/sessions/:sessionId",
                element: screen(
                  () => import("../features/qa-session/SessionDetailPage"),
                  "SessionDetailPage",
                ),
              },
              {
                path: "p/:projectId/imports/:jobId",
                element: screen(
                  () => import("../features/imports/ImportJobPage"),
                  "ImportJobPage",
                ),
              },
              {
                path: "p/:projectId/transversal",
                element: screen(
                  () => import("../features/cross-analysis/CrossAnalysisPage"),
                  "CrossAnalysisPage",
                ),
              },
              {
                path: "p/:projectId/metricas",
                element: screen(
                  () => import("../features/metrics/MetricsPage"),
                  "MetricsPage",
                ),
              },
              {
                path: "p/:projectId/evaluacion",
                element: screen(
                  () => import("../features/evaluation/EvaluationPage"),
                  "EvaluationPage",
                ),
              },
              {
                path: "p/:projectId/reports",
                element: screen(
                  () => import("../features/reports/ReportsPage"),
                  "ReportsPage",
                ),
              },
              {
                path: "p/:projectId/settings",
                element: screen(
                  () => import("../features/settings/SettingsPage"),
                  "SettingsPage",
                ),
              },
              { path: "*", element: <NotFound /> },
            ],
          },
        ],
      },
    ],
  },
];

export const createAppRouter = () => createBrowserRouter(routes);
