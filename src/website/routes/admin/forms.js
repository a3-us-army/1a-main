import { Router } from 'express';
import ensureAdmin from '../../middleware/ensureAdmin.js';
import { 
  getAllFormTemplates,
  createFormTemplate,
  getFormTemplate,
  updateFormTemplate,
  deleteFormTemplate,
  getFormResponses,
  getFormAnalytics,
  saveFormResponse,
  getDatabase 
} from '../../../bot/utils/database.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const db = getDatabase();

// Form Templates Dashboard
router.get('/', ensureAdmin, async (req, res) => {
  try {
    const forms = getAllFormTemplates();
    const stats = {
      totalForms: forms.length,
      activeForms: forms.filter(f => f.is_active).length,
      totalResponses: forms.reduce((sum, f) => sum + (f.response_count || 0), 0),
      avgResponses: forms.length > 0 ? Math.round(forms.reduce((sum, f) => sum + (f.response_count || 0), 0) / forms.length) : 0
    };
    
    res.render('admin/form-builder', {
      user: req.user,
      forms: forms,
      stats: stats,
      active: 'forms',
      isAdmin: true,
      alert: req.query.alert,
      error: req.query.error
    });
  } catch (error) {
    console.error('Error loading forms dashboard:', error);
    res.redirect('/form-builder?error=Failed to load forms data');
  }
});

// Form Builder - Create new template
router.get('/create', ensureAdmin, (req, res) => {
  res.render('admin/form-editor', {
    user: req.user,
    active: 'forms',
    isAdmin: true,
    form: null,
    alert: req.query.alert,
    error: req.query.error
  });
});

// Form Builder - Edit existing template
router.get('/edit/:id', ensureAdmin, async (req, res) => {
  try {
    const form = getFormTemplate(req.params.id);
    if (!form) {
      return res.redirect('/form-builder?error=Form not found');
    }
    
    res.render('admin/form-editor', {
      user: req.user,
      active: 'forms',
      isAdmin: true,
      form: form,
      alert: req.query.alert,
      error: req.query.error
    });
  } catch (error) {
    console.error('Error loading form builder:', error);
    res.redirect('/form-builder?error=Failed to load form');
  }
});

// Save Form Template
router.post('/save', ensureAdmin, async (req, res) => {
  try {
    const { id, name, description, fields, conditionalLogic, isActive } = req.body;
    
    const templateData = {
      id: id || uuidv4(),
      name,
      description,
      fields: JSON.parse(fields),
      conditionalLogic: conditionalLogic ? JSON.parse(conditionalLogic) : null,
      createdBy: req.user.id
    };
    
    if (id) {
      // Update existing template
      await updateFormTemplate(id, {
        name,
        description,
        fields: templateData.fields,
        conditionalLogic: templateData.conditionalLogic,
        isActive: isActive === 'true'
      });
    } else {
      // Create new template
      await createFormTemplate(templateData);
    }
    
    res.redirect('/form-builder?alert=Form saved successfully');
  } catch (error) {
    console.error('Error saving form template:', error);
    res.redirect('/form-builder?error=Failed to save form');
  }
});

// Delete Form Template
router.post('/delete/:id', ensureAdmin, async (req, res) => {
  try {
    await deleteFormTemplate(req.params.id);
    res.redirect('/form-builder?alert=Form deleted successfully');
  } catch (error) {
    console.error('Error deleting form template:', error);
    res.redirect('/form-builder?error=Failed to delete form');
  }
});

// Form Analytics
router.get('/analytics/:id', ensureAdmin, async (req, res) => {
  try {
    const template = getFormTemplate(req.params.id);
    if (!template) {
      return res.redirect('/admin/forms?error=Template not found');
    }
    
    const analytics = getFormAnalytics(req.params.id);
    const responses = getFormResponses(req.params.id, 100);
    
    // Get response breakdown by field
    const fieldAnalytics = {};
    if (template.fields) {
      const fields = JSON.parse(template.fields);
      fields.forEach(field => {
        if (field.type === 'select' || field.type === 'radio') {
          const options = field.options || [];
          const optionCounts = {};
          options.forEach(option => {
            optionCounts[option] = 0;
          });
          
          responses.forEach(response => {
            const responseData = JSON.parse(response.responses);
            const value = responseData[field.name];
            if (value && optionCounts.hasOwnProperty(value)) {
              optionCounts[value]++;
            }
          });
          
          fieldAnalytics[field.name] = {
            type: field.type,
            options: optionCounts
          };
        }
      });
    }
    
    res.render('admin/form-analytics', {
      user: req.user,
      template,
      analytics,
      responses,
      fieldAnalytics,
      active: 'forms',
      isAdmin: true
    });
  } catch (error) {
    console.error('Error loading form analytics:', error);
    res.redirect('/admin/forms?error=Failed to load analytics');
  }
});

// Export Form Responses
router.get('/export/:id', ensureAdmin, async (req, res) => {
  try {
    const template = getFormTemplate(req.params.id);
    if (!template) {
      return res.redirect('/admin/forms?error=Template not found');
    }
    
    const responses = getFormResponses(req.params.id, 1000);
    const fields = JSON.parse(template.fields);
    
    // Create CSV headers
    const headers = ['Response ID', 'User ID', 'Started At', 'Completed At', 'Completion Time (seconds)'];
    fields.forEach(field => {
      headers.push(field.label || field.name);
    });
    
    // Create CSV data
    const csvData = [headers.join(',')];
    responses.forEach(response => {
      const responseData = JSON.parse(response.responses);
      const row = [
        response.id,
        response.user_id || 'Anonymous',
        response.started_at,
        response.completed_at || 'Incomplete',
        response.completion_time || 'N/A'
      ];
      
      fields.forEach(field => {
        const value = responseData[field.name] || '';
        row.push(`"${value.toString().replace(/"/g, '""')}"`);
      });
      
      csvData.push(row.join(','));
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="form_responses_${template.name}_${Date.now()}.csv"`);
    res.send(csvData.join('\n'));
  } catch (error) {
    console.error('Error exporting form responses:', error);
    res.redirect('/admin/forms?error=Failed to export responses');
  }
});

// Form Preview
router.get('/preview/:id', ensureAdmin, async (req, res) => {
  try {
    const template = getFormTemplate(req.params.id);
    if (!template) {
      return res.redirect('/admin/forms?error=Template not found');
    }
    
    res.render('admin/form-preview', {
      user: req.user,
      template,
      active: 'forms',
      isAdmin: true
    });
  } catch (error) {
    console.error('Error loading form preview:', error);
    res.redirect('/admin/forms?error=Failed to load preview');
  }
});

// Submit Form Response (for testing)
router.post('/submit/:id', ensureAdmin, async (req, res) => {
  try {
    const template = getFormTemplate(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    const responseData = {
      id: uuidv4(),
      formId: req.params.id,
      userId: req.user.id,
      responses: JSON.stringify(req.body),
      completionTime: Math.floor(Math.random() * 300) + 30, // Random time for testing
      startedAt: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
      completedAt: new Date().toISOString(),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    };
    
    await saveFormResponse(responseData);
    
    res.json({ success: true, message: 'Response saved successfully' });
  } catch (error) {
    console.error('Error submitting form response:', error);
    res.status(500).json({ error: 'Failed to save response' });
  }
});

// Form Templates API
router.get('/api/templates', ensureAdmin, async (req, res) => {
  try {
    const templates = getAllFormTemplates();
    res.json(templates);
  } catch (error) {
    console.error('Error loading templates API:', error);
    res.status(500).json({ error: 'Failed to load templates' });
  }
});

// Form Analytics API
router.get('/api/analytics/:id', ensureAdmin, async (req, res) => {
  try {
    const analytics = getFormAnalytics(req.params.id);
    res.json(analytics);
  } catch (error) {
    console.error('Error loading analytics API:', error);
    res.status(500).json({ error: 'Failed to load analytics' });
  }
});

// Form Responses
router.get('/responses/:id', ensureAdmin, async (req, res) => {
  try {
    const form = getFormTemplate(req.params.id);
    if (!form) {
      return res.redirect('/form-builder?error=Form not found');
    }
    
    const responses = getFormResponses(req.params.id);
    const filters = {
      date_from: req.query.date_from || '',
      date_to: req.query.date_to || '',
      search: req.query.search || ''
    };
    
    res.render('admin/form-responses', {
      user: req.user,
      active: 'forms',
      isAdmin: true,
      form: form,
      responses: responses,
      filters: filters,
      alert: req.query.alert,
      error: req.query.error
    });
  } catch (error) {
    console.error('Error loading form responses:', error);
    res.redirect('/form-builder?error=Failed to load responses');
  }
});

// Form Analytics
router.get('/analytics/:id', ensureAdmin, async (req, res) => {
  try {
    const form = getFormTemplate(req.params.id);
    if (!form) {
      return res.redirect('/form-builder?error=Form not found');
    }
    
    const analytics = getFormAnalytics(req.params.id);
    
    res.render('admin/form-analytics', {
      user: req.user,
      active: 'forms',
      isAdmin: true,
      form: form,
      analytics: analytics,
      alert: req.query.alert,
      error: req.query.error
    });
  } catch (error) {
    console.error('Error loading form analytics:', error);
    res.redirect('/form-builder?error=Failed to load analytics');
  }
});

// Toggle Form Status
router.post('/toggle/:id', ensureAdmin, async (req, res) => {
  try {
    const form = getFormTemplate(req.params.id);
    if (!form) {
      return res.redirect('/form-builder?error=Form not found');
    }
    
    await updateFormTemplate(req.params.id, {
      is_active: !form.is_active
    });
    
    res.redirect('/form-builder?alert=Form status updated');
  } catch (error) {
    console.error('Error toggling form status:', error);
    res.redirect('/form-builder?error=Failed to update form status');
  }
});

export default router; 