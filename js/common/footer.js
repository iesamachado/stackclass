// ═══════════════════════════════════════════════════════════════════════
//  STACKCLASS — Global Footer Component (Licencia Creative Commons)
// ═══════════════════════════════════════════════════════════════════════

export function getRootPrefix() {
  const path = window.location.pathname;
  if (path.includes('/games/')) return '../../../';
  if (path.includes('/temario/')) return '../';
  return '';
}

export const CC_SVG_MARK = `
<svg class="cc-logo-svg" viewBox="0 0 120 30" width="80" height="20" aria-label="Creative Commons BY-NC-SA" style="vertical-align:middle; display:inline-block;">
  <g fill="currentColor">
    <g transform="translate(2, 2)">
      <circle cx="13" cy="13" r="12" fill="none" stroke="currentColor" stroke-width="2.2"/>
      <path d="M12.2 10.4c-.5-.4-1.1-.6-1.8-.6-1.8 0-3 1.3-3 3.2 0 1.9 1.2 3.2 3 3.2.7 0 1.3-.2 1.8-.6l.7 1.3c-.7.5-1.6.8-2.5.8-2.8 0-4.7-2-4.7-4.7s1.9-4.7 4.7-4.7c1 0 1.8.3 2.5.8l-.7 1.3zm6.6 0c-.5-.4-1.1-.6-1.8-.6-1.8 0-3 1.3-3 3.2 0 1.9 1.2 3.2 3 3.2.7 0 1.3-.2 1.8-.6l.7 1.3c-.7.5-1.6.8-2.5.8-2.8 0-4.7-2-4.7-4.7s1.9-4.7 4.7-4.7c1 0 1.8.3 2.5.8l-.7 1.3z"/>
    </g>
    <g transform="translate(32, 2)">
      <circle cx="13" cy="13" r="12" fill="none" stroke="currentColor" stroke-width="2.2"/>
      <circle cx="13" cy="8.2" r="2.2"/>
      <path d="M10 12h6c.6 0 1 .4 1 1v4.5h-1.5V21h-2v-4h-1v4h-2v-3.5H9V13c0-.6.4-1 1-1z"/>
    </g>
    <g transform="translate(62, 2)">
      <circle cx="13" cy="13" r="12" fill="none" stroke="currentColor" stroke-width="2.2"/>
      <path d="M13 6.5v2m0 9v2M9.5 10.5c.5-.8 1.5-1.3 2.7-1.3 1.8 0 3 1 3 2.3 0 1.2-.8 1.9-2.2 2.2-1.4.3-1.8.7-1.8 1.3 0 .7.6 1.2 1.8 1.2 1.1 0 2-.4 2.5-1.1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="6.5" y1="19.5" x2="19.5" y2="6.5" stroke="currentColor" stroke-width="2"/>
    </g>
    <g transform="translate(92, 2)">
      <circle cx="13" cy="13" r="12" fill="none" stroke="currentColor" stroke-width="2.2"/>
      <path d="M13 7.5a5.5 5.5 0 1 1-4.8 2.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M7 7.5h3.2v3.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  </g>
</svg>`;

export function getFooterHtml() {
  const prefix = getRootPrefix();
  return `
    <div class="app-footer-inner">
      <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/deed.es" target="_blank" rel="license noopener noreferrer" class="footer-license-link" title="Licencia Creative Commons Atribución-NoComercial-CompartirIgual 4.0 Internacional">
        ${CC_SVG_MARK}
        <span>CC BY-NC-SA 4.0</span>
      </a>
      <span class="footer-sep" aria-hidden="true">·</span>
      <a href="${prefix}privacidad.html" class="footer-link">Privacidad y Condiciones de uso</a>
    </div>
  `.trim();
}

/**
 * Renderiza el pie de página.
 * Busca un contenedor por ID (por defecto 'app-footer') o añade un elemento footer al final del body si no existe.
 */
export function renderFooter(targetId = 'app-footer') {
  let target = document.getElementById(targetId);
  if (!target) {
    if (document.querySelector('.app-footer')) return; // Ya existe en el DOM
    target = document.createElement('footer');
    target.className = 'app-footer';
    target.setAttribute('role', 'contentinfo');
    document.body.appendChild(target);
  } else {
    target.className = 'app-footer';
    target.setAttribute('role', 'contentinfo');
  }
  target.innerHTML = getFooterHtml();
}

// Inicialización automática cuando el DOM está listo
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (document.getElementById('app-footer')) {
        renderFooter('app-footer');
      }
    });
  } else {
    if (document.getElementById('app-footer')) {
      renderFooter('app-footer');
    }
  }
}
