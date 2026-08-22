function FileIcon({ type = 'pdf' }) {
  const isPdf =
    type.toLowerCase() === 'pdf';

  return (
    <div
      className={`file-icon ${
        isPdf
          ? 'file-icon-pdf'
          : 'file-icon-docx'
      }`}
    >
      <div className="file-icon-fold" />

      <span>
        {isPdf ? 'PDF' : 'DOC'}
      </span>
    </div>
  );
}

export default FileIcon;
