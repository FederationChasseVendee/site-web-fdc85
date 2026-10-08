import { createServer, request } from "node:http";
import { pipeline } from "node:stream";

const upstream = "http://127.0.0.1:4322";
const html = `<!doctype html><html lang="fr"><meta charset="utf-8"><title>Benchmark local de l'éditeur</title>
<style>body{font:14px system-ui;max-width:1000px;margin:24px auto;padding:16px}button{padding:8px}pre{white-space:pre-wrap;max-height:260px;overflow:auto}iframe{width:100%;height:400px;border:1px solid #ddd}</style>
<h1>Benchmark local : WebGPU + vrai Astro en WebContainer</h1>
<p>Ce test ne se connecte pas à GitHub, ne crée aucune PR et ne publie rien. Il utilise l'archive locale des fichiers suivis.
Chaque demande repart des sources d'origine. Réussite attendue : au moins 9/10, sans changement hors cible.</p>
<button id="start">Lancer les dix demandes (Coder 3B)</button><p id="status">Prêt à tester.</p><pre id="results"></pre><pre id="logs"></pre>
<iframe id="preview" allow="cross-origin-isolated" title="Vrai aperçu Astro local"></iframe>
<script type="module">
import {CodeModel} from "/site-web/src/editor/model.ts";
import {BrowserRuntime} from "/site-web/src/editor/runtime.ts";
import {LocalWorkspace,readArchive} from "/site-web/src/editor/workspace.ts";
import {runAgent} from "/site-web/src/editor/agent.ts";
const state=window.editorBenchmark={phase:"idle",results:[],logs:[],error:null};
const status=message=>{state.phase=message;document.getElementById("status").textContent=message};
const log=message=>{state.logs.push(message);if(state.logs.length>100)state.logs.shift();document.getElementById("logs").textContent=state.logs.join("\\n")};
const model=new CodeModel(status,()=>{},log);
const runtime=new BrowserRuntime({stage:status,log,ready:url=>{state.previewUrl=url;document.getElementById("preview").src=url},error:log});
window.stopEditorBenchmark=()=>{state.abort?.abort();model.stop();runtime.stop()};
const home="src/content/home.json",site="src/content/site.json",contact="src/content/standard-pages/contact.md",css="src/styles/global.css";
const cases=[
["Sur l'accueil, remplace le grand titre par « La chasse en Vendée, simplement ». Ne change rien d'autre.",home,["hero","title"],"La chasse en Vendée, simplement"],
["Sur l'accueil, remplace le texte sous le grand titre par « Retrouvez facilement vos démarches et les services de la Fédération. »",home,["hero","text"],"Retrouvez facilement vos démarches et les services de la Fédération."],
["Renomme la rubrique « Que souhaitez-vous faire ? » en « Vos démarches essentielles » sur l'accueil.",home,["tasks","title"],"Vos démarches essentielles"],
["Sur l'accueil, le bouton « Valider mon permis stp » doit simplement s'appeler « Valider mon permis ». Garde son lien.",home,["tasks","items",0,"title"],"Valider mon permis"],
["Sur l'accueil, renomme le bloc « Informations importantes » en « Les dernières nouvelles ».",home,["news","title"],"Les dernières nouvelles"],
["Sur l'accueil, renomme le lien « Découvrir la Fédération » en « Notre Fédération », sans changer sa destination.",home,["institution","action","label"],"Notre Fédération"],
["Dans la navigation du site, renomme « Actualités » en « Nos actualités », sans changer son lien.",site,["navigation",0,"label"],"Nos actualités"],
["Dans les coordonnées globales du site, affiche « 02 51 47 80 90 (accueil) » comme libellé du téléphone, sans changer son numéro ni le texte de la page Contact.",site,["contact","phoneLabel"],"02 51 47 80 90 (accueil)"],
["Sur la page Contact, les horaires du lundi, mardi, jeudi et vendredi commencent désormais à 9h00 au lieu de 8h30. Ne change pas mercredi, midi ni l'après-midi.",contact,null,null],
["Les coins arrondis du site doivent être moins marqués : passe le rayon global --radius de 1rem à 0.5rem. Ne change aucun autre style.",css,null,null],
];
function expected(files,test){
 const [prompt,path,keys,value]=test;
 const original=new TextDecoder().decode(files.get(path));
 if(keys){const result=JSON.parse(original);let target=result;for(const key of keys.slice(0,-1))target=target[key];target[keys.at(-1)]=value;return text=>JSON.stringify(JSON.parse(text))===JSON.stringify(result)}
 if(path===contact){const replacement=original.replace("- Lundi, mardi, jeudi et vendredi : 8h30","- Lundi, mardi, jeudi et vendredi : 9h00");return text=>text===replacement}
 return text=>text.replace(/--radius:\\s*0?\\.5rem/,"--radius: 1rem")===original&&text!==original;
}
document.getElementById("start").onclick=async()=>{
 document.getElementById("start").disabled=true;
 state.abort=new AbortController();
 const signal=state.abort.signal;
 try{
   if(!crossOriginIsolated)throw Error("Cette page n'est pas isolée. Ouvrez-la dans un onglet Chrome/Edge de premier niveau.");
   const response=await fetch("/site-web/editor-validation-archive.zip",{signal});
   if(!response.ok)throw Error("Créez d'abord l'archive de validation locale (voir script).");
   const sources=await readArchive(response,signal,status);
   await Promise.all([model.load("Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC"),runtime.prepare(sources,signal)]);
   for(let index=0;index<cases.length;index++){
     signal.throwIfAborted();
     const test=cases[index];
     const workspace=new LocalWorkspace("a".repeat(40),sources);
     const matches=expected(sources,test);
     await runtime.open(workspace.files,signal);
     const begin=performance.now();
     let passed=false,error=null;
     try{
       const summary=await runAgent({workspace,runtime,generate:(...args)=>model.complete(...args),prompt:test[0],title:"Benchmark "+(index+1),route:index===8?"/contact/":"/",signal:AbortSignal.any([signal,AbortSignal.timeout(240000)]),progress:status});
       const changes=workspace.changes();
       passed=changes.length===1&&changes[0].path===test[1]&&matches(workspace.text(test[1]));
       if(!passed)error="Le résultat ne correspond pas exactement à la demande ou modifie un autre fichier.";
       log(summary);
     }catch(cause){error=cause instanceof Error?cause.message:String(cause)}
     state.results.push({case:index+1,prompt:test[0],passed,error,seconds:Math.round((performance.now()-begin)/1000)});
     document.getElementById("results").textContent=JSON.stringify(state.results,null,2);
   }
   const passed=state.results.filter(result=>result.passed).length;
   status("Terminé : "+passed+"/10. "+(passed>=9?"Seuil atteint.":"Seuil non atteint."));
 }catch(error){state.error=error instanceof Error?error.message:String(error);status("Échec : "+state.error)}
 finally{model.stop();runtime.stop()}
};
window.addEventListener("pagehide",window.stopEditorBenchmark);
</script></html>`;

const server = createServer((incoming, outgoing) => {
  outgoing.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  outgoing.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  outgoing.setHeader("Cache-Control", "no-store");
  if (incoming.method !== "GET" && incoming.method !== "HEAD") { outgoing.writeHead(405); outgoing.end("Read-only benchmark"); return; }
  if (incoming.url === "/") { outgoing.setHeader("Content-Type", "text/html; charset=utf-8"); outgoing.end(html); return; }
  const target = new URL(incoming.url, upstream);
  if (target.origin !== upstream) { outgoing.writeHead(400); outgoing.end("Invalid proxy target"); return; }
  if (!target.pathname.startsWith("/site-web/")) target.pathname = `/site-web${target.pathname}`;
  const proxy = request(target, { method: incoming.method }, response => {
    outgoing.writeHead(response.statusCode ?? 502, { ...response.headers, "cross-origin-opener-policy": "same-origin", "cross-origin-embedder-policy": "require-corp" });
    pipeline(response, outgoing, error => { if (error) console.error(error.message); });
  });
  proxy.on("error", error => { console.error(error.message); outgoing.writeHead(502); outgoing.end("Start Astro on port 4322 first."); });
  proxy.end();
});
server.listen(4335, "127.0.0.1", () => {
  console.log("Benchmark: http://127.0.0.1:4335/ (Chrome/Edge, WebGPU).");
  console.log("Prerequisites: npm.cmd run dev -- --host 127.0.0.1 --port 4322");
  console.log("git archive --format=zip --prefix=repo/ --output=public\\editor-validation-archive.zip HEAD");
  console.log("Stop with Ctrl+C; remove the specific temporary ZIP afterwards.");
});
