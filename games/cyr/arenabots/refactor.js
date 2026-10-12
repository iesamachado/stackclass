const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'css', 'styles.css');
let css = fs.readFileSync(cssPath, 'utf8');

// We will just do a direct string replace for the remaining hardcoded values,
// mapping them to existing variables with alpha (or just using transparent / semantic values).

const replacements = [
  // Validation
  { match: /background:\s*rgba\(57,255,20,0\.08\)/g, replace: 'background: var(--bg-badge)' },
  { match: /border:\s*1px solid rgba\(57,255,20,0\.2\)/g, replace: 'border: var(--border-badge)' },
  { match: /background:\s*rgba\(255,68,68,0\.08\)/g, replace: 'background: rgba(255,68,68,0.1)' }, // We'll just leave error as is or use a var. Wait, let's map it.
  
  // Actually, replacing all rgba with var() requires defining the vars.
  // Let's define the toast and validation variables in the script.
];

// Let's inject more vars to the :root
const neonExtra = `
  --bg-toast-success: rgba(57,255,20,0.1);
  --bg-toast-error:   rgba(255,68,68,0.1);
  --bg-toast-info:    rgba(0,245,255,0.1);
  --bg-toast-warning: rgba(255,230,0,0.1);
  --bg-val-ok:        rgba(57,255,20,0.08);
  --bg-val-err:       rgba(255,68,68,0.08);
  --bg-val-warn:      rgba(255,230,0,0.08);
  --bg-card-alt:      rgba(255,255,255,0.04);
  --bg-overlay-dark:  rgba(0,0,0,0.3);
`;
css = css.replace(/(--bg-cmd-repeat-hover:\s*rgba\(255,140,0,0\.15\);)/, `$1\n${neonExtra}`);

const sketchExtra = `
  --bg-toast-success: rgba(0,179,0,0.1);
  --bg-toast-error:   rgba(230,0,0,0.1);
  --bg-toast-info:    rgba(0,85,255,0.1);
  --bg-toast-warning: rgba(255,235,59,0.2);
  --bg-val-ok:        rgba(0,179,0,0.1);
  --bg-val-err:       rgba(230,0,0,0.1);
  --bg-val-warn:      rgba(255,235,59,0.2);
  --bg-card-alt:      transparent;
  --bg-overlay-dark:  rgba(0,0,0,0.05);
`;
css = css.replace(/(--bg-cmd-repeat-hover:\s*rgba\(255,140,0,0\.2\);)/, `$1\n${sketchExtra}`);

const arcadeExtra = `
  --bg-toast-success: #004400;
  --bg-toast-error:   #440000;
  --bg-toast-info:    #000044;
  --bg-toast-warning: #444400;
  --bg-val-ok:        #004400;
  --bg-val-err:       #440000;
  --bg-val-warn:      #444400;
  --bg-card-alt:      #000000;
  --bg-overlay-dark:  #000000;
`;
css = css.replace(/(--bg-cmd-repeat-hover:\s*#884400;)/, `$1\n${arcadeExtra}`);

const glassExtra = `
  --bg-toast-success: rgba(52,199,89,0.1);
  --bg-toast-error:   rgba(255,59,48,0.1);
  --bg-toast-info:    rgba(0,122,255,0.1);
  --bg-toast-warning: rgba(255,204,0,0.1);
  --bg-val-ok:        rgba(52,199,89,0.1);
  --bg-val-err:       rgba(255,59,48,0.1);
  --bg-val-warn:      rgba(255,204,0,0.1);
  --bg-card-alt:      rgba(255,255,255,0.4);
  --bg-overlay-dark:  rgba(0,0,0,0.05);
`;
css = css.replace(/(--bg-cmd-repeat-hover:\s*rgba\(255,149,0,0\.2\);)/, `$1\n${glassExtra}`);

// Toasts
css = css.replace(/(\.toast-success\s*{[^}]*background:\s*)rgba\(57,255,20,0\.1\)/, '$1var(--bg-toast-success)');
css = css.replace(/(\.toast-error\s*{[^}]*background:\s*)rgba\(255,68,68,0\.1\)/, '$1var(--bg-toast-error)');
css = css.replace(/(\.toast-info\s*{[^}]*background:\s*)rgba\(0,245,255,0\.1\)/, '$1var(--bg-toast-info)');
css = css.replace(/(\.toast-warning\s*{[^}]*background:\s*)rgba\(255,230,0,0\.1\)/, '$1var(--bg-toast-warning)');

// Validation
css = css.replace(/(\.validation-ok\s*{[^}]*background:\s*)rgba\(57,255,20,0\.08\)/, '$1var(--bg-val-ok)');
css = css.replace(/(\.validation-error\s*{[^}]*background:\s*)rgba\(255,68,68,0\.08\)/, '$1var(--bg-val-err)');
css = css.replace(/(\.validation-warn\s*{[^}]*background:\s*)rgba\(255,230,0,0\.08\)/, '$1var(--bg-val-warn)');

// Other common rgba
css = css.replace(/background:\s*rgba\(255,255,255,0\.04\)/g, 'background: var(--bg-card-alt)');
css = css.replace(/background:\s*rgba\(0,0,0,0\.3\)/g, 'background: var(--bg-overlay-dark)');
css = css.replace(/background:\s*rgba\(0,0,0,0\.2\)/g, 'background: var(--bg-overlay-dark)');

// Complex linear gradients to just use var(--bg-card) or transparent since they don't look good on flat themes
css = css.replace(/background:\s*linear-gradient\([^)]+\)/g, 'background: var(--bg-card-alt)');
css = css.replace(/background:\s*radial-gradient\([^)]+\)/g, 'background: var(--bg-card-alt)');
css = css.replace(/box-shadow:\s*var\(--glow-cyan\),\s*inset[^;]+;/g, 'box-shadow: var(--shadow-card);');
css = css.replace(/text-shadow:[^;]+;/g, '');

fs.writeFileSync(cssPath, css, 'utf8');
console.log('Refactor pass 2 complete!');
