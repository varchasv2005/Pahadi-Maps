const DEFAULT_CENTER = [30.4595, 78.0730];
const store = { hazards: [], helpers: [], places: [] };
let userLocation = null;
let toastTimer;

const map = L.map('map', { zoomControl: false }).setView(DEFAULT_CENTER, 14);
L.control.zoom({ position: 'bottomright' }).addTo(map);
const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
const groups = { hazards: L.layerGroup().addTo(map), helpers: L.layerGroup().addTo(map), places: L.layerGroup().addTo(map) };
const icons = { 'blind-curve': '⚠', landslide: '⌁', 'road-damage': '⌁', 'poor-lighting': '☼', other: '!' };

function markerIcon(kind, symbol) {
  return L.divIcon({ className: '', html: `<div class="custom-marker ${kind}"><span>${symbol}</span></div>`, iconSize: [28, 28], iconAnchor: [14, 27], popupAnchor: [0, -25] });
}
function escapeHtml(text) { return String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
function timeAgo(value) { const mins = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 60000)); return mins < 60 ? `${mins} min ago` : `${Math.floor(mins / 60)} hr ago`; }
function drawMap() {
  Object.values(groups).forEach((layer) => layer.clearLayers());
  store.hazards.filter((h) => h.status === 'active').forEach((h) => L.marker([h.lat, h.lng], { icon: markerIcon('hazard', icons[h.type] || '!') }).bindPopup(`<div class="popup-title">${escapeHtml(h.title)}</div><div class="popup-type">${escapeHtml(h.location)} · ${escapeHtml(h.severity)} risk</div>`).addTo(groups.hazards));
  store.helpers.forEach((h) => L.marker([h.lat, h.lng], { icon: markerIcon('helper', '✳') }).bindPopup(`<div class="popup-title">${escapeHtml(h.name)}</div><div class="popup-type">Community helper · available</div>`).addTo(groups.helpers));
  store.places.forEach((p) => L.marker([p.lat, p.lng], { icon: markerIcon('place', '⌂') }).bindPopup(`<div class="popup-title">${escapeHtml(p.name)}</div><div class="popup-type">${escapeHtml(p.category)} · ${escapeHtml(p.distance)}</div>`).addTo(groups.places));
}
function renderLists() {
  const active = store.hazards.filter((h) => h.status === 'active');
  document.querySelector('#hazardCount').textContent = active.length;
  document.querySelector('#hazardList').innerHTML = active.slice(0, 4).map((h) => `<article class="hazard-row" data-lat="${h.lat}" data-lng="${h.lng}"><span class="hazard-icon ${h.severity === 'High' ? '' : 'amber'}">${icons[h.type] || '!'}</span><span class="hazard-info"><strong>${escapeHtml(h.title)}</strong><small>${escapeHtml(h.location)} · ${timeAgo(h.reportedAt)}</small></span><span class="severity ${h.severity === 'High' ? '' : 'medium'}">${escapeHtml(h.severity)}</span></article>`).join('') || '<p class="muted">No active reports. Have a safe journey.</p>';
  document.querySelector('#helperCount').textContent = store.helpers.length;
  document.querySelector('#helperList').innerHTML = store.helpers.slice(0, 3).map((h) => `<div class="person"><span class="person-avatar ${escapeHtml(h.tone || '')}">${escapeHtml(h.initials)}</span><span class="person-detail"><strong>${escapeHtml(h.name)}</strong><small>${escapeHtml(h.role)}</small></span><i class="online"></i></div>`).join('');
  document.querySelector('#placeList').innerHTML = store.places.slice(0, 3).map((p) => `<div class="place-item" data-lat="${p.lat}" data-lng="${p.lng}"><span class="place-emoji">${escapeHtml(p.icon)}</span><span class="place-info"><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.category)}</small></span><span class="distance">${escapeHtml(p.distance)}</span></div>`).join('');
  drawMap();
  try { localStorage.setItem('pahadi-cache', JSON.stringify(store)); } catch { /* Storage can be disabled. */ }
}
function showToast(message) { const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3200); }
async function loadData() {
  try {
    const response = await fetch('./api/data'); if (!response.ok) throw new Error('API unavailable');
    Object.assign(store, await response.json()); renderLists();
  } catch {
    let hasCachedData = false;
    try {
      const cached = JSON.parse(localStorage.getItem('pahadi-cache') || 'null');
      if (cached && Array.isArray(cached.hazards)) { Object.assign(store, cached); hasCachedData = true; }
    } catch { /* Use the bundled sample data below. */ }
    if (!hasCachedData) {
      try {
        const [hazards, helpers, places] = await Promise.all(['hazards', 'helpers', 'places'].map(async (name) => {
          const response = await fetch(`./data/${name}.json`);
          if (!response.ok) throw new Error(`Could not load ${name}`);
          return response.json();
        }));
        Object.assign(store, { hazards, helpers, places });
      } catch { /* The browser may be offline before a first visit. */ }
    }
    renderLists();
    if (!navigator.onLine) showToast('Showing saved updates. Reconnect to refresh community reports.');
  }
}
function openDialog(id) { document.getElementById(id).showModal(); }
document.querySelector('#openReport').addEventListener('click', () => openDialog('reportDialog'));
document.querySelector('#mobileReport').addEventListener('click', () => openDialog('reportDialog'));
document.querySelector('#sosBtn').addEventListener('click', () => openDialog('sosDialog'));
document.querySelector('#mobileSos').addEventListener('click', () => openDialog('sosDialog'));
document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach((dialog) => dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); }));
document.querySelector('#reportForm').addEventListener('submit', async (event) => {
  event.preventDefault(); const form = new FormData(event.currentTarget);
  try {
    const report = { type: form.get('type'), description: form.get('description'), location: form.get('location'), ...(userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : {}) };
    let hazard;
    try {
      const response = await fetch('./api/hazards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      hazard = result.hazard;
    } catch {
      const titles = { 'blind-curve': 'Blind curve reported', landslide: 'Landslide or debris reported', 'road-damage': 'Road damage reported', 'poor-lighting': 'Poor lighting reported', other: 'Road hazard reported' };
      hazard = { id: `local-${Date.now()}`, ...report, title: titles[report.type], lat: report.lat || 30.4591, lng: report.lng || 78.0661, severity: 'Medium', reportedAt: new Date().toISOString(), status: 'active' };
    }
    store.hazards.unshift(hazard); renderLists(); event.currentTarget.reset(); document.querySelector('#reportDialog').close(); map.setView([hazard.lat, hazard.lng], 15);
    showToast(navigator.onLine ? 'Thanks — your road update is now on the map.' : 'Saved on this device. It will appear on this device only.');
  } catch (error) { showToast(error.message || 'Could not save report.'); }
});
document.querySelector('#sosForm').addEventListener('submit', async (event) => {
  event.preventDefault(); const need = new FormData(event.currentTarget).get('need');
  try {
    const response = await fetch('./api/sos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ need, ...(userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : {}) }) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error);
    document.querySelector('#sosDialog').close(); showToast(result.message);
  } catch {
    const alerts = JSON.parse(localStorage.getItem('pahadi-alerts') || '[]');
    alerts.unshift({ id: `local-sos-${Date.now()}`, need, ...(userLocation || { lat: 30.4591, lng: 78.0661 }), createdAt: new Date().toISOString(), status: 'saved-on-device' });
    localStorage.setItem('pahadi-alerts', JSON.stringify(alerts));
    document.querySelector('#sosDialog').close(); showToast('Prototype alert saved on this device. It did not notify helpers or emergency services.');
  }
});
document.querySelector('#layersBtn').addEventListener('click', () => document.querySelector('#layerMenu').classList.toggle('hidden'));
document.querySelectorAll('[data-layer]').forEach((input) => input.addEventListener('change', () => input.checked ? map.addLayer(groups[input.dataset.layer]) : map.removeLayer(groups[input.dataset.layer])));
document.querySelector('#locateBtn').addEventListener('click', () => {
  if (!navigator.geolocation) return showToast('Location is not available in this browser.');
  navigator.geolocation.getCurrentPosition((position) => { userLocation = { lat: position.coords.latitude, lng: position.coords.longitude }; map.setView([userLocation.lat, userLocation.lng], 15); L.circleMarker([userLocation.lat, userLocation.lng], { radius: 7, color: '#fff', weight: 3, fillColor: '#3279cb', fillOpacity: 1 }).addTo(map).bindPopup('You are here').openPopup(); }, () => showToast('Location permission was not granted.'), { timeout: 8000 });
});
document.querySelector('#routeBtn').addEventListener('click', () => { const route = L.polyline([[30.3165, 78.0322], [30.3551, 78.0448], [30.3972, 78.0580], [30.4310, 78.0718], [30.4595, 78.0730]], { color: '#3e8660', weight: 5, opacity: .9, dashArray: '1 0' }).addTo(map); map.fitBounds(route.getBounds(), { padding: [60, 60] }); showToast('Safer route preview: Dehradun → Mussoorie.'); });
document.querySelector('#searchInput').addEventListener('keydown', (event) => { if (event.key !== 'Enter') return; const query = event.currentTarget.value.trim().toLowerCase(); const match = [...store.places, ...store.hazards].find((item) => `${item.name || item.title} ${item.location || ''}`.toLowerCase().includes(query)); if (match) map.setView([match.lat, match.lng], 16); else showToast('No matching local place or report. Try a landmark.'); });
document.querySelector('#hazardList').addEventListener('click', (event) => { const row = event.target.closest('.hazard-row'); if (row) map.setView([Number(row.dataset.lat), Number(row.dataset.lng)], 16); });
document.querySelector('#placeList').addEventListener('click', (event) => { const row = event.target.closest('.place-item'); if (row) map.setView([Number(row.dataset.lat), Number(row.dataset.lng)], 16); });
document.querySelector('#allHelpers').addEventListener('click', () => { const bounds = L.latLngBounds(store.helpers.map((h) => [h.lat, h.lng])); if (bounds.isValid()) map.fitBounds(bounds, { padding: [90, 90] }); });
document.querySelector('#allPlaces').addEventListener('click', () => { const bounds = L.latLngBounds(store.places.map((p) => [p.lat, p.lng])); if (bounds.isValid()) map.fitBounds(bounds, { padding: [90, 90] }); });
document.querySelector('#mobilePlaces').addEventListener('click', () => { const bounds = L.latLngBounds(store.places.map((p) => [p.lat, p.lng])); if (bounds.isValid()) map.fitBounds(bounds, { padding: [90, 90] }); });
document.querySelector('#searchInput').addEventListener('focus', () => { if (window.innerWidth < 700) document.querySelector('#searchInput').scrollIntoView({ block: 'nearest' }); });
window.addEventListener('online', () => showToast('You’re back online. Refreshing road updates…'));
window.addEventListener('online', loadData);
loadData();
