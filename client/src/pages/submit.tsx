import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Send, AlertTriangle } from "lucide-react";
import Header from "@/components/layout/header";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  requestType: z.enum(["withNumber", "withoutNumber"]),
  phoneNumber: z.string().optional(),
  imei: z.string().regex(/^\d{15}$/, "IMEI debe tener 15 dígitos"),
  firstName: z.string().min(1, "Nombre es requerido"),
  lastName: z.string().min(1, "Apellido es requerido"),
  email: z.string().email("Email inválido"),
}).refine((data) => {
  if (data.requestType === "withNumber" && !data.phoneNumber) {
    return false;
  }
  if (data.phoneNumber && !/^\d{10}$/.test(data.phoneNumber)) {
    return false;
  }
  return true;
}, {
  message: "Número AT&T debe tener 10 dígitos cuando se selecciona 'Con número AT&T'",
  path: ["phoneNumber"],
});

type FormData = z.infer<typeof formSchema>;

export default function Submit() {
  const [requestType, setRequestType] = useState<"withNumber" | "withoutNumber">("withNumber");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      requestType: "withNumber",
      phoneNumber: "",
      imei: "",
      firstName: "",
      lastName: "",
      email: "",
    },
  });

  const submitMutation = useMutation({
    mutationFn: (data: FormData) => {
      const submitData = {
        imei: data.imei,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        ...(data.requestType === "withNumber" && data.phoneNumber && {
          phoneNumber: data.phoneNumber
        })
      };
      return api.createUnlockRequest(submitData);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      
      form.reset();
      
      if (result.submissionResult.success) {
        toast({
          title: "✅ Solicitud enviada exitosamente",
          description: result.submissionResult.requestId 
            ? `Request ID: ${result.submissionResult.requestId}`
            : "La solicitud se procesó correctamente",
        });
      } else if (result.submissionResult.captchaDetected) {
        toast({
          title: "🔐 CAPTCHA Detectado",
          description: "Se requiere intervención manual. Intente más tarde.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "❌ Error en la solicitud",
          description: result.submissionResult.errorMessage || "Error desconocido",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    submitMutation.mutate(data);
  };

  return (
    <div className="flex-1 flex flex-col">
      <Header 
        title="Nueva Solicitud" 
        description="Crear una nueva solicitud de desbloqueo AT&T"
      />
      
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground">
                Nueva Solicitud de Desbloqueo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Request Type Selection */}
                <div className="space-y-4">
                  <Label className="text-sm font-medium text-foreground">
                    Tipo de Solicitud
                  </Label>
                  <RadioGroup
                    value={requestType}
                    onValueChange={(value: "withNumber" | "withoutNumber") => {
                      setRequestType(value);
                      form.setValue("requestType", value);
                      if (value === "withoutNumber") {
                        form.setValue("phoneNumber", "");
                      }
                    }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                  >
                    <div className="flex items-center space-x-2 p-4 border border-border rounded-lg cursor-pointer hover:bg-accent">
                      <RadioGroupItem value="withNumber" id="withNumber" data-testid="radio-with-number" />
                      <Label htmlFor="withNumber" className="cursor-pointer flex-1">
                        <div className="font-medium text-foreground">Con número AT&T</div>
                        <div className="text-sm text-muted-foreground">Tengo número AT&T activo</div>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 p-4 border border-border rounded-lg cursor-pointer hover:bg-accent">
                      <RadioGroupItem value="withoutNumber" id="withoutNumber" data-testid="radio-without-number" />
                      <Label htmlFor="withoutNumber" className="cursor-pointer flex-1">
                        <div className="font-medium text-foreground">Sin número</div>
                        <div className="text-sm text-muted-foreground">No tengo número AT&T</div>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Phone Number and IMEI */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber" className="text-sm font-medium text-foreground">
                      Número AT&T {requestType === "withNumber" && <span className="text-red-500">*</span>}
                      {requestType === "withoutNumber" && <span className="text-muted-foreground">(opcional)</span>}
                    </Label>
                    <Input
                      id="phoneNumber"
                      placeholder="1234567890"
                      {...form.register("phoneNumber")}
                      disabled={requestType === "withoutNumber"}
                      data-testid="input-phone-number"
                    />
                    <p className="text-xs text-muted-foreground">10 dígitos sin espacios</p>
                    {form.formState.errors.phoneNumber && (
                      <p className="text-xs text-destructive">{form.formState.errors.phoneNumber.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="imei" className="text-sm font-medium text-foreground">
                      IMEI <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="imei"
                      placeholder="353012345678901"
                      {...form.register("imei")}
                      data-testid="input-imei"
                    />
                    <p className="text-xs text-muted-foreground">15 dígitos</p>
                    {form.formState.errors.imei && (
                      <p className="text-xs text-destructive">{form.formState.errors.imei.message}</p>
                    )}
                  </div>
                </div>

                {/* Name Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-sm font-medium text-foreground">
                      Nombre <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="firstName"
                      placeholder="Juan"
                      {...form.register("firstName")}
                      data-testid="input-first-name"
                    />
                    {form.formState.errors.firstName && (
                      <p className="text-xs text-destructive">{form.formState.errors.firstName.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-sm font-medium text-foreground">
                      Apellido <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="lastName"
                      placeholder="Pérez"
                      {...form.register("lastName")}
                      data-testid="input-last-name"
                    />
                    {form.formState.errors.lastName && (
                      <p className="text-xs text-destructive">{form.formState.errors.lastName.message}</p>
                    )}
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-foreground">
                    Correo Electrónico <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="juan.perez@email.com"
                    {...form.register("email")}
                    data-testid="input-email"
                  />
                  <p className="text-xs text-muted-foreground">
                    Aquí recibirás las notificaciones de AT&T
                  </p>
                  {form.formState.errors.email && (
                    <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                  )}
                </div>

                {/* Information Alert */}
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Información Importante:</strong>
                    <ul className="mt-2 space-y-1 text-sm">
                      <li>• El proceso puede tomar hasta 24 horas</li>
                      <li>• Recibirás confirmación por correo electrónico</li>
                      <li>• Si aparece CAPTCHA, se requerirá intervención manual</li>
                      <li>• Los datos no se almacenan permanentemente</li>
                    </ul>
                  </AlertDescription>
                </Alert>

                {/* Submit Actions */}
                <div className="flex justify-end space-x-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => form.reset()}
                    data-testid="button-cancel"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitMutation.isPending}
                    data-testid="button-submit"
                  >
                    {submitMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    Enviar Solicitud
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
