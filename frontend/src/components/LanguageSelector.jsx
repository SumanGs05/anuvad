const LANGUAGES = [
  {
    code: 'hi',
    name: 'Hindi',
    native: 'हिन्दी'
  },
  {
    code: 'bn',
    name: 'Bengali',
    native: 'বাংলা'
  },
  {
    code: 'mr',
    name: 'Marathi',
    native: 'मराठी'
  },
  {
    code: 'gu',
    name: 'Gujarati',
    native: 'ગુજરાતી'
  },
  {
    code: 'ta',
    name: 'Tamil',
    native: 'தமிழ்'
  },
  {
    code: 'te',
    name: 'Telugu',
    native: 'తెలుగు'
  },
  {
    code: 'en',
    name: 'English',
    native: 'English'
  }
];

function LanguageSelector({
  value,
  onChange
}) {
  const selected =
    LANGUAGES.find(
      (language) =>
        language.code === value
    );

  return (
    <div className="language-selector">
      <div className="language-label">
        TRANSLATE TO
      </div>

      <button
        type="button"
        className="language-trigger"
      >
        <div className="language-info">
          <span className="language-native">
            {selected?.native}
          </span>

          <span className="language-name">
            {selected?.name}
          </span>
        </div>

        <span className="language-arrow">
          ↓
        </span>
      </button>

      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="language-native-select"
        aria-label="Target language"
      >
        {LANGUAGES.map(
          (language) => (
            <option
              key={language.code}
              value={language.code}
            >
              {language.native} —{' '}
              {language.name}
            </option>
          )
        )}
      </select>
    </div>
  );
}

export default LanguageSelector;
