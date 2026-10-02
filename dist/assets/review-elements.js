export function install(frame, onSelect) {
  let annotating = false;
  const toggle = document.createElement('button');
  toggle.type = 'button'; toggle.id = 'comment-toggle'; toggle.textContent = 'Comment';
  toggle.setAttribute('aria-pressed', 'false');
  document.getElementById('review-actions').prepend(toggle);
  const help = document.getElementById('selection-help');
  let clear = () => {};
  toggle.addEventListener('click', () => {
    annotating = !annotating;
    toggle.setAttribute('aria-pressed', String(annotating));
    toggle.textContent = annotating ? 'Browse' : 'Comment';
    help.hidden = !annotating;
    clear();
  });
  frame.addEventListener('load', () => {
    const doc = frame.contentDocument;
    if (!doc?.body) return;
    const highlight = doc.createElement('div');
    highlight.setAttribute('aria-hidden', 'true');
    highlight.style.cssText = 'display:none;position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #075c9d;background:#075c9d15;';
    doc.body.append(highlight);
    clear = () => { highlight.style.display = 'none'; };
    const targetOf = node => node instanceof frame.contentWindow.Element ? node.closest('a,button,h1,h2,h3,h4,p,img,li,label,input,textarea,select,article,section,div,span') : null;
    const select = target => {
      const parts = [];
      for (let node = target; node && node !== doc.body; node = node.parentElement) {
        if (node.id) { parts.unshift(`#${CSS.escape(node.id)}`); break; }
        const siblings = [...node.parentElement.children].filter(sibling => sibling.tagName === node.tagName);
        parts.unshift(`${node.tagName.toLowerCase()}:nth-of-type(${siblings.indexOf(node) + 1})`);
      }
      onSelect({ selector: parts.join(' > '), text: (target.getAttribute('alt') || target.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 500), tag: target.tagName.toLowerCase() });
      clear();
    };
    doc.addEventListener('pointermove', event => {
      if (!annotating) return;
      const target = targetOf(event.target);
      if (!target) return clear();
      const rect = target.getBoundingClientRect();
      Object.assign(highlight.style, { display: 'block', top: `${rect.top}px`, left: `${rect.left}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    });
    doc.addEventListener('click', event => {
      if (!annotating) return;
      const target = targetOf(event.target);
      if (!target) return;
      event.preventDefault(); event.stopImmediatePropagation(); select(target);
    }, true);
    doc.addEventListener('keydown', event => {
      if (!annotating) return;
      if (event.key === 'Escape') { toggle.click(); toggle.focus(); return; }
      if (event.key === 'Enter' || event.key === ' ') {
        const target = targetOf(event.target);
        if (target) { event.preventDefault(); event.stopImmediatePropagation(); select(target); }
      }
    }, true);
    doc.addEventListener('scroll', clear, true);
    frame.contentWindow.addEventListener('resize', clear);
  });
}
