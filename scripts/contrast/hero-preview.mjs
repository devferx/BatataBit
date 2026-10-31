// CSS inyectable para previsualizar el hero sin tocar archivos.
// Hero actual por debajo de 930px; a partir de 930px, la maqueta propuesta en PHASE5-PROPOSAL.md
// (tipografía tablet 40/42 + 20/24, medida de 466px, hero de 480px, CTA centrado en el borde inferior).
export const BREAKPOINT = 930;

export const gradientCss = (stop) =>
  `header{background:linear-gradient(207.8deg,#201e1c ${stop}%,#f7931a 100%)!important}`;

export const leadColorCss = (color) => `header p{color:${color}!important}`;

export const layoutCss = (width) =>
  width < BREAKPOINT
    ? ""
    : `header{height:480px!important;justify-content:flex-start!important;padding-top:43px}
.header--title-container{height:auto!important;max-width:none!important}
.section-title{max-width:466px;margin-inline:auto}
header h1{font-size:4rem!important;line-height:4.2rem!important}
header p{font-size:2rem!important;line-height:2.4rem!important}
.hero-cta{top:auto!important;bottom:0!important;left:0!important;right:0!important;margin:0!important;display:flex;justify-content:center;transform:translateY(50%)}`;

export const OPTIONS = [
  { id: "1-current", label: "1. Current: dark stop 16.69%, lead #FFE9D4", stop: 16.69, lead: "#FFE9D4" },
  { id: "2-stop55-white-lead", label: "2. Dark stop 55%, lead #FFFFFF", stop: 55, lead: "#FFFFFF" },
  { id: "3-stop65-soft-lead", label: "3. Dark stop 65%, lead #FFE9D4", stop: 65, lead: "#FFE9D4" },
];
