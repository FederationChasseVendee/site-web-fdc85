export interface EditTarget {
  path: string;
  hash: string;
  start: number;
  end: number;
  kind: "string" | "json" | "line";
  value: string;
}

export function sourceTargets(path: string, source: string, hash: string, startLine: number, endLine: number, format: "values" | "lines"): Map<string, EditTarget> {
  const targets = new Map<string, EditTarget>();
  const lines = source.split("\n");
  const first = lines.slice(0, startLine - 1).join("\n").length + (startLine > 1 ? 1 : 0);
  const last = Math.min(source.length, lines.slice(0, endLine).join("\n").length);
  if (!path.endsWith(".json") || format === "lines") {
    let offset = first;
    for (let line = startLine; line <= Math.min(endLine, lines.length); line++) {
      const text = lines[line - 1]!.replace(/\r$/, "");
      targets.set(`L${line}`, { path, hash, start: offset, end: offset + text.length, kind: "line", value: text });
      offset += lines[line - 1]!.length + 1;
    }
    return targets;
  }
  JSON.parse(source);
  let offset = 0;
  const space = () => { while (/\s/.test(source[offset] ?? "") && offset < source.length) offset++; };
  const string = () => {
    const match = /"(?:[^"\\]|\\.)*"/y;
    match.lastIndex = offset;
    const token = match.exec(source)?.[0];
    if (!token) throw new Error("Chaîne JSON invalide.");
    offset += token.length;
    return token;
  };
  const seen = new Set<string>();
  const visit = (pointer: string): void => {
    if (seen.has(pointer)) throw new Error("Les clés JSON dupliquées ne peuvent pas être modifiées par référence.");
    seen.add(pointer);
    space();
    const start = offset;
    if (source[offset] === "{" || source[offset] === "[") {
      const object = source[offset++] === "{";
      const close = object ? "}" : "]";
      let index = 0;
      space();
      while (source[offset] !== close) {
        const key = object ? String(JSON.parse(string())) : String(index++);
        space();
        if (object) { if (source[offset++] !== ":") throw new Error("Objet JSON invalide."); }
        visit(`${pointer}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`);
        space();
        if (source[offset] === close) break;
        if (source[offset++] !== ",") throw new Error("Valeur JSON invalide.");
        space();
      }
      offset++;
      return;
    }
    const isString = source[offset] === '"';
    if (isString) string();
    else { while (offset < source.length && !/[\s,\]}]/.test(source[offset]!)) offset++; }
    const token = source.slice(start, offset);
    const id = pointer || "/";
    if (start >= first && offset <= last) {
      targets.set(id, { path, hash, start, end: offset, kind: isString ? "string" : "json", value: isString ? JSON.parse(token) as string : token });
    }
  };
  visit("");
  return targets;
}

export function applyTarget(source: string, target: EditTarget, text: string): string {
  if (target.kind === "line" && /[\r\n]/.test(text)) throw new Error("Une référence de ligne ne remplace qu'une ligne. Utilisez l'action lines pour plusieurs lignes.");
  if (target.kind === "json") JSON.parse(text);
  const replacement = target.kind === "string" ? JSON.stringify(text)
    : target.kind === "json" ? text.trim() : text;
  return source.slice(0, target.start) + replacement + source.slice(target.end);
}

export function replaceReadLines(source: string, path: string, startLine: number, endLine: number, text: string, hash: string, targets: Map<string, EditTarget>): string {
  const first = targets.get(`L${startLine}`);
  const last = targets.get(`L${endLine}`);
  for (let line = startLine; line <= endLine; line++) {
    const target = targets.get(`L${line}`);
    if (!target || target.path !== path || target.kind !== "line" || target.hash !== hash) throw new Error("Chaque ligne remplacée doit avoir été lue dans la version actuelle.");
  }
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  return source.slice(0, first!.start) + text.replaceAll("\r\n", "\n").replaceAll("\n", newline) + source.slice(last!.end);
}
