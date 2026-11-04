(() => {
    function replayHomeIntro() {
        const homeHero = document.querySelector('[data-home-hero]');
        if (!homeHero) return;

        const animatedElements = homeHero.querySelectorAll(
            '.hero-headline-line, .hero-text p, .hero-text .btn-explore'
        );
        animatedElements.forEach(element => element.classList.remove('home-copy-enter'));
        void homeHero.offsetHeight;
        animatedElements.forEach(element => element.classList.add('home-copy-enter'));
    }

    replayHomeIntro();
    window.addEventListener('pageshow', event => {
        if (event.persisted) replayHomeIntro();
    });

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reducedMotion.matches) return;

    document.body.classList.add('page-entering');

    document.addEventListener('click', event => {
        if (event.defaultPrevented || event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

        const link = event.target.closest('a[href]');
        if (!link || link.target || link.hasAttribute('download')) return;

        const destination = new URL(link.href, window.location.href);
        if (destination.origin !== window.location.origin) return;
        if (destination.pathname === window.location.pathname
            && destination.search === window.location.search) return;

        event.preventDefault();
        document.body.classList.remove('page-entering');
        document.body.classList.add('page-leaving');
        window.setTimeout(() => window.location.assign(destination.href), 180);
    });
})();