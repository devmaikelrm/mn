import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Eye, RefreshCw, Download } from "lucide-react";
import { useState } from "react";
import Header from "@/components/layout/header";
import { api, type UnlockRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function Requests() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: requests = [], isLoading, error } = useQuery({
    queryKey: ['/api/requests'],
    queryFn: () => api.getUnlockRequests(),
  });

  const checkStatusMutation = useMutation({
    mutationFn: (requestId: string) => api.checkRequestStatus(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/requests'] });
      toast({
        title: "Estado actualizado",
        description: "El estado de la solicitud se ha actualizado",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al verificar estado",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredRequests = requests.filter(request => {
    if (statusFilter === "all") return true;
    return request.status === statusFilter;
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      approved: { variant: "default" as const, className: "status-approved", text: "Aprobada" },
      pending: { variant: "secondary" as const, className: "status-pending", text: "Pendiente" },
      denied: { variant: "destructive" as const, className: "status-denied", text: "Denegada" },
      unknown: { variant: "outline" as const, className: "status-unknown", text: "Desconocido" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.unknown;
    
    return (
      <Badge variant={config.variant} className={config.className}>
        {config.text}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-MX');
  };

  const maskImei = (imei: string) => {
    return `${imei.substring(0, 6)}****${imei.substring(-4)}`;
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col">
        <Header title="Solicitudes" description="Cargando solicitudes..." />
        <main className="flex-1 p-6">
          <div className="flex items-center justify-center h-96">
            <div className="text-muted-foreground">Cargando solicitudes...</div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col">
        <Header title="Solicitudes" description="Error al cargar solicitudes" />
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
        title="Solicitudes" 
        description="Historial y gestión de solicitudes de desbloqueo"
      />
      
      <main className="flex-1 overflow-y-auto p-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-semibold text-foreground">
                Historial de Solicitudes
              </CardTitle>
              <div className="flex items-center space-x-3">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-48" data-testid="status-filter">
                    <SelectValue placeholder="Filtrar por estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="approved">Aprobadas</SelectItem>
                    <SelectItem value="pending">Pendientes</SelectItem>
                    <SelectItem value="denied">Denegadas</SelectItem>
                    <SelectItem value="unknown">Desconocido</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" data-testid="export-button">
                  <Download className="w-4 h-4 mr-2" />
                  Exportar
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredRequests.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {statusFilter === "all" 
                    ? "No hay solicitudes registradas" 
                    : `No hay solicitudes con estado: ${statusFilter}`
                  }
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Request ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        IMEI
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Fecha
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Vencimiento
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredRequests.map((request: UnlockRequest) => (
                      <tr key={request.id} className="hover:bg-muted/50" data-testid={`request-row-${request.id}`}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-foreground">
                          {request.requestId || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-muted-foreground">
                          {maskImei(request.imei)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(request.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          {formatDate(request.submittedAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          {request.deadlineAt ? formatDate(request.deadlineAt) : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            data-testid={`view-details-${request.id}`}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Ver
                          </Button>
                          {request.requestId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => checkStatusMutation.mutate(request.id)}
                              disabled={checkStatusMutation.isPending}
                              data-testid={`check-status-${request.id}`}
                            >
                              <RefreshCw className={`w-4 h-4 mr-1 ${checkStatusMutation.isPending ? 'animate-spin' : ''}`} />
                              Estado
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
