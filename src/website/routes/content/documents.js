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

// Main document center page
router.get('/', ensureAuth, async (req, res) => {
  try {
    const isAdmin = await isUserAdmin(req.user.id);
    const userRoles = await getUserRoles(req.user.id);
    const userRoleIds = userRoles.map(role => role.id);
    const userRoleNames = userRoles.map(role => role.name);

    // Get all tabs
    const tabs = db.prepare('SELECT * FROM document_tabs ORDER BY sort_order ASC, name ASC').all();

    // Get documents for each tab, filtered by user's MOS access
    const accessibleTabs = [];
    
    for (const tab of tabs) {
      const documents = db.prepare('SELECT * FROM documents WHERE tab_id = ? ORDER BY sort_order ASC, title ASC').all(tab.id);
      
      // Filter documents based on user's MOS access
      const accessibleDocuments = documents.filter(doc => {
        if (!doc.required_mos) return true; // No MOS requirement
        
        // Admins can see all documents regardless of MOS
        if (isAdmin) return true;
        
        // Parse multiple MOS requirements (comma-separated)
        const requiredMOSList = doc.required_mos.split(',').map(mos => mos.trim());
        
        // Check if user has any of the required MOS by ID or name
        for (const requiredMOS of requiredMOSList) {
          const mosRole = getAvailableMOSRoles().find(
            mos => mos.name === requiredMOS
          );
          
          if (mosRole) {
            if (userRoleIds.includes(mosRole.id) || userRoleNames.includes(requiredMOS)) {
              return true;
            }
          } else if (userRoleNames.includes(requiredMOS)) {
            return true;
          }
        }
        
        return false;
      });
      
      if (accessibleDocuments.length > 0 || isAdmin) {
        accessibleTabs.push({
          ...tab,
          documents: accessibleDocuments
        });
      }
    }

    res.render('content/documents', {
      user: req.user,
      active: 'dashboard',
      isAdmin,
      tabs: accessibleTabs,
      availableMOS: getAvailableMOSRoleNames(),
      alert: req.query.alert,
      error: req.query.error
    });
  } catch (error) {
    console.error('Error loading document center:', error);
    res.status(500).render('error', {
      user: req.user,
      error: 'Failed to load document center',
      active: 'dashboard'
    });
  }
});

// Admin: Create new tab
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
    
    res.redirect('/documents?alert=Tab created successfully');
  } catch (error) {
    console.error('Error creating tab:', error);
    res.redirect('/documents?error=Failed to create tab');
  }
});

// Admin: Update tab
router.put('/tabs/:tabId', ensureAdmin, async (req, res) => {
  try {
    const { tabId } = req.params;
    const { name, description, sort_order } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Tab name is required' });
    }
    
    db.prepare(`
      UPDATE document_tabs 
      SET name = ?, description = ?, sort_order = ?, updated_by = ?, updated_at = DATETIME('now')
      WHERE id = ?
    `).run(name.trim(), description?.trim() || '', sort_order || 0, req.user.id, tabId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating tab:', error);
    res.status(500).json({ error: 'Failed to update tab' });
  }
});

// Admin: Delete tab
router.delete('/tabs/:tabId', ensureAdmin, async (req, res) => {
  try {
    const { tabId } = req.params;
    
    // Delete all documents in this tab first
    db.prepare('DELETE FROM documents WHERE tab_id = ?').run(tabId);
    
    // Delete the tab
    db.prepare('DELETE FROM document_tabs WHERE id = ?').run(tabId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting tab:', error);
    res.status(500).json({ error: 'Failed to delete tab' });
  }
});

// Admin: Create new document
router.post('/documents', ensureAdmin, async (req, res) => {
  try {
    const { tab_id, title, description, url, sort_order = 0 } = req.body;
    const { required_mos, no_restriction } = req.body;
    
    if (!tab_id || !title || title.trim() === '') {
      return res.redirect('/documents?error=Tab and title are required');
    }
    
    const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Handle multiple MOS selection
    let finalRequiredMOS = null;
    if (no_restriction) {
      finalRequiredMOS = null; // No restriction
    } else if (required_mos && Array.isArray(required_mos) && required_mos.length > 0) {
      finalRequiredMOS = required_mos.join(', '); // Join multiple MOS with commas
    }
    
    db.prepare(`
      INSERT INTO documents (id, tab_id, title, description, url, required_mos, sort_order, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, DATETIME('now'))
    `).run(documentId, tab_id, title.trim(), description?.trim() || '', url?.trim() || '', finalRequiredMOS, sort_order, req.user.id);
    
    res.redirect('/documents?alert=Document created successfully');
  } catch (error) {
    console.error('Error creating document:', error);
    res.redirect('/documents?error=Failed to create document');
  }
});

// Admin: Update document
router.put('/documents/:documentId', ensureAdmin, async (req, res) => {
  try {
    const { documentId } = req.params;
    const { title, description, url, sort_order, required_mos } = req.body;
    
    console.log('Update document request body:', req.body);
    
    if (!title || title.trim() === '') {
      return res.status(400).json({ error: 'Document title is required' });
    }
    
    // Handle MOS selection - required_mos is already processed by frontend
    let finalRequiredMOS = required_mos;
    if (finalRequiredMOS === 'null' || finalRequiredMOS === '') {
      finalRequiredMOS = null;
    }
    
    console.log('Final required MOS:', finalRequiredMOS);
    
    db.prepare(`
      UPDATE documents 
      SET title = ?, description = ?, url = ?, required_mos = ?, sort_order = ?, updated_by = ?, updated_at = DATETIME('now')
      WHERE id = ?
    `).run(title.trim(), description?.trim() || '', url?.trim() || '', finalRequiredMOS, sort_order || 0, req.user.id, documentId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

// Admin: Delete document
router.delete('/documents/:documentId', ensureAdmin, async (req, res) => {
  try {
    const { documentId } = req.params;
    
    db.prepare('DELETE FROM documents WHERE id = ?').run(documentId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

export default router; 