import { Router } from 'express';
import ensureAdmin from '../../middleware/ensureAdmin.js';
import { getDatabase, setupDatabase } from '../../../bot/utils/database.js';

const router = Router();

// Ensure database is set up
setupDatabase();
const db = getDatabase();

// Database Table Editor Dashboard
router.get('/', ensureAdmin, async (req, res) => {
  try {
    // Get all tables
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all();

    res.render('admin/database-editor', {
      user: req.user,
      tables,
      active: 'database',
      isAdmin: true,
      alert: req.query.alert,
      error: req.query.error
    });
  } catch (error) {
    console.error('Error loading database editor:', error);
    res.redirect('/database-editor?error=Failed to load database tables');
  }
});

// View Table Data
router.get('/table/:tableName', ensureAdmin, async (req, res) => {
  try {
    const { tableName } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    // Get table schema
    const schema = db.prepare(`PRAGMA table_info(${tableName})`).all();
    
    // Get total count
    const countResult = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get();
    const totalCount = countResult.count;
    const totalPages = Math.ceil(totalCount / limit);

    // Get table data
    const data = db.prepare(`SELECT * FROM ${tableName} LIMIT ? OFFSET ?`).all(limit, offset);

    res.render('admin/database-table-view', {
      user: req.user,
      tableName,
      schema,
      data,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        limit: parseInt(limit)
      },
      active: 'database',
      isAdmin: true,
      alert: req.query.alert,
      error: req.query.error
    });
  } catch (error) {
    console.error('Error loading table data:', error);
    res.redirect('/database-editor?error=Failed to load table data');
  }
});

// Add Row Form
router.get('/table/:tableName/add', ensureAdmin, async (req, res) => {
  try {
    const { tableName } = req.params;
    
    // Get table schema
    const schema = db.prepare(`PRAGMA table_info(${tableName})`).all();
    
    res.render('admin/database-row-form', {
      user: req.user,
      tableName,
      schema,
      row: null,
      active: 'database',
      isAdmin: true
    });
  } catch (error) {
    console.error('Error loading add row form:', error);
    res.redirect(`/database-editor/table/${req.params.tableName}?error=Failed to load form`);
  }
});

// Edit Row Form
router.get('/table/:tableName/edit/:id', ensureAdmin, async (req, res) => {
  try {
    const { tableName, id } = req.params;
    
    // Get table schema
    const schema = db.prepare(`PRAGMA table_info(${tableName})`).all();
    
    // Get primary key column
    const primaryKey = schema.find(col => col.pk > 0);
    if (!primaryKey) {
      return res.redirect(`/database-editor/table/${tableName}?error=Table has no primary key`);
    }
    
    // Get row data
    const row = db.prepare(`SELECT * FROM ${tableName} WHERE ${primaryKey.name} = ?`).get(id);
    if (!row) {
      return res.redirect(`/database-editor/table/${tableName}?error=Row not found`);
    }
    
    res.render('admin/database-row-form', {
      user: req.user,
      tableName,
      schema,
      row,
      primaryKey: primaryKey.name,
      active: 'database',
      isAdmin: true
    });
  } catch (error) {
    console.error('Error loading edit row form:', error);
    res.redirect(`/database-editor/table/${req.params.tableName}?error=Failed to load form`);
  }
});

// Save Row
router.post('/table/:tableName/save', ensureAdmin, async (req, res) => {
  try {
    const { tableName } = req.params;
    const { id, ...formData } = req.body;
    
    // Get table schema
    const schema = db.prepare(`PRAGMA table_info(${tableName})`).all();
    const primaryKey = schema.find(col => col.pk > 0);
    
    if (id && primaryKey) {
      // Update existing row
      const setClause = schema
        .filter(col => col.name !== primaryKey.name)
        .map(col => `${col.name} = ?`)
        .join(', ');
      
      const values = schema
        .filter(col => col.name !== primaryKey.name)
        .map(col => {
          const value = formData[col.name];
          if (col.type === 'INTEGER' && value !== '') {
            return parseInt(value) || 0;
          } else if (col.type === 'REAL' && value !== '') {
            return parseFloat(value) || 0;
          } else if (col.type === 'BOOLEAN') {
            return value === 'true' || value === '1' ? 1 : 0;
          }
          return value || null;
        });
      
      values.push(id); // Add primary key value for WHERE clause
      
      db.prepare(`UPDATE ${tableName} SET ${setClause} WHERE ${primaryKey.name} = ?`).run(...values);
    } else {
      // Insert new row
      const columns = schema.map(col => col.name).join(', ');
      const placeholders = schema.map(() => '?').join(', ');
      
      const values = schema.map(col => {
        const value = formData[col.name];
        if (col.type === 'INTEGER' && value !== '') {
          return parseInt(value) || 0;
        } else if (col.type === 'REAL' && value !== '') {
          return parseFloat(value) || 0;
        } else if (col.type === 'BOOLEAN') {
          return value === 'true' || value === '1' ? 1 : 0;
        }
        return value || null;
      });
      
      db.prepare(`INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`).run(...values);
    }
    
    res.redirect(`/database-editor/table/${tableName}?alert=Row saved successfully`);
  } catch (error) {
    console.error('Error saving row:', error);
    res.redirect(`/database-editor/table/${req.params.tableName}?error=Failed to save row`);
  }
});

// Delete Row
router.post('/table/:tableName/delete/:id', ensureAdmin, async (req, res) => {
  try {
    const { tableName, id } = req.params;
    
    // Get table schema to find primary key
    const schema = db.prepare(`PRAGMA table_info(${tableName})`).all();
    const primaryKey = schema.find(col => col.pk > 0);
    
    if (!primaryKey) {
      return res.redirect(`/database-editor/table/${tableName}?error=Table has no primary key`);
    }
    
    db.prepare(`DELETE FROM ${tableName} WHERE ${primaryKey.name} = ?`).run(id);
    
    res.redirect(`/database-editor/table/${tableName}?alert=Row deleted successfully`);
  } catch (error) {
    console.error('Error deleting row:', error);
    res.redirect(`/database-editor/table/${req.params.tableName}?error=Failed to delete row`);
  }
});

// Execute Custom Query
router.post('/query', ensureAdmin, async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query || !query.trim()) {
      return res.redirect('/database-editor?error=Query cannot be empty');
    }
    
    // Basic security check - only allow SELECT queries
    const trimmedQuery = query.trim().toLowerCase();
    if (!trimmedQuery.startsWith('select ')) {
      return res.redirect('/database-editor?error=Only SELECT queries are allowed for security');
    }
    
    const result = db.prepare(query).all();
    
    res.render('admin/database-query-result', {
      user: req.user,
      query,
      result,
      active: 'database',
      isAdmin: true
    });
  } catch (error) {
    console.error('Error executing query:', error);
    res.redirect('/database-editor?error=Failed to execute query: ' + error.message);
  }
});

// Get Table Schema API
router.get('/api/schema/:tableName', ensureAdmin, async (req, res) => {
  try {
    const { tableName } = req.params;
    const schema = db.prepare(`PRAGMA table_info(${tableName})`).all();
    res.json(schema);
  } catch (error) {
    console.error('Error getting table schema:', error);
    res.status(500).json({ error: 'Failed to get table schema' });
  }
});

// Get Table Data API
router.get('/api/data/:tableName', ensureAdmin, async (req, res) => {
  try {
    const { tableName } = req.params;
    const { limit = 100, offset = 0 } = req.query;
    
    const data = db.prepare(`SELECT * FROM ${tableName} LIMIT ? OFFSET ?`).all(limit, offset);
    const count = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get().count;
    
    res.json({
      data,
      count,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error getting table data:', error);
    res.status(500).json({ error: 'Failed to get table data' });
  }
});

export default router; 