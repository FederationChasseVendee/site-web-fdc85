export const editorConfig = {
  apiBase: "/api/editor",
  model: "Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC",
  smallModel: "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC",
  maxAgentSteps: 18,
  maxCorrections: 2,
  maxContextCharacters: 11000,
  runtimeEnabled: import.meta.env?.DEV || import.meta.env?.PUBLIC_EDITOR_RUNTIME_ENABLED === "true",
};
