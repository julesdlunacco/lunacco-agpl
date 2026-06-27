/**
 * featurables — composes the master cross-module list of featurable items.
 *
 * Each item: { id, moduleId, kind: 'chart'|'spread', label, shortLabel, viewKey, param, level, popular }
 *
 * Sources:
 *   window.LunaCcoNumerologyModule.CHART_TYPES  → kind='chart', viewKey='core-charts'
 *   window.LunaCcoAstroHDCharts.CHART_TYPES     → kind='chart', viewKey='core-charts'
 *   window.LunaCcoEasternCharts.CHART_TYPES     → kind='chart', viewKey='core-charts'
 *   window.LunaCcoTarotSpreads.spreads          → kind='spread', viewKey='reading'
 *
 * Admin meta overrides (from LunaCcoData.featured.meta) layer on top of built-in defaults.
 */

const MODULE_LABELS = {
  'luna-numerology': 'Numerology',
  'luna-astrohd':   'AstroHD',
  'lunacco-eastern': 'Eastern',
  'luna-tarot':     'Tarot',
};

function applyMeta( item, meta ) {
  const m = meta?.[ item.id ];
  if ( ! m ) return item;
  return {
    ...item,
    level:    m.level    !== undefined ? m.level    : item.level,
    popular:  m.popular  !== undefined ? m.popular  : item.popular,
    featured: m.featured !== undefined ? m.featured : item.featured,
  };
}

/**
 * Build the master featurables list from all registered module globals.
 *
 * @param {object|null} storedFeatured  LunaCcoData.featured (may be null = no admin override)
 * @returns {Array}
 */
export function buildFeaturables( storedFeatured = null ) {
  const meta = storedFeatured?.meta || {};
  const items = [];

  // Numerology charts
  const numCharts = window.LunaCcoNumerologyModule?.CHART_TYPES || [];
  for ( const ct of numCharts ) {
    items.push( applyMeta( {
      id:         ct.id,
      moduleId:   'luna-numerology',
      kind:       'chart',
      label:      ct.label,
      shortLabel: ct.shortLabel || ct.label,
      viewKey:    'core-charts',
      param:      ct.id,
      level:      ct.level || null,
      popular:    ct.popular || false,
      featured:   false,
    }, meta ) );
  }

  // AstroHD charts
  const ahdCharts = window.LunaCcoAstroHDCharts?.CHART_TYPES || [];
  for ( const ct of ahdCharts ) {
    items.push( applyMeta( {
      id:         ct.id,
      moduleId:   'luna-astrohd',
      kind:       'chart',
      label:      ct.label,
      shortLabel: ct.shortLabel || ct.label,
      viewKey:    'core-charts',
      param:      ct.id,
      level:      ct.level || null,
      popular:    ct.popular || false,
      featured:   false,
    }, meta ) );
  }

  // Eastern charts
  const easCharts = window.LunaCcoEasternCharts?.CHART_TYPES || [];
  for ( const ct of easCharts ) {
    items.push( applyMeta( {
      id:         ct.id,
      moduleId:   'lunacco-eastern',
      kind:       'chart',
      label:      ct.label,
      shortLabel: ct.shortLabel || ct.label,
      viewKey:    'core-charts',
      param:      ct.id,
      level:      ct.level || null,
      popular:    ct.popular || false,
      featured:   false,
    }, meta ) );
  }

  // Tarot spreads
  const tarotSpreads = window.LunaCcoTarotSpreads?.spreads || [];
  for ( const sp of tarotSpreads ) {
    items.push( applyMeta( {
      id:         `spread_${ sp.id }`,
      moduleId:   'luna-tarot',
      kind:       'spread',
      label:      sp.name,
      shortLabel: sp.name,
      viewKey:    'reading',
      param:      sp.id,
      level:      sp.level || 'beginner',
      popular:    sp.popular || false,
      featured:   false,
    }, meta ) );
  }

  // If admin has ordered items, sort by that order + apply featured flag
  if ( storedFeatured?.items?.length ) {
    const orderedIds = storedFeatured.items.map( i => i.id );
    const featuredSet = new Set( orderedIds );

    // Mark featured on ordered items
    for ( const item of items ) {
      if ( featuredSet.has( item.id ) ) {
        item.featured = true;
      }
    }

    // Sort: featured items in their configured order, then the rest
    items.sort( ( a, b ) => {
      const ai = orderedIds.indexOf( a.id );
      const bi = orderedIds.indexOf( b.id );
      if ( ai === -1 && bi === -1 ) return 0;
      if ( ai === -1 ) return 1;
      if ( bi === -1 ) return -1;
      return ai - bi;
    } );
  } else {
    // Default featured = popular items (up to 6 total, 2 per module)
    const countByModule = {};
    for ( const item of items ) {
      if ( item.popular ) {
        const c = countByModule[ item.moduleId ] || 0;
        if ( c < 2 ) {
          item.featured = true;
          countByModule[ item.moduleId ] = c + 1;
        }
      }
    }
  }

  return items;
}

/**
 * Returns only featured items, in order.
 */
export function getFeaturedItems( storedFeatured = null ) {
  return buildFeaturables( storedFeatured ).filter( i => i.featured );
}

export { MODULE_LABELS };
