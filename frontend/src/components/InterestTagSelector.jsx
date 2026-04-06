import { INTEREST_SCHEMA } from '../schema/interestSchema'

export default function InterestTagSelector({ selected, onToggle }) {
  return (
    <div className="tag-selector">
      {Object.entries(INTEREST_SCHEMA).map(([category, { label, tags }]) => (
        <div key={category} className="tag-group">
          <p className="tag-group-label">{label}</p>
          <div className="tag-row">
            {Object.entries(tags).map(([key, display]) => {
              const on = selected[category]?.includes(key)
              return (
                <button
                  key={key}
                  type="button"
                  className={on ? 'tag tag-on' : 'tag'}
                  onClick={() => onToggle(category, key)}
                >
                  {display}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
