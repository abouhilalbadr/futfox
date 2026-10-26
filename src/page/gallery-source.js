// Downloads the published Gallery sets (FutFox's own Firestore document, readable by anyone)
// and keeps a copy in the page's local storage for a day. Nothing is sent with the request.
(function (root) {
  'use strict';

  const H = root.FutFox;
  const SOURCE = 'https://firestore.googleapis.com/v1/projects/futfox-gallery/databases/(default)/documents/public/gallery';
  // For local testing, set this key to the Firestore emulator's address for public/gallery.
  const DEV_SOURCE_KEY = 'futfox.dev.setsUrl';
  const CACHE_KEY = 'futfox.gallerySets';
  const MAX_AGE = 24 * 60 * 60 * 1000;

  function read(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function cached() {
    try {
      const data = JSON.parse(read(CACHE_KEY) || 'null');
      return data && Array.isArray(data.sets) ? data : null;
    } catch (e) {
      return null;
    }
  }

  // The sets, from the copy if it is less than a day old (or `force` is false and the download fails).
  async function load({ force = false } = {}) {
    const copy = cached();
    if (!force && copy && Date.now() - copy.fetchedAt < MAX_AGE) return copy;
    const res = await fetch(read(DEV_SOURCE_KEY) || SOURCE, { credentials: 'omit', cache: 'no-store' });
    // 404: nothing has been published yet.
    if (!res.ok && res.status !== 404) throw new Error(`FutFox's set list answered ${res.status}.`);
    const gallery = res.status === 404 ? { publishedAt: 0, sets: [] } : H.setMatch.readGallery(await res.json());
    if (!gallery) throw new Error('The set list is in a format this version of FutFox doesn\'t know. Update FutFox.');
    const fresh = { ...gallery, fetchedAt: Date.now() };
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(fresh));
    } catch (e) {
      // The copy only saves a download next time.
    }
    return fresh;
  }

  H.gallerySource = { load, cached };
})(typeof globalThis !== 'undefined' ? globalThis : this);
