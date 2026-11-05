(() => {
    const panel = document.querySelector('[data-air-quality]');
    if (!panel) return;

    const scoreElement = document.querySelector('#aqi-score');
    const gaugeElement = document.querySelector('#aqi-gauge');
    const categoryElement = document.querySelector('#aqi-category');
    const locationElement = document.querySelector('#aqi-location');
    const updatedElement = document.querySelector('#aqi-updated');
    const messageElement = document.querySelector('#aqi-message');
    const cityInput = document.querySelector('#city-name');
    const cityForm = document.querySelector('#city-search');
    const refreshButton = document.querySelector('#refresh-aqi');
    const locationButton = document.querySelector('#use-location');
    const refreshInterval = 5 * 60 * 1000;
    let activeLocation = null;
    let refreshTimer = null;
    let locationRequestToken = 0;
    let searchRequestToken = 0;
    let airQualityRequestToken = 0;
    let scoreAnimationFrame = null;
    let displayedAqi = null;

    function resetAqiScore(value) {
        if (scoreAnimationFrame !== null) {
            window.cancelAnimationFrame(scoreAnimationFrame);
            scoreAnimationFrame = null;
        }
        displayedAqi = null;
        scoreElement.textContent = value;
        gaugeElement.style.setProperty('--aqi-progress', '0%');
    }

    function animateAqiScore(value) {
        const startValue = displayedAqi ?? 0;
        const startTime = performance.now();
        const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 0
            : Math.min(1400, Math.max(700, Math.abs(value - startValue) * 7));

        function updateScore(timestamp) {
            const progress = duration === 0 ? 1 : Math.min((timestamp - startTime) / duration, 1);
            const easedProgress = 1 - Math.pow(1 - progress, 3);
            const currentValue = startValue + (value - startValue) * easedProgress;

            scoreElement.textContent = String(Math.round(currentValue));
            gaugeElement.style.setProperty('--aqi-progress', `${Math.min(Math.max(currentValue, 0), 500) / 5}%`);

            if (progress < 1) {
                scoreAnimationFrame = window.requestAnimationFrame(updateScore);
            } else {
                displayedAqi = value;
                scoreAnimationFrame = null;
            }
        }

        if (scoreAnimationFrame !== null) window.cancelAnimationFrame(scoreAnimationFrame);
        scoreAnimationFrame = window.requestAnimationFrame(updateScore);
    }

    function setMessage(message, state = '') {
        messageElement.textContent = message;
        messageElement.dataset.state = state;
    }

    function getAqiCategory(value) {
        if (value <= 50) return { label: 'Good', level: 'good' };
        if (value <= 100) return { label: 'Moderate', level: 'moderate' };
        if (value <= 150) return { label: 'Unhealthy for sensitive groups', level: 'sensitive' };
        if (value <= 200) return { label: 'Unhealthy', level: 'unhealthy' };
        if (value <= 300) return { label: 'Very unhealthy', level: 'very-unhealthy' };
        return { label: 'Hazardous', level: 'hazardous' };
    }

    function formatPollutant(value) {
        return typeof value === 'number' && Number.isFinite(value)
            ? String(Math.round(value * 10) / 10)
            : '—';
    }

    function formatEstimateTime(timestamp) {
        const estimatedAt = new Date(timestamp);
        if (Number.isNaN(estimatedAt.getTime())) return 'Estimate time unavailable';
        return `Estimated ${estimatedAt.toLocaleString()} · checks every 5 minutes`;
    }

    function scheduleRefresh() {
        window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(() => {
            if (activeLocation) loadAirQuality(activeLocation.coordinates, activeLocation.label);
        }, refreshInterval);
    }

    async function loadAirQuality(coordinates, label) {
        const requestToken = ++airQualityRequestToken;
        activeLocation = { coordinates, label };
        refreshButton.disabled = true;
        panel.dataset.level = 'loading';
        resetAqiScore('…');
        categoryElement.textContent = 'Loading AQI estimate';
        locationElement.textContent = label;
        updatedElement.hidden = true;
        setMessage('Getting an approximate air-quality estimate…');

        const parameters = new URLSearchParams({
            latitude: coordinates.latitude,
            longitude: coordinates.longitude
        });

        try {
            const response = await fetch(`/api/air-quality?${parameters}`);
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Air-quality estimates are unavailable.');
            }

            if (requestToken !== airQualityRequestToken) return;
            if (!Number.isFinite(data.aqi)) {
                throw new Error('The service did not provide a usable AQI estimate.');
            }

            const category = getAqiCategory(data.aqi);
            panel.dataset.level = category.level;
            animateAqiScore(data.aqi);
            categoryElement.textContent = category.label;
            document.querySelector('#pm25-value').textContent = formatPollutant(data.measurements.pm25);
            document.querySelector('#pm10-value').textContent = formatPollutant(data.measurements.pm10);
            updatedElement.textContent = formatEstimateTime(data.measured_at);
            updatedElement.hidden = false;
            refreshButton.disabled = false;
            setMessage('Model-based U.S. AQI estimate from Open-Meteo. Actual local conditions may differ.');
            scheduleRefresh();
        } catch (error) {
            if (requestToken !== airQualityRequestToken) return;
            panel.dataset.level = 'unavailable';
            resetAqiScore('—');
            categoryElement.textContent = 'Reading unavailable';
            document.querySelector('#pm25-value').textContent = '—';
            document.querySelector('#pm10-value').textContent = '—';
            window.clearTimeout(refreshTimer);
            refreshButton.disabled = !activeLocation;
            setMessage(error.message || 'Could not load air quality. Please try again.', 'error');
        }
    }

    function refreshActiveLocation() {
        if (activeLocation && !refreshButton.disabled) {
            loadAirQuality(activeLocation.coordinates, activeLocation.label);
        }
    }

    function requestLocation() {
        searchRequestToken += 1;
        airQualityRequestToken += 1;
        activeLocation = null;
        refreshButton.disabled = true;
        window.clearTimeout(refreshTimer);
        if (!navigator.geolocation) {
            categoryElement.textContent = 'Location unavailable';
            setMessage('Search for a city to see its air quality.', 'error');
            return;
        }

        const requestToken = ++locationRequestToken;
        locationButton.disabled = true;
        setMessage('Requesting your location…');
        navigator.geolocation.getCurrentPosition(
            ({ coords }) => {
                if (requestToken !== locationRequestToken) return;
                locationButton.disabled = false;
                loadAirQuality(
                    { latitude: coords.latitude, longitude: coords.longitude },
                    'Your location'
                );
            },
            () => {
                if (requestToken !== locationRequestToken) return;
                locationButton.disabled = false;
                categoryElement.textContent = 'Choose a location';
                setMessage('Location access is unavailable. Search for a city instead.');
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 15 * 60 * 1000 }
        );
    }

    cityForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        locationRequestToken += 1;
        locationButton.disabled = false;
        const query = cityInput.value.trim();
        if (query.length < 2) {
            setMessage('Enter at least two characters to search for a city.', 'error');
            cityInput.focus();
            return;
        }

        const requestToken = ++searchRequestToken;
        airQualityRequestToken += 1;
        activeLocation = null;
        refreshButton.disabled = true;
        window.clearTimeout(refreshTimer);
        panel.dataset.level = 'loading';
        resetAqiScore('…');
        categoryElement.textContent = 'Searching for city';
        locationElement.textContent = query;
        document.querySelector('#pm25-value').textContent = '—';
        document.querySelector('#pm10-value').textContent = '—';
        setMessage('Searching for that location…');
        try {
            const parameters = new URLSearchParams({ name: query, count: '100', language: 'en', format: 'json' });
            const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${parameters}`);
            if (!response.ok) throw new Error('Location search is unavailable. Please try again.');

            const data = await response.json();
            if (requestToken !== searchRequestToken) return;
            const places = Array.isArray(data.results) ? data.results : [];
            const queryParts = query.split(',').map((part) => part.trim().toLocaleLowerCase()).filter(Boolean);
            const matchingPlace = queryParts.length > 1
                ? places.find((candidate) => {
                    const location = [
                        candidate.name,
                        candidate.admin1,
                        candidate.country
                    ].filter(Boolean).join(' ').toLocaleLowerCase();
                    return queryParts.every((part) => location.includes(part));
                })
                : null;
            const place = matchingPlace || places[0];
            if (!place) throw new Error('No matching city found. Try adding a country name.');

            const label = [...new Set([place.name, place.admin1, place.country].filter(Boolean))].join(', ');
            await loadAirQuality(
                { latitude: place.latitude, longitude: place.longitude },
                label
            );
        } catch (error) {
            if (requestToken !== searchRequestToken) return;
            panel.dataset.level = 'unavailable';
            resetAqiScore('—');
            categoryElement.textContent = 'Location unavailable';
            document.querySelector('#pm25-value').textContent = '—';
            document.querySelector('#pm10-value').textContent = '—';
            refreshButton.disabled = true;
            setMessage(error.message || 'Could not search for that city.', 'error');
        }
    });

    refreshButton.addEventListener('click', refreshActiveLocation);
    locationButton.addEventListener('click', requestLocation);
    requestLocation();
})();