import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MarkerProvider } from "./store/useMarkerStore.jsx";
import App from "./App";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <MarkerProvider>
      <App />
    </MarkerProvider>
  </StrictMode>
);
