/**
 * Luna AstroHD — shell component. Routes between views by active view key.
 */

import NatalView       from './views/NatalView.tsx';
import ShadowView      from './views/ShadowView.tsx';
import TransitView     from './views/TransitView.tsx';
import ConnectionView  from './views/ConnectionView.jsx';
import SnapshotView    from './views/SnapshotView.tsx';
import DefinitionsView from './views/DefinitionsView.jsx';
import AsteroidsView   from './views/AsteroidsView.tsx';
import ChartMakerView  from './views/ChartMakerView.tsx';
import SelectionPresetsView from './views/SelectionPresetsView.tsx';
import PlaceholderView from './views/PlaceholderView.jsx';

export default function AstroHDApp( { view } ) {
  switch ( view ) {
    case 'astrohd-natal':       return <NatalView />;
    case 'astrohd-shadow':      return <ShadowView />;
    case 'astrohd-transit':     return <TransitView />;
    case 'astrohd-connection':  return <ConnectionView />;
    case 'astrohd-snapshot':    return <SnapshotView />;
    case 'astrohd-asteroids':   return <AsteroidsView />;
    case 'astrohd-chart-maker': return <ChartMakerView />;
    case 'astrohd-selection-presets': return <SelectionPresetsView />;
    case 'astrohd-definitions': return <DefinitionsView />;
    case 'astrohd-settings':    return <PlaceholderView title="AstroHD Settings" subtitle="Configuration UI lives in WP admin for now." />;
    default:                    return <NatalView />;
  }
}
