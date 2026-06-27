/**
 * API utility — centralized fetch wrapper for LunaCco REST endpoints.
 *
 * Usage:
 *   import { apiFetch } from '../utils/api.js';
 *   const data = await apiFetch( 'lunacco/v1/user/context' );
 *
 * Automatically reads window.LunaCcoData.root and window.LunaCcoData.nonce.
 */

/** @returns {string} REST API root URL */
export function getRoot() {
  return window.LunaCcoData?.root || '/wp-json/';
}

/** @returns {string} Current WP REST nonce */
export function getNonce() {
  return window.LunaCcoData?.nonce || '';
}

/**
 * Wrapper around fetch() for WP REST API requests.
 *
 * @param {string} endpoint  Path relative to root, e.g. 'lunacco/v1/user/context'.
 * @param {RequestInit} [options]
 * @returns {Promise<any>} Parsed JSON response.
 */
export async function apiFetch( endpoint, options = {} ) {
  const url     = getRoot() + endpoint;
  const headers = {
    'Content-Type': 'application/json',
    'X-WP-Nonce':   getNonce(),
    ...( options.headers || {} ),
  };

  const response = await fetch( url, { ...options, headers } );

  if ( ! response.ok ) {
    const error = await response.json().catch( () => ( { message: response.statusText } ) );
    throw Object.assign( new Error( error.message || 'Request failed' ), {
      status: response.status,
      data:   error,
    } );
  }

  return response.json();
}
