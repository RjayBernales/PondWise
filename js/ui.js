/* Shared, click-only information panels. Native popovers provide Escape/outside dismissal. */
(() => {
  let sequence = 0;
  const escape = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function info(title, text) {
    const id = 'pond-info-' + (++sequence);
    return `<span class="info-wrap"><button type="button" class="info-button" popovertarget="${id}" aria-label="Information about ${escape(title)}">${PondIcons('info')}</button><span id="${id}" class="info-popover" popover="auto" role="note"><strong>${escape(title)}</strong><span>${escape(text)}</span></span></span>`;
  }
  function compact(root) {
    root.querySelectorAll('.page-head > p:not(.eyebrow), .draft-note, .dash-footnote, .panel > small').forEach(p => {
      if (p.closest('.legal-page,.chat-shell')) return;
      const title = p.closest('section')?.querySelector('h2')?.textContent || 'About this page';
      p.outerHTML = info(title,p.textContent);
    });
    root.querySelectorAll('.panel > h2 + p:not(.empty), .section-title + p:not(.empty), .setting-row h2 + p').forEach(p => {
      // Keep saved values, statuses, notes and action guidance visible.
      if (p.closest('.water-panel,.legal-page,.profile-summary,.plan-card') || p.querySelector('strong,a,button') || /Revision|backup download|No |Not |required|unavailable/i.test(p.textContent)) return;
      p.outerHTML = info(p.previousElementSibling?.textContent || 'More information',p.textContent);
    });
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('[popovertarget]'); if (!button) return;
    const panel = document.getElementById(button.getAttribute('popovertarget')); if (!panel) return;
    const r = button.getBoundingClientRect(), width = Math.min(288,innerWidth-32);
    panel.style.width = width+'px'; panel.style.left = Math.max(16,Math.min(innerWidth-width-16,r.right-width))+'px';
    panel.style.top = Math.max(16,Math.min(innerHeight-250,r.bottom+8))+'px';
  });
  window.PondUI = {info, compact};
})();
