import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Activity, TrendingUp, Fish, AlertTriangle, Zap } from 'lucide-react';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  const features = [
    {
      icon: TrendingUp,
      title: 'New Markets',
      description: 'Get instant alerts when new prediction markets are created.',
    },
    {
      icon: Fish,
      title: 'Whale Detection',
      description: 'Track large bets and suspicious whale activity.',
    },
    {
      icon: AlertTriangle,
      title: 'Price Imbalances',
      description: 'Spot arbitrage opportunities when yes/no prices deviate >1%.',
    },
  ];

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-radial from-primary/10 via-transparent to-transparent" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-radial from-primary/5 to-transparent blur-3xl" />

      <div className="relative z-10">
        {/* Header */}
        <header className="container mx-auto px-4 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/20">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <span className="text-xl font-bold tracking-tight">PolyWatch</span>
          </div>
          <Button variant="glass" onClick={() => navigate('/auth')}>
            Sign In
          </Button>
        </header>

        {/* Hero */}
        <main className="container mx-auto px-4 pt-20 pb-32">
          <div className="max-w-3xl mx-auto text-center slide-up">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/20 border border-primary/30 text-primary text-sm mb-6">
              <Zap className="h-3.5 w-3.5" />
              Real-time Polymarket Intelligence
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              Never Miss a{' '}
              <span className="text-primary">Market Move</span>
            </h1>
            
            <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
              Track new markets, whale bets, and price imbalances on Polymarket. 
              Get alerts that matter, delivered in real-time.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="xl" onClick={() => navigate('/auth')}>
                Start Free Trial
              </Button>
              <p className="text-sm text-muted-foreground">
                48 hours free, then $9.99/month
              </p>
            </div>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 mt-24 max-w-4xl mx-auto">
            {features.map((feature, i) => (
              <div 
                key={feature.title} 
                className="glass-card p-6 glow-border fade-in"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="p-3 rounded-lg bg-primary/20 w-fit mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </main>

        {/* Footer */}
        <footer className="container mx-auto px-4 py-8 border-t border-border">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>© 2024 PolyWatch</span>
            <span>Powered by Polymarket data</span>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Index;
