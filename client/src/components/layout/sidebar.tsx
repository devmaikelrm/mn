import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  FileText, 
  Plus, 
  ScrollText, 
  Settings,
  Smartphone
} from "lucide-react";

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Solicitudes', href: '/requests', icon: FileText },
  { name: 'Nueva Solicitud', href: '/submit', icon: Plus },
  { name: 'Logs', href: '/logs', icon: ScrollText },
  { name: 'Configuración', href: '/config', icon: Settings },
];

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="w-64 bg-card border-r border-border flex flex-col">
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-2">
          <Smartphone className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">AT&T Unlock Bot</h1>
            <p className="text-sm text-muted-foreground">Panel de Control</p>
          </div>
        </div>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        {navigation.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;
          
          return (
            <Link key={item.name} href={item.href}>
              <a 
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
                data-testid={`nav-link-${item.name.toLowerCase().replace(' ', '-')}`}
              >
                <Icon className="w-4 h-4 mr-3" />
                {item.name}
              </a>
            </Link>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-border">
        <div className="flex items-center space-x-3">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-sm text-muted-foreground">Bot Activo</span>
        </div>
      </div>
    </div>
  );
}
