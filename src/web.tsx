import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./crop-controls.css";
import { MyComponent } from "./Composition";

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <MyComponent />
  </React.StrictMode>,
);
