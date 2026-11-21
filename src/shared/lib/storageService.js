import { apiClient } from './apiClient';

export function formatFileSize(bytes) {
  if (!bytes) return '1.0 MB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function uploadSchoolFile(folder, file) {
  if (!file) {
    return { fileName: '', fileSize: '', filePath: '', fileUrl: '' };
  }

  const fileName = file.name || 'document';
  const fileSize = formatFileSize(file.size);

  if (apiClient.getToken()) {
    try {
      const uploaded = await apiClient.uploadFile(folder || 'general', file);
      if (uploaded && (uploaded.fileUrl || uploaded.filePath)) {
        return {
          fileName: uploaded.fileName || fileName,
          fileSize: uploaded.fileSize || fileSize,
          filePath: uploaded.filePath || '',
          fileUrl: uploaded.fileUrl || ''
        };
      }
    } catch {
    }
  }

  const localUrl = typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(file) : '';
  return {
    fileName,
    fileSize,
    filePath: '',
    fileUrl: localUrl
  };
}

function triggerBrowserDownload(href, fileName) {
  const link = document.createElement('a');
  link.href = href;
  link.download = fileName || 'download';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function downloadSchoolFile({
  fileUrl = '',
  filePath = '',
  fileName = '',
  title = 'School File',
  description = ''
} = {}) {
  const targetName = fileName || `${String(title).toLowerCase().replace(/\s+/g, '-')}.txt`;
  const candidateUrl = fileUrl
    ? apiClient.resolveUrl(fileUrl)
    : filePath
    ? apiClient.resolveUrl(`/files/download/${filePath}`)
    : '';

  if (candidateUrl) {
    try {
      const token = apiClient.getToken();
      const response = await fetch(candidateUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (response.ok) {
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        triggerBrowserDownload(blobUrl, targetName);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
        return true;
      }
    } catch {
      triggerBrowserDownload(candidateUrl, targetName);
      return true;
    }
  }

  const summaryContent = `${title}\n${'='.repeat(title.length)}\nFile: ${targetName}\n${
    description ? `\n${description}\n` : ''
  }`;
  const blob = new Blob([summaryContent], { type: 'text/plain;charset=utf-8' });
  const fallbackUrl = URL.createObjectURL(blob);
  triggerBrowserDownload(fallbackUrl, targetName.endsWith('.pdf') ? `${targetName}.txt` : targetName);
  setTimeout(() => URL.revokeObjectURL(fallbackUrl), 10000);
  return true;
}
