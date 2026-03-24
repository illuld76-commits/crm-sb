import { supabase } from '@/integrations/supabase/client';

interface NotificationParams {
  userId: string;
  eventType: string;
  placeholders: Record<string, string>;
  link?: string;
}

export async function sendNotification({ userId, eventType, placeholders, link }: NotificationParams) {
  try {
    // Fetch template
    const { data: templates } = await supabase
      .from('notification_templates')
      .select('*')
      .eq('event_type', eventType)
      .limit(1);

    let title = eventType;
    let body = 'An event has occurred.';

    if (templates && templates.length > 0) {
      const template = templates[0];
      title = template.title_template;
      body = template.body_template;

      Object.entries(placeholders).forEach(([key, value]) => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        title = title.replace(regex, value || '');
        body = body.replace(regex, value || '');
      });
    }

    await supabase.from('notifications').insert({
      user_id: userId,
      title,
      body,
      is_read: false,
      link: link || '',
    });
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}
