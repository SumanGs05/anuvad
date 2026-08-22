const STEPS = [
  {
    id: 'parsing',
    label: 'Parsing document',
    description: 'Extracting structure and content'
  },
  {
    id: 'translating',
    label: 'Translating',
    description: 'Converting content to your language'
  },
  {
    id: 'refining',
    label: 'Refining translation',
    description: 'Improving terminology and fluency'
  },
  {
    id: 'reconstructing',
    label: 'Reconstructing document',
    description: 'Rebuilding the document'
  },
  {
    id: 'completed',
    label: 'Complete',
    description: 'Your translated document is ready'
  }
];

const STEP_ORDER = [
  'parsing',
  'translating',
  'refining',
  'reconstructing',
  'completed'
];

function ProcessingSteps({ status }) {
  const currentIndex =
    STEP_ORDER.indexOf(status);

  const isFailed =
    status === 'failed';

  return (
    <div className="processing-steps">
      {STEPS.map((step, index) => {
        const complete =
          currentIndex > index;

        const current =
          currentIndex === index;

        return (
          <div
            key={step.id}
            className={[
              'processing-step',
              complete
                ? 'processing-step-complete'
                : '',
              current
                ? 'processing-step-current'
                : ''
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div className="step-indicator">
              {complete ? (
                '✓'
              ) : current ? (
                <span className="step-spinner" />
              ) : (
                index + 1
              )}
            </div>

            <div className="step-content">
              <div className="step-label">
                {step.label}
              </div>

              <div className="step-description">
                {complete
                  ? 'Completed'
                  : current
                    ? step.description
                    : 'Waiting'}
              </div>
            </div>
          </div>
        );
      })}

      {isFailed && (
        <div className="processing-failed">
          Translation failed. Please try again.
        </div>
      )}
    </div>
  );
}

export default ProcessingSteps;
