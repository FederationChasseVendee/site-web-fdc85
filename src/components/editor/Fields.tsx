import { useRef, useState } from "preact/hooks";
import type { Draft, Field } from "../../lib/editor/model";
import { initialValue } from "../../lib/editor/model";
import { safeUrl } from "../../lib/editor/markdown";

interface Props {
  fields: Field[];
  value: Draft;
  onChange: (value: Draft) => void;
  base: string;
  prefix?: string;
}

function MarkdownInput({ id, value, onChange, required }: { id: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  function insert(before: string, after = "", placeholder = "texte") {
    const node = textarea.current;
    if (!node) return;
    const start = node.selectionStart;
    const end = node.selectionEnd;
    const text = value.slice(start, end) || placeholder;
    onChange(value.slice(0, start) + before + text + after + value.slice(end));
    requestAnimationFrame(() => {
      node.focus();
      node.setSelectionRange(start + before.length, start + before.length + text.length);
    });
  }
  return <div class="markdown-input">
    <div class="markdown-toolbar" role="group" aria-label="Insérer une mise en forme Markdown">
      <button type="button" onClick={() => insert("**", "**")}>Gras</button>
      <button type="button" onClick={() => insert("*", "*")}>Italique</button>
      <button type="button" onClick={() => insert("\n## ", "\n", "Titre de section")}>Titre</button>
      <button type="button" onClick={() => insert("\n- ", "\n")}>Liste</button>
      <button type="button" onClick={() => insert("[", "](https://exemple.fr)")}>Lien</button>
      <button type="button" onClick={() => insert("![", "](/assets/image.webp)", "Description de l’image")}>Image</button>
    </div>
    <textarea ref={textarea} id={id} value={value} required={required} rows={15} spellcheck
      aria-describedby={`${id}-help`} onInput={(event) => onChange(event.currentTarget.value)} />
    <p id={`${id}-help`} class="field-help">Texte Markdown, utilisable au clavier. Sélectionnez du texte puis un bouton ; le résultat apparaît à droite. Le HTML actif est neutralisé.</p>
  </div>;
}

function FieldInput({ field, value, onChange, base, id }: { field: Field; value: unknown; onChange: (value: unknown) => void; base: string; id: string }) {
  const [failedImage, setFailedImage] = useState("");
  if (field.list) {
    const items = Array.isArray(value) ? value : [];
    const bounds = typeof field.list === "object" ? field.list : {};
    function move(index: number, direction: number) {
      const result = [...items];
      [result[index], result[index + direction]] = [result[index + direction], result[index]];
      onChange(result);
    }
    return <div class="field-list">{items.map((item, index) => <fieldset key={index} class="list-item">
      <legend>{field.label ?? field.name} {index + 1}</legend>
      {field.type !== "object" && <label for={`${id}-${index}`}>Valeur</label>}
      <FieldInput field={{ ...field, list: false }} value={item} id={`${id}-${index}`} base={base}
        onChange={(updated) => onChange(items.map((old, position) => position === index ? updated : old))} />
      <div class="list-actions">
        <button type="button" disabled={index === 0} aria-label={`Monter l’élément ${index + 1}`} onClick={() => move(index, -1)}>Monter</button>
        <button type="button" disabled={index === items.length - 1} aria-label={`Descendre l’élément ${index + 1}`} onClick={() => move(index, 1)}>Descendre</button>
        <button type="button" disabled={items.length <= (bounds.min ?? 0)} aria-label={`Supprimer l’élément ${index + 1}`}
          onClick={() => onChange(items.filter((_, position) => position !== index))}>Supprimer</button>
      </div>
    </fieldset>)}
      <button type="button" disabled={bounds.max !== undefined && items.length >= bounds.max}
        onClick={() => onChange([...items, initialValue({ ...field, list: false })])}>Ajouter : {field.label ?? field.name}</button>
    </div>;
  }
  if (field.type === "object") {
    const present = Boolean(value && typeof value === "object" && !Array.isArray(value));
    const data = present ? value as Draft : {};
    return <div class="object-field">
      {!field.required && <label class="checkbox-label"><input type="checkbox" checked={present}
        onChange={(event) => onChange(event.currentTarget.checked ? initialValue(field) : undefined)} /> Inclure ce bloc</label>}
      {(present || field.required) && <Fields fields={field.fields ?? []} value={data} onChange={onChange} base={base} prefix={id} />}
    </div>;
  }
  const text = typeof value === "string" ? value : "";
  switch (field.type) {
    case "boolean": return <label class="checkbox-label"><input id={id} type="checkbox" checked={value === true}
      onChange={(event) => onChange(event.currentTarget.checked)} /> Oui</label>;
    case "number": return <input id={id} type="number" value={typeof value === "number" ? value : ""} required={field.required}
      onInput={(event) => onChange(event.currentTarget.value === "" ? undefined : event.currentTarget.valueAsNumber)} />;
    case "select": return <select id={id} value={text} required={field.required}
      onChange={(event) => onChange(event.currentTarget.value || undefined)}>
      <option value="">— Choisir —</option>{field.options?.values?.map((option) =>
        <option value={option.value} key={option.value}>{option.label}</option>)}
    </select>;
    case "date": return <input id={id} type="date" value={text.slice(0, 10)} required={field.required}
      onInput={(event) => onChange(event.currentTarget.value || undefined)} />;
    case "rich-text": return <MarkdownInput id={id} value={text} onChange={onChange} required={field.required} />;
    case "text": return <textarea id={id} value={text} required={field.required} rows={4}
      onInput={(event) => onChange(event.currentTarget.value)} />;
    case "image": return <div>
      <input id={id} type="text" value={text} required={field.required} list="editor-images"
        onInput={(event) => onChange(event.currentTarget.value)} aria-describedby={`${id}-help`} />
      <p id={`${id}-help`} class="field-help">Choisissez un média existant ou collez une URL HTTPS. Aucun fichier n’est téléversé ici ; utilisez la médiathèque Pages CMS.</p>
      {safeUrl(text, base) && <img class="field-image" src={safeUrl(text, base)} alt="Aperçu du média sélectionné" referrerpolicy="no-referrer"
        onError={() => setFailedImage(text)} onLoad={() => setFailedImage("")} />}
      {failedImage === text && text && <p class="editor-error" role="alert">Image inaccessible. Vérifiez l’adresse ou choisissez un média existant ; l’export ne téléverse aucun fichier.</p>}
    </div>;
    case "string": return <input id={id} type="text" value={text} required={field.required}
      onInput={(event) => onChange(event.currentTarget.value)} />;
    default: return <p role="alert">Type « {field.type} » non pris en charge. Valeur conservée, non modifiable.</p>;
  }
}

export default function Fields({ fields, value, onChange, base, prefix = "field" }: Props) {
  return <>{fields.map((field) => {
    const id = `${prefix}-${field.name}`;
    return <div class="editor-field" key={id}>
      {field.type === "object" || field.list
        ? <fieldset><legend>{field.label ?? field.name}{field.required && " *"}</legend>
          {field.description && <p class="field-help">{field.description}</p>}
          <FieldInput field={field} value={value[field.name]} base={base} id={id}
            onChange={(updated) => {
              const next = { ...value };
              if (updated === undefined) delete next[field.name];
              else next[field.name] = updated;
              onChange(next);
            }} />
        </fieldset>
        : <><label for={id}>{field.label ?? field.name}{field.required && " *"}</label>
          {field.description && <p class="field-help">{field.description}</p>}
          <FieldInput field={field} value={value[field.name]} base={base} id={id} onChange={(updated) => {
            const next = { ...value };
            if (updated === undefined) delete next[field.name];
            else next[field.name] = updated;
            onChange(next);
          }} />
        </>}
    </div>;
  })}</>;
}
