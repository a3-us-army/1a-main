import { Router } from 'express';
import { parse } from 'csv-parse/sync';
import fetch from 'node-fetch';

const router = Router();

router.get('/', async (req, res) => {
  let isAdmin = false;
  if (req.user) {
    isAdmin = await import('../utils/discord.js').then(m =>
      m.isUserAdmin(req.user.id)
    );
  }
  res.render('personnel', {
    user: req.user,
    active: 'dashboard',
    isAdmin,
  });
});

router.get('/api/personnel', async (req, res) => {
  try {
    const sheetUrl =
      'https://docs.google.com/spreadsheets/d/11b5ZnMwxw3qj66q3-PMy0YHFOn5Th_I-NnsJH5cRrF4/export?format=csv&gid=9697998';
    const response = await fetch(sheetUrl);
    const csv = await response.text();

    const rows = parse(csv, { skip_empty_lines: false, trim: true });

    // Find the header row
    const headerRowIdx = rows.findIndex(
      row =>
        row[0]?.toLowerCase().includes('position') &&
        row[1]?.toLowerCase().includes('callsign') &&
        row[2]?.toLowerCase().includes('status') &&
        row[3]?.toLowerCase().includes('name')
    );

    if (headerRowIdx === -1) {
      return res
        .status(500)
        .json({ error: 'Could not find header row in personnel sheet' });
    }

    const headers = rows[headerRowIdx].map(h => h.trim());
    const personnel = [];

    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.every(cell => !cell || cell.trim() === '')) continue;
      const person = {};
      for (let j = 0; j < headers.length; j++) {
        person[headers[j].toLowerCase()] = row[j] ? row[j].trim() : '';
      }
      personnel.push(person);
    }

    res.json(personnel);
  } catch (e) {
    console.error('Failed to fetch personnel from Google Sheets:', e);
    res.status(500).json({ error: 'Failed to fetch personnel data' });
  }
});

router.get('/api/aviation', async (req, res) => {
  try {
    const aviationSheetUrl =
      'https://docs.google.com/spreadsheets/d/11b5ZnMwxw3qj66q3-PMy0YHFOn5Th_I-NnsJH5cRrF4/export?format=csv&gid=81369472';
    const response = await fetch(aviationSheetUrl);
    const csv = await response.text();

    const rows = parse(csv, { skip_empty_lines: false, trim: true });

    // Find the header row (must include at least "position" and "name")
    const headerRowIdx = rows.findIndex(
      row =>
        row[0]?.toLowerCase().includes('position') &&
        row.some(cell => cell?.toLowerCase().includes('name'))
    );

    if (headerRowIdx === -1) {
      return res
        .status(500)
        .json({ error: 'Could not find header row in aviation sheet' });
    }

    const headers = rows[headerRowIdx].map(h => h.trim().toLowerCase());
    const personnel = [];

    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.every(cell => !cell || cell.trim() === '')) continue;
      const person = {};
      for (let j = 0; j < headers.length; j++) {
        person[headers[j]] = row[j] ? row[j].trim() : '';
      }
      personnel.push(person);
    }

    res.json(personnel);
  } catch (e) {
    console.error('Failed to fetch aviation personnel from Google Sheets:', e);
    res.status(500).json({ error: 'Failed to fetch aviation personnel data' });
  }
});

export default router;
