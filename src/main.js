import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient.js";
import App from "./App.tsx";

const rootElement = document.getElementById("root");
const root = createRoot(rootElement);

root.render(
  React.createElement(QueryClientProvider, { client: queryClient },
    React.createElement(App)
  )
);