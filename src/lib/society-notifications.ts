import { supabase } from '@/integrations/supabase/client';

/**
 * Notify all society members via push notification
 * This calls the send-push-notification edge function for each member
 */
export async function notifySocietyMembers(
  societyId: string,
  title: string,
  body: string,
  data?: Record<string, string>,
  excludeUserId?: string
): Promise<void> {
  try {
    // Get all user IDs in this society
    const { data: members } = await supabase
      .from('profiles')
      .select('id')
      .eq('society_id', societyId)
      .eq('verification_status', 'approved');

    if (!members || members.length === 0) return;

    // Send notification to each member (except excluded user)
    const targets = excludeUserId
      ? members.filter(m => m.id !== excludeUserId)
      : members;

    // Fire and forget - don't await all
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
    // Get admin user IDs in this society
    const { data: adminRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    if (!adminRoles || adminRoles.length === 0) return;

    const adminIds = adminRoles.map(r => r.user_id);

    // Filter to only admins in this society
    const { data: adminProfiles } = await supabase
      .from('profiles')
      .select('id')
      .eq('society_id', societyId)
      .in('id', adminIds);

    if (!adminProfiles) return;

    for (const admin of adminProfiles) {
      supabase.functions.invoke('send-push-notification', {
        body: { userId: admin.id, title, body, data },
      }).catch(err => console.error('Push failed for admin', admin.id, err));
    }
  } catch (err) {
    console.error('Failed to notify admins:', err);
  }
}
