const manager = new NlpManager({ languages: ['fr'], forceNER: true, nlu: { log: false } });

async function trainChatbot() {
    console.log('🧠 Démarrage du module Chatbot...');

    // 1. SUPPRESSION AUTOMATIQUE DE L'ANCIEN CERVEAU
    // Cela force le bot à apprendre les nouvelles phrases à chaque redémarrage
    const modelPath = path.join(__dirname, '../model.nlp');
    if (fs.existsSync(modelPath)) {
        fs.unlinkSync(modelPath);
        console.log('🗑️ Ancien modèle supprimé pour mise à jour.');
    }

    // 2. ENTRAÎNEMENT
    console.log('📚 Apprentissage des nouvelles phrases...');

    // --- INTENTION : SALUTATIONS ---
    manager.addDocument('fr', 'bonjour', 'greetings.hello');
    manager.addDocument('fr', 'salut', 'greetings.hello');
    manager.addDocument('fr', 'coucou', 'greetings.hello');
    manager.addAnswer('fr', 'greetings.hello', 'Bonjour ! Je suis l\'assistant UAP.');

    // --- INTENTION : CRÉATION D'ANNONCE (Celle qui posait problème) ---
    manager.addDocument('fr', 'comment créer une annonce', 'property.create');
    manager.addDocument('fr', 'créer annonce', 'property.create');
    manager.addDocument('fr', 'ajouter une propriété', 'property.create');
    manager.addDocument('fr', 'je veux vendre', 'property.create');
    manager.addDocument('fr', 'publier un bien', 'property.create');
    manager.addDocument('fr', 'mise en ligne', 'property.create');
    manager.addDocument('fr', 'nouvelle annonce', 'property.create');
    manager.addDocument('fr', 'je veux ajouter un bien', 'property.create');
    
    // Pas de réponse texte ici, car le serveur gère l'action (bouton)

    // --- INTENTION : COMMANDES ---
    manager.addDocument('fr', 'mes commandes', 'order.status');
    manager.addDocument('fr', 'voir mes achats', 'order.status');
    manager.addDocument('fr', 'statut commande', 'order.status');
    manager.addDocument('fr', 'suivi commande', 'order.status');

    // --- INTENTION : MOT DE PASSE ---
    manager.addDocument('fr', 'mot de passe oublié', 'account.password');
    manager.addDocument('fr', 'changer mot de passe', 'account.password');

    // --- INTENTION : AIDE ---
    manager.addDocument('fr', 'aide', 'agent.help');
    manager.addDocument('fr', 'help', 'agent.help');
    manager.addAnswer('fr', 'agent.help', 'Je peux vous aider sur vos commandes, votre compte ou la création d\'annonce.');

    await manager.train();
    manager.save();
    console.log('🚀 Chatbot mis à jour et prêt !');
}

module.exports = { manager, trainChatbot };
