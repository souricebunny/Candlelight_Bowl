export function showIntro() {
  const intro = document.querySelector('#intro');
  const main = document.querySelector('main');
  let remaining = 3000;
  let startedAt = null;
  let timer;

  intro.hidden = false;
  main.inert = true;
  document.body.classList.add('previewing');

  function finish() {
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', schedule);
    intro.hidden = true;
    main.inert = false;
    document.body.classList.remove('previewing');
  }

  function schedule() {
    clearTimeout(timer);
    if (startedAt !== null) remaining -= performance.now() - startedAt;
    startedAt = null;
    intro.style.animationPlayState = document.hidden ? 'paused' : 'running';
    if (remaining <= 0) return finish();
    if (!document.hidden) {
      startedAt = performance.now();
      timer = setTimeout(finish, remaining);
    }
  }

  document.addEventListener('visibilitychange', schedule);
  schedule();
}
