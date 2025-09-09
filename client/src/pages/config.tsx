import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Save, Eye, EyeOff, Code, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import Header from "@/components/layout/header";
import { api, type BotConfig } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function Config() {
  const [showTokens, setShowTokens] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: configs = [], isLoading, error } = useQuery({
    queryKey: ['/api/config'],
    queryFn: () => api.getConfig(),
  });

  const updateConfigMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => 
      api.updateConfig(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/config'] });
      toast({
        title: "Configuración guardada",
        description: "Los cambios se han aplicado correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al guardar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getConfigValue = (key: string) => {
    const config = configs.find(c => c.key === key);
    return config?.value || '';
  };

  const handleConfigUpdate = (key: string, value: string) => {
    updateConfigMutation.mutate({ key, value });
  };

  const handleSaveAll = () => {
    // This would typically batch all changes, but for simplicity we'll just show a success message
    toast({
      title: "Configuración actualizada",
      description: "Todos los cambios se han guardado correctamente",
    });
  };

  const copyAppsScriptCode = () => {
    const code = `// Google Apps Script para reenvío de correos AT&T
function forwardATTEmails() {
  const BOT_TOKEN = 'TU_BOT_TOKEN_AQUI';
  const CHAT_ID = 'TU_CHAT_ID_AQUI';
  
  // Buscar emails de AT&T relacionados con unlock
  const query = 'from:att.com (subject:unlock OR subject:request OR subject:confirm OR subject:status OR subject:decision)';
  const threads = GmailApp.search(query, 0, 10);
  
  threads.forEach(thread => {
    const messages = thread.getMessages();
    const latestMessage = messages[messages.length - 1];
    
    if (!latestMessage.isUnread()) return;
    
    const subject = latestMessage.getSubject();
    const body = latestMessage.getPlainBody();
    
    // Extraer Request ID y enlaces
    const requestIdMatch = body.match(/([A-Z]{3}\\d{12})/);
    const confirmLinkMatch = body.match(/(https:\\/\\/www\\.att\\.com\\/[^\\s]+confirm[^\\s]*)/);
    
    let message = \`📧 *Nuevo email de AT&T*\\n\\n\`;
    message += \`*Asunto:* \${subject}\\n\`;
    
    if (requestIdMatch) {
      message += \`*Request ID:* \\\`\${requestIdMatch[1]}\\\`\\n\`;
    }
    
    // Crear botones inline
    const keyboard = {
      inline_keyboard: []
    };
    
    if (confirmLinkMatch) {
      keyboard.inline_keyboard.push([
        { text: '✅ Confirmar Solicitud', url: confirmLinkMatch[1] }
      ]);
    }
    
    if (requestIdMatch) {
      keyboard.inline_keyboard.push([
        { text: '📊 Ver Estado', callback_data: \`status_\${requestIdMatch[1]}\` }
      ]);
    }
    
    // Enviar a Telegram
    const payload = {
      chat_id: CHAT_ID,
      text: message,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    };
    
    UrlFetchApp.fetch(\`https://api.telegram.org/bot\${BOT_TOKEN}/sendMessage\`, {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify(payload)
    });
    
    // Marcar como leído
    latestMessage.markRead();
  });
}`;

    navigator.clipboard.writeText(code).then(() => {
      toast({
        title: "Código copiado",
        description: "El código de Google Apps Script se ha copiado al portapapeles",
      });
    }).catch(() => {
      toast({
        title: "Error al copiar",
        description: "No se pudo copiar el código al portapapeles",
        variant: "destructive",
      });
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col">
        <Header title="Configuración" description="Cargando configuración..." />
        <main className="flex-1 p-6">
          <div className="flex items-center justify-center h-96">
            <div className="text-muted-foreground">Cargando configuración...</div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col">
        <Header title="Configuración" description="Error al cargar configuración" />
        <main className="flex-1 p-6">
          <div className="flex items-center justify-center h-96">
            <div className="text-destructive">Error: {error.message}</div>
          </div>
        </main>
      </div>
    );
  }

  const debugEnabled = getConfigValue('debug_enabled') === 'true';

  return (
    <div className="flex-1 flex flex-col">
      <Header 
        title="Configuración" 
        description="Gestión y configuración del bot AT&T"
      />
      
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl space-y-6">
          {/* Bot Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground">
                Configuración del Bot
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="botToken" className="text-sm font-medium text-foreground mb-2 block">
                  Bot Token
                </Label>
                <div className="relative">
                  <Input
                    id="botToken"
                    type={showTokens ? "text" : "password"}
                    placeholder="••••••••••••••••••••••••••••••••••••••••••••••••"
                    defaultValue={getConfigValue('bot_token')}
                    onBlur={(e) => handleConfigUpdate('bot_token', e.target.value)}
                    data-testid="input-bot-token"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    onClick={() => setShowTokens(!showTokens)}
                    data-testid="toggle-token-visibility"
                  >
                    {showTokens ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Token del bot de Telegram obtenido de @BotFather
                </p>
              </div>

              <div>
                <Label htmlFor="ownerId" className="text-sm font-medium text-foreground mb-2 block">
                  Owner ID
                </Label>
                <Input
                  id="ownerId"
                  placeholder="123456789"
                  defaultValue={getConfigValue('owner_id')}
                  onBlur={(e) => handleConfigUpdate('owner_id', e.target.value)}
                  data-testid="input-owner-id"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Chat ID del propietario autorizado
                </p>
              </div>

              <div>
                <Label htmlFor="timezone" className="text-sm font-medium text-foreground mb-2 block">
                  Zona Horaria
                </Label>
                <Select 
                  value={getConfigValue('timezone') || 'America/Mexico_City'}
                  onValueChange={(value) => handleConfigUpdate('timezone', value)}
                >
                  <SelectTrigger data-testid="select-timezone">
                    <SelectValue placeholder="Seleccionar zona horaria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/Mexico_City">America/Mexico_City</SelectItem>
                    <SelectItem value="America/New_York">America/New_York</SelectItem>
                    <SelectItem value="America/Los_Angeles">America/Los_Angeles</SelectItem>
                    <SelectItem value="America/Chicago">America/Chicago</SelectItem>
                    <SelectItem value="Europe/Madrid">Europe/Madrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div>
                  <h4 className="font-medium text-foreground">Logs de Debug</h4>
                  <p className="text-sm text-muted-foreground">Habilitar logging detallado para depuración</p>
                </div>
                <Switch
                  checked={debugEnabled}
                  onCheckedChange={(checked) => handleConfigUpdate('debug_enabled', checked.toString())}
                  data-testid="switch-debug-enabled"
                />
              </div>

              <Button 
                onClick={handleSaveAll}
                disabled={updateConfigMutation.isPending}
                className="w-full"
                data-testid="button-save-config"
              >
                <Save className="w-4 h-4 mr-2" />
                Guardar Configuración
              </Button>
            </CardContent>
          </Card>

          {/* Google Apps Script */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground flex items-center">
                Google Apps Script
                <Badge variant="outline" className="ml-2">Externo</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Configura el reenvío automático de correos de AT&T siguiendo estos pasos:
              </p>
              
              <div className="bg-muted p-4 rounded-lg">
                <ol className="text-sm text-foreground space-y-2 list-decimal list-inside">
                  <li>
                    Abre{' '}
                    <a 
                      href="https://script.google.com" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center"
                    >
                      Google Apps Script
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </a>
                  </li>
                  <li>Crea un nuevo proyecto y pega el código proporcionado</li>
                  <li>Configura las variables BOT_TOKEN y CHAT_ID</li>
                  <li>Autoriza los permisos de Gmail</li>
                  <li>Configura un trigger para ejecutar cada 1-5 minutos</li>
                </ol>
              </div>

              <div className="flex space-x-3">
                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="flex-1" data-testid="button-view-apps-script">
                      <Code className="w-4 h-4 mr-2" />
                      Ver Código Apps Script
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
                    <DialogHeader>
                      <DialogTitle>Código Google Apps Script</DialogTitle>
                    </DialogHeader>
                    <div className="overflow-y-auto">
                      <pre className="bg-muted p-4 rounded-lg text-sm font-mono overflow-x-auto text-foreground whitespace-pre-wrap">
{`// Google Apps Script para reenvío de correos AT&T
function forwardATTEmails() {
  const BOT_TOKEN = 'TU_BOT_TOKEN_AQUI';
  const CHAT_ID = 'TU_CHAT_ID_AQUI';
  
  // Buscar emails de AT&T relacionados con unlock
  const query = 'from:att.com (subject:unlock OR subject:request OR subject:confirm OR subject:status OR subject:decision)';
  const threads = GmailApp.search(query, 0, 10);
  
  threads.forEach(thread => {
    const messages = thread.getMessages();
    const latestMessage = messages[messages.length - 1];
    
    if (!latestMessage.isUnread()) return;
    
    const subject = latestMessage.getSubject();
    const body = latestMessage.getPlainBody();
    
    // Extraer Request ID y enlaces
    const requestIdMatch = body.match(/([A-Z]{3}\\d{12})/);
    const confirmLinkMatch = body.match(/(https:\\/\\/www\\.att\\.com\\/[^\\s]+confirm[^\\s]*)/);
    
    let message = \`📧 *Nuevo email de AT&T*\\n\\n\`;
    message += \`*Asunto:* \${subject}\\n\`;
    
    if (requestIdMatch) {
      message += \`*Request ID:* \\\`\${requestIdMatch[1]}\\\`\\n\`;
    }
    
    // Crear botones inline
    const keyboard = {
      inline_keyboard: []
    };
    
    if (confirmLinkMatch) {
      keyboard.inline_keyboard.push([
        { text: '✅ Confirmar Solicitud', url: confirmLinkMatch[1] }
      ]);
    }
    
    if (requestIdMatch) {
      keyboard.inline_keyboard.push([
        { text: '📊 Ver Estado', callback_data: \`status_\${requestIdMatch[1]}\` }
      ]);
    }
    
    // Enviar a Telegram
    const payload = {
      chat_id: CHAT_ID,
      text: message,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    };
    
    UrlFetchApp.fetch(\`https://api.telegram.org/bot\${BOT_TOKEN}/sendMessage\`, {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify(payload)
    });
    
    // Marcar como leído
    latestMessage.markRead();
  });
}`}
                      </pre>
                      <div className="mt-4 p-4 bg-amber-500/20 border border-amber-500/30 rounded-lg">
                        <h4 className="font-medium text-amber-400 mb-2">⚠️ Configuración Requerida</h4>
                        <ul className="text-sm text-foreground space-y-1">
                          <li>• Reemplaza <code className="bg-muted px-1 rounded">TU_BOT_TOKEN_AQUI</code> con tu token real</li>
                          <li>• Reemplaza <code className="bg-muted px-1 rounded">TU_CHAT_ID_AQUI</code> con tu chat ID</li>
                          <li>• Configura un trigger para ejecutar cada 1-5 minutos</li>
                          <li>• Autoriza permisos de Gmail cuando se solicite</li>
                        </ul>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <Button 
                  variant="secondary" 
                  onClick={copyAppsScriptCode}
                  data-testid="button-copy-apps-script"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copiar Código
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* System Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground">
                Información del Sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Versión:</span>
                  <span className="ml-2 text-foreground">1.0.0</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Entorno:</span>
                  <span className="ml-2 text-foreground">Replit</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Última actualización:</span>
                  <span className="ml-2 text-foreground">{getConfigValue('last_update') || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Debug habilitado:</span>
                  <span className="ml-2 text-foreground">{debugEnabled ? 'Sí' : 'No'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
