module.exports = {
  apps: [
    {
      name: 'uap-immo',
      script: './server.js',  // Le fichier qui démarre ton serveur
      watch: true,  // Activer la surveillance des fichiers
      ignore_watch: ['public/uploads'],  // Ignorer les changements dans ce répertoire
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
