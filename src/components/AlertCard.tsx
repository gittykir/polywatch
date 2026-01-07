import { formatDistanceToNow } from 'date-fns';
import { TrendingUp, Wallet, Fish, AlertTriangle } from 'lucide-react';

interface AlertDetails {
  volume?: number;
  liquidity?: number;
  amount?: number;
  outcome?: string;
  yesPrice?: number;
  noPrice?: number;
  walletAge?: string;
  tradeAmount?: number;
  [key: string]: unknown;
}

interface AlertCardProps {
  alertType: string;
  marketQuestion?: string;
  details: AlertDetails;
  detectedAt: string;
  onClick?: () => void;
}

const alertConfig = {
  new_market: {
    icon: TrendingUp,
    badgeClass: 'alert-badge-new-market',
    label: 'New Market',
  },
  new_wallet: {
    icon: Wallet,
    badgeClass: 'alert-badge-new-wallet',
    label: 'New Wallet',
  },
  whale_bet: {
    icon: Fish,
    badgeClass: 'alert-badge-whale',
    label: 'Whale Bet',
  },
  price_imbalance: {
    icon: AlertTriangle,
    badgeClass: 'alert-badge-imbalance',
    label: 'Price Imbalance',
  },
};

const AlertCard = ({ alertType, marketQuestion, details, detectedAt, onClick }: AlertCardProps) => {
  const validAlertType = alertType as keyof typeof alertConfig;
  const config = alertConfig[validAlertType] || alertConfig.new_market;
  const Icon = config.icon;

  const formatDetails = () => {
    switch (alertType) {
      case 'new_market':
        return (
          <div className="space-y-1 text-sm">
            {details.volume && (
              <p><span className="text-muted-foreground">Volume:</span> ${Number(details.volume).toLocaleString()}</p>
            )}
            {details.liquidity && (
              <p><span className="text-muted-foreground">Liquidity:</span> ${Number(details.liquidity).toLocaleString()}</p>
            )}
          </div>
        );
      case 'whale_bet':
        return (
          <div className="space-y-1 text-sm">
            {details.amount && (
              <p><span className="text-muted-foreground">Amount:</span> ${Number(details.amount).toLocaleString()}</p>
            )}
            {details.outcome && (
              <p><span className="text-muted-foreground">Position:</span> {details.outcome}</p>
            )}
          </div>
        );
      case 'price_imbalance':
        return (
          <div className="space-y-1 text-sm">
            {details.yesPrice !== undefined && details.noPrice !== undefined && (
              <>
                <p><span className="text-muted-foreground">Yes:</span> {(details.yesPrice * 100).toFixed(1)}¢</p>
                <p><span className="text-muted-foreground">No:</span> {(details.noPrice * 100).toFixed(1)}¢</p>
                <p className="text-destructive font-medium">
                  Imbalance: {Math.abs(100 - (details.yesPrice + details.noPrice) * 100).toFixed(2)}¢
                </p>
              </>
            )}
          </div>
        );
      case 'new_wallet':
        return (
          <div className="space-y-1 text-sm">
            {details.walletAge && (
              <p><span className="text-muted-foreground">Wallet Age:</span> {details.walletAge}</p>
            )}
            {details.tradeAmount && (
              <p><span className="text-muted-foreground">Trade:</span> ${Number(details.tradeAmount).toLocaleString()}</p>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div 
      className="glass-card p-4 fade-in glow-border cursor-pointer hover:bg-muted/30 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`p-2 rounded-lg ${
            alertType === 'new_market' ? 'bg-primary/20' :
            alertType === 'whale_bet' ? 'bg-warning/20' :
            alertType === 'new_wallet' ? 'bg-success/20' :
            'bg-destructive/20'
          }`}>
            <Icon className={`h-4 w-4 ${
              alertType === 'new_market' ? 'text-primary' :
              alertType === 'whale_bet' ? 'text-warning' :
              alertType === 'new_wallet' ? 'text-success' :
              'text-destructive'
            }`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`alert-badge ${config.badgeClass}`}>
                {config.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(detectedAt), { addSuffix: true })}
              </span>
            </div>
            {marketQuestion && (
              <p className="font-medium text-sm mb-2 line-clamp-2">{marketQuestion}</p>
            )}
            {formatDetails()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlertCard;
