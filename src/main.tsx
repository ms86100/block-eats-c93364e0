import "./index.css";
import { initializeCapacitorPlugins } from "./lib/capacitor";

const FALLBACK_HTML = `<div style="display:flex;align-items:center;justify-content:center;height:100dvh;font-family:system-ui;padding:2rem;text-align:center"><div><h2>Something went wrong</h2><p style="color:#666;margin-top:8px">The app did not initialize correctly. Please try again.</p><button id="retry-boot-btn" style="margin-top:16px;padding:10px 14px;border-radius:10px;border:1px solid #ddd;background:white;cursor:pointer">Reload App</button></div></div>`;

function showFatalFallback() {
  const root = document.getElementById("root");
  if (!root) return;
  root.innerHTML = FALLBACK_HTML;
  // Wire up the retry button to re-run bootstrap from scratch
  document.getElementById("retry-boot-btn")?.addEventListener("click", () => {
    root.innerHTML = "";
    bootstrap();
  });
}

/**
 * Checks if the app has meaningfully mounted.
 * ErrorBoundary sets this attribute in its constructor,
 * so it is present as soon as React begins processing.
 */
function appDidNotMount() {
  const root = document.getElementById("root");
  return !!root && !root.hasAttribute("data-app-mounted");
}

// Logging-only global guards — they do NOT destroy the React tree.
// React's ErrorBoundary handles render errors. The 10-second timeout
// below is the sole safety net for complete mount failure.
window.addEventListener("error", (event) => {
  console.error("[Bootstrap] Unhandled error:", event.error || event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("[Bootstrap] Unhandled rejection:", event.reason);
});

async function bootstrap() {
  try {
    await initializeCapacitorPlugins();
  } catch (e) {
    console.error('[Bootstrap] Capacitor init failed, continuing without native plugins:', e);
  }

  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("[Bootstrap] Missing root element");
  }

  const [{ createRoot }, { default: App }] = await Promise.all([
    import("react-dom/client"),
    import("./App.tsx"),
  ]);

  createRoot(rootElement).render(<App />);

  // Safety net: if the app hasn't signalled it mounted within 10s, show fallback
  window.setTimeout(() => {
    if (appDidNotMount()) {
      console.error("[Bootstrap] App did not mount within 10 seconds");
      showFatalFallback();
    }
  }, 10000);
}

bootstrap().catch((e) => {
  console.error('[Bootstrap] Fatal error:', e);
  showFatalFallback();
});
