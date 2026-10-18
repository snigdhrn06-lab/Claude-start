import "server-only";

// Server-only entry point: keeps the API key and provider SDK out of client bundles.
// The implementation lives in ./core so the offline benchmark harness can import it.
export { aiConfig, analyzeWithAI, ocrWithAI, validateImageDataUrl, DEFAULT_MODEL } from "./core";
