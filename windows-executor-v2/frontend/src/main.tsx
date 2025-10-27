import React from "react";
import ReactDOM from "react-dom/client";
import AppEnhanced from "./app/AppEnhanced";

import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppEnhanced />
  </React.StrictMode>
);
