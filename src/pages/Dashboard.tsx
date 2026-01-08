import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import DashboardHeader from '@/components/DashboardHeader';
import StatsGrid from '@/components/StatsGrid';
import AlertFilters from '@/components/AlertFilters';
import AlertCard from '@/components/AlertCard';
import AlertDetailDialog from '@/components/AlertDetailDialog';
import InstallPromptBanner from '@/components/InstallPromptBanner';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

type AlertType = 'all' | 'new_market' | 'new_wallet' | 'whale_bet' | 'price_imbalance';

const ALERTS_PER_PAGE = 20;

interface AlertDetails {
  eventTitle?: string;
  volume?: number;
  liquidity?: number;
  amount?: number;
  outcome?: string;
  yesPrice?: number;
  noPrice?: number;
  deviation?: number;
  walletAge?: string;
  tradeAmount?: number;
  [key: string]: unknown;
}

interface Alert {
  id: string;
  alert_type: string;
  market_id: string | null;
  market_question: string | null;
  details: AlertDetails;
  detected_at: string;
}

interface Profile {
  is_premium: boolean;
  trial_started_at: string;
}

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeFilter, setActiveFilter] = useState<AlertType>('all');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('profiles')
      .select('is_premium, trial_started_at')
      .eq('id', user.id)
      .single();
    
    if (error) {
      console.error('Error fetching profile:', error);
      return;
    }
    
    setProfile(data);
  }, [user]);

  const fetchAlerts = useCallback(async (page: number = 1) => {
    const from = (page - 1) * ALERTS_PER_PAGE;
    const to = from + ALERTS_PER_PAGE - 1;

    // Get total count
    const { count } = await supabase
      .from('market_alerts')
      .select('*', { count: 'exact', head: true });

    setTotalCount(count || 0);

    const { data, error } = await supabase
      .from('market_alerts')
      .select('*')
      .order('detected_at', { ascending: false })
      .range(from, to);
    
    if (error) {
      console.error('Error fetching alerts:', error);
      return;
    }
    
    setAlerts((data || []) as Alert[]);
    setLoading(false);
  }, []);

  const triggerSync = async () => {
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke('sync-polymarket');
      if (error) throw error;
      
      toast({
        title: "Sync complete",
        description: "Latest market data has been fetched.",
      });
      
      setCurrentPage(1);
      await fetchAlerts(1);
    } catch (error) {
      console.error('Sync error:', error);
      toast({
        title: "Sync failed",
        description: "Could not fetch latest data. Try again.",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: { email: user?.email }
      });
      
      if (error) throw error;
      
      if (data?.redirect_url) {
        window.location.href = data.redirect_url;
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast({
        title: "Payment error",
        description: "Could not initialize payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpgrading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchAlerts(currentPage);
    }
  }, [user, fetchProfile, currentPage]);

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('market-alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'market_alerts'
        },
        (payload) => {
          if (currentPage === 1) {
            setAlerts((prev) => [payload.new as Alert, ...prev.slice(0, ALERTS_PER_PAGE - 1)]);
          }
          setTotalCount((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isPremium = profile?.is_premium ?? false;
  const trialEndsAt = profile?.trial_started_at 
    ? new Date(new Date(profile.trial_started_at).getTime() + 48 * 60 * 60 * 1000)
    : null;

  const isTrialExpired = trialEndsAt ? new Date() > trialEndsAt : false;
  const hasAccess = isPremium || !isTrialExpired;

  const filteredAlerts = activeFilter === 'all' 
    ? alerts 
    : alerts.filter(a => a.alert_type === activeFilter);

  const totalPages = Math.ceil(totalCount / ALERTS_PER_PAGE);

  const stats = {
    newMarkets: alerts.filter(a => a.alert_type === 'new_market').length,
    newWallets: alerts.filter(a => a.alert_type === 'new_wallet').length,
    whaleBets: alerts.filter(a => a.alert_type === 'whale_bet').length,
    priceImbalances: alerts.filter(a => a.alert_type === 'price_imbalance').length,
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader 
        isPremium={isPremium} 
        trialEndsAt={trialEndsAt}
        onUpgrade={handleUpgrade}
        upgrading={upgrading}
      />

      <main className="container mx-auto px-4 py-6 space-y-6">
        <InstallPromptBanner />
        
        {!hasAccess && (
          <div className="glass-card p-6 border-destructive/50 text-center">
            <h2 className="text-lg font-semibold mb-2">Trial Expired</h2>
            <p className="text-muted-foreground mb-4">
              Upgrade to Premium to continue receiving real-time market alerts.
            </p>
            <Button variant="premium" onClick={handleUpgrade} disabled={upgrading}>
              {upgrading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Initializing...
                </>
              ) : (
                'Upgrade Now - $9.99/month (KES 1,000)'
              )}
            </Button>
          </div>
        )}

        {hasAccess && (
          <>
            <StatsGrid stats={stats} />

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <AlertFilters 
                activeFilter={activeFilter} 
                onFilterChange={setActiveFilter} 
              />
              <Button 
                variant="glass" 
                size="sm" 
                onClick={triggerSync}
                disabled={syncing}
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync Now'}
              </Button>
            </div>

            <div className="space-y-3">
              {filteredAlerts.length === 0 ? (
                <div className="glass-card p-8 text-center">
                  <p className="text-muted-foreground">
                    No alerts yet. Click "Sync Now" to fetch latest market data.
                  </p>
                </div>
              ) : (
                <>
                  {filteredAlerts.map((alert) => (
                    <AlertCard
                      key={alert.id}
                      alertType={alert.alert_type}
                      marketQuestion={alert.market_question ?? undefined}
                      details={alert.details}
                      detectedAt={alert.detected_at}
                      onClick={() => setSelectedAlert(alert)}
                    />
                  ))}
                </>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <Button
                  variant="glass"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "glass"}
                        size="sm"
                        className="w-9"
                        onClick={() => handlePageChange(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="glass"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                
                <span className="text-sm text-muted-foreground ml-2">
                  {totalCount} alerts
                </span>
              </div>
            )}
          </>
        )}
      </main>

      <AlertDetailDialog
        alert={selectedAlert}
        open={!!selectedAlert}
        onOpenChange={(open) => !open && setSelectedAlert(null)}
      />
    </div>
  );
};

export default Dashboard;
