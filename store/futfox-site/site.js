// How it works: clicking a step opens its text and slides in its screenshot.
// While the section is on screen it moves to the next step on its own, until the visitor clicks one.
(function () {
  const how = document.querySelector('.how');
  if (!how) return;
  const steps = [...how.querySelectorAll('.how-step')];
  const shots = [...how.querySelectorAll('.shot')];
  let current = 0;
  let timer = null;

  function show(i) {
    if (i === current && shots[i].classList.contains('is-active')) return;
    const old = shots[current];
    if (old !== shots[i]) {
      old.classList.add('is-leaving');
      setTimeout(() => old.classList.remove('is-leaving'), 600);
    }
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
    how.classList.remove('is-playing');
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
        how.classList.add('is-playing');
      } else if (!entry.isIntersecting) {
        stop();
      }
    }, { threshold: 0.5 }).observe(how);
  }
})();

// FAQ: open and close each answer with a height animation instead of a jump.
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !Element.prototype.animate) return;
  document.querySelectorAll('.faq details').forEach((item) => {
    const summary = item.querySelector('summary');
    let anim = null;
    summary.addEventListener('click', (e) => {
      e.preventDefault();
      const closing = item.open && !item.classList.contains('is-closing');
      const from = item.getBoundingClientRect().height;
      if (anim) anim.cancel();
      item.classList.toggle('is-closing', closing);
      if (!closing) item.open = true;
      const to = closing ? summary.offsetHeight + item.offsetHeight - item.clientHeight : item.getBoundingClientRect().height;
      item.style.overflow = 'hidden';
      anim = item.animate({ height: [from + 'px', to + 'px'] }, { duration: 340, easing: 'cubic-bezier(.3,0,.1,1)' });
      if (!closing) {
        item.querySelector('p').animate(
          { opacity: [0, 1], transform: ['translateY(-6px)', 'none'] },
          { duration: 300, delay: 80, easing: 'ease-out', fill: 'backwards' }
        );
      }
      anim.onfinish = () => {
        if (closing) {
          item.open = false;
          item.classList.remove('is-closing');
        }
        item.style.overflow = '';
        anim = null;
      };
    });
  });
})();
