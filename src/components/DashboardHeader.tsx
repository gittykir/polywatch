import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Activity, LogOut, Crown, Loader2 } from 'lucide-react';

interface DashboardHeaderProps {
  isPremium: boolean;
  trialEndsAt: Date | null;
  onUpgrade: () => void;
  upgrading?: boolean;
}

const DashboardHeader = ({ isPremium, trialEndsAt, onUpgrade, upgrading = false }: DashboardHeaderProps) => {
  const { signOut, user } = useAuth();

  const getTrialStatus = () => {
    if (isPremium) return null;
    if (!trialEndsAt) return null;
    
    const now = new Date();
    const diff = trialEndsAt.getTime() - now.getTime();
    
    if (diff <= 0) {
      return { expired: true, text: 'Trial expired' };
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return { expired: false, text: `${hours}h ${minutes}m remaining` };
  };

  const trialStatus = getTrialStatus();

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/20">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <span className="text-xl font-bold tracking-tight">PolyWatch</span>
          <div className="flex items-center gap-1.5 ml-2">
            <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
            <span className="text-xs text-muted-foreground">Live</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {trialStatus && !isPremium && (
            <div className="flex items-center gap-3">
              <span className={`text-sm ${trialStatus.expired ? 'text-destructive' : 'text-muted-foreground'}`}>
                {trialStatus.text}
              </span>
              <Button variant="premium" size="sm" onClick={onUpgrade} disabled={upgrading}>
                {upgrading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Crown className="h-4 w-4" />
                )}
                {upgrading ? 'Processing...' : 'Upgrade'}
              </Button>
            </div>
          )}
          
          {isPremium && (
            <span className="flex items-center gap-1.5 text-sm text-primary">
              <Crown className="h-4 w-4" />
              Premium
            </span>
          )}

          <span className="text-sm text-muted-foreground hidden sm:block">
            {user?.email}
          </span>

          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
