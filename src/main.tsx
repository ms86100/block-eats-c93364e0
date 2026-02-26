import "./index.css";
import { initializeCapacitorPlugins } from "./lib/capacitor";

async function bootstrap() {
  await initializeCapacitorPlugins();
  const { createRoot } = await import("react-dom/client");
  const { default: App } = await import("./App.tsx");
  createRoot(document.getElementById("root")!).render(<App />);
}

bootstrap();
