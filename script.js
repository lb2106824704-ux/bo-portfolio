(() => {
  document.addEventListener('contextmenu', event => {
    if (event.target.closest('input, textarea, [contenteditable="true"]')) return;
    event.preventDefault();
  });
  const menuButton = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#primary-nav');
  const navLinks = nav.querySelectorAll('a');
  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') !== 'true';
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? '关闭导航' : '打开导航');
    nav.classList.toggle('is-open', open);
  });
  navLinks.forEach(link => link.addEventListener('click', () => {
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', '打开导航');
    nav.classList.remove('is-open');
  }));

  const filters = document.querySelectorAll('.filter-button');
  const cards = document.querySelectorAll('.project-card');
  filters.forEach(button => button.addEventListener('click', () => {
    const filter = button.dataset.filter;
    filters.forEach(item => {
      const active = item === button;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    cards.forEach(card => {
      card.classList.toggle('is-hidden', filter !== 'all' && card.dataset.category !== filter);
    });
  }));

  const dialog = document.querySelector('.lightbox');
  const dialogImage = dialog.querySelector('img');
  const caption = dialog.querySelector('figcaption');
  const galleryButtons = [...document.querySelectorAll('.gallery-image')];
  const closeButton = dialog.querySelector('.lightbox-close');
  let currentIndex = 0;
  let returnFocus = null;

  function showImage(index) {
    currentIndex = (index + galleryButtons.length) % galleryButtons.length;
    const button = galleryButtons[currentIndex];
    const image = button.querySelector('img');
    dialogImage.src = button.dataset.image;
    dialogImage.alt = image.alt;
    caption.textContent = button.dataset.caption;
  }
  galleryButtons.forEach((button, index) => button.addEventListener('click', () => {
    returnFocus = button;
    showImage(index);
    dialog.showModal();
    closeButton.focus();
  }));
  dialog.querySelector('.lightbox-prev').addEventListener('click', () => showImage(currentIndex - 1));
  dialog.querySelector('.lightbox-next').addEventListener('click', () => showImage(currentIndex + 1));
  closeButton.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    if (returnFocus) returnFocus.focus();
  });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') showImage(currentIndex - 1);
    if (event.key === 'ArrowRight') showImage(currentIndex + 1);
  });
})();

