import { Router } from 'express';
import { 
  getFormTemplate,
  saveFormResponse,
  getFormResponses
} from '../../bot/utils/database.js';
import { v4 as uuidv4 } from 'uuid';
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';

// Create Discord client for posting form responses
const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

// Login to Discord
if (process.env.DISCORD_TOKEN) {
  discordClient.login(process.env.DISCORD_TOKEN);
}

const router = Router();

// Function to post form response to Discord
async function postFormResponseToDiscord(form, responses, userId) {
  try {
    if (!process.env.CUSTOM_FORMS_CHANNEL_ID || !discordClient.isReady()) {
      console.log('Discord client not ready or channel ID not configured');
      return;
    }

    const channel = await discordClient.channels.fetch(process.env.CUSTOM_FORMS_CHANNEL_ID);
    if (!channel) {
      console.log('Custom forms channel not found');
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`📝 New Form Response: ${form.name}`)
      .setColor('#4b5a2a')
      .setTimestamp()
      .setFooter({ text: '1A 75th Forms' });

    // Add form description if available
    if (form.description) {
      embed.setDescription(form.description);
    }

    // Add response fields
    let fields = form.fields;
    if (typeof fields === 'string') {
      try {
        fields = JSON.parse(fields);
      } catch (e) {
        fields = [];
      }
    }
    
    fields.forEach(field => {
      const value = responses[field.name] || 'No response';
      const displayValue = Array.isArray(value) ? value.join(', ') : value;
      
      embed.addFields({
        name: field.label,
        value: displayValue.length > 1024 ? displayValue.substring(0, 1021) + '...' : displayValue,
        inline: false
      });
    });

    // Add metadata
    const userMention = userId ? `<@${userId}>` : 'Anonymous';
    embed.addFields({
      name: 'Response Info',
      value: `**User:** ${userMention}\n**Form ID:** ${form.id}\n**Submitted:** <t:${Math.floor(Date.now() / 1000)}:R>`,
      inline: false
    });

    await channel.send({ embeds: [embed] });
    console.log(`Form response posted to Discord channel: ${form.name}`);
  } catch (error) {
    console.error('Error posting form response to Discord:', error);
  }
}

// Public form access
router.get('/:id', async (req, res) => {
  try {
    const form = getFormTemplate(req.params.id);
    
    if (!form) {
      return res.status(404).render('error', {
        title: 'Form Not Found',
        message: 'The requested form could not be found.',
        user: req.user
      });
    }

    if (!form.is_active) {
      return res.status(404).render('error', {
        title: 'Form Unavailable',
        message: 'This form is currently not available.',
        user: req.user
      });
    }

    // Check if form has expired
    if (form.expiry_date && new Date(form.expiry_date) < new Date()) {
      return res.status(404).render('error', {
        title: 'Form Expired',
        message: 'This form has expired and is no longer accepting submissions.',
        user: req.user
      });
    }

    // Check if max responses reached
    if (form.max_responses && form.response_count >= form.max_responses) {
      return res.status(404).render('error', {
        title: 'Form Full',
        message: 'This form has reached its maximum number of responses.',
        user: req.user
      });
    }

    // Parse fields if they're stored as JSON string
    if (form.fields && typeof form.fields === 'string') {
      try {
        form.fields = JSON.parse(form.fields);
      } catch (e) {
        form.fields = [];
      }
    }
    
    res.render('forms/public-form', {
      title: form.name,
      form: form,
      user: req.user
    });
  } catch (error) {
    console.error('Error loading public form:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'An error occurred while loading the form.',
      user: req.user
    });
  }
});

// Submit form response
router.post('/:id/submit', async (req, res) => {
  try {
    const form = getFormTemplate(req.params.id);
    
    if (!form || !form.is_active) {
      return res.status(404).json({ error: 'Form not found or inactive' });
    }

    // Check if form has expired
    if (form.expiry_date && new Date(form.expiry_date) < new Date()) {
      return res.status(400).json({ error: 'Form has expired' });
    }

    // Check if max responses reached
    if (form.max_responses && form.response_count >= form.max_responses) {
      return res.status(400).json({ error: 'Form has reached maximum responses' });
    }

    // Parse fields if they're stored as JSON string
    let fields = form.fields;
    if (typeof fields === 'string') {
      try {
        fields = JSON.parse(fields);
      } catch (e) {
        fields = [];
      }
    }
    
    const responses = {};
    let hasRequiredFields = true;

    // Validate required fields
    fields.forEach(field => {
      const value = req.body[field.name];
      if (field.required && (!value || value.trim() === '')) {
        hasRequiredFields = false;
      }
      responses[field.name] = value || '';
    });

    if (!hasRequiredFields) {
      return res.status(400).json({ error: 'Please fill in all required fields' });
    }

    // Save the response
    const now = new Date();
    const startTime = req.body._startTime ? parseInt(req.body._startTime) : Date.now();
    const completionTime = Math.floor((Date.now() - startTime) / 1000);
    
    const responseData = {
      id: uuidv4(),
      formId: req.params.id,
      userId: req.user?.id || null,
      responses: responses,
      completionTime: completionTime,
      startedAt: new Date(startTime).toISOString(),
      completedAt: now.toISOString(),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    };

    await saveFormResponse(responseData);

    // Post to Discord channel
    await postFormResponseToDiscord(form, responses, req.user?.id);

    // Update response count
    // Note: This would need to be implemented in the database functions
    // For now, we'll just return success

    res.json({ 
      success: true, 
      message: form.success_message || 'Thank you for your submission!' 
    });
  } catch (error) {
    console.error('Error submitting form response:', error);
    res.status(500).json({ error: 'Failed to submit form response' });
  }
});

export default router; 