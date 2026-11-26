/* Public endpoint only. API keys belong in Cloudflare secrets, never in this file. */
window.PONDWISE_CONFIG = Object.freeze({
  chatEndpoint: ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
    ? '/api/chat'
    : 'https://pondwise-helper.ond-ise.workers.dev/api/chat'
});
