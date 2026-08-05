import multer from 'multer';

// Buffer in memory; routes decide the final relative path and call storage.save().
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});
