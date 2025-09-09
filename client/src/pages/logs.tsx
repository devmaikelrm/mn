import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, Download } from "lucide-react";
import { useState } from "react";
import Header from "@/components/layout/header";
import { api, type SystemLog } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function Logs() {
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [limitFilter, setLimitFilter] = useState<string>("100");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: logs = [], isLoading, error } = useQuery({
    queryKey: ['/api/logs', limitFilter, levelFilter === "all" ? undefined : levelFilter],
    queryFn: () => api.getLogs(
      parseInt(limitFilter), 
      levelFilter === "all" ? undefined : levelFilter
    ),
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const clearLogsMutation = useMutation({
    mutationFn: () => api.clearLogs(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/logs'] });
      toast({
        title: "Logs eliminados",
        description: "Todos los logs del sistema han sido eliminados",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al eliminar logs",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getLevelBadge = (level: string) => {
    const levelConfig = {
      error: { variant: "destructive" as const, emoji: "🔴", text: "ERROR" },
      warn: { variant: "secondary" as const, emoji: "🟡", text: "WARN" },
      info: { variant: "default" as const, emoji: "🔵", text: "INFO" },
      debug: { variant: "outline" as const, emoji: "⚪", text: "DEBUG" },
    };

    const config = levelConfig[level as keyof typeof levelConfig] || levelConfig.info;
    
    return (
      <Badge variant={config.variant} className="font-mono text-xs">
        {config.emoji} {config.text}
      </Badge>
    );
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('es-MX', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return `hace ${diffInSeconds}s`;
    if (diffInSeconds < 3600) return `hace ${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `hace ${Math.floor(diffInSeconds / 3600)}h`;
    return `hace ${Math.floor(diffInSeconds / 86400)}d`;
  };

  const exportLogs = () => {
    const csvContent = [
      ['Timestamp', 'Level', 'Source', 'Message', 'Request ID'].join(','),
      ...logs.map(log => [
        log.timestamp,
        log.level,
        log.source,
        `"${log.message.replace(/"/g, '""')}"`,
        log.requestId || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `att-bot-logs-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Logs exportados",
      description: "Los logs se han descargado en formato CSV",
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col">
        <Header title="Logs" description="Cargando logs del sistema..." />
        <main className="flex-1 p-6">
          <div className="flex items-center justify-center h-96">
            <div className="text-muted-foreground">Cargando logs...</div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col">
        <Header title="Logs" description="Error al cargar logs" />
        <main className="flex-1 p-6">
          <div className="flex items-center justify-center h-96">
            <div className="text-destructive">Error: {error.message}</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <Header 
        title="Logs" 
        description="Monitoreo y registro de actividad del sistema"
      />
      
      <main className="flex-1 overflow-y-auto p-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-semibold text-foreground">
                Logs del Sistema
              </CardTitle>
              <div className="flex items-center space-x-3">
                <Select value={levelFilter} onValueChange={setLevelFilter}>
                  <SelectTrigger className="w-40" data-testid="level-filter">
                    <SelectValue placeholder="Nivel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los niveles</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                    <SelectItem value="warn">Warning</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="debug">Debug</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={limitFilter} onValueChange={setLimitFilter}>
                  <SelectTrigger className="w-32" data-testid="limit-filter">
                    <SelectValue placeholder="Límite" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="250">250</SelectItem>
                    <SelectItem value="500">500</SelectItem>
                  </SelectContent>
                </Select>

                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={exportLogs}
                  data-testid="export-logs-button"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Exportar
                </Button>
                
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => clearLogsMutation.mutate()}
                  disabled={clearLogsMutation.isPending}
                  data-testid="clear-logs-button"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Limpiar
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  No hay logs disponibles con los filtros seleccionados
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto bg-muted rounded-lg p-4 font-mono text-sm">
                {logs.map((log: SystemLog) => (
                  <div 
                    key={log.id} 
                    className="flex items-start space-x-4 py-2 border-b border-border/50 last:border-b-0"
                    data-testid={`log-entry-${log.id}`}
                  >
                    <div className="flex-shrink-0 text-xs text-muted-foreground min-w-[140px]">
                      {formatTimestamp(log.timestamp)}
                    </div>
                    
                    <div className="flex-shrink-0">
                      {getLevelBadge(log.level)}
                    </div>
                    
                    <div className="flex-shrink-0 text-xs text-muted-foreground min-w-[100px]">
                      [{log.source}]
                    </div>
                    
                    <div className="flex-1 text-foreground break-words">
                      {log.message}
                      {log.requestId && (
                        <span className="ml-2 text-xs text-primary">
                          (Request: {log.requestId})
                        </span>
                      )}
                    </div>
                    
                    <div className="flex-shrink-0 text-xs text-muted-foreground">
                      {getTimeAgo(log.timestamp)}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {logs.length > 0 && (
              <div className="mt-4 text-xs text-muted-foreground text-center">
                Mostrando {logs.length} entradas • Actualización automática cada 5 segundos
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
