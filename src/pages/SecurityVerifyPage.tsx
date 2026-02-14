import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useSecurityOfficer } from '@/hooks/useSecurityOfficer';
import { GuardConfirmationPoller } from '@/components/security/GuardConfirmationPoller';
import { toast } from 'sonner';
import {
  Shield, CheckCircle, XCircle, User, Search, Clock,
  QrCode, AlertTriangle, Send
} from 'lucide-react';

interface VerifiedResident {
  name: string;
  flat_number: string;
  block: string;
  avatar_url?: string;
  user_id: string;
}

export default function SecurityVerifyPage() {
  const { profile, effectiveSocietyId } = useAuth();
  const { isSecurityOfficer, isLoading: roleLoading } = useSecurityOfficer();

  const [tokenInput, setTokenInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedResident, setVerifiedResident] = useState<VerifiedResident | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'success' | 'expired' | 'failed' | 'awaiting'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [pendingEntryId, setPendingEntryId] = useState<string | null>(null);
  const [confirmTimeout, setConfirmTimeout] = useState(20);
  const [flatInput, setFlatInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [manualStatus, setManualStatus] = useState<'idle' | 'sent' | 'approved' | 'denied' | 'expired'>('idle');
  const manualRequestIdRef = useRef<string | null>(null);

  // Fix 5: Realtime subscription for manual entry responses
  useEffect(() => {
    if (manualStatus !== 'sent' || !manualRequestIdRef.current) return;

    const channel = supabase
      .channel(`manual-entry-${manualRequestIdRef.current}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'manual_entry_requests',
          filter: `id=eq.${manualRequestIdRef.current}`,
        },
        (payload) => {
          const newStatus = (payload.new as any).status;
          if (newStatus === 'approved') {
            setManualStatus('approved');
            toast.success('✅ Entry approved by resident!');
          } else if (newStatus === 'denied') {
            setManualStatus('denied');
            toast.error('❌ Entry denied by resident');
          } else if (newStatus === 'expired') {
            setManualStatus('expired');
            toast.warning('⏰ Request expired — no response');
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [manualStatus]);
  const handleConfirmationComplete = useCallback((status: 'confirmed' | 'denied' | 'expired') => {
    if (status === 'confirmed') {
      setVerificationStatus('success');
    }
  }, []);

  const resetVerification = useCallback(() => {
    setTokenInput('');
    setVerifiedResident(null);
    setVerificationStatus('idle');
    setErrorMessage('');
    setPendingEntryId(null);
  }, []);

  // Route guard
  if (roleLoading) {
    return (
      <AppLayout headerTitle="Security Verify" showLocation={false} showNav={false}>
        <div className="p-4 text-center py-20 text-muted-foreground">
          <Shield size={48} className="mx-auto mb-4 opacity-50 animate-pulse" />
          <p className="font-medium">Loading...</p>
        </div>
      </AppLayout>
    );
  }

  if (!isSecurityOfficer) {
    return (
      <AppLayout headerTitle="Security Verify" showLocation={false} showNav={false}>
        <div className="p-4 text-center py-20 text-muted-foreground">
          <Shield size={48} className="mx-auto mb-4 opacity-50" />
          <p className="font-medium">Access Restricted</p>
          <p className="text-sm">Only security officers and society admins can access this page.</p>
        </div>
      </AppLayout>
    );
  }

  const handleValidateToken = async (tokenValue?: string) => {
    const token = tokenValue || tokenInput;
    if (!token.trim()) return;

    setIsVerifying(true);
    setVerifiedResident(null);
    setVerificationStatus('idle');
    setPendingEntryId(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('Please log in'); return; }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gate-token?action=validate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        }
      );

      const result = await response.json();

      if (result.valid && result.awaiting_confirmation) {
        setVerifiedResident(result.resident);
        setVerificationStatus('awaiting');
        setPendingEntryId(result.entry_id);
        setConfirmTimeout(result.timeout_seconds || 20);
      } else if (result.valid) {
        setVerifiedResident(result.resident);
        setVerificationStatus('success');
      } else if (result.expired) {
        setVerificationStatus('expired');
        setErrorMessage('QR code has expired. Ask resident to refresh.');
      } else {
        setVerificationStatus('failed');
        setErrorMessage(result.error || 'Invalid QR code');
      }
    } catch (error: any) {
      setVerificationStatus('failed');
      setErrorMessage('Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleManualEntry = async () => {
    if (!flatInput.trim() || !nameInput.trim() || !effectiveSocietyId) return;

    try {
      const { data: resident } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('society_id', effectiveSocietyId)
        .eq('flat_number', flatInput.trim())
        .eq('verification_status', 'approved')
        .maybeSingle();

      const { data: insertData, error } = await supabase.from('manual_entry_requests').insert({
        society_id: effectiveSocietyId,
        flat_number: flatInput.trim(),
        claimed_name: nameInput.trim(),
        requested_by: profile?.id,
        resident_id: resident?.id || null,
        status: 'pending',
      }).select('id').single();

      if (error) throw error;
      manualRequestIdRef.current = insertData?.id || null;
      setManualStatus('sent');
      toast.success('Verification request sent to resident');

      if (resident?.id) {
        await supabase.from('notification_queue').insert({
          user_id: resident.id,
          title: '🚨 Gate Entry Request',
          body: `Someone claiming to be "${nameInput.trim()}" is requesting entry at the gate. Approve?`,
          type: 'gate_manual_entry',
          reference_path: '/gate-entry',
        });
      }
    } catch (error) {
      toast.error('Failed to send request');
    }
  };

  return (
    <AppLayout headerTitle="Security Verify" showLocation={false} showNav={false}>
      <div className="p-4 space-y-4">
        <Tabs defaultValue="scan">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="scan" className="gap-1"><QrCode size={14} /> Scan QR</TabsTrigger>
            <TabsTrigger value="manual" className="gap-1"><User size={14} /> Manual</TabsTrigger>
          </TabsList>

          <TabsContent value="scan" className="space-y-4 mt-4">
            <Card className="border-2 border-primary/30">
              <CardContent className="p-6 space-y-4">
                <div className="text-center">
                  <Shield className="mx-auto text-primary mb-2" size={40} />
                  <h2 className="text-xl font-bold">Verify Resident</h2>
                  <p className="text-sm text-muted-foreground">Paste QR code data or scan</p>
                </div>
                <Input
                  value={tokenInput}
                  onChange={e => {
                    setTokenInput(e.target.value);
                    if (verificationStatus !== 'idle') resetVerification();
                  }}
                  placeholder="Paste QR code content..."
                  className="text-center h-14 text-sm"
                />
                <Button
                  onClick={() => handleValidateToken()}
                  disabled={!tokenInput.trim() || isVerifying}
                  className="w-full h-14 text-lg"
                  size="lg"
                >
                  <Search size={20} className="mr-2" />
                  {isVerifying ? 'Verifying...' : 'Verify Entry'}
                </Button>
              </CardContent>
            </Card>

            {verificationStatus === 'awaiting' && pendingEntryId && verifiedResident && (
              <GuardConfirmationPoller
                entryId={pendingEntryId}
                timeoutSeconds={confirmTimeout}
                residentName={verifiedResident.name}
                flatNumber={verifiedResident.flat_number}
                block={verifiedResident.block}
                onComplete={handleConfirmationComplete}
              />
            )}

            {verificationStatus === 'success' && verifiedResident && (
              <Card className="border-success/50 bg-success/5">
                <CardContent className="p-6 space-y-4">
                  <div className="text-center">
                    <CheckCircle className="mx-auto text-success mb-2" size={64} />
                    <p className="text-2xl font-bold text-success">VERIFIED</p>
                  </div>
                  <div className="bg-background rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      {verifiedResident.avatar_url ? (
                        <img src={verifiedResident.avatar_url} className="w-14 h-14 rounded-full object-cover" alt="" />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                          <User size={28} className="text-primary" />
                        </div>
                      )}
                      <div>
                        <p className="text-xl font-bold">{verifiedResident.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Block {verifiedResident.block}, Flat {verifiedResident.flat_number}
                        </p>
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full h-12" onClick={resetVerification}>
                    Verify Next
                  </Button>
                </CardContent>
              </Card>
            )}

            {verificationStatus === 'expired' && (
              <Card className="border-warning/50 bg-warning/5">
                <CardContent className="p-6 text-center">
                  <Clock className="mx-auto text-warning mb-3" size={64} />
                  <p className="text-2xl font-bold text-warning">EXPIRED</p>
                  <p className="text-sm text-muted-foreground mt-2">{errorMessage}</p>
                  <Button variant="outline" className="mt-4" onClick={resetVerification}>Try Again</Button>
                </CardContent>
              </Card>
            )}

            {verificationStatus === 'failed' && (
              <Card className="border-destructive/50 bg-destructive/5">
                <CardContent className="p-6 text-center">
                  <XCircle className="mx-auto text-destructive mb-3" size={64} />
                  <p className="text-2xl font-bold text-destructive">INVALID</p>
                  <p className="text-sm text-muted-foreground mt-2">{errorMessage}</p>
                  <Button variant="outline" className="mt-4" onClick={resetVerification}>Try Again</Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="manual" className="space-y-4 mt-4">
            <Card className="border-2 border-warning/30">
              <CardContent className="p-6 space-y-4">
                <div className="text-center">
                  <AlertTriangle className="mx-auto text-warning mb-2" size={40} />
                  <h2 className="text-xl font-bold">Manual Verification</h2>
                  <p className="text-sm text-muted-foreground">When resident forgot their phone</p>
                </div>
                <div className="space-y-3">
                  <Input value={flatInput} onChange={e => setFlatInput(e.target.value)} placeholder="Enter flat number" className="h-14 text-center text-lg" />
                  <Input value={nameInput} onChange={e => setNameInput(e.target.value)} placeholder="Person's claimed name" className="h-14 text-center text-lg" />
                  <Button onClick={handleManualEntry} disabled={!flatInput.trim() || !nameInput.trim() || manualStatus === 'sent'} className="w-full h-14 text-lg" variant="outline">
                    <Send size={20} className="mr-2" />
                    {manualStatus === 'sent' ? 'Request Sent — Waiting...' : 'Send to Resident'}
                  </Button>
                </div>
                {manualStatus === 'sent' && (
                  <div className="bg-muted rounded-lg p-4 text-center">
                    <Clock className="mx-auto text-muted-foreground mb-2 animate-pulse" size={24} />
                    <p className="text-sm font-medium">Waiting for resident confirmation...</p>
                    <p className="text-xs text-muted-foreground mt-1">You'll be notified when they respond</p>
                  </div>
                )}
                {manualStatus === 'approved' && (
                  <Card className="border-success/50 bg-success/5">
                    <CardContent className="p-4 text-center">
                      <CheckCircle className="mx-auto text-success mb-2" size={48} />
                      <p className="text-xl font-bold text-success">APPROVED</p>
                      <p className="text-sm text-muted-foreground mt-1">Resident confirmed entry</p>
                      <Button variant="outline" className="mt-3" onClick={() => { setManualStatus('idle'); setFlatInput(''); setNameInput(''); manualRequestIdRef.current = null; }}>
                        Next Entry
                      </Button>
                    </CardContent>
                  </Card>
                )}
                {manualStatus === 'denied' && (
                  <Card className="border-destructive/50 bg-destructive/5">
                    <CardContent className="p-4 text-center">
                      <XCircle className="mx-auto text-destructive mb-2" size={48} />
                      <p className="text-xl font-bold text-destructive">DENIED</p>
                      <p className="text-sm text-muted-foreground mt-1">Resident rejected entry</p>
                      <Button variant="outline" className="mt-3" onClick={() => { setManualStatus('idle'); setFlatInput(''); setNameInput(''); manualRequestIdRef.current = null; }}>
                        Next Entry
                      </Button>
                    </CardContent>
                  </Card>
                )}
                {manualStatus === 'expired' && (
                  <Card className="border-warning/50 bg-warning/5">
                    <CardContent className="p-4 text-center">
                      <Clock className="mx-auto text-warning mb-2" size={48} />
                      <p className="text-xl font-bold text-warning">EXPIRED</p>
                      <p className="text-sm text-muted-foreground mt-1">No response from resident</p>
                      <Button variant="outline" className="mt-3" onClick={() => { setManualStatus('idle'); setFlatInput(''); setNameInput(''); manualRequestIdRef.current = null; }}>
                        Try Again
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
