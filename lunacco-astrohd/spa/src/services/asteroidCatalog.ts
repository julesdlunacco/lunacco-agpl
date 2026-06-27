/**
 * asteroidCatalog.ts
 *
 * Display catalog of asteroid names available in the ephemeris, used by the
 * Chart Maker's asteroid selector. Mirrors the BASE + CSV asteroid lists in
 * EphemerisService (kept as a flat name list for UI selection only).
 */

export const BASE_ASTEROIDS = ['Ceres', 'Pallas', 'Juno', 'Vesta', 'Pholus'];

export const NUMBERED_ASTEROIDS = [
  'Iris', 'Hygiea', 'Psyche', 'Melpomene', 'Fortuna', 'Themis', 'Urania', 'Pomona',
  'Circe', 'Fides', 'Daphne', 'Isis', 'Echo', 'Niobe', 'Feronia', 'Freia', 'Klio',
  'Aurora', 'Hekate', 'Artemis', 'Felicitas', 'Kassandra', 'Lachesis', 'Liberatrix',
  'Nemesis', 'Elektra', 'Abundantia', 'Bertha', 'Sibylla', 'Eucharis', 'Medea',
  'Sophia', 'Tyche', 'Magdalena', 'Gabriella', 'Bona', 'Hades', 'Fama', 'Hybris',
  'Pythia', 'Eros', 'Photographica', 'Damocles', 'Achilles', 'Charis', 'Moira', 'Pax',
  'Raphaela', 'Sphinx', 'Sirene', 'Aesculapia', 'Copia', 'Demeter', 'Pecunia',
  'Atlantis', 'Hypnos', 'Aura', 'Apollo', 'Sisyphus', 'Anubis', 'Horus', 'Lucifer',
  'Midas', 'Bacchus', 'Tantalus', 'Ganesa', 'Merlin', 'Magion', 'Parvati', 'Panacea',
  'Makhaon', 'Bounty', 'Glo', 'Wisdom', 'Kafka', 'Opportunity', 'Angst', 'Kaali',
  'Spacewatch', 'Child', 'Sybil', 'Gold', 'Reiki', 'Telephus', 'Silver', 'Akashi',
  'Destinn', 'Mony', 'Chariklo', 'Angel', 'Fast', 'Talent', 'Spirit', 'Hawaii/Lemuria',
  'DNA', 'Logos/Persuasia', 'Hermes', 'Sedna', 'Bless', 'Maia', 'Eris', 'Makemake', 'Jobse',
];

/** Full, de-duplicated asteroid name catalog (base first). */
export const ASTEROID_CATALOG: string[] = Array.from(
  new Set([...BASE_ASTEROIDS, ...NUMBERED_ASTEROIDS])
);
