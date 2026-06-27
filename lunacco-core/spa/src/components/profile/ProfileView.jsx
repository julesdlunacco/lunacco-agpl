/**
 * ProfileView — user profile editor (astrology, human design, numerology data).
 *
 * Uses UserContext for profile data and saveProfile().
 * Modules read the relevant profile section for their focus/lens features.
 */
import React from 'react';
import { useUser } from '../../contexts/UserContext.jsx';
import { useAppConfig } from '../../contexts/AppConfigContext.jsx';
import { useModuleRegistry } from '../../contexts/ModuleContext.jsx';
import { parsePersonaCatalog } from '../../utils/persona.js';
import CitySearchInput from '../shared/CitySearchInput.jsx';

const Field = ( { label, children } ) => (
  <label className="flex flex-col gap-1.5 text-sm text-[var(--ink)]">
    <span className="text-[11px] uppercase tracking-widest font-bold text-[var(--mute)]">{ label }</span>
    { children }
  </label>
);

const inputClass = 'bg-[var(--paper)] border border-[var(--hair)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--indigo)] transition-all';

export default function ProfileView() {
  const { profileData, setProfileData, saveProfile, profileSaving, profileSavedMsg } = useUser();
  const { modules, returnMainUrl, returnMainLabel, buyCreditsUrl, becomeMemberUrl } = useAppConfig();
  const { modules: registeredModules } = useModuleRegistry();

  const hasEastern = registeredModules.some( m => m.id === 'lunacco-eastern' );
  const hasNumerology = registeredModules.some( m => m.id === 'luna-numerology' );

  // Persona catalog may be in the tarot module's localize data or empty
  const personaCatalog = parsePersonaCatalog( modules?.[ 'luna-tarot' ]?.personaCatalog ?? null );

  return (
    <div className="w-full h-full flex flex-col p-8 overflow-y-auto no-scrollbar bg-[var(--paper)]">
      <h2 className="text-5xl font-normal text-[var(--ink)] tracking-tighter mb-10 text-center" style={{ fontFamily: 'var(--font-display)' }}>Profile &amp; Lens Data</h2>
      
      <div className="max-w-[980px] mx-auto w-full space-y-12 pb-24">

        <div className="bg-[var(--card)] border border-[var(--hair)] p-8 space-y-6" style={{ borderRadius: 'var(--radius-card, 0px)' }}>
          <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-[var(--indigo)] mb-4">Identity</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Field label="Full Name">
              <input className={ inputClass } style={{ borderRadius: 'var(--radius-input, 0px)' }} placeholder="Your full name" value={ profileData.identity?.full_name || '' } onChange={ ( e ) => setProfileData( ( p ) => ( { ...p, identity: { ...p.identity, full_name: e.target.value } } ) ) } />
            </Field>
            <Field label="Nickname / Known As">
              <input className={ inputClass } style={{ borderRadius: 'var(--radius-input, 0px)' }} placeholder="What to call you" value={ profileData.identity?.nickname || '' } onChange={ ( e ) => setProfileData( ( p ) => ( { ...p, identity: { ...p.identity, nickname: e.target.value } } ) ) } />
            </Field>
            <Field label="Birthdate">
              <input type="date" className={ inputClass } style={{ borderRadius: 'var(--radius-input, 0px)' }} value={ profileData.identity?.birthdate || '' } onChange={ ( e ) => setProfileData( ( p ) => ( { ...p, identity: { ...p.identity, birthdate: e.target.value } } ) ) } />
            </Field>
          </div>

          { /* Birth Details — for Human Design / AstroHD */ }
          <div className="mt-8 pt-8 border-t border-[var(--hair)]">
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[var(--mute)] mb-6">Birth Details <span className="normal-case font-normal opacity-50">for Human Design charts</span></p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Field label="Birth Time">
                <input
                  type="time"
                  className={ inputClass }
                  style={{ borderRadius: 'var(--radius-input, 0px)' }}
                  value={ profileData.identity?.birth_time || '' }
                  onChange={ ( e ) => setProfileData( ( p ) => ( { ...p, identity: { ...p.identity, birth_time: e.target.value } } ) ) }
                />
              </Field>
              <Field label="Birth Location">
                <CitySearchInput
                  value={ profileData.identity?.birth_location || '' }
                  onChange={ ( v ) => setProfileData( ( p ) => ( { ...p, identity: { ...p.identity, birth_location: v } } ) ) }
                  onSelect={ ( { label, lat, lng, timezone } ) => setProfileData( ( p ) => ( {
                    ...p,
                    identity: {
                      ...p.identity,
                      birth_location: label,
                      birth_lat:      lat,
                      birth_lng:      lng,
                      birth_timezone: timezone,
                    },
                  } ) ) }
                  placeholder="Search city…"
                  inputClass={ `${ inputClass }` }
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6 pt-6 border-t border-[var(--hair)]">
              <Field label="Birth Timezone Override">
                <div className="flex gap-2">
                  <input
                    className={ inputClass }
                    style={{ borderRadius: 'var(--radius-input, 0px)', flex: 1 }}
                    placeholder="e.g. America/New_York"
                    value={ profileData.identity?.birth_timezone || '' }
                    onChange={ ( e ) => setProfileData( ( p ) => ( { ...p, identity: { ...p.identity, birth_timezone: e.target.value } } ) ) }
                  />
                  <button
                    type="button"
                    onClick={ () => {
                      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                      if ( tz ) setProfileData( ( p ) => ( { ...p, identity: { ...p.identity, birth_timezone: tz } } ) );
                    } }
                    className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest bg-[var(--card)] border border-[var(--hair)] text-[var(--mute)] hover:text-[var(--ink)] hover:border-[var(--indigo)] transition-all whitespace-nowrap"
                    style={{ borderRadius: 'var(--radius-input, 0px)' }}
                  >
                    Auto-detect
                  </button>
                </div>
              </Field>
              { profileData.identity?.birth_lat && (
                <div className="flex flex-col justify-end pb-2">
                  <p className="text-[10px] text-[var(--mute)] italic">
                    Coordinates: { parseFloat( profileData.identity.birth_lat ).toFixed( 4 ) }, { parseFloat( profileData.identity.birth_lng ).toFixed( 4 ) }
                  </p>
                </div>
              ) }
            </div>
          </div>

          { hasEastern && (
            <div className="mt-8 pt-8 border-t border-[var(--hair)]">
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[var(--mute)] mb-6">Eastern Timing <span className="normal-case font-normal opacity-50">for BaZi luck cycles</span></p>
              <div className="max-w-xl">
                <Field label="Luck Cycle Polarity">
                  <select
                    className={ inputClass }
                    style={{ borderRadius: 'var(--radius-input, 0px)' }}
                    value={ profileData.identity?.luck_cycle_polarity || '' }
                    onChange={ ( e ) => setProfileData( ( p ) => ( { ...p, identity: { ...p.identity, luck_cycle_polarity: e.target.value } } ) ) }
                  >
                    <option value="">Other / None / Unsure</option>
                    <option value="yang">Yang</option>
                    <option value="yin">Yin</option>
                  </select>
                </Field>
                <p className="text-[10px] text-[var(--mute)] mt-2 italic leading-relaxed">
                  Some BaZi luck-cycle methods use a yin/yang polarity to choose pillar direction. Choose what best aligns with your lived presentation, birth context, or reading preference. If unsure, BaZi charts will show both directions for comparison.
                </p>
              </div>
            </div>
          ) }

          <div className="mt-8 pt-8 border-t border-[var(--hair)]">
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[var(--mute)] mb-6">Current Timezone <span className="normal-case font-normal opacity-50">for Snapshot &amp; Astroweather</span></p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Field label="Your Current Timezone">
                <div className="flex gap-2">
                  <input
                    className={ inputClass }
                    style={{ borderRadius: 'var(--radius-input, 0px)', flex: 1 }}
                    placeholder="e.g. America/New_York"
                    value={ profileData.identity?.current_timezone || '' }
                    onChange={ ( e ) => setProfileData( ( p ) => ( { ...p, identity: { ...p.identity, current_timezone: e.target.value } } ) ) }
                  />
                  <button
                    type="button"
                    onClick={ () => {
                      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                      if ( tz ) setProfileData( ( p ) => ( { ...p, identity: { ...p.identity, current_timezone: tz } } ) );
                    } }
                    className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest bg-[var(--card)] border border-[var(--hair)] text-[var(--mute)] hover:text-[var(--ink)] hover:border-[var(--indigo)] transition-all whitespace-nowrap"
                    style={{ borderRadius: 'var(--radius-input, 0px)' }}
                  >
                    Auto-detect
                  </button>
                </div>
              </Field>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-[var(--hair)]">
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[var(--mute)] mb-6">Home Location <span className="normal-case font-normal opacity-50">for Location-based insights</span></p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <Field label="City">
                <input className={ inputClass } style={{ borderRadius: 'var(--radius-input, 0px)' }} placeholder="e.g. Santa Fe" value={ profileData.identity?.city || '' } onChange={ ( e ) => setProfileData( ( p ) => ( { ...p, identity: { ...p.identity, city: e.target.value } } ) ) } />
              </Field>
              <Field label="Region / State">
                <input className={ inputClass } style={{ borderRadius: 'var(--radius-input, 0px)' }} placeholder="e.g. New Mexico" value={ profileData.identity?.region || '' } onChange={ ( e ) => setProfileData( ( p ) => ( { ...p, identity: { ...p.identity, region: e.target.value } } ) ) } />
              </Field>
              <Field label="Country">
                <input className={ inputClass } style={{ borderRadius: 'var(--radius-input, 0px)' }} placeholder="optional" value={ profileData.identity?.country || '' } onChange={ ( e ) => setProfileData( ( p ) => ( { ...p, identity: { ...p.identity, country: e.target.value } } ) ) } />
              </Field>
            </div>
          </div>
        </div>

        <div className="bg-[var(--card)] border border-[var(--hair)] p-8" style={{ borderRadius: 'var(--radius-card, 0px)' }}>
          <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-[var(--indigo)] mb-6">Preferred Tone</h3>
          <select
            className={ `${ inputClass } w-full max-w-md` }
            style={{ borderRadius: 'var(--radius-input, 0px)' }}
            value={ profileData.preferred_tone }
            onChange={ ( e ) => setProfileData( ( prev ) => ( { ...prev, preferred_tone: e.target.value } ) ) }
          >
            <option value="">No preference</option>
            { ( personaCatalog.tone || [] ).map( ( tone ) => (
              <option key={ tone.key } value={ tone.key }>{ tone.label || tone.key }</option>
            ) ) }
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-[var(--card)] border border-[var(--hair)] p-8 space-y-6" style={{ borderRadius: 'var(--radius-card, 0px)' }}>
            <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-[var(--indigo)] mb-4">Astrology</h3>
            <div className="space-y-4">
              <Field label="Sun Sign">
                <input className={ inputClass } style={{ borderRadius: 'var(--radius-input, 0px)' }} placeholder="Sun sign" value={ profileData.astrology.sun_sign } onChange={ ( e ) => setProfileData( ( p ) => ( { ...p, astrology: { ...p.astrology, sun_sign: e.target.value } } ) ) } />
              </Field>
              <Field label="Moon Sign">
                <input className={ inputClass } style={{ borderRadius: 'var(--radius-input, 0px)' }} placeholder="Moon sign" value={ profileData.astrology.moon_sign } onChange={ ( e ) => setProfileData( ( p ) => ( { ...p, astrology: { ...p.astrology, moon_sign: e.target.value } } ) ) } />
              </Field>
              <Field label="Rising Sign">
                <input className={ inputClass } style={{ borderRadius: 'var(--radius-input, 0px)' }} placeholder="Rising sign" value={ profileData.astrology.rising_sign } onChange={ ( e ) => setProfileData( ( p ) => ( { ...p, astrology: { ...p.astrology, rising_sign: e.target.value } } ) ) } />
              </Field>
            </div>
          </div>

          <div className="bg-[var(--card)] border border-[var(--hair)] p-8 space-y-6" style={{ borderRadius: 'var(--radius-card, 0px)' }}>
            <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-[var(--indigo)] mb-4">Human Design</h3>
            <div className="space-y-4">
              <Field label="Type">
                <input className={ inputClass } style={{ borderRadius: 'var(--radius-input, 0px)' }} placeholder="Type" value={ profileData.human_design.type } onChange={ ( e ) => setProfileData( ( p ) => ( { ...p, human_design: { ...p.human_design, type: e.target.value } } ) ) } />
              </Field>
              <Field label="Profile">
                <input className={ inputClass } style={{ borderRadius: 'var(--radius-input, 0px)' }} placeholder="Profile" value={ profileData.human_design.profile } onChange={ ( e ) => setProfileData( ( p ) => ( { ...p, human_design: { ...p.human_design, profile: e.target.value } } ) ) } />
              </Field>
              <Field label="Incarnation Cross">
                <input className={ inputClass } style={{ borderRadius: 'var(--radius-input, 0px)' }} placeholder="Incarnation cross" value={ profileData.human_design.incarnation_cross } onChange={ ( e ) => setProfileData( ( p ) => ( { ...p, human_design: { ...p.human_design, incarnation_cross: e.target.value } } ) ) } />
              </Field>
            </div>
          </div>
        </div>

        { hasNumerology && (
          <div className="bg-[var(--card)] border border-[var(--hair)] p-8" style={{ borderRadius: 'var(--radius-card, 0px)' }}>
            <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-[var(--indigo)] mb-6">Numerology</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              <Field label="Life Path">
                <input className={ inputClass } style={{ borderRadius: 'var(--radius-input, 0px)' }} placeholder="Life path" value={ profileData.numerology.life_path_number } onChange={ ( e ) => setProfileData( ( p ) => ( { ...p, numerology: { ...p.numerology, life_path_number: e.target.value } } ) ) } />
              </Field>
              <Field label="Expression">
                <input className={ inputClass } style={{ borderRadius: 'var(--radius-input, 0px)' }} placeholder="Expression" value={ profileData.numerology.expression_number } onChange={ ( e ) => setProfileData( ( p ) => ( { ...p, numerology: { ...p.numerology, expression_number: e.target.value } } ) ) } />
              </Field>
              <Field label="Personality">
                <input className={ inputClass } style={{ borderRadius: 'var(--radius-input, 0px)' }} placeholder="Personality" value={ profileData.numerology.personality_number } onChange={ ( e ) => setProfileData( ( p ) => ( { ...p, numerology: { ...p.numerology, personality_number: e.target.value } } ) ) } />
              </Field>
              <Field label="Motivation">
                <input className={ inputClass } style={{ borderRadius: 'var(--radius-input, 0px)' }} placeholder="Motivation" value={ profileData.numerology.motivation_number } onChange={ ( e ) => setProfileData( ( p ) => ( { ...p, numerology: { ...p.numerology, motivation_number: e.target.value } } ) ) } />
              </Field>
              <Field label="Destiny">
                <input className={ inputClass } style={{ borderRadius: 'var(--radius-input, 0px)' }} placeholder="Destiny" value={ profileData.numerology.destiny_number } onChange={ ( e ) => setProfileData( ( p ) => ( { ...p, numerology: { ...p.numerology, destiny_number: e.target.value } } ) ) } />
              </Field>
            </div>
          </div>
        ) }

        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-6">
          <div className="flex items-center gap-4">
            <button
              onClick={ () => saveProfile( profileData ) }
              disabled={ profileSaving }
              className="px-10 py-3 bg-[var(--indigo)] hover:opacity-90 text-[var(--btn-fg)] font-bold text-[10px] uppercase tracking-[0.2em] transition-all disabled:opacity-50"
              style={{ borderRadius: 'var(--radius-button, 0px)' }}
            >
              { profileSaving ? 'Saving...' : 'Commit Changes' }
            </button>
            { profileSavedMsg && <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--indigo)] animate-pulse">{ profileSavedMsg }</span> }
          </div>

          { ( !!returnMainUrl || !!buyCreditsUrl || !!becomeMemberUrl ) && (
            <div className="flex flex-wrap items-center gap-8">
              { !!returnMainUrl && <a href={ returnMainUrl } className="text-[10px] font-bold uppercase tracking-widest text-[var(--mute)] hover:text-[var(--ink)] transition-colors">← { returnMainLabel }</a> }
              { !!buyCreditsUrl && <a href={ buyCreditsUrl } target="_blank" rel="noreferrer" className="text-[10px] font-bold uppercase tracking-widest text-[var(--gold)] hover:opacity-80 transition-opacity">Buy Credits</a> }
              { !!becomeMemberUrl && <a href={ becomeMemberUrl } target="_blank" rel="noreferrer" className="text-[10px] font-bold uppercase tracking-widest text-[var(--indigo)] hover:opacity-80 transition-opacity">Become Member</a> }
            </div>
          ) }
        </div>
      </div>
    </div>
  );
}
