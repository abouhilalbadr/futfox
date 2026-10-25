// How it works: clicking a step shows its text and swaps in its screenshot.
// While the section is on screen it moves to the next step on its own, until the visitor clicks one.
(function () {
  const how = document.querySelector('.how');
  if (!how) return;
  const steps = [...how.querySelectorAll('.how-step')];
  const shots = [...how.querySelectorAll('.shot')];
  let current = 0;
  let timer = null;

  function show(i) {
    current = i;
    steps.forEach((step, n) => {
      step.classList.toggle('is-active', n === i);
      step.querySelector('.how-btn').setAttribute('aria-expanded', String(n === i));
    });
    shots.forEach((shot, n) => shot.classList.toggle('is-active', n === i));
  }

  function stop() {
    clearInterval(timer);
    timer = null;
  }

  steps.forEach((step, n) => {
    step.querySelector('.how-btn').addEventListener('click', () => {
      stop();
      autoplay = false;
      show(n);
    });
  });

  let autoplay = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && autoplay && !timer) {
        timer = setInterval(() => show((current + 1) % steps.length), 6000);
      } else if (!entry.isIntersecting) {
        stop();
      }
    }, { threshold: 0.5 }).observe(how);
  }
})();
