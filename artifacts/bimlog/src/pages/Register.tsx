import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/store/auth";
import { useRegister } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Hexagon, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Minimum 6 characters"),
  fullName: z.string().min(2, "Name required"),
  companyName: z.string().min(2, "Company required"),
});

export function Register() {
  const { t } = useI18n();
  const [, setLocation] = useLocation();
  const { setAuth } = useAuthStore();
  const { toast } = useToast();
  
  const { mutate: register, isPending } = useRegister({
    mutation: {
      onSuccess: (data) => {
        setAuth(data.token, data.user);
        toast({ title: t('common.success') });
        setLocation("/dashboard");
      },
      onError: (error) => {
        toast({ 
          title: t('common.error'), 
          description: error.response?.data?.error || "Registration failed",
          variant: "destructive" 
        });
      }
    }
  });

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "", fullName: "", companyName: "" },
  });

  const onSubmit = (data: z.infer<typeof registerSchema>) => {
    register({ data });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="sm:mx-auto sm:w-full sm:max-w-md"
      >
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
            <Hexagon className="w-8 h-8 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-display font-bold text-white">
          {t('auth.register')}
        </h2>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mt-8 sm:mx-auto sm:w-full sm:max-w-md"
      >
        <div className="glass-panel py-8 px-4 shadow sm:rounded-2xl sm:px-10">
          <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
            
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                {t('auth.fullName')}
              </label>
              <Input {...form.register("fullName")} />
              {form.formState.errors.fullName && (
                <p className="text-destructive text-sm mt-1">{form.formState.errors.fullName.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                {t('auth.companyName')}
              </label>
              <Input {...form.register("companyName")} />
              {form.formState.errors.companyName && (
                <p className="text-destructive text-sm mt-1">{form.formState.errors.companyName.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                {t('auth.email')}
              </label>
              <Input {...form.register("email")} type="email" />
              {form.formState.errors.email && (
                <p className="text-destructive text-sm mt-1">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                {t('auth.password')}
              </label>
              <Input {...form.register("password")} type="password" />
              {form.formState.errors.password && (
                <p className="text-destructive text-sm mt-1">{form.formState.errors.password.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full mt-2" disabled={isPending}>
              {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : t('auth.register')}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t('auth.hasAccount')}{' '}
              <Link href="/login" className="font-medium text-primary hover:text-primary/80 transition-colors">
                {t('auth.login')}
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
