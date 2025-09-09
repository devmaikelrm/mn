import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  FileText, 
  CheckCircle, 
  Clock, 
  XCircle, 
  Smartphone, 
  Globe, 
  Bot,
  FileSearch
} from "lucide-react";
import Header from "@/components/layout/header";
import { api } from "@/lib/api";

export default function Dashboard() {
  const { data: dashboardData, isLoading, error } = useQuery({
    queryKey: ['/api/dashboard/stats'],
    queryFn: () => api.getDashboardStats(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'hace unos segundos';
    if (diffInMinutes < 60) return `hace ${diffInMinutes} min`;
    if (diffInMinutes < 1440) return `hace ${Math.floor(diffInMinutes / 60)} horas`;
    return `hace ${Math.floor(diffInMinutes / 1440)} días`;
  };

  const getStatusIcon = (level: string) => {
    switch (level) {
      case 'error': return '🔴';
      case 'warn': return '🟡';
      case 'info': return '🔵';
      case 'debug': return '⚪';
      default: return '⚪';
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col">
        <Header title="Dashboard" description="Cargando datos..." />
        <main className="flex-1 p-6">
          <div className="flex items-center justify-center h-96">
            <div className="text-muted-foreground">Cargando...</div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col">
        <Header title="Dashboard" description="Error al cargar datos" />
        <main className="flex-1 p-6">
          <div className="flex items-center justify-center h-96">
            <div className="text-destructive">Error: {error.message}</div>
          </div>
        </main>
      </div>
    );
  }

  const stats = dashboardData?.stats || { total: 0, approved: 0, pending: 0, denied: 0, unknown: 0 };
  const recentRequests = dashboardData?.recentRequests || [];
  const recentActivity = dashboardData?.recentActivity || [];

  const lastUpdate = recentActivity.length > 0 
    ? formatTimeAgo(recentActivity[0].timestamp)
    : 'No disponible';

  return (
    <div className="flex-1 flex flex-col">
      <Header 
        title="Dashboard" 
        description="Monitoreo y gestión del bot de desbloqueo"
        lastUpdate={lastUpdate}
      />
      
      <main className="flex-1 overflow-y-auto p-6">
        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card data-testid="card-total-requests">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Solicitudes Totales</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="total-requests">
                    {stats.total}
                  </p>
                </div>
                <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-approved-requests">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Aprobadas</p>
                  <p className="text-2xl font-bold text-green-400" data-testid="approved-requests">
                    {stats.approved}
                  </p>
                </div>
                <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-pending-requests">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pendientes</p>
                  <p className="text-2xl font-bold text-amber-400" data-testid="pending-requests">
                    {stats.pending}
                  </p>
                </div>
                <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-denied-requests">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Denegadas</p>
                  <p className="text-2xl font-bold text-red-400" data-testid="denied-requests">
                    {stats.denied}
                  </p>
                </div>
                <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card data-testid="card-recent-activity">
            <CardHeader>
              <CardTitle className="font-semibold text-foreground">Actividad Reciente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No hay actividad reciente
                  </div>
                ) : (
                  recentActivity.slice(0, 5).map((activity, index) => (
                    <div key={activity.id} className="flex items-start space-x-3" data-testid={`activity-${index}`}>
                      <div className="text-sm mt-1">
                        {getStatusIcon(activity.level)}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-foreground">{activity.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatTimeAgo(activity.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-system-status">
            <CardHeader>
              <CardTitle className="font-semibold text-foreground">Estado del Sistema</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between" data-testid="status-telegram-bot">
                  <span className="text-sm text-muted-foreground flex items-center">
                    <Bot className="w-4 h-4 mr-2" />
                    Bot de Telegram
                  </span>
                  <span className="inline-flex items-center px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded-full">
                    ● Activo
                  </span>
                </div>
                
                <div className="flex items-center justify-between" data-testid="status-browser">
                  <span className="text-sm text-muted-foreground flex items-center">
                    <Globe className="w-4 h-4 mr-2" />
                    Navegador Headless
                  </span>
                  <span className="inline-flex items-center px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded-full">
                    ● Disponible
                  </span>
                </div>
                
                <div className="flex items-center justify-between" data-testid="status-att-portal">
                  <span className="text-sm text-muted-foreground flex items-center">
                    <Smartphone className="w-4 h-4 mr-2" />
                    Portal AT&T
                  </span>
                  <span className="inline-flex items-center px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded-full">
                    ● Operativo
                  </span>
                </div>
                
                <div className="flex items-center justify-between" data-testid="status-apps-script">
                  <span className="text-sm text-muted-foreground flex items-center">
                    <FileSearch className="w-4 h-4 mr-2" />
                    Apps Script
                  </span>
                  <span className="inline-flex items-center px-2 py-1 text-xs bg-amber-500/20 text-amber-400 rounded-full">
                    ● Configurar
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
