import { Router } from 'express';
import ensureAdmin from '../../middleware/ensureAdmin.js';
import { 
  addFinanceItem, 
  getFinanceItems, 
  getFinanceItem, 
  updateFinanceItem, 
  deleteFinanceItem, 
  getMonthlyTotal 
} from '../../../bot/utils/database.js';

const router = Router();

// Main finance page
router.get('/', ensureAdmin, async (req, res) => {
  try {
    const userId = req.user.id;
    const items = getFinanceItems(userId);
    const monthlyTotal = getMonthlyTotal(userId);

    res.render('admin/finance', {
      user: req.user,
      active: 'finance',
      items,
      monthlyTotal,
      alert: req.query.alert,
      error: req.query.error
    });
  } catch (error) {
    console.error('Error loading finance page:', error);
    res.status(500).render('error', {
      user: req.user,
      active: 'error',
      error: 'Failed to load finance data.',
    });
  }
});

// Add new finance item
router.post('/add', ensureAdmin, async (req, res) => {
  try {
    const { name, description, price, card_last_four } = req.body;
    
    if (!name || !price) {
      return res.redirect('/finance?error=Name and price are required');
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      return res.redirect('/finance?error=Invalid price');
    }

    addFinanceItem(req.user.id, {
      name: name.trim(),
      description: description?.trim() || '',
      price: priceNum,
      card_last_four: card_last_four?.trim() || ''
    });

    res.redirect('/finance?alert=Item added successfully');
  } catch (error) {
    console.error('Error adding finance item:', error);
    res.redirect('/finance?error=Failed to add item');
  }
});

// Edit finance item form
router.get('/edit/:id', ensureAdmin, async (req, res) => {
  try {
    const itemId = parseInt(req.params.id);
    const item = getFinanceItem(itemId, req.user.id);
    
    if (!item) {
      return res.status(404).render('error', {
        user: req.user,
        active: 'error',
        error: 'Item not found.',
      });
    }

    res.render('admin/finance-edit', {
      user: req.user,
      active: 'finance',
      item
    });
  } catch (error) {
    console.error('Error loading edit form:', error);
    res.status(500).render('error', {
      user: req.user,
      active: 'error',
      error: 'Failed to load item.',
    });
  }
});

// Update finance item
router.post('/edit/:id', ensureAdmin, async (req, res) => {
  try {
    const itemId = parseInt(req.params.id);
    const { name, description, price, card_last_four } = req.body;
    
    if (!name || !price) {
      return res.redirect(`/finance/edit/${itemId}?error=Name and price are required`);
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      return res.redirect(`/finance/edit/${itemId}?error=Invalid price`);
    }

    const result = updateFinanceItem(itemId, req.user.id, {
      name: name.trim(),
      description: description?.trim() || '',
      price: priceNum,
      card_last_four: card_last_four?.trim() || ''
    });

    if (result.changes === 0) {
      return res.redirect('/finance?error=Item not found or no changes made');
    }

    res.redirect('/finance?alert=Item updated successfully');
  } catch (error) {
    console.error('Error updating finance item:', error);
    res.redirect('/finance?error=Failed to update item');
  }
});

// Delete finance item
router.post('/delete/:id', ensureAdmin, async (req, res) => {
  try {
    const itemId = parseInt(req.params.id);
    const result = deleteFinanceItem(itemId, req.user.id);

    if (result.changes === 0) {
      return res.redirect('/finance?error=Item not found');
    }

    res.redirect('/finance?alert=Item deleted successfully');
  } catch (error) {
    console.error('Error deleting finance item:', error);
    res.redirect('/finance?error=Failed to delete item');
  }
});

export default router;
