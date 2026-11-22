const grid = document.querySelector('#cameras');
const toolbar = document.querySelector('.toolbar');
const back = document.querySelector('#back');
const resume = document.querySelector('#resume');
const title = document.querySelector('h1');
let cameraIndex = null;
let blanked = false;
let focusTimeout;
let stopTiles = [];
let activeSettings;

function setting(name) {
  const control = document.querySelector(`meta[content="${name}"]`);
  const fallback = control.dataset.default.replace(/^'|'$/g, '');
  try {
    const value = window[name] ?? Function(`return typeof ${name} === 'undefined' ? undefined : ${name}`)();
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function list(name) {
  return String(setting(name)).split(',').map(value => value.trim());
}

function relayURL(value, endpoint, relay) {
  if (/^[\w.-]+$/.test(value)) {
    const url = new URL(endpoint, relay);
    url.searchParams.set('src', value);
    return url.href;
  }

  try {
    const url = new URL(value);
    if (url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname) &&
        !url.username && !url.password && url.pathname === endpoint &&
        /^[\w.-]+$/.test(url.searchParams.get('src') ?? '') &&
        url.searchParams.getAll('src').length === 1 &&
        [...url.searchParams.keys()].every(key => ['src', 'width', 'height', 'cache'].includes(key))) {
      return url.href;
    }
  } catch {
    // An invalid entry produces an offline tile.
  }
  return '';
}

function readSettings() {
  const host = setting('relayHost') === 'localhost' ? 'localhost' : '127.0.0.1';
  const port = Number(setting('relayPort'));
  const relay = `http://${host}:${Number.isInteger(port) && port > 0 && port <= 65535 ? port : 1984}`;
  const count = String(setting('tileCount')) === '4' ? 4 : 6;
  const labels = list('cameraLabels');
  const mosaic = list('mosaicSources');
  const focus = list('focusSources');
  const live = list('liveSources');
  const cameras = Array.from({ length: count }, (_, index) => {
    const main = focus[index] || mosaic[index] || '';
    const snapshot = relayURL(main, '/api/frame.jpeg', relay);
    const liveAlias = /^[\w.-]+$/.test(main) ? main : '';
    return {
      label: labels[index] || `Camera ${index + 1}`,
      mosaic: relayURL(mosaic[index] || '', '/api/frame.jpeg', relay),
      snapshot,
      live: relayURL(live[index] || liveAlias, '/api/stream.mjpeg', relay),
    };
  });
  return {
    cameras,
    interval: Math.min(2, Math.max(1, Number(setting('refreshSeconds')) || 2)) * 1000,
    timeout: Math.min(600, Math.max(5, Number(setting('focusSeconds')) || 60)) * 1000,
  };
}

function showCamera(camera, focused, onTap) {
  const tile = document.createElement('button');
  tile.className = 'tile';
  tile.type = 'button';
  tile.setAttribute('aria-label', focused ? 'Return to mosaic' : `Open ${camera.label}`);
  tile.innerHTML = '<span class="status"></span><span class="caption"><span class="dot"></span><span class="label"></span></span>';
  tile.querySelector('.label').textContent = camera.label;
  const status = tile.querySelector('.status');
  tile.addEventListener('click', onTap);
  grid.append(tile);

  let current;
  let pending;
  let deadline;
  let retry;
  let errors = 0;
  const interval = focused ? 250 : activeSettings.interval;

  function state(value, message = '') {
    tile.dataset.state = value;
    status.hidden = !message;
    status.textContent = message;
  }

  function cancelImage(img) {
    if (!img) return;
    img.onload = img.onerror = null;
    img.removeAttribute('src');
    img.remove();
  }

  function load(source, continuous = false) {
    if (!source) {
      state('offline', 'No signal');
      return;
    }
    const img = new Image();
    pending = img;
    img.alt = '';

    function failed() {
      clearTimeout(deadline);
      pending = undefined;
      if (continuous) {
        cancelImage(img);
        current = undefined;
        state('offline', 'No signal');
        load(camera.snapshot);
        return;
      }
      cancelImage(img);
      state('offline', 'No signal');
      errors += 1;
      retry = setTimeout(() => load(source), Math.min(30000, interval * 2 ** Math.min(errors, 8)));
    }

    img.onload = () => {
      clearTimeout(deadline);
      if (current === img) return;
      cancelImage(current);
      current = img;
      pending = undefined;
      tile.prepend(img);
      errors = 0;
      state('live');
      if (!continuous) retry = setTimeout(() => load(source), interval);
    };
    img.onerror = failed;
    const url = new URL(source);
    url.searchParams.set('_', Date.now());
    deadline = setTimeout(failed, continuous ? 3500 : 5000);
    img.src = url.href;
  }

  state('loading', 'Connecting');
  if (focused && camera.live) load(camera.live, true);
  else load(focused ? camera.snapshot : camera.mosaic);

  return () => {
    clearTimeout(deadline);
    clearTimeout(retry);
    cancelImage(pending);
    cancelImage(current);
  };
}

function render() {
  clearTimeout(focusTimeout);
  stopTiles.forEach(stop => stop());
  stopTiles = [];
  grid.replaceChildren();
  document.body.classList.toggle('blanked', blanked);
  toolbar.hidden = grid.hidden = blanked;
  resume.hidden = !blanked;
  if (blanked) {
    resume.focus();
    return;
  }

  const { cameras, timeout } = activeSettings;
  const camera = cameras[cameraIndex];
  back.hidden = !camera;
  title.textContent = camera?.label ?? 'CCTV Mosaic';
  grid.dataset.count = camera ? 1 : cameras.length;
  if (camera) {
    stopTiles.push(showCamera(camera, true, returnToMosaic));
    focusTimeout = setTimeout(returnToMosaic, timeout);
    return;
  }
  stopTiles = cameras.map((entry, index) => showCamera(entry, false, () => {
    cameraIndex = index;
    render();
    back.focus();
  }));
}

function returnToMosaic() {
  const previousIndex = cameraIndex;
  cameraIndex = null;
  render();
  grid.children[previousIndex]?.focus();
}

function applySettings() {
  const accent = String(setting('accentColor'));
  document.documentElement.style.setProperty('--accent', /^#[\da-f]{6}$/i.test(accent) ? accent : '#62e1bd');
  const next = readSettings();
  if (JSON.stringify(next) === JSON.stringify(activeSettings)) return;
  activeSettings = next;
  if (cameraIndex >= next.cameras.length) cameraIndex = null;
  render();
}

back.addEventListener('click', returnToMosaic);
document.querySelector('#privacy').addEventListener('click', () => {
  blanked = true;
  cameraIndex = null;
  render();
});
resume.addEventListener('click', () => {
  blanked = false;
  render();
  document.querySelector('#privacy').focus();
});
icueEvents = { onICUEInitialized: applySettings, onDataUpdated: applySettings };
applySettings();
