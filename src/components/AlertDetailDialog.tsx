import { formatDistanceToNow, format } from 'date-fns';
import { TrendingUp, Wallet, Fish, AlertTriangle, ExternalLink, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

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

interface AlertDetailDialogProps {
  alert: Alert | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const alertConfig = {
  new_market: {
    icon: TrendingUp,
    label: 'New Market',
    color: 'text-primary',
    bgColor: 'bg-primary/20',
  },
  new_wallet: {
    icon: Wallet,
    label: 'New Wallet',
    color: 'text-success',
    bgColor: 'bg-success/20',
  },
  whale_bet: {
    icon: Fish,
    label: 'Whale Bet',
    color: 'text-warning',
    bgColor: 'bg-warning/20',
  },
  price_imbalance: {
    icon: AlertTriangle,
    label: 'Price Imbalance',
    color: 'text-destructive',
    bgColor: 'bg-destructive/20',
  },
};

const AlertDetailDialog = ({ alert, open, onOpenChange }: AlertDetailDialogProps) => {
  if (!alert) return null;

  const validAlertType = alert.alert_type as keyof typeof alertConfig;
  const config = alertConfig[validAlertType] || alertConfig.new_market;
  const Icon = config.icon;
  const details = alert.details;

  const polymarketUrl = alert.market_id 
    ? `https://polymarket.com/event/${alert.market_id}`
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg glass-card border-border/50">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl ${config.bgColor}`}>
              <Icon className={`h-6 w-6 ${config.color}`} />
            </div>
            <div>
              <span className={`text-xs font-medium uppercase tracking-wide ${config.color}`}>
                {config.label}
              </span>
              <DialogTitle className="text-lg font-semibold mt-1">
                {alert.market_question || 'Market Alert'}
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Timing info */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Detected</span>
            <span>
              {format(new Date(alert.detected_at), 'MMM d, yyyy h:mm a')}
              <span className="text-muted-foreground ml-2">
                ({formatDistanceToNow(new Date(alert.detected_at), { addSuffix: true })})
              </span>
            </span>
          </div>

          <Separator />

          {/* Market details based on type */}
          <div className="space-y-3">
            {details.eventTitle && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Event</span>
                <span className="font-medium">{details.eventTitle}</span>
              </div>
            )}

            {details.volume !== undefined && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Volume</span>
                <span className="font-medium text-success">
                  ${Number(details.volume).toLocaleString()}
                </span>
              </div>
            )}

            {details.liquidity !== undefined && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Liquidity</span>
                <span className="font-medium">
                  ${Number(details.liquidity).toLocaleString()}
                </span>
              </div>
            )}

            {details.yesPrice !== undefined && details.noPrice !== undefined && (
              <>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div className="glass-card p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">YES Price</p>
                    <p className="text-2xl font-bold text-success">
                      {(details.yesPrice * 100).toFixed(1)}¢
                    </p>
                  </div>
                  <div className="glass-card p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">NO Price</p>
                    <p className="text-2xl font-bold text-destructive">
                      {(details.noPrice * 100).toFixed(1)}¢
                    </p>
                  </div>
                </div>
                {details.deviation !== undefined && (
                  <div className="glass-card p-3 text-center border-destructive/30">
                    <p className="text-xs text-muted-foreground mb-1">Price Deviation</p>
                    <p className="text-xl font-bold text-destructive">
                      {details.deviation.toFixed(2)}%
                    </p>
                  </div>
                )}
              </>
            )}

            {details.amount !== undefined && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Bet Amount</span>
                <span className="font-medium text-warning">
                  ${Number(details.amount).toLocaleString()}
                </span>
              </div>
            )}

            {details.outcome && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Position</span>
                <span className={`font-bold ${details.outcome === 'YES' ? 'text-success' : 'text-destructive'}`}>
                  {details.outcome}
                </span>
              </div>
            )}

            {details.walletAge && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Wallet Age</span>
                <span className="font-medium">{details.walletAge}</span>
              </div>
            )}

            {details.tradeAmount !== undefined && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Trade Amount</span>
                <span className="font-medium">
                  ${Number(details.tradeAmount).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Market ID */}
          {alert.market_id && (
            <>
              <Separator />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Market ID</span>
                <code className="text-xs bg-muted px-2 py-1 rounded">
                  {alert.market_id.slice(0, 16)}...
                </code>
              </div>
            </>
          )}

          {/* Actions */}
          {polymarketUrl && (
            <>
              <Separator />
              <Button 
                variant="glass" 
                className="w-full" 
                onClick={() => window.open(polymarketUrl, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View on Polymarket
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AlertDetailDialog;