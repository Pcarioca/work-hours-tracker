// Lightweight effects and delightful surprises kept in one place to stay organized.
const WEATHER_DESCRIPTIONS = {
  snow: 'Snow is on the way—bundle up!',
  rain: 'A little rain never stopped productivity.',
  sunny: 'Sunny skies, sunny vibes.',
  cloudy: 'Cozy clouds overhead.',
  none: 'Weather unavailable—enjoy your own climate!',
};

function mapWeatherCodeToMood(code) {
  if (code === null || code === undefined) return 'none';
  const snowCodes = new Set([71, 73, 75, 77, 85, 86]);
  const rainCodes = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82]);
  const stormCodes = new Set([95, 96, 99]);
  if (snowCodes.has(code)) return 'snow';
  if (rainCodes.has(code) || stormCodes.has(code)) return 'rain';
  if (code === 0) return 'sunny';
  if ([1, 2].includes(code)) return 'sunny';
  if ([3, 45, 48].includes(code)) return 'cloudy';
  return 'cloudy';
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 6000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

async function fetchLocation() {
  const res = await fetchWithTimeout('https://ipapi.co/json/', {}, 5000);
  if (!res.ok) throw new Error('Location lookup failed');
  return res.json();
}

async function fetchWeather(latitude, longitude) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`;
  const res = await fetchWithTimeout(url, {}, 5000);
  if (!res.ok) throw new Error('Weather lookup failed');
  return res.json();
}

function setMoodClass(layerEl, mood) {
  if (!layerEl) return;
  layerEl.dataset.mood = mood;
}

function updateStatus(statusEl, mood, meta = {}) {
  if (!statusEl) return;
  const parts = [];
  if (meta.city) parts.push(meta.city);
  if (meta.region) parts.push(meta.region);
  const locationText = parts.join(', ');
  const description = WEATHER_DESCRIPTIONS[mood] || WEATHER_DESCRIPTIONS.none;
  statusEl.textContent = locationText ? `${locationText} • ${description}` : description;
}

export async function initWeatherEffects({ statusEl, layerEl, onMood }) {
  try {
    const geo = await fetchLocation();
    const { latitude, longitude, city, region } = geo;
    if (!latitude || !longitude) throw new Error('Missing coordinates');
    const weather = await fetchWeather(latitude, longitude);
    const code = weather?.current_weather?.weathercode;
    const mood = mapWeatherCodeToMood(code);
    updateStatus(statusEl, mood, { city, region });
    setMoodClass(layerEl, mood);
    onMood?.(mood, { city, region, code });
  } catch (err) {
    console.warn('Weather effect error:', err);
    setMoodClass(layerEl, 'none');
    updateStatus(statusEl, 'none');
  }
}

export function initSparkles() {
  const sparkleContainer = document.createElement('div');
  sparkleContainer.className = 'sparkle-container';
  document.body.appendChild(sparkleContainer);

  const spawnSparkles = (x, y, count = 10) => {
    if (!sparkleContainer) return;
    for (let i = 0; i < count; i++) {
      const dot = document.createElement('span');
      dot.className = 'sparkle';
      const offsetX = (Math.random() - 0.5) * 60;
      const offsetY = (Math.random() - 0.5) * 40;
      dot.style.left = `${x + offsetX}px`;
      dot.style.top = `${y + offsetY}px`;
      dot.style.animationDelay = `${Math.random() * 0.3}s`;
      sparkleContainer.appendChild(dot);
      setTimeout(() => dot.remove(), 1200);
    }
  };

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (target && target.closest && target.closest('.btn')) {
      spawnSparkles(event.clientX || 0, event.clientY || 0, 8);
    }
  });

  return { spawnSparkles };
}

export function initEasterEggs({ siteTitle, logo, secretHint, onSecretToggle }) {
  let tapCount = 0;
  let sparkleMode = false;
  const resetTap = () => {
    tapCount = 0;
  };

  if (siteTitle) {
    siteTitle.addEventListener('click', () => {
      tapCount += 1;
      if (tapCount >= 5) {
        sparkleMode = !sparkleMode;
        onSecretToggle?.(sparkleMode);
        if (secretHint) {
          secretHint.textContent = sparkleMode
            ? '✨ Secret cozy mode unlocked! Tap again to return.'
            : 'Hint: tap the title 5x for a cozy surprise.';
        }
        tapCount = 0;
      }
      clearTimeout(resetTap._t);
      resetTap._t = setTimeout(resetTap, 1200);
    });
  }

  if (logo) {
    let giggleCount = 0;
    logo.addEventListener('click', () => {
      giggleCount += 1;
      if (giggleCount % 3 === 0) {
        const msg = document.createElement('div');
        msg.className = 'toast';
        msg.textContent = 'You found the giggle loop! 😸';
        document.body.appendChild(msg);
        setTimeout(() => msg.classList.add('show'), 10);
        setTimeout(() => msg.classList.remove('show'), 2000);
        setTimeout(() => msg.remove(), 2300);
      }
    });
  }
}
