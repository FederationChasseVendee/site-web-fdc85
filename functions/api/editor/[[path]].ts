import { handleEditorRequest } from "../../../src/editor/server.ts";
import type { EditorEnv } from "../../../src/editor/server.ts";

export function onRequest(context: { request: Request; env: EditorEnv }): Promise<Response> {
  return handleEditorRequest(context.request, context.env);
}
