import { Router } from 'express';
import ensureAuth from '../../middleware/ensureAuth.js';
import ensureAdmin from '../../middleware/ensureAdmin.js';
import { getDatabase } from '../../../bot/utils/database.js';
import { 
  isUserAdmin, 
  getUserRoles, 
  getAvailableMOSRoles,
  getAvailableMOSRoleNames 
} from '../../utils/discord.js';

const router = Router();
const db = getDatabase();

// Get all document tabs and documents
router.get('/', ensureAuth, async (req, res) => {
  try {
    const isAdmin = await isUserAdmin(req.user.id);
    const userRoles = await getUserRoles(req.user.id);
    const availableMOS = await getAvailableMOSRoleNames();

    // Get all tabs
    const tabs = db.prepare('SELECT * FROM document_tabs ORDER BY sort_order, created_at').all();
    
    // Get documents for each tab
    for (const tab of tabs) {
      let documentsQuery = `
        SELECT * FROM documents 
        WHERE tab_id = ? 
        ORDER BY sort_order, created_at
      `;
      
      const allDocuments = db.prepare(documentsQuery).all(tab.id);
      
      // Filter documents based on user's MOS if not admin
      if (isAdmin) {
        tab.documents = allDocuments;
      } else {
        tab.documents = allDocuments.filter(doc => {
          if (!doc.required_mos) return true;
          
          const requiredMOSList = doc.required_mos.split(', ').map(mos => mos.trim());
          return requiredMOSList.some(requiredMOS => userRoles.includes(requiredMOS));
        });
      }
    }

    res.render('content/documents', { 
      tabs, 
      isAdmin, 
      availableMOS,
      user: req.user,
      active: 'dashboard',
      alert: req.query.alert,
      error: req.query.error 
    });
  } catch (error) {
    console.error('Error loading documents:', error);
    res.status(500).render('error', { message: 'Failed to load documents' });
  }
});

// Create a new document (external link only)
router.post('/', ensureAdmin, async (req, res) => {
  try {
    const { tab_id, title, description, url, sort_order = 0 } = req.body;
    const { required_mos, no_restriction } = req.body;
    
    if (!tab_id || !title || title.trim() === '') {
      return res.redirect('/documents?error=Tab and title are required');
    }
    
    if (!url || url.trim() === '') {
      return res.redirect('/documents?error=Document URL is required');
    }
    
    const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Handle multiple MOS selection
    let finalRequiredMOS = null;
    if (!no_restriction && required_mos && Array.isArray(required_mos) && required_mos.length > 0) {
      finalRequiredMOS = required_mos.join(', ');
    }
    
    db.prepare(`
      INSERT INTO documents (id, tab_id, title, description, url, required_mos, sort_order, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, DATETIME('now'))
    `).run(
      documentId, 
      tab_id, 
      title.trim(), 
      description?.trim() || '', 
      url.trim(),
      finalRequiredMOS, 
      sort_order, 
      req.user.id
    );
    
    res.redirect('/documents?alert=Document created successfully');
  } catch (error) {
    console.error('Error creating document:', error);
    res.redirect('/documents?error=Failed to create document');
  }
});

// Update a document
router.put('/:documentId', ensureAdmin, async (req, res) => {
  try {
    const { documentId } = req.params;
    const { title, description, url, sort_order } = req.body;
    const { required_mos, no_restriction } = req.body;
    
    if (!title || title.trim() === '') {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    if (!url || url.trim() === '') {
      return res.status(400).json({ error: 'Document URL is required' });
    }
    
    // Handle multiple MOS selection
    let finalRequiredMOS = null;
    if (!no_restriction && required_mos && Array.isArray(required_mos) && required_mos.length > 0) {
      finalRequiredMOS = required_mos.join(', ');
    }
    
    const result = db.prepare(`
      UPDATE documents 
      SET title = ?, description = ?, url = ?, required_mos = ?, sort_order = ?, updated_by = ?, updated_at = DATETIME('now')
      WHERE id = ?
    `).run(
      title.trim(), 
      description?.trim() || '', 
      url.trim(),
      finalRequiredMOS, 
      sort_order || 0, 
      req.user.id, 
      documentId
    );
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    res.json({ success: true, message: 'Document updated successfully' });
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

// Delete a document
router.delete('/:documentId', ensureAdmin, async (req, res) => {
  try {
    const { documentId } = req.params;
    
    const result = db.prepare('DELETE FROM documents WHERE id = ?').run(documentId);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    res.json({ success: true, message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// Create a new document tab
router.post('/tabs', ensureAdmin, async (req, res) => {
  try {
    const { name, description, sort_order = 0 } = req.body;
    
    if (!name || name.trim() === '') {
      return res.redirect('/documents?error=Tab name is required');
    }
    
    const tabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    db.prepare(`
      INSERT INTO document_tabs (id, name, description, sort_order, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, DATETIME('now'))
    `).run(tabId, name.trim(), description?.trim() || '', sort_order, req.user.id);
    
    res.redirect('/documents?alert=Document tab created successfully');
  } catch (error) {
    console.error('Error creating document tab:', error);
    res.redirect('/documents?error=Failed to create document tab');
  }
});

// Update a document tab
router.put('/tabs/:tabId', ensureAdmin, async (req, res) => {
  try {
    const { tabId } = req.params;
    const { name, description, sort_order } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Tab name is required' });
    }
    
    const result = db.prepare(`
      UPDATE document_tabs 
      SET name = ?, description = ?, sort_order = ?, updated_by = ?, updated_at = DATETIME('now')
      WHERE id = ?
    `).run(name.trim(), description?.trim() || '', sort_order || 0, req.user.id, tabId);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Document tab not found' });
    }
    
    res.json({ success: true, message: 'Document tab updated successfully' });
  } catch (error) {
    console.error('Error updating document tab:', error);
    res.status(500).json({ error: 'Failed to update document tab' });
  }
});

// Delete a document tab
router.delete('/tabs/:tabId', ensureAdmin, async (req, res) => {
  try {
    const { tabId } = req.params;
    
    // First delete all documents in this tab
    db.prepare('DELETE FROM documents WHERE tab_id = ?').run(tabId);
    
    // Then delete the tab
    const result = db.prepare('DELETE FROM document_tabs WHERE id = ?').run(tabId);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Document tab not found' });
    }
    
    res.json({ success: true, message: 'Document tab and all its documents deleted successfully' });
  } catch (error) {
    console.error('Error deleting document tab:', error);
    res.status(500).json({ error: 'Failed to delete document tab' });
  }
});

export default router;