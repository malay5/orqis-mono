"use client";

import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";

/**
 * Wrapped in a client component because Scalar's renderer reaches for the DOM
 * for syntax highlighting + the live "try it" panel. The OpenAPI spec lives
 * at /openapi.json so Scalar can fetch it via a stable URL (works in dev + prod).
 */
export function ScalarDocs() {
  return (
    <ApiReferenceReact
      configuration={{
        url: "/openapi.json",
        theme: "purple",
        darkMode: true,
        hideClientButton: false,
        hideDarkModeToggle: true,
      }}
    />
  );
}
