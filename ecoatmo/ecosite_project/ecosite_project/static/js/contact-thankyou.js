(() => {
    const dialog = document.querySelector('#contact-thankyou');
    if (!dialog || typeof dialog.showModal !== 'function') return;

    const closeButton = document.querySelector('#thankyou-close');
    dialog.showModal();
    closeButton.focus();

    closeButton.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
        if (event.target === dialog) dialog.close();
    });
})();