import "./index.css";
import { initializeCapacitorPlugins } from "./lib/capacitor";

async function bootstrap() {
  try {
    await initializeCapacitorPlugins();
  } catch (e) {
    console.error('[Bootstrap] Capacitor init failed, continuing without native plugins:', e);
  }

  const { createRoot } = await import("react-dom/client");
  const { default: App } = await import("./App.tsx");
  createRoot(document.getElementById("root")!).render(<App />);
}

bootstrap().catch((e) => {
  console.error('[Bootstrap] Fatal error:', e);
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100dvh;font-family:system-ui;padding:2rem;text-align:center"><div><h2>Something went wrong</h2><p style="color:#666;margin-top:8px">Please close and reopen the app.</p></div></div>';
  }
});
