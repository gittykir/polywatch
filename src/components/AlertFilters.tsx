import { Button } from '@/components/ui/button';
import { TrendingUp, Wallet, Fish, AlertTriangle } from 'lucide-react';

type AlertType = 'all' | 'new_market' | 'new_wallet' | 'whale_bet' | 'price_imbalance';

interface AlertFiltersProps {
  activeFilter: AlertType;
  onFilterChange: (filter: AlertType) => void;
}

const AlertFilters = ({ activeFilter, onFilterChange }: AlertFiltersProps) => {
  const filters: { type: AlertType; label: string; icon?: React.ComponentType<{ className?: string }> }[] = [
    { type: 'all', label: 'All' },
    { type: 'new_market', label: 'Markets', icon: TrendingUp },
    { type: 'new_wallet', label: 'Wallets', icon: Wallet },
    { type: 'whale_bet', label: 'Whales', icon: Fish },
    { type: 'price_imbalance', label: 'Imbalance', icon: AlertTriangle },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((filter) => (
        <Button
          key={filter.type}
          variant={activeFilter === filter.type ? 'default' : 'glass'}
          size="sm"
          onClick={() => onFilterChange(filter.type)}
          className="gap-1.5"
        >
          {filter.icon && <filter.icon className="h-3.5 w-3.5" />}
          {filter.label}
        </Button>
      ))}
    </div>
  );
};

export default AlertFilters;
