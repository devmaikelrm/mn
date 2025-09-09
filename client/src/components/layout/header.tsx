import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface HeaderProps {
  title: string;
  description: string;
  lastUpdate?: string;
}

export default function Header({ title, description, lastUpdate }: HeaderProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const refreshMutation = useMutation({
    mutationFn: () => api.updateActivity(),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({
        title: "Datos actualizados",
        description: "La información se ha actualizado correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al actualizar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <header className="bg-card border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center space-x-4">
          {lastUpdate && (
            <div className="text-sm text-muted-foreground">
              Última actualización: <span data-testid="last-update">{lastUpdate}</span>
            </div>
          )}
          <Button 
            size="sm" 
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            data-testid="refresh-button"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </div>
    </header>
  );
}
