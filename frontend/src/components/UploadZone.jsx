import {
  useRef,
  useState
} from 'react';

import FileIcon from './FileIcon';

const MAX_FILE_SIZE =
  20 * 1024 * 1024;

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png'
];

function UploadZone({
  file,
  onFileChange
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] =
    useState(false);
  const [error, setError] =
    useState('');

  function validateFile(
    selectedFile
  ) {
    if (!selectedFile) return;

    if (
      !ACCEPTED_TYPES.includes(
        selectedFile.type
      )
    ) {
      setError(
        'PDF, DOCX, JPG and PNG files only.'
      );
      return;
    }

    if (
      selectedFile.size >
      MAX_FILE_SIZE
    ) {
      setError(
        'Maximum file size is 20 MB.'
      );
      return;
    }

    setError('');
    onFileChange(selectedFile);
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);

    const droppedFile =
      event.dataTransfer.files?.[0];

    validateFile(droppedFile);
  }

  function handleInput(event) {
    const selectedFile =
      event.target.files?.[0];

    validateFile(selectedFile);
  }

  function removeFile(event) {
    event.stopPropagation();

    setError('');

    onFileChange(null);

    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }

  if (file) {
    return (
      <div className="selected-file-card">
        <div className="selected-file-main">
          <FileIcon
            type={
              file.name
                .split('.')
                .pop()
            }
          />

          <div className="selected-file-info">
            <div className="selected-file-name">
              {file.name}
            </div>

            <div className="selected-file-meta">
              {(
                file.size /
                1024 /
                1024
              ).toFixed(2)}{' '}
              MB
            </div>
          </div>
        </div>

        <button
          type="button"
          className="remove-file"
          onClick={removeFile}
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        className={`upload-zone ${
          dragging
            ? 'upload-zone-dragging'
            : ''
        }`}
        onClick={() =>
          inputRef.current?.click()
        }
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() =>
          setDragging(false)
        }
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          hidden
          accept=".pdf,.docx,.jpg,.jpeg,.png"
          onChange={handleInput}
        />

        <div className="upload-icon">
          ↑
        </div>

        <div className="upload-title">
          Drop your document here
        </div>

        <div className="upload-subtitle">
          or click to browse
        </div>

        <div className="upload-formats">
          PDF · DOCX · JPG · PNG
          <span> · </span>
          MAX 20 MB
        </div>
      </div>

      {error && (
        <div className="upload-error">
          {error}
        </div>
      )}
    </div>
  );
}

export default UploadZone;
