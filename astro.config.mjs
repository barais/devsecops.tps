// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import vue from '@astrojs/vue';

/**
 * Plugin remark : convertit les blocs ```mermaid en <pre class="mermaid">
 * avant qu'Expressive Code ne les intercepte.
 */
function remarkMermaid() {
  return (tree) => {
    function walk(node) {
      if (node.type === 'code' && node.lang === 'mermaid') {
        node.type  = 'html';
        node.value = `<pre class="mermaid">\n${node.value}\n</pre>`;
        delete node.lang;
        delete node.meta;
      }
      if (node.children) node.children.forEach(walk);
    }
    walk(tree);
  };
}

/**
 * Intégration Astro qui injecte le renderer Mermaid sur chaque page.
 * injectScript('page', ...) est bundlé par Vite → import local depuis node_modules,
 * pas de CDN, pas de composant override nécessaire.
 */
function mermaidIntegration() {
  return {
    name: 'mermaid-renderer',
    hooks: {
      'astro:config:setup': ({ injectScript }) => {
        injectScript('page', `
          console.log('[mermaid] ✓ script injecté et actif');

          async function renderMermaid() {
            console.log('[mermaid] renderMermaid() sur', location.pathname);

            let mermaid;
            try {
              const mod = await import('mermaid');
              mermaid = mod.default;
              console.log('[mermaid] ✓ import mermaid OK');
            } catch (err) {
              console.error('[mermaid] ✗ import mermaid ECHEC :', err);
              return;
            }

            mermaid.initialize({ startOnLoad: false, theme: 'neutral' });

            // Cas 1 : remarkMermaid → <pre class="mermaid">
            const simplePres = [...document.querySelectorAll('pre.mermaid:not([data-processed])')];
            console.log('[mermaid] pre.mermaid:', simplePres.length);
            if (simplePres.length > 0) {
              await mermaid.run({ nodes: simplePres });
              return;
            }

            // Cas 2 : Expressive Code → <pre data-language="mermaid">
            const ecPres = [...document.querySelectorAll('pre[data-language="mermaid"]')];
            console.log('[mermaid] pre[data-language=mermaid]:', ecPres.length);
            if (ecPres.length > 0) {
              for (const pre of ecPres) {
                const source = (pre.querySelector('code') ?? pre).textContent?.trim() ?? '';
                const id = 'mermaid-' + Math.random().toString(36).slice(2, 9);
                try {
                  const { svg } = await mermaid.render(id, source);
                  const div = Object.assign(document.createElement('div'), { innerHTML: svg });
                  (pre.closest('.expressive-code, figure') ?? pre).replaceWith(div);
                } catch (e) { console.error('[mermaid] erreur render:', e); }
              }
              return;
            }

            // Diagnostic si rien trouvé
            const allPres = [...document.querySelectorAll('pre')];
            console.log('[mermaid] aucun bloc mermaid.', allPres.length, 'pre(s) :', 
              allPres.map(p => (p.className || p.getAttribute('data-language') || '?')).join(', '));
          }

          // Starlight SPA : astro:page-load déclenché à chaque navigation
          document.addEventListener('astro:page-load', () => {
            console.log('[mermaid] astro:page-load ✓');
            renderMermaid();
          });

          // Fallback si astro:page-load ne se déclenche pas
          if (document.readyState !== 'loading') {
            renderMermaid();
          } else {
            document.addEventListener('DOMContentLoaded', renderMermaid);
          }
        `);
      },
    },
  };
}

export default defineConfig({

  site: 'https://olivier.barais.fr', // URL finale déployée (sitemaps, URL canoniques)
  base: '/devsecops.tps/',  // Chemin de base (ex. pour GitHub Pages)

  markdown: {
    remarkPlugins: [remarkMermaid],
  },
  integrations: [
    starlight({
      title: 'DevSecOps — TPs',
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/withastro/starlight' }],
      sidebar: [
        {
          label: 'Travaux Pratiques',
          items: [
            { label: 'TP 1 — uv, Git & CI', slug: 'tps/tp1-uv-git-ci' },
            { label: 'TP 2 — Docker', slug: 'tps/tp2-docker' },
            { label: 'TP 3 — Bandit, Gitleaks & SBOM', slug: 'tps/tp3-bandit-gitleaks-sbom' },
            { label: 'TP 4 — Reproductibilité avec Guix', slug: 'tps/tp4-guix' },
            { label: 'Projet — Audit de sécurité d\'un composant open source', slug: 'tps/projet-audit-oss' },
          ],
        },
      ],
    }),
    vue(),
    mermaidIntegration(),
  ],
});
