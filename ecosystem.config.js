module.exports = {
  apps : [{
    name      : 'uap-immo',
    script    : './server.js',
    instances : 1, // Garde un seul processus
    exec_mode : 'fork', 
    watch     : true, // Conserve votre réglage 'watch'
    ignore_watch: ['public/uploads'], // Conserve votre réglage 'ignore_watch'
    
    // VARIABLES D'ENVIRONNEMENT DE PRODUCTION
    env: {
      NODE_ENV: 'production',
      PORT: 8080,
      
      // 🔑 1. CONFIGURATION SMTP (EXPÉDITEUR)
      // Utilisé pour se connecter à IONOS (expéditeur de tous les mails)
      EMAIL_USER: 'contact@uap.immo',
      EMAIL_PASS: '29_Vpa17$', // <== ⚠️ REMPLACEZ CECI PAR VOTRE MOT DE PASSE RÉEL IONOS ⚠️
      
      // 🔑 2. ADRESSE DE RÉCEPTION DES ALERTES ADMIN
      // L'adresse où les notifications d'inscription/commande seront envoyées.
      ADMIN_RECEIVER_EMAIL: 'info@uap.company',
      
     
    }
  }]
};
