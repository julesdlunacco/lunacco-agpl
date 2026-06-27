/**
 * EditorialCard — shared "Broadsheet" interpretation/card primitive.
 *
 * Global primitive consumed across ALL modules (astrohd, numerology, eastern,
 * tarot) so reading content gets one consistent, theme-aware treatment. It is a
 * thin wrapper over the `.icard*` classes in styles/broadsheet.css — the CSS
 * classes are the shared contract, so rendering this component or the raw classes
 * produces identical markup.
 *
 * Variants map to a slot's role in a reading:
 *   synthesis   — the woven placement reading (indigo header rule)
 *   gift        — the gift / light expression (indigo top border)
 *   shadow      — the shadow / challenge (gold top border + hatch)
 *   affirm      — affirmation (inverted: ink bg / paper text, quote marks)
 *   keynotes    — coaching key notes (use <Keynote>)
 *   questions   — reflection questions (use <Question>)
 *   default     — any other prose box
 */

const VARIANT_CLASS = {
  synthesis: 'synthesis',
  gift: 'gift',
  shadow: 'shadow',
  affirm: 'affirm',
  keynotes: 'keynotes',
  questions: 'questions',
};

export function EditorialCards( { children, columns, style, className = '' } ) {
  const gridStyle = columns ? { gridTemplateColumns: columns, ...style } : style;
  return (
    <div className={ `icards ${ className }`.trim() } style={ gridStyle }>
      { children }
    </div>
  );
}

export function EditorialCard( {
  variant = 'default',
  label,
  icon,            // optional React node rendered before the label
  term,            // optional large serif term (synthesis)
  quote,           // affirm: render the body as a pull quote
  children,
  className = '',
  style,
} ) {
  const v = VARIANT_CLASS[ variant ] || '';
  return (
    <div className={ `icard ${ v } ${ className }`.trim() } style={ style }>
      { label && (
        <div className="ih">
          { icon }
          { label }
        </div>
      ) }
      { term && <div className="iterm">{ term }</div> }
      { quote ? <div className="quote">{ children }</div> : children }
    </div>
  );
}

/** A single coaching key-note row (use inside an EditorialCard variant="keynotes"). */
export function Keynote( { children } ) {
  return (
    <div className="knote">
      <span className="kn">—</span>
      <span className="kt">{ children }</span>
    </div>
  );
}

/** A single reflection question row (use inside an EditorialCard variant="questions"). */
export function Question( { n, children } ) {
  return (
    <div className="q">
      <span className="qn">{ n }</span>
      <span className="qt">{ children }</span>
    </div>
  );
}

export default EditorialCard;
