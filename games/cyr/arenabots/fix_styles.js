const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'css', 'styles.css');
let css = fs.readFileSync(cssPath, 'utf8');

// 1. Fix vs-badge
css = css.replace(/\.vs-badge\s*\{[^}]+\}/, `.vs-badge {
  font-family: var(--font-display);
  font-size: var(--fs-xl);
  font-weight: 900;
  color: var(--neon-magenta);
  flex-shrink: 0;
}`);

// 2. Add --text-btn to themes
css = css.replace(/(--neon-orange:\s*#ff8c00;)/, `$1\n  --text-btn: #05050d;`);
css = css.replace(/(--neon-orange:\s*#ff8c00;\s*)/, `$1\n  --text-btn: #ffffff;`); // Sketchbook
css = css.replace(/(--neon-orange:\s*#ff9900;)/, `$1\n  --text-btn: #ffffff;`); // Arcade
css = css.replace(/(--neon-orange:\s*#ff9500;)/, `$1\n  --text-btn: #ffffff;`); // Glass

// Actually, replacing --neon-orange might hit multiple things. 
// Let's do it safer by injecting before --color-player
css = css.replace(/--color-player:\s*var\(--neon-cyan\);/g, '--text-btn: #ffffff;\n  --color-player:  var(--neon-cyan);');
// Fix neon to be dark
css = css.replace(/(--bg-deep:\s*#05050d;[\s\S]*?)--text-btn:\s*#ffffff;/m, '$1--text-btn: #05050d;');

// 3. Update buttons to use --text-btn
css = css.replace(/(\.btn-primary\s*{[^}]*color:\s*)#05050d([^}]*})/, '$1var(--text-btn)$2');

// 4. Fix energy bar box shadows
css = css.replace(/box-shadow: 0 0 4px #0088ff/g, 'box-shadow: 0 0 4px var(--neon-cyan)');

// 5. Change .canvas-container background
css = css.replace(/(\.canvas-container\s*{[^}]*background:\s*)var\(--bg-secondary\)/, '$1var(--bg-primary)');
css = css.replace(/(\.canvas-container\s*{[^}]*border:\s*)1px solid rgba\(0,245,255,0\.15\)/, '$1var(--border-cyan)');

// 6. Fix nav-btn text color for inactive state in light themes. 
// Wait, --neon-cyan is blue in sketchbook, which is readable.
// But maybe nav buttons need --text-primary instead? 
css = css.replace(/(\.nav-btn\s*{[^}]*color:\s*)var\(--neon-cyan\)/, '$1var(--text-primary)');

// 7. Change default theme in CSS
css = css.replace(/:root, \[data-theme="neon"\]/, '[data-theme="neon"]');
css = css.replace(/\[data-theme="sketchbook"\]/, ':root, [data-theme="sketchbook"]');

fs.writeFileSync(cssPath, css, 'utf8');
console.log('Fixed styles!');
