import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { FileCheck2, ShieldCheck, FileSpreadsheet, LockKeyhole } from "lucide-react";
import { motion } from "framer-motion";

export function Landing() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background Image / Effects */}
      <div className="absolute inset-0 z-0">
        <img 
          src={`${import.meta.env.BASE_URL}images/hero-bg.png`} 
          alt="Hero abstract background" 
          className="w-full h-full object-cover opacity-20 mix-blend-screen"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-24">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center max-w-4xl mx-auto"
        >
          <div className="inline-flex items-center space-x-2 bg-card border border-white/10 rounded-full px-4 py-1.5 mb-8">
            <span className="flex h-2 w-2 rounded-full bg-accent animate-pulse"></span>
            <span className="text-sm font-medium text-muted-foreground">Enterprise AEC Software</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-display font-bold text-white mb-8 leading-tight">
            {t('landing.hero.title')}
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed">
            {t('landing.hero.subtitle')}
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="w-full sm:w-auto text-lg px-8">
                {t('landing.hero.cta')}
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg px-8">
                {t('auth.login')}
              </Button>
            </Link>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="mt-32 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
        >
          <FeatureCard 
            icon={<FileCheck2 className="w-8 h-8 text-primary" />}
            title={t('landing.features.naming')}
            desc={t('landing.features.namingDesc')}
          />
          <FeatureCard 
            icon={<ShieldCheck className="w-8 h-8 text-accent" />}
            title={t('landing.features.audit')}
            desc={t('landing.features.auditDesc')}
          />
          <FeatureCard 
            icon={<FileSpreadsheet className="w-8 h-8 text-primary" />}
            title={t('landing.features.rfi')}
            desc={t('landing.features.rfiDesc')}
          />
          <FeatureCard 
            icon={<LockKeyhole className="w-8 h-8 text-accent" />}
            title="Role-Based Security"
            desc="Granular permissions ensuring the right access for every team member."
          />
        </motion.div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="glass-panel rounded-2xl p-8 hover:-translate-y-1 transition-transform duration-300">
      <div className="w-16 h-16 rounded-xl bg-background/50 border border-white/5 flex items-center justify-center mb-6">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-white mb-3 font-display">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}
