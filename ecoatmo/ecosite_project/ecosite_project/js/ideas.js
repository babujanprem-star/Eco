(() => {
    const dialog = document.querySelector('#idea-dialog');
    if (!dialog) return;

    const ideaDetails = {
        bicycles: {
            title: 'Use bicycles',
            summary: 'Short trips are a good place to replace a car journey. Cycling reduces fuel use while adding movement to your day.',
            steps: [
                'Try a familiar trip under a few kilometres, such as a grocery run or commute to a nearby stop.',
                'Plan a calmer route with bike lanes or quieter streets, and use lights after dark.',
                'Check your tyres, brakes, and helmet before setting out.'
            ]
        },
        recycling: {
            title: 'Recycle waste',
            summary: 'Recycling works best when materials are sorted according to local collection rules and kept free of food residue.',
            steps: [
                'Check your local guide because accepted materials differ between areas.',
                'Keep paper and cardboard dry, and empty and rinse containers when required.',
                'Reuse or repair an item first when it is still useful.'
            ]
        },
        electricity: {
            title: 'Save electricity',
            summary: 'Small changes to lighting and appliance use can reduce household electricity demand over time.',
            steps: [
                'Switch off lights when leaving an empty room and replace frequently used bulbs with efficient LEDs.',
                'Use a power strip to turn off electronics that do not need to stay on.',
                'Run full loads in washing machines and dishwashers when practical.'
            ]
        },
        trees: {
            title: 'Plant trees',
            summary: 'Well-placed, locally suitable trees can provide shade and habitat. Choosing the right species and caring for it matters more than planting count.',
            steps: [
                'Choose a native species suited to your soil, rainfall, and available space.',
                'Check underground utilities, property boundaries, and mature canopy size before planting.',
                'Water and protect the young tree through its first growing seasons.'
            ]
        },
        water: {
            title: 'Conserve water',
            summary: 'Reducing avoidable water use helps protect local supplies and can also reduce the energy used to treat and move water.',
            steps: [
                'Repair dripping taps and running toilets promptly.',
                'Turn off the tap while brushing your teeth or washing dishes by hand.',
                'Water gardens early or late in the day and choose plants suited to the local climate.'
            ]
        },
        reusables: {
            title: 'Carry reusables',
            summary: 'A reusable item is most useful when it replaces disposables repeatedly and is cleaned and cared for well.',
            steps: [
                'Keep a folded bag near your keys or in a work bag so it is easy to remember.',
                'Bring a refillable bottle or cup for places where refill and washing facilities are available.',
                'Use the item for as long as it remains safe and practical.'
            ]
        },
        'protect-nature': {
            title: 'Protect Nature',
            summary: 'Protecting local habitats starts with everyday choices that reduce pressure on plants, wildlife, and shared outdoor spaces.',
            steps: [
                'Stay on marked paths and leave wild plants, rocks, and wildlife undisturbed.',
                'Choose native plants for your garden and avoid introducing invasive species.',
                'Join a local habitat cleanup or restoration activity when one is available.'
            ]
        },
        'reduce-waste': {
            title: 'Reduce Waste',
            summary: 'Preventing waste is often more effective than sorting it afterward. Reuse, repair, and careful purchasing all help.',
            steps: [
                'Choose products with less packaging and bring reusable bags or containers.',
                'Repair, borrow, or donate useful items instead of throwing them away.',
                'Separate recycling and food scraps according to your local collection rules.'
            ]
        }
    };

    const title = document.querySelector('#idea-dialog-title');
    const summary = document.querySelector('#idea-dialog-summary');
    const steps = document.querySelector('#idea-dialog-steps');
    const closeButton = document.querySelector('#idea-dialog-close');
    const artPanel = document.querySelector('#idea-art-panel');
    const artUse = document.querySelector('#idea-art-use');

    function openIdea(card) {
        const detail = ideaDetails[card.dataset.idea];
        if (!detail) return;

        title.textContent = detail.title;
        summary.textContent = detail.summary;
        artPanel.dataset.art = card.dataset.idea;
        artUse.setAttribute('href', `#idea-art-${card.dataset.idea}`);
        steps.replaceChildren(...detail.steps.map(step => {
            const item = document.createElement('li');
            item.textContent = step;
            return item;
        }));
        dialog.showModal();
        closeButton.focus();
    }

    document.querySelectorAll('.card[data-idea]').forEach(card => {
        card.addEventListener('click', () => openIdea(card));
        card.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openIdea(card);
            }
        });
    });

    closeButton.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
        if (event.target === dialog) dialog.close();
    });
})();