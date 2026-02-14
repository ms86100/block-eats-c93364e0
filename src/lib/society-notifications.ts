import { supabase } from '@/integrations/supabase/client';

/**
 * Notify all society members via push notification
 * Also writes to user_notifications table for persistent inbox
 */
export async function notifySocietyMembers(
  societyId: string,
  title: string,
  body: string,
  data?: Record<string, string>,
  excludeUserId?: string
): Promise<void> {
  try {
    const { data: members } = await supabase
      .from('profiles')
      .select('id')
      .eq('society_id', societyId)
      .eq('verification_status', 'approved');

    if (!members || members.length === 0) return;

    const targets = excludeUserId
      ? members.filter(m => m.id !== excludeUserId)
      : members;

    // Write persistent notifications to inbox
    const notificationRows = targets.map(m => ({
      user_id: m.id,
      title,
      body,
      type: data?.type || 'general',
      reference_path: data?.path || null,
      reference_id: data?.reference_id || null,
    }));

    supabase.from('user_notifications').insert(notificationRows as any).then(({ error }) => {
      if (error) console.error('Failed to write notifications:', error);
    });

    // Fire push notifications
    for (const member of targets) {
      supabase.functions.invoke('send-push-notification', {
        body: { userId: member.id, title, body, data },
      }).catch(err => console.error('Push failed for', member.id, err));
    }
  } catch (err) {
    console.error('Failed to notify society members:', err);
  }
}

/**
 * Notify admins of a society
 */
export async function notifySocietyAdmins(
  societyId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  try {
    const { data: adminRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    if (!adminRoles || adminRoles.length === 0) return;

    const adminIds = adminRoles.map(r => r.user_id);

    const { data: adminProfiles } = await supabase
      .from('profiles')
      .select('id')
      .eq('society_id', societyId)
      .in('id', adminIds);

    if (!adminProfiles) return;

    // Write persistent notifications
    const notificationRows = adminProfiles.map(a => ({
      user_id: a.id,
      title,
      body,
      type: data?.type || 'admin',
      reference_path: data?.path || null,
      reference_id: data?.reference_id || null,
    }));

    supabase.from('user_notifications').insert(notificationRows as any).then(({ error }) => {
      if (error) console.error('Failed to write admin notifications:', error);
    });

    for (const admin of adminProfiles) {
      supabase.functions.invoke('send-push-notification', {
        body: { userId: admin.id, title, body, data },
      }).catch(err => console.error('Push failed for admin', admin.id, err));
    }
  } catch (err) {
    console.error('Failed to notify admins:', err);
  }
}
