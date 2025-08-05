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
    
    // Parse fields for each form to get response count
    forms.forEach(form => {
      if (form.fields && typeof form.fields === 'string') {
        try {
          form.fields = JSON.parse(form.fields);
        } catch (e) {
          form.fields = [];
        }
      }
    });
    
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

// Form Builder - Create new template (alias for /new)
router.get('/new', ensureAdmin, async (req, res) => {
  try {
    let form = null;
    const templateId = req.query.template;
    
    if (templateId) {
      if (templateId === 'application') {
        // Predefined application template
        form = {
          name: 'Application Form',
          description: 'Standard application form for new members',
          fields: [
            { label: 'Full Name', name: 'full_name', type: 'text', required: true, options: [] },
            { label: 'Email Address', name: 'email', type: 'email', required: true, options: [] },
            { label: 'Discord Username', name: 'discord_username', type: 'text', required: true, options: [] },
            { label: 'Age', name: 'age', type: 'number', required: true, options: [] },
            { label: 'Previous Experience', name: 'experience', type: 'textarea', required: false, options: [] },
            { label: 'Why do you want to join?', name: 'motivation', type: 'textarea', required: true, options: [] },
            { label: 'How did you hear about us?', name: 'source', type: 'select', required: true, options: ['Discord', 'Website', 'Friend', 'Other'] },
            { label: 'Available Time', name: 'availability', type: 'checkbox', required: false, options: ['Weekdays', 'Weekends', 'Evenings'] }
          ]
        };
      } else if (templateId === 'feedback') {
        // Predefined feedback template
        form = {
          name: 'Feedback Form',
          description: 'Collect feedback and suggestions from users',
          fields: [
            { label: 'Your Name', name: 'name', type: 'text', required: false, options: [] },
            { label: 'Email Address', name: 'email', type: 'email', required: false, options: [] },
            { label: 'Overall Rating', name: 'rating', type: 'radio', required: true, options: ['Excellent', 'Good', 'Average', 'Poor', 'Very Poor'] },
            { label: 'What did you like most?', name: 'likes', type: 'textarea', required: false, options: [] },
            { label: 'What could be improved?', name: 'improvements', type: 'textarea', required: false, options: [] },
            { label: 'Would you recommend us?', name: 'recommend', type: 'select', required: true, options: ['Yes', 'No', 'Maybe'] },
            { label: 'Additional Comments', name: 'comments', type: 'textarea', required: false, options: [] }
          ]
        };
      } else if (templateId === 'event') {
        // Predefined event registration template
        form = {
          name: 'Event Registration',
          description: 'Event registration form for attendees',
          fields: [
            { label: 'Full Name', name: 'full_name', type: 'text', required: true, options: [] },
            { label: 'Email Address', name: 'email', type: 'email', required: true, options: [] },
            { label: 'Phone Number', name: 'phone', type: 'tel', required: false, options: [] },
            { label: 'Number of Attendees', name: 'attendees', type: 'number', required: true, options: [] },
            { label: 'Dietary Restrictions', name: 'dietary', type: 'select', required: false, options: ['None', 'Vegetarian', 'Vegan', 'Gluten-Free', 'Other'] },
            { label: 'Special Requirements', name: 'requirements', type: 'textarea', required: false, options: [] },
            { label: 'How did you hear about this event?', name: 'source', type: 'select', required: false, options: ['Social Media', 'Email', 'Friend', 'Website', 'Other'] }
          ]
        };
      } else {
        // Use existing template as base
        const existingTemplate = getFormTemplate(templateId);
        if (existingTemplate) {
          form = { ...existingTemplate };
          form.name = `${existingTemplate.name} (Copy)`;
          form.id = null; // Remove ID to create new form
          
          // Parse fields if they're stored as JSON string
          if (form.fields && typeof form.fields === 'string') {
            try {
              form.fields = JSON.parse(form.fields);
            } catch (e) {
              form.fields = [];
            }
          }
        }
      }
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
    console.error('Error loading form template:', error);
    res.redirect('/form-builder?error=Failed to load template');
  }
});

// Form Builder - Create new template
router.get('/create', ensureAdmin, async (req, res) => {
  try {
    let form = null;
    const templateId = req.query.template;
    
    if (templateId) {
      if (templateId === 'application') {
        // Predefined application template
        form = {
          name: 'Application Form',
          description: 'Standard application form for new members',
          fields: [
            { label: 'Full Name', name: 'full_name', type: 'text', required: true, options: [] },
            { label: 'Email Address', name: 'email', type: 'email', required: true, options: [] },
            { label: 'Discord Username', name: 'discord_username', type: 'text', required: true, options: [] },
            { label: 'Age', name: 'age', type: 'number', required: true, options: [] },
            { label: 'Previous Experience', name: 'experience', type: 'textarea', required: false, options: [] },
            { label: 'Why do you want to join?', name: 'motivation', type: 'textarea', required: true, options: [] },
            { label: 'How did you hear about us?', name: 'source', type: 'select', required: true, options: ['Discord', 'Website', 'Friend', 'Other'] },
            { label: 'Available Time', name: 'availability', type: 'checkbox', required: false, options: ['Weekdays', 'Weekends', 'Evenings'] }
          ]
        };
      } else if (templateId === 'feedback') {
        // Predefined feedback template
        form = {
          name: 'Feedback Form',
          description: 'Collect feedback and suggestions from users',
          fields: [
            { label: 'Your Name', name: 'name', type: 'text', required: false, options: [] },
            { label: 'Email Address', name: 'email', type: 'email', required: false, options: [] },
            { label: 'Overall Rating', name: 'rating', type: 'radio', required: true, options: ['Excellent', 'Good', 'Average', 'Poor', 'Very Poor'] },
            { label: 'What did you like most?', name: 'likes', type: 'textarea', required: false, options: [] },
            { label: 'What could be improved?', name: 'improvements', type: 'textarea', required: false, options: [] },
            { label: 'Would you recommend us?', name: 'recommend', type: 'select', required: true, options: ['Yes', 'No', 'Maybe'] },
            { label: 'Additional Comments', name: 'comments', type: 'textarea', required: false, options: [] }
          ]
        };
      } else if (templateId === 'event') {
        // Predefined event registration template
        form = {
          name: 'Event Registration',
          description: 'Event registration form for attendees',
          fields: [
            { label: 'Full Name', name: 'full_name', type: 'text', required: true, options: [] },
            { label: 'Email Address', name: 'email', type: 'email', required: true, options: [] },
            { label: 'Phone Number', name: 'phone', type: 'tel', required: false, options: [] },
            { label: 'Number of Attendees', name: 'attendees', type: 'number', required: true, options: [] },
            { label: 'Dietary Restrictions', name: 'dietary', type: 'select', required: false, options: ['None', 'Vegetarian', 'Vegan', 'Gluten-Free', 'Other'] },
            { label: 'Special Requirements', name: 'requirements', type: 'textarea', required: false, options: [] },
            { label: 'How did you hear about this event?', name: 'source', type: 'select', required: false, options: ['Social Media', 'Email', 'Friend', 'Website', 'Other'] }
          ]
        };
      } else {
        // Use existing template as base
        const existingTemplate = getFormTemplate(templateId);
        if (existingTemplate) {
          form = { ...existingTemplate };
          form.name = `${existingTemplate.name} (Copy)`;
          form.id = null; // Remove ID to create new form
          
          // Parse fields if they're stored as JSON string
          if (form.fields && typeof form.fields === 'string') {
            try {
              form.fields = JSON.parse(form.fields);
            } catch (e) {
              form.fields = [];
            }
          }
        }
      }
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
    console.error('Error loading form template:', error);
    res.redirect('/form-builder?error=Failed to load template');
  }
});

// Form Builder - Edit existing template
router.get('/edit/:id', ensureAdmin, async (req, res) => {
  try {
    const form = getFormTemplate(req.params.id);
    if (!form) {
      return res.redirect('/form-builder?error=Form not found');
    }
    
    // Parse fields if they're stored as JSON string
    if (form.fields && typeof form.fields === 'string') {
      try {
        form.fields = JSON.parse(form.fields);
      } catch (e) {
        form.fields = [];
      }
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
    console.log('Full request body:', req.body);
    const { id, name, description, is_active, conditional_logic, success_message, max_responses, expiry_date } = req.body;
    
    // Process fields from form data
    let fields = [];
    
    // Check if fields are sent as an array (JSON format)
    if (req.body.fields && Array.isArray(req.body.fields)) {
      console.log('Fields sent as array, processing directly...');
      fields = req.body.fields.map(field => ({
        label: field.label || '',
        name: field.name || field.label?.toLowerCase().replace(/\s+/g, '_') || '',
        type: field.type || 'text',
        required: field.required === '1' || field.required === true,
        options: field.options ? (Array.isArray(field.options) ? field.options : field.options.split('\n').filter(opt => opt.trim())) : []
      })).filter(field => field.label && field.name);
    } else {
      // Process fields from individual form fields
      const fieldKeys = Object.keys(req.body).filter(key => key.startsWith('fields['));
      const fieldIndices = [...new Set(fieldKeys.map(key => key.match(/fields\[(\d+)\]/)[1]))];
      
      console.log('Field keys found:', fieldKeys);
      console.log('Field indices:', fieldIndices);
      
      fieldIndices.forEach(index => {
        const label = req.body[`fields[${index}][label]`] || '';
        const name = req.body[`fields[${index}][name]`] || label.toLowerCase().replace(/\s+/g, '_') || '';
        const type = req.body[`fields[${index}][type]`] || 'text';
        const required = req.body[`fields[${index}][required]`] === '1';
        const options = req.body[`fields[${index}][options]`] ? req.body[`fields[${index}][options]`].split('\n').filter(opt => opt.trim()) : [];
        
        console.log(`Processing field ${index}:`, { label, name, type, required, options });
        
        const field = {
          label,
          name,
          type,
          required,
          options
        };
        
        if (field.label && field.name) {
          fields.push(field);
        }
      });
    }
    
    console.log('Final fields array:', fields);
    
    const templateData = {
      id: id || uuidv4(),
      name,
      description,
      fields: fields,
      conditionalLogic: conditional_logic && conditional_logic.trim() ? conditional_logic : null,
      createdBy: req.user.id,
      successMessage: success_message,
      maxResponses: max_responses || null,
      expiryDate: expiry_date || null
    };
    
    if (id) {
      // Update existing template
      const updateData = {};
      
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (templateData.fields !== undefined) updateData.fields = templateData.fields;
      if (templateData.conditionalLogic !== undefined) updateData.conditionalLogic = templateData.conditionalLogic;
      if (is_active !== undefined) updateData.isActive = is_active === '1';
      if (templateData.successMessage !== undefined) updateData.successMessage = templateData.successMessage;
      if (templateData.maxResponses !== undefined) updateData.maxResponses = templateData.maxResponses;
      if (templateData.expiryDate !== undefined) updateData.expiryDate = templateData.expiryDate;
      
      await updateFormTemplate(id, updateData);
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
    const form = getFormTemplate(req.params.id);
    if (!form) {
      return res.redirect('/form-builder?error=Form not found');
    }
    
    // Parse fields if they're stored as JSON string
    if (form.fields && typeof form.fields === 'string') {
      try {
        form.fields = JSON.parse(form.fields);
      } catch (e) {
        form.fields = [];
      }
    }
    
    const analytics = getFormAnalytics(req.params.id);
    const responses = getFormResponses(req.params.id, 100);
    
    console.log('Analytics data:', analytics);
    console.log('Form fields:', form.fields);
    
    // Transform analytics data to match template expectations
    const transformedAnalytics = {
      totalResponses: analytics?.totalCompleted || 0,
      avgResponsesPerDay: analytics?.dailyStats && analytics.dailyStats.length > 0 
        ? Math.round(analytics.dailyStats.reduce((sum, day) => sum + day.count, 0) / Math.min(analytics.dailyStats.length, 30)) 
        : 0,
      completionRate: parseFloat(analytics?.completionRate) || 0,
      avgCompletionTime: analytics?.averageCompletionTime || 0,
      dailyStats: analytics?.dailyStats || [],
      totalStarted: analytics?.totalStarted || 0,
      totalCompleted: analytics?.totalCompleted || 0,
      trends: {
        labels: analytics?.dailyStats ? analytics.dailyStats.map(day => day.date).reverse() : [],
        data: analytics?.dailyStats ? analytics.dailyStats.map(day => day.count).reverse() : []
      },
      hourlyDistribution: {
        labels: ['12 AM', '1 AM', '2 AM', '3 AM', '4 AM', '5 AM', '6 AM', '7 AM', '8 AM', '9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM', '7 PM', '8 PM', '9 PM', '10 PM', '11 PM'],
        data: Array(24).fill(0) // Initialize with zeros for now
      },
      weeklyDistribution: {
        labels: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        data: Array(7).fill(0) // Initialize with zeros for now
      }
    };
    
    // Get response breakdown by field
    const fieldAnalytics = {};
    if (form.fields) {
      form.fields.forEach(field => {
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
      active: 'forms',
      isAdmin: true,
      form: form,
      analytics: transformedAnalytics,
      responses: responses,
      fieldAnalytics: fieldAnalytics,
      alert: req.query.alert,
      error: req.query.error
    });
  } catch (error) {
    console.error('Error loading form analytics:', error);
    res.redirect('/form-builder?error=Failed to load analytics');
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

// Form Templates Page
router.get('/templates', ensureAdmin, async (req, res) => {
  try {
    const templates = getAllFormTemplates();
    
    // Parse fields for each template
    const processedTemplates = templates.map(template => {
      if (template.fields && typeof template.fields === 'string') {
        try {
          template.fields = JSON.parse(template.fields);
        } catch (e) {
          template.fields = [];
        }
      }
      return template;
    });
    
    res.render('admin/form-templates', {
      user: req.user,
      active: 'forms',
      isAdmin: true,
      templates: processedTemplates,
      alert: req.query.alert,
      error: req.query.error
    });
  } catch (error) {
    console.error('Error loading templates:', error);
    res.redirect('/form-builder?error=Failed to load templates');
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

// View Single Response
router.get('/responses/:formId/view/:responseId', ensureAdmin, async (req, res) => {
  try {
    const form = getFormTemplate(req.params.formId);
    if (!form) {
      return res.status(404).json({ error: 'Form not found' });
    }
    
    // Parse fields if they're stored as JSON string
    if (form.fields && typeof form.fields === 'string') {
      try {
        form.fields = JSON.parse(form.fields);
      } catch (e) {
        form.fields = [];
      }
    }
    
    const responses = getFormResponses(req.params.formId);
    const response = responses.find(r => r.id === req.params.responseId);
    
    if (!response) {
      return res.status(404).json({ error: 'Response not found' });
    }
    
    // Parse response data
    let responseData = {};
    try {
      responseData = JSON.parse(response.responses);
    } catch (e) {
      responseData = {};
    }
    
    // Generate HTML for modal
    let html = `
      <div class="row">
        <div class="col-md-6">
          <h6>Response Information</h6>
          <p><strong>Response ID:</strong> ${response.id}</p>
          <p><strong>User ID:</strong> ${response.user_id || 'Anonymous'}</p>
          <p><strong>Started:</strong> ${response.started_at ? new Date(response.started_at).toLocaleString() : 'N/A'}</p>
          <p><strong>Completed:</strong> ${response.completed_at ? new Date(response.completed_at).toLocaleString() : 'N/A'}</p>
          <p><strong>Completion Time:</strong> ${response.completion_time ? response.completion_time + ' seconds' : 'N/A'}</p>
        </div>
        <div class="col-md-6">
          <h6>Form Fields</h6>
    `;
    
    form.fields.forEach(field => {
      const value = responseData[field.name];
      html += `
        <div class="mb-3">
          <label class="form-label"><strong>${field.label}:</strong></label>
          <div class="form-control-plaintext">
            ${value !== null && value !== undefined ? value : '<span class="text-muted">No response</span>'}
          </div>
        </div>
      `;
    });
    
    html += `
        </div>
      </div>
    `;
    
    res.json({ html });
  } catch (error) {
    console.error('Error loading response details:', error);
    res.status(500).json({ error: 'Failed to load response details' });
  }
});

// Form Responses
router.get('/responses/:id', ensureAdmin, async (req, res) => {
  try {
    const form = getFormTemplate(req.params.id);
    if (!form) {
      return res.redirect('/form-builder?error=Form not found');
    }
    
    // Parse fields if they're stored as JSON string
    if (form.fields && typeof form.fields === 'string') {
      try {
        form.fields = JSON.parse(form.fields);
      } catch (e) {
        form.fields = [];
      }
    }
    
    const responses = getFormResponses(req.params.id);
    
    // Transform responses to match template expectations
    const transformedResponses = responses.map(response => {
      try {
        const responseData = JSON.parse(response.responses);
        return {
          ...response,
          data: responseData
        };
      } catch (e) {
        return {
          ...response,
          data: {}
        };
      }
    });
    
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
      responses: transformedResponses,
      filters: filters,
      alert: req.query.alert,
      error: req.query.error
    });
  } catch (error) {
    console.error('Error loading form responses:', error);
    res.redirect('/form-builder?error=Failed to load responses');
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