export const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Map common mime types or extensions to icons
export const getFileIcon = (filename: string, isDirectory: boolean) => {
  if (isDirectory) return 'folder';
  
  const ext = filename.split('.').pop()?.toLowerCase();
  
  if (['mp4', 'mkv', 'avi', 'mov'].includes(ext || '')) return 'videocam';
  if (['mp3', 'wav', 'aac', 'flac'].includes(ext || '')) return 'musical-notes';
  if (['jpg', 'jpeg', 'png', 'gif'].includes(ext || '')) return 'image';
  
  return 'document';
};

export const getParentDirectory = (uri: string) => {
    // Basic string manipulation for file URIs
    // Ensure no trailing slash for consistent logic
    const cleanUri = uri.endsWith('/') ? uri.slice(0, -1) : uri;
    const lastSlashIndex = cleanUri.lastIndexOf('/');
    if (lastSlashIndex === -1) return uri;
    return cleanUri.substring(0, lastSlashIndex);
};
