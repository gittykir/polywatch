import { TrendingUp, Wallet, Fish, AlertTriangle } from 'lucide-react';

interface StatsGridProps {
  stats: {
    newMarkets: number;
    newWallets: number;
    whaleBets: number;
    priceImbalances: number;
  };
}

const StatsGrid = ({ stats }: StatsGridProps) => {
  const statItems = [
    {
      label: 'New Markets',
      value: stats.newMarkets,
      icon: TrendingUp,
      color: 'text-primary',
      bg: 'bg-primary/20',
    },
    {
      label: 'New Wallets',
      value: stats.newWallets,
      icon: Wallet,
      color: 'text-success',
      bg: 'bg-success/20',
    },
    {
      label: 'Whale Bets',
      value: stats.whaleBets,
      icon: Fish,
      color: 'text-warning',
      bg: 'bg-warning/20',
    },
    {
      label: 'Price Imbalances',
      value: stats.priceImbalances,
      icon: AlertTriangle,
      color: 'text-destructive',
      bg: 'bg-destructive/20',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {statItems.map((item) => (
        <div key={item.label} className="stat-card">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${item.bg}`}>
              <item.icon className={`h-5 w-5 ${item.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold">{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatsGrid;
