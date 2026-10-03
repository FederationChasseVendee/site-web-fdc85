import type { ComponentChildren } from "preact";
import type { RenderContext, RenderEntry } from "../../lib/editor/model";
import { renderMarkdown, safeUrl } from "../../lib/editor/markdown";
import { isExternalUrl } from "../../lib/urls";

interface Props {
  entry: RenderEntry;
  context: RenderContext;
  children?: ComponentChildren;
}

interface Resource { label: string; url: string; type?: string; size?: string }
interface Image { src: string; alt: string; decorative: boolean; width?: number; height?: number }
interface IndexItem { title: string; text: string; meta?: string; url?: string; address?: string; phone?: string; email?: string }

function Link({ href, base, children, class: className }: { href: string; base: string; children: ComponentChildren; class?: string }) {
  const resolved = safeUrl(href, base);
  const external = resolved && isExternalUrl(resolved);
  return <a class={className} href={resolved} aria-disabled={!resolved || undefined}
    target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>
    {children}
    {external && <><span aria-hidden="true"> ↗</span><span class="sr-only"> (site externe, nouvel onglet)</span></>}
  </a>;
}

function Breadcrumbs({ slug, title, context }: { slug: string; title: string; context: RenderContext }) {
  const labels = new Map(context.entries.flatMap((entry) => {
    if ("title" in entry.data) return [[entry.slug, entry.data.title] as const];
    if ("name" in entry.data) return [[entry.slug, entry.data.name] as const];
    return [];
  }));
  labels.set("actualites", "Actualités");
  labels.set("actualites/archives", "Archives");
  const segments = slug.split("/");
  return <nav class="breadcrumbs container" aria-label="Fil d’Ariane"><ol>
    <li><a href={context.base}>Accueil</a></li>
    {segments.map((segment, index) => {
      const path = segments.slice(0, index + 1).join("/");
      return <li key={path}>{index === segments.length - 1
        ? <span aria-current="page">{title}</span>
        : <a href={safeUrl(`${path}/`, context.base)}>{labels.get(path) ?? segment}</a>}</li>;
    })}
  </ol></nav>;
}

function PageHeader({ slug, title, intro, image, context }: { slug: string; title: string; intro: string; image?: Image; context: RenderContext }) {
  return <><Breadcrumbs slug={slug} title={title} context={context} />
    <header class={`page-hero${image ? " page-hero-with-image" : ""}`}>
      {image && <img src={safeUrl(image.src, context.base)} alt={image.decorative ? "" : image.alt} width="1600" height="700" />}
      <div class="page-hero-shade" aria-hidden="true" />
      <div class="container page-hero-content"><h1>{title}</h1><p>{intro}</p></div>
    </header></>;
}

function Resources({ title, items, base }: { title: string; items: Resource[]; base: string }) {
  const id = `resources-${title.toLowerCase().replace(/\s+/g, "-")}`;
  return items.length > 0 ? <section class="resource-block" aria-labelledby={id}>
    <h2 id={id}>{title}</h2><ul class="resource-list">{items.map((item, index) => <li key={index}>
      <Link href={item.url} base={base}><strong>{item.label}</strong>
        {(item.type || item.size) && <span>{[item.type, item.size].filter(Boolean).join(" · ")}</span>}
      </Link></li>)}</ul>
  </section> : null;
}

const dateLabel = (date: Date) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(date);
const jsonScript = (value: unknown) => JSON.stringify(value).replaceAll("<", "\\u003c");

export function indexItems(entry: Extract<RenderEntry, { collection: "indexes" }>, context: RenderContext): IndexItem[] {
  const { source, category } = entry.data;
  const items = context.entries.filter((item) => item.collection === source);
  const matches = (value: string) => !category || category === value;
  switch (source) {
    case "articles": return items.filter((item) => item.collection === "articles")
      .filter((item) => matches(item.data.category)).sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
      .map((item) => ({ title: item.data.title, text: item.data.summary, meta: item.data.category, url: `${item.slug}/` }));
    case "species": return items.filter((item) => item.collection === "species").filter((item) => matches(item.data.category))
      .map((item) => ({ title: item.data.name, text: item.data.identification, meta: item.data.category, url: `${item.slug}/` }));
    case "trainings": return items.filter((item) => item.collection === "trainings")
      .map((item) => ({ title: item.data.title, text: item.data.summary, meta: item.data.duration, url: `${item.slug}/` }));
    case "documents": return items.filter((item) => item.collection === "documents").filter((item) => matches(item.data.category))
      .map((item) => ({ title: item.data.title, text: item.data.description, meta: [item.data.fileType, item.data.fileSize].filter(Boolean).join(" · "), url: item.data.file }));
    case "faqs": return items.filter((item) => item.collection === "faqs").sort((a, b) => a.data.order - b.data.order)
      .map((item) => ({ title: item.data.question, text: item.data.answer, meta: item.data.category }));
    case "glossary": return items.filter((item) => item.collection === "glossary").sort((a, b) => a.data.term.localeCompare(b.data.term, "fr"))
      .map((item) => ({ title: item.data.term, text: item.data.definition }));
    case "directories": return items.filter((item) => item.collection === "directories")
      .filter((item) => !category || item.data.category.toLocaleLowerCase("fr").includes(category.toLocaleLowerCase("fr")))
      .sort((a, b) => a.data.order - b.data.order || a.data.name.localeCompare(b.data.name, "fr"))
      .map((item) => ({
        title: item.data.name, text: item.data.description,
        meta: [item.data.role, item.data.category].filter(Boolean).join(" · "),
        url: item.data.website, address: item.data.address, phone: item.data.phone, email: item.data.email,
      }));
  }
}

export default function SiteContent({ entry, context, children }: Props) {
  const { base } = context;
  const body = { __html: renderMarkdown(entry.body, base) };
  switch (entry.collection) {
    case "standardPages": {
      const data = entry.data;
      return <><PageHeader slug={entry.slug} title={data.title} intro={data.intro} image={data.hero} context={context} />
        <div class="container content-layout"><article class="prose" dangerouslySetInnerHTML={body} />
          <Resources title="Documents à télécharger" items={data.documents} base={base} />
          <Resources title="Liens utiles" items={data.links} base={base} />
        </div>
        {data.cta && <aside class="cta-panel"><div class="container"><div>
          <h2>{data.cta.title}</h2>{data.cta.text && <p>{data.cta.text}</p>}
        </div><Link class="button button-light" href={data.cta.action.url} base={base}>{data.cta.action.label}</Link></div></aside>}
      </>;
    }
    case "articles": {
      const data = entry.data;
      const expired = data.expiresAt && data.expiresAt < new Date(context.now);
      const canonical = new URL(safeUrl(`${entry.slug}/`, base) ?? base, context.siteUrl).href;
      const structured = {
        "@context": "https://schema.org", "@type": "NewsArticle", headline: data.title,
        description: data.summary, datePublished: data.date.toISOString(), mainEntityOfPage: canonical,
        publisher: { "@type": "Organization", name: "Fédération Départementale des Chasseurs de la Vendée", url: new URL(base, context.siteUrl).href },
        ...(data.image ? { image: new URL(safeUrl(data.image.src, base) ?? base, context.siteUrl).href } : {}),
      };
      return <><Breadcrumbs slug={entry.slug} title={data.title} context={context} /><article>
        <header class="article-header container"><p class="eyebrow">{data.category}</p>
          <h1>{data.title}</h1><p class="lead">{data.summary}</p>
          <p class="meta">Publié le <time datetime={data.date.toISOString()}>{dateLabel(data.date)}</time></p>
          {(data.archived || expired) && <p class="status-message" role="status">Cette information est archivée. Vérifiez qu’elle est encore applicable.</p>}
          {data.image && <img src={safeUrl(data.image.src, base)} alt={data.image.decorative ? "" : data.image.alt}
            width={data.image.width ?? 1200} height={data.image.height ?? 675} fetchpriority="high" decoding="async" />}
        </header><div class="container content-layout"><div class="prose" dangerouslySetInnerHTML={body} />
          <Resources title="Documents associés" items={data.documents} base={base} />
        </div></article>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonScript(structured) }} />
      </>;
    }
    case "crossroads": {
      const data = entry.data;
      const generated = context.entries.flatMap((child) => {
        if (child.collection !== data.childrenFrom) return [];
        switch (child.collection) {
          case "articles": case "trainings": return [{ title: child.data.title, text: child.data.summary, url: `${child.slug}/` }];
          case "species": return [{ title: child.data.name, text: child.data.identification, url: `${child.slug}/` }];
          case "indexes": return child.slug.startsWith(`${entry.slug}/`) ? [{ title: child.data.title, text: child.data.intro, url: `${child.slug}/` }] : [];
          default: return [];
        }
      });
      const cards = [...data.cards, ...generated].filter((card, index, list) => list.findIndex((candidate) => candidate.url === card.url) === index);
      return <><PageHeader slug={entry.slug} title={data.title} intro={data.intro} image={data.hero} context={context} />
        <div class="container content-layout"><article class="prose" dangerouslySetInnerHTML={body} />
          <section aria-label={`Accès proposés dans ${data.title}`}><div class="card-grid">
            {cards.map((card, index) => <article class="link-card" key={index}>
              <h2><Link href={card.url} base={base}>{card.title}</Link></h2><p>{card.text}</p>
            </article>)}
          </div></section>
        </div></>;
    }
    case "species": {
      const data = entry.data;
      const sections = [["Identification", data.identification], ["Habitat", data.habitat], ["Alimentation", data.diet],
        ["Reproduction", data.reproduction], ["Répartition", data.distribution], ["Statut et menaces", data.statusAndThreats]];
      return <><PageHeader slug={entry.slug} title={data.name} intro={data.category} image={data.image} context={context} />
        <div class="container content-layout"><dl class="species-details">{sections.map(([label, value]) =>
          <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          {data.gallery.length > 0 && <section aria-labelledby="gallery-title"><h2 id="gallery-title">Galerie</h2>
            <div class="gallery">{data.gallery.map((image, index) => <img key={index} src={safeUrl(image.src, base)}
              alt={image.decorative ? "" : image.alt} width="600" height="400" loading="lazy" />)}</div>
          </section>}
        </div></>;
    }
    case "trainings": {
      const data = entry.data;
      const facts = [["Public", data.audience], ["Prérequis", data.prerequisites], ["Durée", data.duration], ["Lieu", data.location], ["Tarif", data.price]];
      return <><PageHeader slug={entry.slug} title={data.title} intro={data.summary} context={context} />
        <div class="container content-layout training-layout">
          <section class="key-facts" aria-label="Informations pratiques"><dl>{facts.map(([label, value]) =>
            <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>
          <section class="prose"><h2>Objectifs</h2><ul>{data.objectives.map((value, index) => <li key={index}>{value}</li>)}</ul>
            <h2>Programme</h2><ol>{data.program.map((value, index) => <li key={index}>{value}</li>)}</ol></section>
          <section aria-labelledby="training-dates"><h2 id="training-dates">Prochaines dates</h2>
            {data.dates.length > 0 ? <ul class="date-list">{data.dates.map((item, index) => <li key={index}>
              <time datetime={item.date.toISOString()}>{dateLabel(item.date)}</time>
              {item.endDate && <> au <time datetime={item.endDate.toISOString()}>{dateLabel(item.endDate)}</time></>}
              {item.note && <span>{item.note}</span>}
            </li>)}</ul> : <p>Aucune date n’est programmée pour le moment.</p>}
            <Link class="button button-dark" href={data.registrationUrl} base={base}>S’inscrire à cette formation</Link>
          </section><Resources title="Documents de la formation" items={data.documents} base={base} />
        </div></>;
    }
    case "indexes": {
      const data = entry.data;
      const items = indexItems(entry, context);
      return <><PageHeader slug={entry.slug} title={data.title} intro={data.intro} image={data.hero} context={context} />
        <div class="container content-layout"><article class="prose" dangerouslySetInnerHTML={body} />
          {data.links.length > 0 && <nav class="section-links" aria-label="Autres ressources">{data.links.map((link, index) =>
            <Link key={index} class="button button-outline" href={link.url} base={base}>{link.label}</Link>)}</nav>}
          {items.length > 0 ? <div class={`index-items${data.display === "cards" ? " card-grid" : ""}`}>{items.map((item, index) =>
            <article class="index-item" key={index}>{item.meta && <p class="eyebrow">{item.meta}</p>}
              <h2>{item.url ? <Link href={item.url} base={base}>{item.title}</Link> : item.title}</h2><p>{item.text}</p>
              {item.address && <p>{item.address}</p>}
              {(item.phone || item.email) && <p class="directory-contacts">
                {item.phone && <Link href={`tel:${item.phone.replace(/[^\d+]/g, "")}`} base={base}>{item.phone}</Link>}
                {item.phone && item.email && <span aria-hidden="true"> · </span>}
                {item.email && <Link href={`mailto:${item.email}`} base={base}>{item.email}</Link>}
              </p>}
            </article>)}</div> : <p class="empty-message">{data.emptyMessage}</p>}
        </div></>;
    }
    case "home": {
      const data = entry.data;
      const articles = context.entries.filter((item) => item.collection === "articles")
        .filter((item) => !item.data.archived && !(item.data.expiresAt && item.data.expiresAt < new Date(context.now)))
        .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
      const alerts = articles.filter((item) => item.data.category === "Alertes").slice(0, 3);
      const news = articles.filter((item) => item.data.category !== "Alertes").slice(0, 3);
      return <><section class="home-hero">
        <img src={safeUrl(data.hero.image, base)} alt={data.hero.imageAlt} width="1600" height="760" fetchpriority="high" />
        <div class="home-hero-shade" aria-hidden="true" /><div class="container home-hero-content">
          <p class="eyebrow eyebrow-light">{data.hero.eyebrow}</p><h1>{data.hero.title}</h1><p>{data.hero.text}</p>
          <div class="button-row"><Link class="button button-primary" href="chasser-en-vendee/validation-du-permis/" base={base}>Valider mon permis</Link>
            <Link class="button button-light" href="contact/" base={base}>Contact</Link></div>
        </div></section>
        {children ?? <section class="weather-section"><div class="container weather-inner"><div class="weather-intro">
          <h2>La météo en Vendée</h2><p>Conditions à La Roche-sur-Yon, à titre indicatif pour le département.</p>
        </div><p>Météo en direct désactivée dans l’aperçu.</p></div></section>}
        <section class="section task-section" aria-labelledby="task-title"><div class="container">
          <div class="section-heading"><h2 id="task-title">{data.tasks.title}</h2><p>{data.tasks.intro}</p></div>
          <div class="task-grid">{data.tasks.items.map((item, index) => <article class="task-card" key={index}>
            <h3><Link href={item.url} base={base}>{item.title}</Link></h3><p>{item.text}</p>
          </article>)}</div>
        </div></section>
        {alerts.length > 0 && <section class="section alerts-section" aria-labelledby="alerts-title"><div class="container">
          <div class="section-heading"><p class="eyebrow">À vérifier en priorité</p><h2 id="alerts-title">Alertes en cours</h2></div>
          <div class="card-grid">{alerts.map((item) => <article class="index-item alert-card" key={item.slug}>
            <p class="news-date">Publié le <time datetime={item.data.date.toISOString()}>{dateLabel(item.data.date)}</time></p>
            <h3><Link href={`${item.slug}/`} base={base}>{item.data.title}</Link></h3><p>{item.data.summary}</p>
            <p class="read-more-row"><Link href={`${item.slug}/`} base={base}>Lire l’alerte : {item.data.title}</Link></p>
          </article>)}</div>
        </div></section>}
        <section class="section news-section" aria-labelledby="news-title"><div class="container">
          <div class="section-heading section-heading-row"><div><h2 id="news-title">{data.news.title}</h2><p>{data.news.intro}</p></div>
            <Link class="button button-outline" href={data.news.action.url} base={base}>{data.news.action.label}</Link>
          </div><div class="card-grid">{news.map((item) => <article class="index-item" key={item.slug}>
            <p class="eyebrow">{item.data.category}</p><h3><Link href={`${item.slug}/`} base={base}>{item.data.title}</Link></h3>
            <p class="news-date">Publié le <time datetime={item.data.date.toISOString()}>{dateLabel(item.data.date)}</time></p><p>{item.data.summary}</p>
            <p class="read-more-row"><Link href={`${item.slug}/`} base={base}>Lire l’article : {item.data.title}</Link></p>
          </article>)}</div>
        </div></section>
        <section class="section institution-section" aria-labelledby="institution-title"><div class="container institution-inner"><div>
          <h2 id="institution-title">{data.institution.title}</h2><p>{data.institution.text}</p>
        </div><Link class="button button-light" href={data.institution.action.url} base={base}>{data.institution.action.label}</Link></div></section>
        <section class="section contact-strip" aria-labelledby="contact-title"><div class="container"><div><h2 id="contact-title">Besoin d’aide ?</h2>
          <p>Appelez le <a href="tel:+33251478090">02 51 47 80 90</a> ou consultez nos coordonnées et horaires.</p>
        </div><Link class="button button-dark" href="contact/" base={base}>Voir les contacts</Link></div></section>
      </>;
    }
    case "redirects": return <><Breadcrumbs slug={entry.slug} title={entry.data.title} context={context} /><div class="container content-layout">
      <h1>{entry.data.title}</h1><p>Aperçu de redirection : aucune redirection automatique ici.</p>
      <Link href={entry.data.destination} base={base}>Destination : {entry.data.destination}</Link>
    </div></>;
    default: return <p>Cette ressource est affichée dans un index, pas sur une page individuelle.</p>;
  }
}
