(async () => {
  const { mode, token, key } = window.ieorReview;
  delete window.ieorReview;
  const frame = document.getElementById('site-frame');
  const dialog = document.getElementById('feedback-dialog');
  const form = document.getElementById('feedback-form');
  const status = document.getElementById('feedback-status');
  const send = document.getElementById('send-feedback');
  const confirmation = document.getElementById('confirmation');
  let selected = null, sending = false, ready = false;
  const endpoint = `${window.IEOR_REVIEW_API_BASE || ''}/api/review`;
  const request = async body => {
    const response = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Review-Token': token },
      body: JSON.stringify({ ...body, mode }), signal: AbortSignal.timeout(15000), credentials: 'omit', referrerPolicy: 'no-referrer'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) sessionStorage.removeItem(key);
      throw new Error(data.error || 'The review service is unavailable. Please try again.');
    }
    return data;
  };
  document.getElementById('exit-review').addEventListener('click', () => sessionStorage.removeItem(key));
  const initialize = async () => {
    if (ready) return;
    document.getElementById('retry').hidden = true;
    try {
      if (!token) throw new Error('Open the complete review link you received.');
      await request({ action: 'session' });
      sessionStorage.setItem(key, token);
      // Load element selection only for route a, after its token is validated.
      if (mode === 'a') {
        const { install } = await import('/assets/review-elements.js');
        install(frame, openFeedback);
      }
      ready = true;
      frame.hidden = false;
      document.getElementById('gate').hidden = true;
      document.getElementById('review-actions').hidden = false;
      frame.src = '/';
    } catch (error) {
      document.getElementById('gate-title').textContent = 'Unable to open this review.';
      document.getElementById('gate-message').textContent = error.message;
      document.getElementById('retry').hidden = false;
    }
  };
  frame.addEventListener('load', () => {
    try {
      const doc = frame.contentDocument;
      document.getElementById('current-page').textContent = doc.title.replace(' · IEOR IIT Bombay', '');
      // Keep external resources outside the review frame.
      doc.querySelectorAll('a[href]').forEach(link => {
        const url = new URL(link.href);
        if (url.origin !== location.origin) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
      });
    } catch { document.getElementById('current-page').textContent = 'Website review'; }
  });
  function openFeedback(target = null) {
    if (sending || !ready) return;
    selected = target;
    confirmation.textContent = '';
    status.textContent = '';
    form.comment.value = '';
    form.author.value = sessionStorage.getItem('ieor-review-name') || '';
    document.getElementById('feedback-title').textContent = target ? 'Feedback on this element' : 'General feedback';
    document.getElementById('feedback-context').textContent = target ? `${frame.contentWindow.location.pathname}\n“${target.text || target.tag}”` : `About ${frame.contentWindow.location.pathname}`;
    dialog.showModal();
    form.comment.focus();
  }
  document.getElementById('general-feedback').addEventListener('click', () => openFeedback());
  document.getElementById('close-feedback').addEventListener('click', () => { if (!sending) dialog.close(); });
  document.getElementById('retry').addEventListener('click', initialize);
  dialog.addEventListener('cancel', event => { if (sending) event.preventDefault(); });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending || !form.reportValidity()) return;
    sending = true; send.disabled = true; send.textContent = 'Sending'; status.textContent = '';
    try {
      await request({ action: 'feedback', kind: selected ? 'element' : 'general',
        comment: form.comment.value, author: form.author.value, page: frame.contentWindow.location.pathname,
        target: selected, viewport: { width: frame.contentWindow.innerWidth, height: frame.contentWindow.innerHeight }
      });
      sessionStorage.setItem('ieor-review-name', form.author.value);
      dialog.close();
      confirmation.textContent = 'Thank you. Your feedback has been saved.';
    } catch (error) { status.textContent = `${error.message} Your feedback is still here.`; }
    finally { sending = false; send.disabled = false; send.textContent = 'Send feedback'; }
  });
  await initialize();
})();
