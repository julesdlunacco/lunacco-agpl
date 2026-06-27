/**
 * Postbuild: place swisseph.wasm + swisseph.data where the bundled
 * swisseph-wasm runtime expects them.
 *
 * At runtime the IIFE resolves `new URL("./swisseph.wasm", import.meta.url).href`
 * which — because the package lives in node_modules/swisseph-wasm/wsam/ — ends
 * up computing a URL like `<dist>/wsam/swisseph.wasm`. Easiest fix: copy the
 * two binary assets into dist/wsam/ next to the module bundle. (Also keeps a
 * copy in dist/assets/ for any legacy loaders.)
 */

const fs   = require( 'fs' );
const path = require( 'path' );

const root    = path.resolve( __dirname, '..' );
const dist    = path.join( root, 'dist' );
const plugin  = path.resolve( root, '..' ); // lunacco-astrohd plugin root
const wsamIn  = path.join( root, 'node_modules', 'swisseph-wasm', 'wsam' );
const wsamOut = path.join( dist, 'wsam' );

if ( ! fs.existsSync( dist ) ) {
	console.warn( '[postbuild] dist/ missing — did vite build fail?' );
	process.exit( 0 );
}

// Copy swisseph binary assets next to the bundle (runtime URL resolution).
fs.mkdirSync( wsamOut, { recursive: true } );
for ( const name of [ 'swisseph.wasm', 'swisseph.data' ] ) {
	const src = path.join( wsamIn, name );
	if ( ! fs.existsSync( src ) ) {
		console.warn( `[postbuild] ${ name } not found in swisseph-wasm/wsam/` );
		continue;
	}
	fs.copyFileSync( src, path.join( wsamOut, name ) );
	console.log( `[postbuild] copied ${ name } -> dist/wsam/` );
}

// Deploy the built module JS + WASM to the plugin's assets/ directory
// so WordPress serves the latest build without a manual copy step.
const pluginAssets = path.join( plugin, 'assets' );
fs.mkdirSync( pluginAssets, { recursive: true } );

const jsSrc = path.join( dist, 'assets', 'luna-astrohd-module.js' );
const jsDst = path.join( pluginAssets, 'luna-astrohd-module.js' );
if ( fs.existsSync( jsSrc ) ) {
	fs.copyFileSync( jsSrc, jsDst );
	console.log( '[postbuild] deployed luna-astrohd-module.js -> plugin/assets/' );
}

for ( const name of [ 'swisseph.wasm', 'swisseph.data' ] ) {
	const src = path.join( wsamOut, name );
	const dst = path.join( pluginAssets, name );
	if ( fs.existsSync( src ) ) {
		fs.copyFileSync( src, dst );
		console.log( `[postbuild] deployed ${ name } -> plugin/assets/` );
	}
}
