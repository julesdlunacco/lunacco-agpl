/**
 * CitySearchInput — birth location search with lat/lng/timezone resolution.
 *
 * Uses core endpoints:
 *   - /lunacco/v1/locations/countries
 *   - /lunacco/v1/locations/cities?country=<code>&q=<query>
 *
 * Props:
 *   value       — display string (current selected city label)
 *   onChange    — called with raw string when user types
 *   onSelect    — called with { label, lat, lng, timezone } on selection / clear
 *   placeholder — input placeholder
 *   inputClass  — optional extra class for the input element
 */
import { useState, useEffect, useRef } from 'react';
import { MapPin, X } from 'lucide-react';

// Helper to extract country code from a city label
function detectCountryCode( label, countriesList ) {
	if ( ! label || ! countriesList.length ) return '';
	const parts = label.split( ',' ).map( s => s.trim() );
	if ( parts.length < 2 ) return '';
	const lastPart = parts[ parts.length - 1 ].toLowerCase();
	
	const match = countriesList.find( c => 
		c.code.toLowerCase() === lastPart || 
		c.name.toLowerCase() === lastPart
	);
	return match ? match.code : '';
}

export default function CitySearchInput( {
	value        = '',
	onChange,
	onSelect,
	placeholder  = 'Search city…',
	inputClass   = '',
} ) {
	const [ query,   setQuery   ] = useState( value );
	const [ results, setResults ] = useState( [] );
	const [ open,    setOpen    ] = useState( false );
	const [ countries, setCountries ] = useState( [] );
	const [ selectedCountry, setSelectedCountry ] = useState( '' );

	const ref   = useRef( null );
	const timer = useRef( null );

	// Load countries on mount
	useEffect( () => {
		async function loadCountries() {
			try {
				const root = ( ( window.LunaCcoData?.root ) || '/wp-json/' ).replace( /\/$/, '' ) + '/';
				const res = await fetch( `${ root }lunacco/v1/locations/countries` );
				if ( ! res.ok ) return;
				const data = await res.json();
				if ( Array.isArray( data ) ) {
					setCountries( data );
					
					// Detect country from value
					let code = detectCountryCode( value, data );
					if ( ! code ) {
						// Fallback to browser locale
						const browserLocale = navigator.language || '';
						const localeParts = browserLocale.split( '-' );
						const browserCode = ( localeParts[ 1 ] || localeParts[ 0 ] || '' ).toUpperCase();
						if ( data.some( c => c.code === browserCode ) ) {
							code = browserCode;
						}
					}
					if ( code ) {
						setSelectedCountry( code );
					}
				}
			} catch ( err ) {
				console.error( 'Failed to fetch countries', err );
			}
		}
		loadCountries();
	}, [] );

	// Sync external value
	useEffect( () => {
		setQuery( value || '' );
		if ( value && countries.length ) {
			const code = detectCountryCode( value, countries );
			if ( code ) {
				setSelectedCountry( code );
			}
		}
	}, [ value, countries ] );

	// Close on outside click
	useEffect( () => {
		const close = ( e ) => { if ( ref.current && !ref.current.contains( e.target ) ) setOpen( false ); };
		document.addEventListener( 'mousedown', close );
		return () => document.removeEventListener( 'mousedown', close );
	}, [] );

	function handleChange( e ) {
		const q = e.target.value;
		setQuery( q );
		if ( onChange ) onChange( q );
		clearTimeout( timer.current );
		if ( q.length < 2 || ! selectedCountry ) { setResults( [] ); setOpen( false ); return; }
		timer.current = setTimeout( async () => {
			try {
				const root = ( ( window.LunaCcoData?.root ) || '/wp-json/' ).replace( /\/$/, '' ) + '/';
				const url = `${ root }lunacco/v1/locations/cities?country=${ encodeURIComponent( selectedCountry ) }&q=${ encodeURIComponent( q ) }`;
				const res  = await fetch( url );
				if ( !res.ok ) return;
				const data = await res.json();
				setResults( Array.isArray( data ) ? data : [] );
				setOpen( true );
			} catch { /* silently ignore */ }
		}, 300 );
	}

	function handleSelect( city ) {
		const label = [ city.city, city.admin_name, city.country ].filter( Boolean ).join( ', ' );
		setQuery( label );
		setResults( [] );
		setOpen( false );
		if ( onChange ) onChange( label );
		if ( onSelect ) onSelect( { label, lat: String( city.latitude || '' ), lng: String( city.longitude || '' ), timezone: city.timezone || '' } );
	}

	function handleClear() {
		setQuery( '' );
		setResults( [] );
		setOpen( false );
		if ( onChange ) onChange( '' );
		if ( onSelect ) onSelect( { label: '', lat: '', lng: '', timezone: '' } );
	}

	return (
		<div ref={ ref } className="relative w-full flex flex-col gap-2">
			<div>
				<select
					value={ selectedCountry }
					onChange={ ( e ) => {
						setSelectedCountry( e.target.value );
						setQuery( '' );
						setResults( [] );
						if ( onChange ) onChange( '' );
						if ( onSelect ) onSelect( { label: '', lat: '', lng: '', timezone: '' } );
					} }
					className={ `w-full ${ inputClass }` }
					style={{ borderRadius: 'var(--radius-input, 0px)', paddingRight: '24px' }}
				>
					<option value="">Select country...</option>
					{ countries.length === 0 ? (
						<option value="" disabled>No country data available. Run importer first.</option>
					) : (
						countries.map( ( c ) => (
							<option key={ c.code } value={ c.code }>
								{ c.name }
							</option>
						) )
					) }
				</select>
			</div>

			<div className="relative">
				<MapPin size={ 14 } className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mute)] pointer-events-none" />
				<input
					type="text"
					value={ query }
					onChange={ handleChange }
					onFocus={ () => results.length > 0 && setOpen( true ) }
					placeholder={ selectedCountry ? placeholder : 'Please select country first…' }
					disabled={ ! selectedCountry }
					className={ `w-full pl-9 ${ query ? 'pr-8' : 'pr-3' } ${ inputClass }` }
				/>
				{ query && (
					<button type="button" onClick={ handleClear } className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--mute)] hover:text-[var(--ink)] transition-colors">
						<X size={ 12 } />
					</button>
				) }
			</div>
			{ open && results.length > 0 && (
				<div className="absolute top-full left-0 right-0 mt-1 bg-[var(--paper)] border border-[var(--indigo)] shadow-2xl z-[300] max-h-56 overflow-y-auto">
					{ results.map( ( city, i ) => (
						<button
							key={ i }
							type="button"
							onClick={ () => handleSelect( city ) }
							className="w-full text-left px-3 py-2.5 hover:bg-[var(--indigo)] hover:text-[var(--btn-fg)] transition-colors border-b border-[var(--hair)] last:border-0"
						>
							<span className="text-[11px] font-bold text-[var(--ink)] hover:text-inherit">{ city.city }</span>
							<span className="text-[10px] text-[var(--mute)] hover:text-inherit ml-1">{ [ city.admin_name, city.country ].filter( Boolean ).join( ', ' ) }</span>
							{ city.timezone && <span className="text-[9px] text-[var(--mute)] hover:text-inherit ml-2 opacity-50">{ city.timezone }</span> }
						</button>
					) ) }
				</div>
			) }
		</div>
	);
}
