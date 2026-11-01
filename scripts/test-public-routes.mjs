import assert from "node:assert/strict";
import test from "node:test";
import { canonicalSlug, procedures, resolvePublicUrl } from "../src/lib/routes.mjs";
import { remarkLocalLinks } from "../src/lib/markdown-links.mjs";

test("les huit démarches restent explicites et ont une adresse unique", () => {
  assert.equal(procedures.length, 8);
  assert.equal(new Set(procedures.map(({ url }) => url)).size, 8);
  assert.deepEqual(procedures.map(({ title }) => title), [
    "Passer mon permis", "Valider mon permis", "Se former", "Déclarer mes prélèvements",
    "Déclarer une arme", "Déclarer un dégât", "Déclarer une perte", "Se connecter à mon espace",
  ]);
});

test("les liens migrés respectent la base, les ancres et les paramètres", () => {
  for (const base of ["/", "/site-web/"]) {
    assert.equal(resolvePublicUrl("/site-web/permis-et-formations/piegeage/?source=menu#inscription", base), `${base}formations/piegeage/?source=menu#inscription`);
    assert.equal(resolvePublicUrl("/assets/documents/test.pdf", base), `${base}assets/documents/test.pdf`);
    assert.equal(resolvePublicUrl("#inscription", base), "#inscription");
    assert.equal(resolvePublicUrl("https://example.org/#inscription", base), "https://example.org/#inscription");
    assert.equal(resolvePublicUrl("/formations/?destination=https://example.org/#inscription", base), `${base}formations/?destination=https://example.org/#inscription`);
    const tree = { children: [{ type: "link", url: "/site-web/chasser-en-vendee/validation-du-permis/" }] };
    remarkLocalLinks({ base })(tree);
    assert.equal(tree.children[0].url, `${base}mes-demarches/valider-mon-permis/`);
  }
});

test("les anciennes pages rejoignent une seule destination principale", () => {
  const cases = {
    "permis-et-formations": "devenir-chasseur",
    "permis-et-formations/passer-son-permis": "mes-demarches/passer-mon-permis",
    "chasser-en-vendee/validation-du-permis": "mes-demarches/valider-mon-permis",
    "permis-et-formations/devenir-chasseur": "devenir-chasseur/comprendre-le-parcours",
    "permis-et-formations/chasse-accompagnee": "devenir-chasseur/chasse-accompagnee",
    "permis-et-formations/formations": "formations",
    "permis-et-formations/piegeage": "formations/piegeage",
    "nature-et-territoires": "nature-et-biodiversite",
    "nature-et-territoires/faune/cerf": "nature-et-biodiversite/faune/cerf",
    "nature-et-territoires/chassadapt": "mes-demarches/declarer-mes-prelevements",
    "chasser-en-vendee/decladom": "mes-demarches/declarer-un-degat/decladom",
    "chasser-en-vendee/espace-adherent": "mes-demarches/mon-espace",
    "actualites/archives": "actualites/archives",
    "assets/documents/test.pdf": "assets/documents/test.pdf",
  };
  for (const [old, destination] of Object.entries(cases)) {
    assert.equal(canonicalSlug(old), destination);
    assert.equal(canonicalSlug(destination), destination, "Le routage doit être idempotent.");
  }
});
