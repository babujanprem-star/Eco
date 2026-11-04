(() => {
    const tableBody = document.querySelector('#country-rows');
    if (!tableBody) return;

    const statusElement = document.querySelector('#countries-status');
    const searchInput = document.querySelector('#country-search');
    const sortSelect = document.querySelector('#country-sort');
    const refreshButton = document.querySelector('#refresh-countries');
    const refreshInterval = 15 * 60 * 1000;
    const countryDataUrl = 'https://raw.githubusercontent.com/mledoze/countries/master/countries.json';
    const airQualityUrl = 'https://air-quality-api.open-meteo.com/v1/air-quality';
    const countryBatchSize = 250;
    let countries = [];
    let readings = new Map();
    let refreshTimer = null;

    function setStatus(message, state = '') {
        statusElement.textContent = message;
        statusElement.dataset.state = state;
    }

    function categoryFor(aqi) {
        if (aqi <= 50) return { label: 'Good', level: 'good' };
        if (aqi <= 100) return { label: 'Moderate', level: 'moderate' };
        if (aqi <= 150) return { label: 'Unhealthy for sensitive groups', level: 'sensitive' };
        if (aqi <= 200) return { label: 'Unhealthy', level: 'unhealthy' };
        if (aqi <= 300) return { label: 'Very unhealthy', level: 'very-unhealthy' };
        return { label: 'Hazardous', level: 'hazardous' };
    }

    function hasCoordinates(coordinates) {
        return Array.isArray(coordinates)
            && coordinates.length === 2
            && coordinates.every(Number.isFinite)
            && coordinates[0] >= -90 && coordinates[0] <= 90
            && coordinates[1] >= -180 && coordinates[1] <= 180;
    }

    function flagFromCountryCode(countryCode) {
        if (!/^[A-Z]{2}$/.test(countryCode || '')) return '';
        return [...countryCode].map(letter =>
            String.fromCodePoint(0x1f1e6 + letter.charCodeAt(0) - 65)
        ).join('');
    }

    function appendCell(row, value, className = '') {
        const cell = document.createElement('td');
        cell.textContent = value;
        if (className) cell.className = className;
        row.append(cell);
        return cell;
    }

    function renderRows() {
        const query = searchInput.value.trim().toLocaleLowerCase();
        const sortedCountries = countries.filter(country =>
            `${country.name} ${country.region}`.toLocaleLowerCase().includes(query)
        );

        if (sortSelect.value === 'highest') {
            sortedCountries.sort((left, right) =>
                (readings.get(right.id) ?? -1) - (readings.get(left.id) ?? -1)
            );
        } else if (sortSelect.value === 'lowest') {
            sortedCountries.sort((left, right) => {
                const leftAqi = readings.get(left.id);
                const rightAqi = readings.get(right.id);
                if (leftAqi === undefined) return 1;
                if (rightAqi === undefined) return -1;
                return leftAqi - rightAqi;
            });
        } else {
            sortedCountries.sort((left, right) => left.name.localeCompare(right.name));
        }

        tableBody.replaceChildren();
        if (sortedCountries.length === 0) {
            const row = document.createElement('tr');
            const cell = appendCell(row, 'No countries match your search.');
            cell.colSpan = 4;
            tableBody.append(row);
            return;
        }

        for (const country of sortedCountries) {
            const row = document.createElement('tr');
            const nameCell = document.createElement('td');
            nameCell.className = 'country-name';
            if (country.flag) {
                const flag = document.createElement('span');
                flag.className = 'country-flag';
                flag.setAttribute('aria-hidden', 'true');
                flag.textContent = country.flag;
                nameCell.append(flag);
            }
            nameCell.append(document.createTextNode(country.name));
            row.append(nameCell);
            appendCell(row, country.region || '—');

            const aqi = readings.get(country.id);
            appendCell(row, aqi === undefined ? '—' : String(aqi), 'country-aqi');

            const levelCell = document.createElement('td');
            const badge = document.createElement('span');
            badge.className = 'country-level';
            if (aqi === undefined) {
                badge.textContent = country.hasCoordinates ? 'No reading' : 'No location data';
            } else {
                const category = categoryFor(aqi);
                badge.textContent = category.label;
                badge.dataset.level = category.level;
            }
            levelCell.append(badge);
            row.append(levelCell);
            tableBody.append(row);
        }
    }

    function scheduleRefresh() {
        window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(refreshReadings, refreshInterval);
    }

    async function refreshReadings() {
        refreshButton.disabled = true;
        statusElement.dataset.state = '';

        try {
            if (countries.length === 0) {
                setStatus('Loading country reference points…');
                const countriesResponse = await fetch(countryDataUrl);
                if (!countriesResponse.ok) throw new Error('Could not load the country list.');

                const countryData = await countriesResponse.json();
                countries = countryData.map((country, index) => ({
                    id: country.cca2 || `country-${index}`,
                    name: country.name?.common || 'Unnamed location',
                    flag: country.flag || flagFromCountryCode(country.cca2),
                    region: country.region || '',
                    coordinates: hasCoordinates(country.latlng) ? country.latlng : null,
                    hasCoordinates: hasCoordinates(country.latlng)
                })).sort((left, right) => left.name.localeCompare(right.name));
                renderRows();
            }

            const locatedCountries = countries.filter(country => country.coordinates);
            if (locatedCountries.length === 0) throw new Error('No country reference coordinates are available.');

            setStatus(`Loading current AQI for ${locatedCountries.length} country and territory reference points…`);
            const batches = [];
            for (let index = 0; index < locatedCountries.length; index += countryBatchSize) {
                batches.push(locatedCountries.slice(index, index + countryBatchSize));
            }

            const latestReadings = new Map();
            await Promise.all(batches.map(async batch => {
                const parameters = new URLSearchParams({
                    latitude: batch.map(country => country.coordinates[0]).join(','),
                    longitude: batch.map(country => country.coordinates[1]).join(','),
                    current: 'us_aqi',
                    timezone: 'auto'
                });
                const response = await fetch(`${airQualityUrl}?${parameters}`);
                if (!response.ok) throw new Error('The air-quality service is temporarily unavailable.');

                const result = await response.json();
                const locations = Array.isArray(result) ? result : [result];
                if (locations.length !== batch.length) throw new Error('The air-quality service returned an incomplete result.');

                locations.forEach((location, index) => {
                    const aqi = location.current?.us_aqi;
                    if (typeof aqi === 'number' && Number.isFinite(aqi)) {
                        latestReadings.set(batch[index].id, Math.round(aqi));
                    }
                });
            }));

            readings = latestReadings;
            renderRows();
            setStatus(`Updated ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. ${readings.size} locations have a current reading; refreshes about every 15 minutes.`);
            scheduleRefresh();
        } catch (error) {
            setStatus(error.message || 'Could not load country air-quality readings.', 'error');
        } finally {
            refreshButton.disabled = false;
        }
    }

    searchInput.addEventListener('input', renderRows);
    sortSelect.addEventListener('change', renderRows);
    refreshButton.addEventListener('click', refreshReadings);
    refreshReadings();
})();