import express from 'express';
import { ensureAuth, ensureAdmin } from '../../middleware/auth.js';
import { getDatabase } from '../../../bot/utils/database.js';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import sharp from 'sharp';

const router = express.Router();
const db = getDatabase();

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/gallery';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Function to crop image based on crop data
async function cropImage(imagePath, cropData) {
  try {
    if (!cropData) {
      console.log('No crop data provided, skipping crop');
      return imagePath;
    }
    
    console.log('Cropping image:', imagePath);
    console.log('Crop data:', cropData);
    
    const crop = JSON.parse(cropData);
    console.log('Parsed crop coordinates:', crop);
    
    const outputPath = imagePath.replace(path.extname(imagePath), '_cropped.jpg');
    console.log('Output path:', outputPath);
    
    await sharp(imagePath)
      .extract({
        left: Math.round(crop.x),
        top: Math.round(crop.y),
        width: Math.round(crop.width),
        height: Math.round(crop.height)
      })
      .jpeg({ quality: 90 })
      .toFile(outputPath);
    
    console.log('Crop completed successfully');
    
    // Replace original with cropped version
    fs.unlinkSync(imagePath);
    fs.renameSync(outputPath, imagePath);
    
    console.log('Original replaced with cropped version');
    return imagePath;
  } catch (error) {
    console.error('Error cropping image:', error);
    return imagePath; // Return original if cropping fails
  }
}

// Main admin page
router.get('/', ensureAuth, ensureAdmin, (req, res) => {
  const images = db.prepare('SELECT * FROM gallery_images ORDER BY display_order ASC').all();
  
  res.render('admin/gallery-admin', {
    user: req.user,
    images,
    active: 'gallery-admin',
    alert: req.query.alert,
    error: req.query.error
  });
});

// Upload image
router.post('/upload', ensureAuth, ensureAdmin, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.redirect('/gallery-admin?error=No image file provided');
    }

    const { description, cropData } = req.body;
    console.log('Upload request received:', { description, cropData });
    
    const imageId = uuidv4();
    const maxOrder = db.prepare('SELECT MAX(display_order) as max_order FROM gallery_images').get();
    const newOrder = (maxOrder.max_order || 0) + 1;

    // Crop the image if crop data is provided
    const imagePath = path.join('uploads/gallery', req.file.filename);
    if (cropData) {
      console.log('Cropping image with data:', cropData);
      await cropImage(imagePath, cropData);
    }

    db.prepare(`
      INSERT INTO gallery_images (id, filename, original_name, description, uploaded_by, uploaded_at, display_order, file_size)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      imageId,
      req.file.filename,
      req.file.originalname,
      description || '',
      req.user.id,
      new Date().toISOString(),
      newOrder,
      req.file.size
    );

    res.redirect('/gallery-admin?alert=Image uploaded successfully!');
  } catch (error) {
    console.error('Error uploading image:', error);
    res.redirect('/gallery-admin?error=Failed to upload image');
  }
});

// Update image details
router.post('/update/:id', ensureAuth, ensureAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { description, display_order, cropData } = req.body;

    // Get current image info
    const image = db.prepare('SELECT filename FROM gallery_images WHERE id = ?').get(id);
    
    if (image && cropData) {
      // Crop the existing image
      const imagePath = path.join('uploads/gallery', image.filename);
      await cropImage(imagePath, cropData);
    }

    db.prepare(`
      UPDATE gallery_images 
      SET description = ?, display_order = ?
      WHERE id = ?
    `).run(description || '', display_order || 0, id);

    res.redirect('/gallery-admin?alert=Image updated successfully!');
  } catch (error) {
    console.error('Error updating image:', error);
    res.redirect('/gallery-admin?error=Failed to update image');
  }
});

// Delete image
router.post('/delete/:id', ensureAuth, ensureAdmin, (req, res) => {
  try {
    const { id } = req.params;
    
    // Get image info before deleting
    const image = db.prepare('SELECT filename FROM gallery_images WHERE id = ?').get(id);
    
    if (image) {
      // Delete file from filesystem
      const filePath = path.join('uploads/gallery', image.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      // Delete from database
      db.prepare('DELETE FROM gallery_images WHERE id = ?').run(id);
    }

    res.redirect('/gallery-admin?alert=Image deleted successfully!');
  } catch (error) {
    console.error('Error deleting image:', error);
    res.redirect('/gallery-admin?error=Failed to delete image');
  }
});

// Bulk delete
router.post('/bulk-delete', ensureAuth, ensureAdmin, (req, res) => {
  try {
    const { imageIds } = req.body;
    
    if (!imageIds || !Array.isArray(imageIds)) {
      return res.redirect('/gallery-admin?error=No images selected');
    }

    for (const id of imageIds) {
      const image = db.prepare('SELECT filename FROM gallery_images WHERE id = ?').get(id);
      if (image) {
        const filePath = path.join('uploads/gallery', image.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        db.prepare('DELETE FROM gallery_images WHERE id = ?').run(id);
      }
    }

    res.redirect('/gallery-admin?alert=Selected images deleted successfully!');
  } catch (error) {
    console.error('Error bulk deleting images:', error);
    res.redirect('/gallery-admin?error=Failed to delete images');
  }
});

// Reorder images
router.post('/reorder', ensureAuth, ensureAdmin, (req, res) => {
  try {
    const { orderData } = req.body;
    
    if (!orderData || !Array.isArray(orderData)) {
      return res.redirect('/gallery-admin?error=Invalid order data');
    }

    for (const item of orderData) {
      db.prepare('UPDATE gallery_images SET display_order = ? WHERE id = ?').run(item.order, item.id);
    }

    res.redirect('/gallery-admin?alert=Image order updated successfully!');
  } catch (error) {
    console.error('Error reordering images:', error);
    res.redirect('/gallery-admin?error=Failed to update image order');
  }
});

// Export gallery data
router.get('/export', ensureAuth, ensureAdmin, (req, res) => {
  try {
    const images = db.prepare('SELECT * FROM gallery_images ORDER BY display_order ASC').all();
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="gallery-export.json"');
    res.json(images);
  } catch (error) {
    console.error('Error exporting gallery:', error);
    res.redirect('/gallery-admin?error=Failed to export gallery data');
  }
});

export default router; 