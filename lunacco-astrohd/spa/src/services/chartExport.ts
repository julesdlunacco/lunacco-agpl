/**
 * chartExport — client-side "Download chart as PNG".
 *
 * Snapshots the on-screen chart info area (the masthead, summary cards, gate
 * columns, panels, graphic — everything currently rendered) into a PNG using
 * html2canvas, which rasterises the live DOM with the document's actual loaded
 * fonts and resolved CSS-variable theming.
 *
 * The capture target is the element marked [data-astrohd-chart-pane]. Because
 * that element (or a child) is usually a fixed-height scroll container, we
 * temporarily expand it (and any descendant scrollers) so the FULL content is
 * laid out, capture, then restore. The floating download button carries
 * data-html2canvas-ignore so it never appears in the image.
 */

import html2canvas from 'html2canvas';

// Colour properties whose computed value can be a modern color function
// (color-mix → serialised as color(srgb …)) that html2canvas can't parse.
const COLOR_PROPS = [
	'color', 'background-color', 'border-top-color', 'border-right-color',
	'border-bottom-color', 'border-left-color', 'outline-color', 'fill',
	'stroke', 'box-shadow', 'text-decoration-color', 'caret-color', 'column-rule-color',
];

/** Convert any color(srgb|display-p3 r g b [/ a]) occurrences in a value to rgb()/rgba(). */
function convertColorFunctions( value: string ): string {
	let out = value.replace(
		/color\(\s*(?:srgb|display-p3|srgb-linear)\s+([^)]+)\)/gi,
		( _m, body: string ) => {
			const [ rgbStr, alphaStr ] = String( body ).split( '/' );
			const comps = rgbStr.trim().split( /\s+/ ).map( ( c ) => {
				const t = c.trim();
				if ( t.endsWith( '%' ) ) return Math.round( ( parseFloat( t ) / 100 ) * 255 );
				const f = parseFloat( t );
				return Math.round( Math.min( 1, Math.max( 0, f ) ) * 255 );
			} );
			const [ r = 0, g = 0, b = 0 ] = comps;
			let a = 1;
			if ( alphaStr !== undefined ) {
				const at = alphaStr.trim();
				a = at.endsWith( '%' ) ? parseFloat( at ) / 100 : parseFloat( at );
			}
			return a >= 1 ? `rgb(${ r }, ${ g }, ${ b })` : `rgba(${ r }, ${ g }, ${ b }, ${ a })`;
		}
	);
	// Safety net: any color function html2canvas still can't read becomes a neutral
	// grey rather than throwing (rare — only if a browser leaves color-mix/oklch raw).
	if ( /(?:color-mix|oklch|oklab|lab|lch)\(/i.test( out ) ) {
		out = out.replace( /(?:color-mix|oklch|oklab|lab|lch)\([^)]*\)/gi, 'rgba(127,127,127,1)' );
	}
	return out;
}

/** Walk the html2canvas clone and inline-resolve unsupported color functions. */
function sanitizeClonedColors( doc: Document, root: HTMLElement ): void {
	const view = doc.defaultView || window;
	const nodes: HTMLElement[] = [ root, ...Array.from( root.querySelectorAll<HTMLElement>( '*' ) ) ];
	for ( const node of nodes ) {
		const cs = view.getComputedStyle( node );
		for ( const prop of COLOR_PROPS ) {
			const v = cs.getPropertyValue( prop );
			if ( v && ( v.indexOf( 'color(' ) !== -1 || /(?:color-mix|oklch|oklab|lab|lch)\(/i.test( v ) ) ) {
				node.style.setProperty( prop, convertColorFunctions( v ) );
			}
		}
	}
}

const XLINK = 'http://www.w3.org/1999/xlink';

function svgTextToDataUri( text: string ): string {
	return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent( text );
}

/**
 * Glyph artwork is loaded as external SVGs and recoloured at runtime — neither
 * survives html2canvas:
 *   • Wheel sign/planet glyphs are SVG <image href="…glyph.svg"> recoloured by an
 *     in-SVG filter (#colorize-accent). External hrefs don't load when html2canvas
 *     serialises the wheel SVG, so they render broken. Inlining the href as a data
 *     URI fixes it — the in-SVG filter then colours them as on screen.
 *   • HD gate-column glyphs are HTML <img> recoloured by a CSS `filter` chain,
 *     which html2canvas ignores (they come out black). We bake the accent colour
 *     into the SVG and drop the now-redundant filter.
 *
 * Returns a function that restores the live DOM after capture.
 */
async function inlineGlyphImages( pane: HTMLElement ): Promise<() => void> {
	const gold = getComputedStyle( document.documentElement ).getPropertyValue( '--gold' ).trim() || '#d4af37';
	const restores: Array<() => void> = [];
	const cache = new Map<string, Promise<string>>();

	const fetchSvg = ( url: string ): Promise<string> => {
		if ( ! cache.has( url ) ) {
			cache.set( url, fetch( url, { credentials: 'same-origin' } )
				.then( ( r ) => ( r.ok ? r.text() : '' ) )
				.catch( () => '' ) );
		}
		return cache.get( url )!;
	};

	// Wheel: inline external SVG <image> hrefs (in-SVG filter handles colour).
	const svgImages = Array.from( pane.querySelectorAll( 'image' ) );
	await Promise.all( svgImages.map( async ( im ) => {
		const href = im.getAttribute( 'href' ) || im.getAttributeNS( XLINK, 'href' ) || '';
		if ( ! href || href.startsWith( 'data:' ) ) {
			return;
		}
		const text = await fetchSvg( href );
		if ( ! text || text.indexOf( '<svg' ) === -1 ) {
			return;
		}
		const origHref = im.getAttribute( 'href' );
		const origXlink = im.getAttributeNS( XLINK, 'href' );
		im.setAttribute( 'href', svgTextToDataUri( text ) );
		im.removeAttributeNS( XLINK, 'href' );
		restores.push( () => {
			if ( origHref === null ) im.removeAttribute( 'href' ); else im.setAttribute( 'href', origHref );
			if ( origXlink ) im.setAttributeNS( XLINK, 'href', origXlink );
		} );
	} ) );

	// HD gate columns: HTML <img> recoloured via CSS filter → bake gold fill, drop filter.
	const htmlImgs = Array.from( pane.querySelectorAll( 'img' ) ).filter( ( img ) => {
		const f = getComputedStyle( img ).filter;
		return f && f !== 'none';
	} );
	await Promise.all( htmlImgs.map( async ( img ) => {
		const src = img.getAttribute( 'src' ) || '';
		if ( ! src || src.startsWith( 'data:' ) ) {
			return;
		}
		const text = await fetchSvg( src );
		if ( ! text || text.indexOf( '<svg' ) === -1 ) {
			return;
		}
		// Force every shape to the accent colour (these are monochrome icons) and
		// guarantee a square aspect ratio so html2canvas doesn't squish the glyph.
		const recoloured = text.replace( /<svg([^>]*)>/i, ( _m, attrs ) => {
			let a = attrs as string;
			if ( ! /preserveAspectRatio/i.test( a ) ) {
				a += ' preserveAspectRatio="xMidYMid meet"';
			}
			const vb = /viewBox\s*=\s*"([^"]+)"/i.exec( a );
			if ( vb && ! /\bwidth\s*=/i.test( a ) ) {
				const parts = vb[ 1 ].trim().split( /[\s,]+/ );
				if ( parts.length === 4 ) {
					a += ` width="${ parts[ 2 ] }" height="${ parts[ 3 ] }"`;
				}
			}
			return `<svg${ a }><style>*{fill:${ gold } !important;}</style>`;
		} );
		const origSrc = img.getAttribute( 'src' );
		const origFilter = img.style.filter;
		img.setAttribute( 'src', svgTextToDataUri( recoloured ) );
		img.style.filter = 'none';
		restores.push( () => {
			if ( origSrc !== null ) img.setAttribute( 'src', origSrc );
			img.style.filter = origFilter;
		} );
	} ) );

	return () => restores.forEach( ( fn ) => fn() );
}

/** Resolve the themed paper background so the PNG isn't transparent. */
function resolveBackground(): string {
	const root = getComputedStyle( document.documentElement );
	const paper = root.getPropertyValue( '--paper' ).trim();
	if ( paper ) {
		return paper;
	}
	const bodyBg = getComputedStyle( document.body ).backgroundColor;
	return bodyBg && bodyBg !== 'rgba(0, 0, 0, 0)' ? bodyBg : '#ffffff';
}

type SavedStyle = [ HTMLElement, string | null ];

/**
 * Expand the pane and any descendant scroll containers so the whole chart lays
 * out at full height for the capture. Returns the saved inline styles to restore.
 */
function expandForCapture( pane: HTMLElement ): SavedStyle[] {
	const saved: SavedStyle[] = [];
	const nodes: HTMLElement[] = [ pane, ...Array.from( pane.querySelectorAll<HTMLElement>( '*' ) ) ];
	for ( const el of nodes ) {
		const cs = getComputedStyle( el );
		const scrolls = /(auto|scroll)/.test( cs.overflow + cs.overflowY + cs.overflowX );
		if ( el === pane || scrolls ) {
			saved.push( [ el, el.getAttribute( 'style' ) ] );
			el.style.overflow = 'visible';
			el.style.maxHeight = 'none';
			if ( el === pane ) {
				el.style.height = 'auto';
				el.style.flex = 'none';
			}
		}
	}
	return saved;
}

function restoreStyles( saved: SavedStyle[] ): void {
	for ( const [ el, style ] of saved ) {
		if ( style === null ) {
			el.removeAttribute( 'style' );
		} else {
			el.setAttribute( 'style', style );
		}
	}
}

function safeFilename( name: string ): string {
	const base = ( name || 'chart' ).replace( /[\\/:*?"<>|]+/g, '' ).replace( /\s+/g, ' ' ).trim();
	return ( base || 'chart' ) + '.png';
}

function downloadCanvas( canvas: HTMLCanvasElement, filename: string ): Promise<void> {
	return new Promise( ( resolve ) => {
		canvas.toBlob( ( blob ) => {
			if ( ! blob ) {
				resolve();
				return;
			}
			const url = URL.createObjectURL( blob );
			const a = document.createElement( 'a' );
			a.href = url;
			a.download = safeFilename( filename );
			document.body.appendChild( a );
			a.click();
			a.remove();
			setTimeout( () => URL.revokeObjectURL( url ), 2000 );
			resolve();
		}, 'image/png' );
	} );
}

/**
 * Snapshot the active chart info area to a PNG and download it. Throws if no
 * chart pane is on screen yet.
 */
export async function downloadActiveChartPng( filename = 'chart' ): Promise<void> {
	const pane = document.querySelector<HTMLElement>( '[data-astrohd-chart-pane]' );
	if ( ! pane ) {
		throw new Error( 'No chart to export yet — generate a chart first.' );
	}

	const background = resolveBackground();
	const saved = expandForCapture( pane );
	const restoreGlyphs = await inlineGlyphImages( pane );

	try {
		// Let layout settle after expansion before rasterising.
		await new Promise( ( r ) => requestAnimationFrame( () => r( null ) ) );
		const canvas = await html2canvas( pane, {
			backgroundColor: background,
			scale: Math.min( 2, window.devicePixelRatio || 1.5 ) || 2,
			useCORS: true,
			logging: false,
			// Elements with [data-html2canvas-ignore] (the download button) are skipped.
			// Resolve color-mix()/color(srgb …) the parser can't handle before it reads them.
			onclone: ( clonedDoc: Document, clonedEl: HTMLElement ) => {
				try {
					// Snapshot-only tweaks: let gate-column text show its descenders
					// (on screen it's clipped by overflow:hidden) and keep glyphs from
					// being stretched.
					const style = clonedDoc.createElement( 'style' );
					style.textContent =
						'[data-astrohd-chart-pane] span,[data-astrohd-chart-pane] div{overflow:visible !important;}' +
						'[data-astrohd-chart-pane] img{object-fit:contain !important;}';
					clonedDoc.head.appendChild( style );
					sanitizeClonedColors( clonedDoc, clonedEl );
				} catch ( e ) {
					console.warn( '[AstroHD] export onclone tweak skipped', e );
				}
			},
		} );
		await downloadCanvas( canvas, filename );
	} finally {
		restoreGlyphs();
		restoreStyles( saved );
	}
}
