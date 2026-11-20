import { ArrowRight, ArrowUpRight, CalendarDays, ChartNoAxesCombined, Check, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import LandingNav from "./LandingNav";
import AppPreview from "./AppPreview";
import NetworkLogo, { NETWORK_LABELS, type LandingNetwork } from "./NetworkLogo";
import { ComposerPreview, MonthPreview, InsightsPreview, CommentsPreview, MediaPreview } from "./FeaturePreviews";
import Reveal from "./Reveal";
import "./landing.css";
import "./stone-reference.css";

const networks: LandingNetwork[] = ["instagram","threads","youtube","tiktok","pinterest"];
const stats = [{value:"1",label:"espace de travail",note:"Pour tous vos réseaux"},{value:"∞",label:"idées & contenus",note:"Organisez votre créativité"},{value:"24/7",label:"calendrier clair",note:"Anticipez chaque publication"},{value:"5",label:"plateformes",note:"Centralisées dans Stone"}];
const plans = [{name:"Starter",price:"19",description:"Pour structurer votre présence.",features:["3 canaux sociaux","10 publications par canal","Insights de base","Calendrier éditorial"]},{name:"Pro",price:"49",description:"Pour publier sans limite.",features:["Tous les canaux","Publications illimitées","Insights avancés","Idées illimitées"],featured:true},{name:"Enterprise",price:"99",description:"Pour les équipes ambitieuses.",features:["Tout inclus dans Pro","Limites personnalisées","Support prioritaire","Accompagnement"]}];
const faq = [{q:"Qu’est-ce que Stone ?",a:"Stone centralise la création, la programmation et le suivi de vos contenus sociaux dans un seul espace."},{q:"Quels réseaux sont pris en charge ?",a:"Instagram, Threads et YouTube disposent de connexions disponibles. TikTok et Pinterest sont actuellement en sandbox."},{q:"Puis-je adapter un post à chaque plateforme ?",a:"Oui, le contenu peut être adapté selon les réseaux sélectionnés depuis le composer."},{q:"Quelles données sont disponibles ?",a:"Les indicateurs et commentaires accessibles dépendent des plateformes et autorisations. Les Insights et commentaires sont actuellement principalement disponibles pour YouTube."}];

function scroll(id:string){document.getElementById(id)?.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});}
function SectionTitle({tag,title,description}:{tag:string,title:ReactNode,description?:string}){return <Reveal className="stone-ref-heading"><span className="stone-ref-tag">{tag}</span><h2>{title}</h2>{description&&<p>{description}</p>}</Reveal>}

export default function LandingPage(){
 return <main className="stone-ref-page">
   <div className="stone-ref-frame">
    <LandingNav/>
    <section className="stone-ref-hero" id="accueil">
      <span className="stone-ref-pill"><Sparkles size={12}/> Social media workspace</span>
      <h1>Build your presence.<br/><em>Not your workload.</em></h1>
      <p>Planifiez, créez et publiez votre contenu sur plusieurs réseaux depuis un espace pensé pour simplifier votre quotidien.</p>
      <div className="stone-ref-actions"><a className="stone-ref-primary" href="/signup">Commencer gratuitement <ArrowRight size={16}/></a><button className="stone-ref-secondary" onClick={()=>scroll("produit")}>Découvrir Stone <ArrowUpRight size={15}/></button></div>
      <div className="stone-ref-mockup">
        <div className="stone-ref-collage stone-ref-collage-left"><ComposerPreview/></div>
        <div className="stone-ref-collage stone-ref-collage-right"><MonthPreview/></div>
        <div className="stone-ref-main-preview"><AppPreview/></div>
        <div className="stone-ref-floating stone-ref-floating-top"><CalendarDays size={16}/><span><b>Publication planifiée</b><small>Votre calendrier centralisé</small></span><Check size={14}/></div>
        <div className="stone-ref-floating stone-ref-floating-bottom"><ChartNoAxesCombined size={17}/><span><b>Vos performances</b><small>Les résultats en un coup d’œil</small></span></div>
      </div>
      <div className="stone-ref-slogan"><span>Créer</span><i>·</i><span>Planifier</span><i>·</i><span>Publier</span><i>·</i><span>Analyser</span></div>
    </section>
    <section className="stone-ref-stats">
      <div className="stone-ref-about"><span className="stone-ref-tag">Pourquoi Stone</span><h2>Tout votre social.<br/><em>Au même endroit.</em></h2><p>Un espace de travail qui vous laisse vous concentrer sur vos idées, plutôt que sur les outils et les allers-retours.</p><a href="/signup">À propos de Stone <ArrowUpRight size={15}/></a></div>
      <div className="stone-ref-stat-grid">{stats.map((s,i)=><Reveal key={s.label} delay={i*60}><article><strong>{s.value}</strong><b>{s.label}</b><p>{s.note}</p></article></Reveal>)}</div>
    </section>
    <section className="stone-ref-projects" id="produit">
      <SectionTitle tag="Le workspace" title={<>Everything you need.<br/><em>Nothing in the way.</em></>} description="Les outils essentiels réunis dans une interface lisible et calme."/>
      <div className="stone-ref-project-grid">
       <Reveal className="stone-ref-project-card stone-ref-project-wide"><span className="stone-ref-tag">01 · Composer</span><h3>Préparez votre contenu en un seul endroit.</h3><p>Écrivez, ajoutez vos médias et adaptez vos posts aux réseaux.</p><ComposerPreview/></Reveal>
       <Reveal className="stone-ref-project-card"><span className="stone-ref-tag">02 · Calendar</span><h3>Gardez le cap.</h3><p>Une vue claire de vos publications à venir.</p><MonthPreview/></Reveal>
       <Reveal className="stone-ref-project-card"><span className="stone-ref-tag">03 · Insights</span><h3>Comprenez ce qui fonctionne.</h3><p>Suivez les indicateurs disponibles.</p><InsightsPreview/></Reveal>
       <Reveal className="stone-ref-project-card stone-ref-project-wide"><span className="stone-ref-tag">04 · Media library</span><h3>Vos ressources, sans friction.</h3><p>Importez et préparez vos médias pour vos publications.</p><MediaPreview/></Reveal>
       <Reveal className="stone-ref-project-card stone-ref-project-wide"><span className="stone-ref-tag">05 · Community</span><h3>Ne perdez pas le fil.</h3><p>Retrouvez les conversations et commentaires disponibles.</p><CommentsPreview/></Reveal>
      </div>
    </section>
    <section className="stone-ref-networks" id="reseaux">
      <SectionTitle tag="Connect your channels" title={<>One calendar.<br/><em>Multiple platforms.</em></>} description="Connectez vos comptes et gérez votre contenu dans un même workflow."/>
      <div className="stone-ref-network-grid">{networks.map((n,i)=><Reveal key={n} delay={i*45}><article><NetworkLogo network={n} size={38}/><strong>{NETWORK_LABELS[n]}</strong><span>{i<3?"Connexion disponible":"Sandbox"}</span></article></Reveal>)}</div>
    </section>
    <section className="stone-ref-how" id="fonctionnalites">
      <SectionTitle tag="Workflow" title={<>Three steps.<br/><em>More time to create.</em></>} />
      <div className="stone-ref-how-grid">{[{n:"01",t:"Connectez",d:"Reliez vos comptes sociaux."},{n:"02",t:"Créez & planifiez",d:"Préparez vos posts et programmez-les."},{n:"03",t:"Suivez",d:"Consultez vos résultats et ajustez."}].map((s,i)=><Reveal key={s.n} delay={i*80}><article><span>{s.n}</span><h3>{s.t}</h3><p>{s.d}</p></article></Reveal>)}</div>
    </section>
    <section className="stone-ref-pricing" id="tarifs"><SectionTitle tag="Pricing" title={<>A plan for your<br/><em>next chapter.</em></>} description="Choisissez l'espace qui correspond à votre rythme."/><div className="stone-ref-price-grid">{plans.map((p,i)=><Reveal key={p.name} delay={i*70}><article className={p.featured?"is-featured":""}><span className="stone-ref-plan-name">{p.name}</span><p>{p.description}</p><div className="stone-ref-price"><strong>{p.price}€</strong><small>/ mois</small></div><a href="/pricing">Voir l’offre <ArrowRight size={14}/></a><ul>{p.features.map(f=><li key={f}><Check size={14}/>{f}</li>)}</ul></article></Reveal>)}</div></section>
    <section className="stone-ref-faq" id="faq"><div><span className="stone-ref-tag">FAQ</span><h2>Questions,<br/><em>answered.</em></h2></div><div className="stone-ref-faq-list">{faq.map((item,i)=><Reveal key={item.q}><details open={i===0}><summary>{item.q}<span>+</span></summary><p>{item.a}</p></details></Reveal>)}</div></section>
    <section className="stone-ref-cta"><span className="stone-ref-tag">STONE WORKSPACE</span><h2>Less managing.<br/><em>More creating.</em></h2><p>Commencez à organiser votre présence sociale.</p><a className="stone-ref-primary" href="/signup">Commencer gratuitement <ArrowRight size={16}/></a></section>
    <footer className="stone-ref-footer"><a href="/" className="stone-ref-logo"><img src="/images/icon.png" alt=""/>stone.</a><span>Votre présence sociale, simplifiée.</span><nav><a href="/pricing">Tarifs</a><a href="/faq">FAQ</a><a href="/privacy">Confidentialité</a><a href="/tos">Conditions</a></nav><small>© Stone</small></footer>
   </div>
 </main>;
}
