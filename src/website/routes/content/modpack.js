import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getDatabase } from '../../../bot/utils/database.js';
import ensureAdmin from '../../middleware/ensureAdmin.js';
import fetch from 'node-fetch'; // or use global fetch in Node 18+

const router = Router();
const upload = multer({ dest: 'uploads/' });

const R2_BUCKET = process.env.R2_BUCKET;
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// List modpacks
router.get('/', async (req, res) => {
  const db = getDatabase();
  const modpacks = db
    .prepare('SELECT * FROM modpacks ORDER BY uploaded_at DESC')
    .all();
  let isAdmin = false;
  if (req.user) {
    isAdmin = await import('../../utils/discord.js').then(m =>
      m.isUserAdmin(req.user.id)
    );
  }
  res.render('content/modpacks', {
    user: req.user,
    active: 'dashboard',
    modpacks,
    isAdmin,
    alert: req.query.alert,
    error: req.query.error,
  });
});

router.get('/download/:id', async (req, res) => {
  const db = getDatabase();
  const mod = db
    .prepare('SELECT * FROM modpacks WHERE id = ?')
    .get(req.params.id);
  if (!mod) return res.status(404).send('Not found');

  try {
    const response = await fetch(mod.url);
    if (!response.ok) return res.status(404).send('Not found');

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${mod.filename}"`
    );
    res.setHeader('Content-Type', 'application/octet-stream');
    response.body.pipe(res);
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).send('Failed to download file.');
  }
});

// Admin: Upload new modpack
router.post(
  '/upload',
  ensureAdmin,
  upload.single('modfile'),
  async (req, res) => {
    try {
      const file = req.file;
      const description = req.body.description || '';
      const r2Key = `modpacks/${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`;

      // Upload to R2
      await r2.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: r2Key,
          Body: fs.createReadStream(file.path),
          ContentType: file.mimetype,
        })
      );

      // The public URL (adjust if you use a custom domain)
      const cdnUrl = `${R2_PUBLIC_URL}/${r2Key.replace(/^modpacks\//, '')}`;

      // Save to DB
      const db = getDatabase();
      db.prepare(
        `
        INSERT INTO modpacks (filename, url, uploaded_at, description)
        VALUES (?, ?, ?, ?)
      `
      ).run(file.originalname, cdnUrl, new Date().toISOString(), description);

      // Delete the temp file
      fs.unlinkSync(file.path);

      res.redirect('/modpacks?alert=Modpack uploaded!');
    } catch (err) {
      console.error(err);
      res.redirect('/modpacks?error=Failed to upload modpack.');
    }
  }
);

// Admin: Rename modpack
router.post('/rename/:id', ensureAdmin, async (req, res) => {
  const { newName } = req.body;
  const db = getDatabase();
  db.prepare('UPDATE modpacks SET filename = ? WHERE id = ?').run(
    newName,
    req.params.id
  );
  res.redirect('/modpacks?alert=Modpack renamed.');
});

// Admin: Delete modpack
router.post('/delete/:id', ensureAdmin, async (req, res) => {
  const db = getDatabase();
  db.prepare('DELETE FROM modpacks WHERE id = ?').run(req.params.id);
  res.redirect('/modpacks?alert=Modpack deleted.');
});

export default router;
