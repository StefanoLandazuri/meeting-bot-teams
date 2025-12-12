import multer from 'multer';

const storage = multer.memoryStorage();

export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    // Acepta archivos de texto y VTT
    const allowedMimes = ['text/plain', 'text/vtt', 'application/octet-stream'];
    const allowedExtensions = ['.txt', '.vtt'];
    
    const hasValidMime = allowedMimes.includes(file.mimetype);
    const hasValidExtension = allowedExtensions.some(ext => 
      file.originalname.toLowerCase().endsWith(ext)
    );
    
    if (hasValidMime || hasValidExtension) {
      cb(null, true);
    } else {
      cb(new Error('Only .txt and .vtt files are allowed'));
    }
  }
});