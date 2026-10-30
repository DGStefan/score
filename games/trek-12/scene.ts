/**
 * Achtergrond van de kaart: een eigen getekend Himalaya-landschap (SVG),
 * in de sfeer van het blad: mintgroene bergen, sneeuwtoppen, gebedsvlaggen,
 * een huisje links en een stoepa rechts. viewBox 0 0 1000 620.
 */

const FLAG_COLORS = ['#3b7fd1', '#f4f1e8', '#d8453b', '#3f9e5a', '#f2c230'];

function flags(x1: number, y1: number, x2: number, y2: number, sag: number, count: number): string {
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2 + sag;
  let out = `<path d="M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}" fill="none" stroke="#6b5a48" stroke-width="1.5"/>`;
  for (let i = 1; i <= count; i++) {
    const t = i / (count + 1);
    const x = (1 - t) ** 2 * x1 + 2 * (1 - t) * t * cx + t ** 2 * x2;
    const y = (1 - t) ** 2 * y1 + 2 * (1 - t) * t * cy + t ** 2 * y2;
    const color = FLAG_COLORS[i % FLAG_COLORS.length];
    out += `<path d="M${(x - 9).toFixed(1)} ${y.toFixed(1)} h18 l-2 22 h-14 z" fill="${color}" opacity="0.92"/>`;
  }
  return out;
}

export const SCENE_SVG = `
<defs>
  <linearGradient id="t12-sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#e3f4ef"/>
    <stop offset="1" stop-color="#b9e3d7"/>
  </linearGradient>
  <linearGradient id="t12-far" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#a9d9cb"/>
    <stop offset="1" stop-color="#8ccbb8"/>
  </linearGradient>
  <linearGradient id="t12-mid" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#6fbfa6"/>
    <stop offset="1" stop-color="#4fa58c"/>
  </linearGradient>
  <linearGradient id="t12-near" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#5fb38f"/>
    <stop offset="1" stop-color="#3f9373"/>
  </linearGradient>
  <linearGradient id="t12-grass" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#9cc96f"/>
    <stop offset="1" stop-color="#6fa54e"/>
  </linearGradient>
</defs>

<rect width="1000" height="620" fill="url(#t12-sky)"/>
<g opacity="0.7" fill="#ffffff">
  <ellipse cx="160" cy="70" rx="90" ry="16"/>
  <ellipse cx="230" cy="58" rx="60" ry="14"/>
  <ellipse cx="760" cy="44" rx="110" ry="15"/>
</g>

<!-- verre bergketen met sneeuw -->
<path d="M0 230 L70 150 L120 185 L210 70 L290 160 L350 120 L430 30 L520 150 L590 90 L680 170 L760 60 L850 150 L920 100 L1000 160 L1000 620 L0 620 Z" fill="url(#t12-far)"/>
<g fill="#ffffff" opacity="0.92">
  <path d="M210 70 L178 112 L196 106 L210 120 L226 104 L246 116 Z"/>
  <path d="M430 30 L392 84 L414 76 L432 92 L450 74 L474 88 Z"/>
  <path d="M760 60 L726 106 L746 98 L762 112 L780 96 L800 106 Z"/>
  <path d="M590 90 L566 122 L582 118 L594 128 L608 116 L620 124 Z"/>
  <path d="M920 100 L898 128 L914 124 L926 134 L940 122 Z"/>
</g>

<!-- middelste keten -->
<path d="M0 330 L90 250 L160 290 L260 190 L340 260 L420 210 L520 300 L610 220 L700 280 L800 200 L890 270 L1000 230 L1000 620 L0 620 Z" fill="url(#t12-mid)"/>
<g fill="#ffffff" opacity="0.55">
  <path d="M260 190 L238 220 L254 214 L266 226 L280 212 Z"/>
  <path d="M800 200 L776 232 L794 226 L806 238 L822 222 Z"/>
  <path d="M610 220 L592 246 L606 242 L616 250 L628 240 Z"/>
</g>

<!-- voorste heuvels -->
<path d="M0 430 C120 380 220 420 330 400 C450 378 560 430 680 410 C800 390 900 420 1000 400 L1000 620 L0 620 Z" fill="url(#t12-near)"/>
<path d="M0 520 C140 490 260 530 400 515 C540 500 650 540 800 522 C900 510 960 520 1000 512 L1000 620 L0 620 Z" fill="url(#t12-grass)"/>
<path d="M120 620 C220 570 330 590 420 560 C500 534 560 560 640 548" fill="none" stroke="#c9b48c" stroke-width="10" stroke-linecap="round" opacity="0.6"/>

<!-- huisje links -->
<g>
  <rect x="-10" y="420" width="96" height="200" fill="#ece1cb"/>
  <rect x="-10" y="420" width="96" height="200" fill="none" stroke="#b9a684" stroke-width="2"/>
  <path d="M-24 426 L40 372 L104 426 Z" fill="#8b5a36"/>
  <path d="M-24 426 L104 426 L104 436 L-24 436 Z" fill="#6e4426"/>
  <rect x="18" y="470" width="40" height="34" fill="#b8473c"/>
  <rect x="24" y="476" width="28" height="22" fill="#3d2b23"/>
  <rect x="18" y="540" width="40" height="34" fill="#b8473c"/>
  <rect x="24" y="546" width="28" height="22" fill="#3d2b23"/>
  <line x1="78" y1="372" x2="70" y2="230" stroke="#7a6146" stroke-width="3"/>
</g>
${flags(72, 236, 168, 330, 6, 4)}

<!-- stoepa rechts -->
<g>
  <rect x="890" y="540" width="120" height="80" fill="#d9ccb2"/>
  <rect x="902" y="500" width="96" height="44" fill="#e7dcc4"/>
  <path d="M912 500 C912 452 988 452 988 500 Z" fill="#f6f2ea"/>
  <rect x="938" y="430" width="24" height="26" fill="#e3c25b"/>
  <path d="M950 380 L940 432 L960 432 Z" fill="#d6a93c"/>
  <circle cx="950" cy="376" r="5" fill="#d6a93c"/>
  <rect x="890" y="540" width="120" height="80" fill="none" stroke="#b5a585" stroke-width="2"/>
</g>
${flags(950, 380, 1010, 470, 10, 3)}
${flags(820, 30, 1000, 90, 26, 7)}

<!-- stenen en steenmannetjes -->
<g fill="#a9a395">
  <ellipse cx="150" cy="590" rx="34" ry="14"/>
  <ellipse cx="740" cy="596" rx="44" ry="16"/>
  <ellipse cx="840" cy="584" rx="22" ry="10"/>
</g>
<g fill="#bdb6a6">
  <ellipse cx="700" cy="590" rx="18" ry="8"/>
  <ellipse cx="700" cy="578" rx="13" ry="6"/>
  <ellipse cx="700" cy="568" rx="9" ry="5"/>
  <ellipse cx="700" cy="560" rx="6" ry="4"/>
</g>
`;
