/**
 * appViews — view key utilities for the core router.
 *
 * Unlike luna-tarot's static VIEW_KEYS array, the core version is dynamic:
 * valid view keys come from the module registry at runtime.
 *
 * Modules register their view keys via window.LunaCcoModuleRegistry.register().
 * The router reads getAllViewKeys() from the registry to validate hash routes.
 */

/**
 * Parse and validate a URL hash against the registered view keys.
 *
 * @param {string}   rawHash     e.g. '#reading' or ''
 * @param {string[]} validKeys   From LunaCcoModuleRegistry.getAllViewKeys()
 * @param {string}   [fallback]  Default view key if hash is invalid.
 * @returns {string}
 */
export function parseViewFromHash( rawHash, validKeys, fallback = 'home' ) {
  return parseHash( rawHash, validKeys, fallback ).view;
}

/**
 * Parse a hash into a view key + optional deep-link param.
 *
 * The hash is `#view` or `#view/param` — the first segment is the (validated)
 * view key; everything after the first slash is an opaque param the consuming
 * view interprets (e.g. a chart type id, or `spread:deck` for tarot). The view
 * is lower-cased for matching; the param keeps its original case.
 *
 * @param {string}   rawHash
 * @param {string[]} validKeys
 * @param {string}   [fallback]
 * @returns {{ view: string, param: string|null }}
 */
export function parseHash( rawHash, validKeys, fallback = 'home' ) {
  const body = ( rawHash || '' ).replace( /^#/, '' ).trim();
  const slash = body.indexOf( '/' );
  const rawView = ( slash === -1 ? body : body.slice( 0, slash ) ).toLowerCase();
  const param = slash === -1 ? null : decodeURIComponent( body.slice( slash + 1 ) ) || null;
  const view = validKeys.includes( rawView ) ? rawView : fallback;
  // A param only belongs to a valid view; drop it when the view fell back.
  return { view, param: view === rawView ? param : null };
}

/**
 * Push a view key (+ optional deep-link param) to the browser hash without
 * triggering a full navigation.
 *
 * @param {string} viewKey
 * @param {string|null} [param]
 */
export function pushViewHash( viewKey, param = null ) {
  window.location.hash = param ? `${ viewKey }/${ encodeURIComponent( param ) }` : viewKey;
}
